"""
Session lifecycle + brute-force protection service.

Named `auth_session_service` to avoid colliding with the pre-existing
`session_service` (which handles RAG *conversation* history, unrelated to auth).

Design notes:
- Synchronous PyMongo, `db: Database` first arg — matches the rest of the codebase.
- Functions are free of FastAPI types so they are unit-testable with mongomock.
- The RAW session id is only ever returned to the caller (to put in a cookie);
  what's stored is its SHA-256 hash (see security.hash_session_id).
- All datetimes are timezone-aware UTC. The TTL index needs naive-or-aware
  consistency; we use aware UTC everywhere.
"""
import logging
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.database import Database

from config import settings
from services import security

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

def create_session(db: Database, user_id: str, ip_address: str, user_agent: str) -> tuple[str, str]:
    """Create a fresh session for a user. Returns (raw_session_id, csrf_token).

    SESSION FIXATION DEFENSE: this always mints a brand-new random session id.
    Login must call this (never reuse a pre-auth id), so an attacker who fixed a
    victim's pre-login cookie gains nothing.

    Supports multiple concurrent sessions per user — we never delete a user's
    other sessions here.
    """
    raw_session_id = security.generate_session_id()
    csrf_token = security.generate_csrf_token()
    now = _now()
    expires_at = now + timedelta(seconds=settings.session_ttl_seconds)

    db.sessions.insert_one({
        # Store the HASH of the token, not the token itself (DB-leak defense).
        "session_id": security.hash_session_id(raw_session_id),
        "user_id": user_id,
        "csrf_token": csrf_token,
        "created_at": now,
        "expires_at": expires_at,
        "last_activity_at": now,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "revoked": False,
    })
    logger.info("[auth-session] created session for user=%s", user_id)
    return raw_session_id, csrf_token


def validate_session(
    db: Database,
    raw_session_id: str,
    ip_address: str,
    user_agent: str,
) -> dict | None:
    """Validate a session id from a cookie. Returns the session doc or None.

    Performs, in order:
      1. lookup by hashed id
      2. revoked check
      3. expiry check (authoritative — TTL purge is only lazy cleanup)
      4. session-binding checks (User-Agent / IP) — HIJACKING defense: a stolen
         cookie replayed from a different client is rejected and the session is
         revoked so the legitimate user is forced to re-auth.
      5. sliding-expiry refresh + last_activity_at bump
    """
    if not raw_session_id:
        return None

    hashed = security.hash_session_id(raw_session_id)
    session = db.sessions.find_one({"session_id": hashed})
    if not session:
        return None

    if session.get("revoked"):
        return None

    # Authoritative expiry check. Compare aware-to-aware; tolerate legacy naive
    # values by assuming UTC.
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= _now():
        return None

    # --- session binding (hijacking mitigation) ---
    if settings.bind_session_to_user_agent and session.get("user_agent") != user_agent:
        logger.warning(
            "[auth-session] user-agent mismatch for user=%s — revoking (possible hijack)",
            session.get("user_id"),
        )
        revoke_session(db, raw_session_id)
        return None
    if settings.bind_session_to_ip and session.get("ip_address") != ip_address:
        logger.warning(
            "[auth-session] ip mismatch for user=%s — revoking (possible hijack)",
            session.get("user_id"),
        )
        revoke_session(db, raw_session_id)
        return None

    # --- sliding expiry + activity bump ---
    now = _now()
    updates = {"last_activity_at": now}
    if settings.session_sliding:
        updates["expires_at"] = now + timedelta(seconds=settings.session_ttl_seconds)
    session = db.sessions.find_one_and_update(
        {"session_id": hashed},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    return session


def rotate_session(
    db: Database,
    raw_session_id: str,
    ip_address: str,
    user_agent: str,
) -> tuple[str, str] | None:
    """Issue a new session id (and CSRF token) for an existing session, revoking
    the old one. Returns (new_raw_session_id, new_csrf_token) or None.

    This is the reusable anti-fixation / refresh primitive: rotating the id on a
    privilege change or periodic refresh limits the window a leaked id is useful.
    """
    session = validate_session(db, raw_session_id, ip_address, user_agent)
    if not session:
        return None
    user_id = session["user_id"]
    # Revoke the old session, then mint a new one.
    revoke_session(db, raw_session_id)
    return create_session(db, user_id, ip_address, user_agent)


def revoke_session(db: Database, raw_session_id: str) -> bool:
    """Revoke (mark) a single session. Returns True if one was modified."""
    if not raw_session_id:
        return False
    result = db.sessions.update_one(
        {"session_id": security.hash_session_id(raw_session_id)},
        {"$set": {"revoked": True}},
    )
    return result.modified_count == 1


def revoke_all_for_user(db: Database, user_id: str) -> int:
    """Revoke every session for a user (logout-from-all-devices). Returns count."""
    result = db.sessions.update_many(
        {"user_id": user_id, "revoked": False},
        {"$set": {"revoked": True}},
    )
    logger.info("[auth-session] revoked %d sessions for user=%s", result.modified_count, user_id)
    return result.modified_count


def get_session_csrf(db: Database, raw_session_id: str) -> str | None:
    """Fetch the CSRF token stored in a session (for synchronizer-token checks)."""
    if not raw_session_id:
        return None
    session = db.sessions.find_one({"session_id": security.hash_session_id(raw_session_id)})
    if not session or session.get("revoked"):
        return None
    return session.get("csrf_token")


# ---------------------------------------------------------------------------
# Brute-force protection (DB-backed, survives restarts & multiple workers)
# ---------------------------------------------------------------------------

def is_locked(db: Database, key: str) -> bool:
    """Return True if `key` (e.g. "email:foo@bar" / "ip:1.2.3.4") is locked out."""
    record = db.login_attempts.find_one({"key": key})
    if not record:
        return False
    locked_until = record.get("locked_until")
    if not locked_until:
        return False
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    return locked_until > _now()


def register_failed_attempt(db: Database, key: str) -> None:
    """Record a failed login. Locks the key once it hits the configured max.

    Uses an atomic upsert+increment so concurrent failed logins can't undercount.
    """
    now = _now()
    record = db.login_attempts.find_one_and_update(
        {"key": key},
        {
            "$inc": {"failed_count": 1},
            "$set": {"updated_at": now},
            "$setOnInsert": {"first_failed_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if record["failed_count"] >= settings.login_max_attempts:
        locked_until = now + timedelta(seconds=settings.login_lockout_seconds)
        db.login_attempts.update_one(
            {"key": key},
            {"$set": {"locked_until": locked_until, "updated_at": now}},
        )
        logger.warning("[auth-bruteforce] key=%s locked until %s", key, locked_until)


def clear_attempts(db: Database, key: str) -> None:
    """Clear the failed-attempt record for a key (call on successful login)."""
    db.login_attempts.delete_one({"key": key})
