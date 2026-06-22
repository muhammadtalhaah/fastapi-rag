"""Pydantic models describing session records.

`SessionRecord` documents the shape of a `sessions` collection document (the
service layer works with plain dicts to match the existing codebase style, but
this model serves as the authoritative schema reference and can validate docs in
tests). `SessionInfo` is the safe, client-facing projection.
"""
from datetime import datetime

from pydantic import BaseModel


class SessionRecord(BaseModel):
    """Internal shape of a document in the `sessions` collection.

    Note: `session_id` here is the SHA-256 HASH of the raw token sent to the
    client, never the raw token itself.
    """

    session_id: str  # SHA-256 hash of the raw session id (not the cookie value)
    user_id: str
    csrf_token: str  # synchronizer token, validated against X-CSRF-Token header
    created_at: datetime
    expires_at: datetime
    last_activity_at: datetime
    ip_address: str
    user_agent: str
    revoked: bool = False


class SessionInfo(BaseModel):
    """Safe projection of a session for listing a user's active sessions.

    Deliberately omits `session_id` (the hash) and `csrf_token`.
    """

    user_id: str
    created_at: datetime
    expires_at: datetime
    last_activity_at: datetime
    ip_address: str
    user_agent: str
    revoked: bool
