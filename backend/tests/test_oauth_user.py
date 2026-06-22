"""Tests for OAuth user resolution (link-by-email + create)."""
from services import user_service


def test_oauth_creates_new_user(db):
    user = user_service.get_or_create_oauth_user(
        db, provider="google", provider_sub="g-123", email="new@example.com", name="New"
    )
    assert user["email"] == "new@example.com"
    assert user["name"] == "New"
    stored = db.users.find_one({"email": "new@example.com"})
    assert stored["auth_provider"] == "google"
    assert stored["google_id"] == "g-123"
    # OAuth users have no password.
    assert "hashed_password" not in stored


def test_oauth_links_to_existing_password_account(db):
    # A password account exists for this email...
    created = user_service.create_user_with_password(
        db, "Ada", "ada@example.com", "supersecret1"
    )
    # ...and a Google login for the same email signs into THAT account.
    user = user_service.get_or_create_oauth_user(
        db, provider="google", provider_sub="g-999", email="ada@example.com", name="Ada G"
    )
    assert user["id"] == created["id"]  # same account, not a duplicate
    assert db.users.count_documents({"email": "ada@example.com"}) == 1

    stored = db.users.find_one({"email": "ada@example.com"})
    assert stored["auth_provider"] == "google"
    assert stored["google_id"] == "g-999"
    # Password is preserved — the user keeps both login methods.
    assert "hashed_password" in stored


def test_oauth_idempotent_on_repeat_login(db):
    first = user_service.get_or_create_oauth_user(
        db, provider="google", provider_sub="g-1", email="x@example.com", name="X"
    )
    second = user_service.get_or_create_oauth_user(
        db, provider="google", provider_sub="g-1", email="x@example.com", name="X"
    )
    assert first["id"] == second["id"]
    assert db.users.count_documents({"email": "x@example.com"}) == 1
