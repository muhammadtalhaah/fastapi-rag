from bson import ObjectId
from pymongo.database import Database
from models.user import (
    DEFAULT_SETTINGS,
    UserCreate,
    UserProfileUpdate,
    UserSettingsUpdate,
    UserUpdate,
)
from services import avatar_service, security

# Resolved defaults for the editable profile fields, applied over whatever is
# (or isn't) stored so the client always gets a complete object.
DEFAULT_PROFILE = {"nickname": "", "work": "", "instructions": ""}


def _public(doc: dict) -> dict:
    """Normalize a raw user document for safe exposure.

    Converts `_id` -> `id` and strips `hashed_password` so the password hash can
    never leak through any code path that returns a user dict.
    """
    doc["id"] = str(doc.pop("_id"))
    doc.pop("hashed_password", None)
    return doc


def create_user(db: Database, data: UserCreate) -> dict:
    result = db.users.insert_one(data.model_dump())
    return {"id": str(result.inserted_id), **data.model_dump()}


def create_user_with_password(db: Database, name: str, email: str, password: str) -> dict:
    """Create an auth-enabled user. Stores ONLY the bcrypt hash, never plaintext.

    Relies on the unique index on `email` (see db/indexes.py) to reject
    duplicates atomically; callers should catch DuplicateKeyError / pre-check.
    """
    doc = {
        "name": name,
        "email": email,
        "hashed_password": security.hash_password(password),
    }
    result = db.users.insert_one(doc)
    return {"id": str(result.inserted_id), "name": name, "email": email}


def get_or_create_oauth_user(
    db: Database, *, provider: str, provider_sub: str, email: str, name: str
) -> dict:
    """Resolve the local account for an OAuth login, creating it if needed.

    Account linking is by EMAIL (per product decision): a Google login for an
    email that already exists signs into that existing account and stamps the
    provider info onto it. This trusts that the provider (Google) verified the
    email — which it does for the openid/email scope.

    `provider_sub` is the provider's stable user id (Google's `sub` claim); we
    store it as `google_id` for traceability and so future logins can match on
    the immutable id even if the user later changes their Google email.
    """
    existing = db.users.find_one({"email": email})
    if existing:
        # Link: ensure the provider fields are present on the existing account.
        db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"auth_provider": provider, "google_id": provider_sub}},
        )
        return {"id": str(existing["_id"]), "name": existing.get("name", name), "email": email}

    # No account yet — create one. OAuth users have no password (hashed_password
    # is absent), so password login is simply unavailable for them until/unless
    # they set one.
    doc = {
        "name": name,
        "email": email,
        "auth_provider": provider,
        "google_id": provider_sub,
    }
    result = db.users.insert_one(doc)
    return {"id": str(result.inserted_id), "name": name, "email": email}


def get_user(db: Database, user_id: str) -> dict | None:
    try:
        doc = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        # Malformed ObjectId -> treat as "not found" rather than 500.
        return None
    return _public(doc) if doc else None


def get_user_by_email(db: Database, email: str) -> dict | None:
    """Return the raw user document (INCLUDING hashed_password) for auth checks.

    This is the one place the hash is intentionally returned — the auth service
    needs it to verify the password. Do NOT pass this dict straight into an HTTP
    response; use the fields you need (id/name/email) explicitly.
    """
    return db.users.find_one({"email": email})


def list_users(db: Database) -> list[dict]:
    return [_public(doc) for doc in db.users.find()]


def update_user(db: Database, user_id: str, data: UserUpdate) -> dict | None:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    return get_user(db, user_id)


def delete_user(db: Database, user_id: str) -> bool:
    result = db.users.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count == 1


def get_user_settings(db: Database, user_id: str) -> dict | None:
    """Return the user's resolved settings, or None if the user doesn't exist.

    Stored settings are merged over DEFAULT_SETTINGS so the client always gets a
    complete object — accounts created before this feature (no `settings` field)
    and users who've only set some keys both come back fully populated.
    """
    try:
        doc = db.users.find_one({"_id": ObjectId(user_id)}, {"settings": 1})
    except Exception:
        # Malformed ObjectId -> treat as "not found" rather than 500.
        return None
    if not doc:
        return None
    return {**DEFAULT_SETTINGS, **(doc.get("settings") or {})}


def update_user_settings(
    db: Database, user_id: str, data: UserSettingsUpdate
) -> dict | None:
    """Merge the provided settings keys into the user's `settings` sub-document.

    Only the keys the client sent (non-None) are written, each under
    `settings.<key>` so a partial update never clobbers the other preferences.
    Returns the full resolved settings, or None if the user doesn't exist.
    """
    updates = {
        f"settings.{k}": v
        for k, v in data.model_dump().items()
        if v is not None
    }
    if updates:
        try:
            result = db.users.update_one(
                {"_id": ObjectId(user_id)}, {"$set": updates}
            )
        except Exception:
            return None
        if result.matched_count == 0:
            return None
    return get_user_settings(db, user_id)


# --- Profile (editable Account-settings fields) ------------------------------

def _profile_from_doc(doc: dict) -> dict:
    """Shape a raw user document into the resolved profile dict the client and
    the chat prompt both consume. Missing fields fall back to DEFAULT_PROFILE."""
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "profile_url": doc.get("profile_url"),
        "nickname": doc.get("nickname", DEFAULT_PROFILE["nickname"]),
        "work": doc.get("work", DEFAULT_PROFILE["work"]),
        "instructions": doc.get("instructions", DEFAULT_PROFILE["instructions"]),
    }


def get_user_profile(db: Database, user_id: str) -> dict | None:
    """Return the user's resolved profile, or None if the user doesn't exist."""
    try:
        doc = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None
    return _profile_from_doc(doc) if doc else None


def update_user_profile(
    db: Database, user_id: str, data: UserProfileUpdate
) -> dict | None:
    """Merge the provided profile keys (name/nickname/work/instructions) into the
    user document. Only non-None keys are written, so a single-field save never
    clobbers the others. Returns the full resolved profile, or None if missing."""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        try:
            result = db.users.update_one(
                {"_id": ObjectId(user_id)}, {"$set": updates}
            )
        except Exception:
            return None
        if result.matched_count == 0:
            return None
    return get_user_profile(db, user_id)


def shuffle_avatar(db: Database, user_id: str) -> dict | None:
    """Assign the user a fresh random avatar URL and persist it. Returns the full
    resolved profile (with the new profile_url), or None if the user is gone."""
    url = avatar_service.random_avatar_url()
    try:
        result = db.users.update_one(
            {"_id": ObjectId(user_id)}, {"$set": {"profile_url": url}}
        )
    except Exception:
        return None
    if result.matched_count == 0:
        return None
    return get_user_profile(db, user_id)
