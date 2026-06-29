"""
MongoDB index setup for the auth/session system.

Called once at startup (from the lifespan handler). Index creation is idempotent
— Mongo ignores `create_index` calls for indexes that already exist with the
same spec — so running this on every boot is safe and cheap.
"""
import logging

from pymongo import ASCENDING, DESCENDING, TEXT
from pymongo.database import Database

from config import settings

logger = logging.getLogger(__name__)


def ensure_indexes(db: Database) -> None:
    """Create all indexes required by the auth layer. Idempotent."""

    # --- sessions ------------------------------------------------------------
    # Unique lookup key. `session_id` is the SHA-256 hash of the cookie token.
    db.sessions.create_index([("session_id", ASCENDING)], unique=True, name="session_id_unique")
    # Fast "all sessions for this user" lookups (logout-all, listing devices).
    db.sessions.create_index([("user_id", ASCENDING)], name="session_user_id")
    # TTL index: Mongo's background sweeper deletes documents once `expires_at`
    # is in the past (expireAfterSeconds=0 means "expire exactly at that time").
    # This auto-invalidates expired sessions. NOTE: the sweep is lazy (~60s), so
    # the service ALSO checks expires_at on every validation — the TTL index is
    # cleanup, not the authoritative expiry guard.
    db.sessions.create_index("expires_at", expireAfterSeconds=0, name="session_ttl")

    # --- login_attempts (brute-force tracking) ------------------------------
    db.login_attempts.create_index([("key", ASCENDING)], unique=True, name="login_attempt_key")
    # TTL cleanup of stale attempt records keyed off last update.
    db.login_attempts.create_index(
        "updated_at",
        expireAfterSeconds=settings.login_attempt_ttl_seconds,
        name="login_attempt_ttl",
    )

    # --- users ---------------------------------------------------------------
    # Email uniqueness is relied on by registration. Enforce it at the DB level
    # so concurrent registrations can't both create the same email (a race the
    # application-level check alone can't close).
    db.users.create_index([("email", ASCENDING)], unique=True, name="user_email_unique")

    # --- conversations (durable per-user chat history) -----------------------
    # The sidebar lists a user's conversations newest-first; this compound index
    # serves that "by user, sorted by recency" query directly.
    db.conversations.create_index(
        [("user_id", ASCENDING), ("updated_at", DESCENDING)],
        name="conversation_user_recent",
    )
    # Pinning sorts pinned conversations above unpinned ones, then by recency
    # within each group. This compound index backs that "by user, pinned-first,
    # then newest-first" sidebar query.
    db.conversations.create_index(
        [("user_id", ASCENDING), ("pinned", DESCENDING), ("updated_at", DESCENDING)],
        name="conversation_user_pinned_recent",
    )
    # Full-text search over the sidebar "search history" feature: a single text
    # index spanning the title and every message body. Weighting the title higher
    # than message text makes a title hit rank above an incidental body mention,
    # which matches what users expect when searching their own threads. The query
    # always pins user_id first (an equality filter Mongo can use the text index's
    # implicit scoping for), so results never cross users.
    db.conversations.create_index(
        [("title", TEXT), ("messages.text", TEXT)],
        weights={"title": 10, "messages.text": 2},
        name="conversation_fulltext",
    )

    logger.info("[indexes] Indexes ensured (sessions, login_attempts, users, conversations)")
