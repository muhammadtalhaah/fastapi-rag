"""
Reusable FastAPI auth dependencies.

Drop `Depends(get_current_user)` on any route to require authentication, or
`Depends(require_csrf)` on any state-changing route to enforce the CSRF
synchronizer-token check. These are the single source of truth for "who is the
caller" and "is this request CSRF-safe", so the rules live in exactly one place.
"""
import logging

from fastapi import Depends, HTTPException, Request, status
from pymongo.database import Database

import db.connection as db_connection
from config import settings
from services import auth_session_service, security, user_service

logger = logging.getLogger(__name__)

# Methods that don't change state — exempt from CSRF (they're safe by definition
# and GET requests can be triggered cross-site without a body/header).
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def get_db() -> Database:
    """Resolve the app database. Mirrors the per-router get_db() pattern so the
    dependency works the same way the rest of the codebase accesses Mongo."""
    return db_connection.client["rag_db"]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")


def _raw_session_id(request: Request) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def get_current_user(request: Request, db: Database = Depends(get_db)) -> dict:
    """Return the authenticated user dict, or raise 401.

    Reads the session cookie, validates the session (revoked/expiry/binding),
    then loads the user. Any failure -> 401 with a generic message (we don't
    distinguish "no cookie" from "bad session" to avoid leaking state).
    """
    raw_session_id = _raw_session_id(request)
    session = auth_session_service.validate_session(
        db, raw_session_id or "", _client_ip(request), _user_agent(request)
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Cookie"},
        )

    user = user_service.get_user(db, session["user_id"])
    if not user:
        # Session points at a deleted user — revoke and reject.
        auth_session_service.revoke_session(db, raw_session_id or "")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def get_optional_user(request: Request, db: Database = Depends(get_db)) -> dict | None:
    """Like get_current_user but returns None instead of raising — for routes
    that behave differently for anonymous vs. authenticated callers."""
    raw_session_id = _raw_session_id(request)
    session = auth_session_service.validate_session(
        db, raw_session_id or "", _client_ip(request), _user_agent(request)
    )
    if not session:
        return None
    return user_service.get_user(db, session["user_id"])


def require_csrf(request: Request, db: Database = Depends(get_db)) -> None:
    """Enforce the CSRF synchronizer-token check on state-changing requests.

    The client must echo the per-session CSRF token (issued at login, also set as
    a readable cookie) in the `X-CSRF-Token` header. We compare it against the
    token stored server-side in the session using a constant-time comparison.
    Because the attacker's forged cross-site request cannot read the victim's
    token (it's tied to the session and not auto-sent like a cookie), this blocks
    CSRF even if SameSite is bypassed.
    """
    if request.method in _SAFE_METHODS:
        return

    raw_session_id = _raw_session_id(request)
    expected = auth_session_service.get_session_csrf(db, raw_session_id or "")
    provided = request.headers.get("x-csrf-token", "")

    if not expected or not provided or not security.tokens_equal(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )
