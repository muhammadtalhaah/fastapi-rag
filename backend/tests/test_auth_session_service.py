"""Service-layer tests for session lifecycle and brute-force protection."""
from datetime import timedelta

import pytest

from config import settings
from services import auth_session_service as svc
from services import security


def test_create_and_validate_session(db):
    raw_id, csrf = svc.create_session(db, "user1", "1.1.1.1", "UA")
    assert raw_id and csrf
    # Stored doc holds the HASH, never the raw id.
    stored = db.sessions.find_one({"session_id": security.hash_session_id(raw_id)})
    assert stored is not None
    assert stored["session_id"] != raw_id
    assert stored["user_id"] == "user1"

    session = svc.validate_session(db, raw_id, "1.1.1.1", "UA")
    assert session is not None
    assert session["user_id"] == "user1"


def test_validate_rejects_unknown_and_empty(db):
    assert svc.validate_session(db, "", "1.1.1.1", "UA") is None
    assert svc.validate_session(db, "does-not-exist", "1.1.1.1", "UA") is None


def test_validate_rejects_revoked(db):
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    assert svc.revoke_session(db, raw_id) is True
    assert svc.validate_session(db, raw_id, "1.1.1.1", "UA") is None


def test_validate_rejects_expired(db):
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    # Force expiry into the past.
    db.sessions.update_one(
        {"session_id": security.hash_session_id(raw_id)},
        {"$set": {"expires_at": svc._now() - timedelta(seconds=1)}},
    )
    assert svc.validate_session(db, raw_id, "1.1.1.1", "UA") is None


def test_user_agent_binding_rejects_and_revokes(db, monkeypatch):
    monkeypatch.setattr(settings, "bind_session_to_user_agent", True)
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA-original")
    # Different UA -> hijack suspicion -> rejected AND revoked.
    assert svc.validate_session(db, raw_id, "1.1.1.1", "UA-attacker") is None
    stored = db.sessions.find_one({"session_id": security.hash_session_id(raw_id)})
    assert stored["revoked"] is True


def test_ip_binding_optional(db, monkeypatch):
    monkeypatch.setattr(settings, "bind_session_to_ip", True)
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    assert svc.validate_session(db, raw_id, "9.9.9.9", "UA") is None


def test_sliding_expiry_extends(db, monkeypatch):
    monkeypatch.setattr(settings, "session_sliding", True)
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    before = db.sessions.find_one({"session_id": security.hash_session_id(raw_id)})["expires_at"]
    # Pull expiry back so we can observe it being pushed forward on validate.
    db.sessions.update_one(
        {"session_id": security.hash_session_id(raw_id)},
        {"$set": {"expires_at": svc._now() + timedelta(seconds=10)}},
    )
    svc.validate_session(db, raw_id, "1.1.1.1", "UA")
    after = db.sessions.find_one({"session_id": security.hash_session_id(raw_id)})["expires_at"]
    assert after > before - timedelta(seconds=1)  # extended near full TTL again


def test_rotate_issues_new_id_and_revokes_old(db):
    raw_id, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    rotated = svc.rotate_session(db, raw_id, "1.1.1.1", "UA")
    assert rotated is not None
    new_id, new_csrf = rotated
    assert new_id != raw_id
    # Old id no longer validates; new id does.
    assert svc.validate_session(db, raw_id, "1.1.1.1", "UA") is None
    assert svc.validate_session(db, new_id, "1.1.1.1", "UA") is not None


def test_rotate_returns_none_for_invalid(db):
    assert svc.rotate_session(db, "bogus", "1.1.1.1", "UA") is None


def test_concurrent_sessions_supported(db):
    a, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    b, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    assert a != b
    assert svc.validate_session(db, a, "1.1.1.1", "UA") is not None
    assert svc.validate_session(db, b, "1.1.1.1", "UA") is not None


def test_revoke_all_for_user(db):
    a, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    b, _ = svc.create_session(db, "user1", "1.1.1.1", "UA")
    other, _ = svc.create_session(db, "user2", "1.1.1.1", "UA")
    count = svc.revoke_all_for_user(db, "user1")
    assert count == 2
    assert svc.validate_session(db, a, "1.1.1.1", "UA") is None
    assert svc.validate_session(db, b, "1.1.1.1", "UA") is None
    # Other user's session untouched.
    assert svc.validate_session(db, other, "1.1.1.1", "UA") is not None


def test_get_session_csrf(db):
    raw_id, csrf = svc.create_session(db, "user1", "1.1.1.1", "UA")
    assert svc.get_session_csrf(db, raw_id) == csrf
    svc.revoke_session(db, raw_id)
    assert svc.get_session_csrf(db, raw_id) is None


def test_brute_force_locks_after_max_attempts(db, monkeypatch):
    monkeypatch.setattr(settings, "login_max_attempts", 3)
    key = "email:victim@example.com"
    assert svc.is_locked(db, key) is False
    for _ in range(3):
        svc.register_failed_attempt(db, key)
    assert svc.is_locked(db, key) is True


def test_brute_force_clears_on_success(db, monkeypatch):
    monkeypatch.setattr(settings, "login_max_attempts", 3)
    key = "email:victim@example.com"
    svc.register_failed_attempt(db, key)
    svc.register_failed_attempt(db, key)
    svc.clear_attempts(db, key)
    assert svc.is_locked(db, key) is False
    assert db.login_attempts.find_one({"key": key}) is None
