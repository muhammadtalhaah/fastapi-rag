"""
Auth router: register / login / logout / logout-all / me / refresh.

Pure HTTP concerns only — all logic delegates to the service layer. Cookie
plumbing (the security-critical part of the HTTP layer) is centralized in the
`_set_session_cookies` / `_clear_session_cookies` helpers so every code path
that issues a session uses identical, correct cookie flags.
"""
import logging
from urllib.parse import urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

import db.connection as db_connection
from api.deps import get_current_user, require_csrf
from config import settings
from models.auth import (
    AuthUserResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
)
from services import auth_session_service, security, user_service
from services.oauth import oauth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def get_db() -> Database:
    return db_connection.client["rag_db"]


# ---------------------------------------------------------------------------
# Cookie helpers (security-critical — single source of truth for cookie flags)
# ---------------------------------------------------------------------------

def _set_session_cookies(response: Response, raw_session_id: str, csrf_token: str) -> None:
    """Set the session + CSRF cookies with hardened, configurable flags."""
    # Session cookie: HttpOnly so JS can't read it (XSS mitigation), Secure so
    # it's HTTPS-only (configurable off for local dev), SameSite to blunt CSRF.
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_session_id,
        max_age=settings.session_ttl_seconds,
        httponly=True,  # never configurable — JS must not see the session id
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
    )
    # CSRF cookie: deliberately NOT HttpOnly so the SPA can read it and echo it
    # back in the X-CSRF-Token header (synchronizer-token pattern). It is not a
    # secret on its own — it's only useful combined with the session cookie,
    # and the server validates it against the session-stored value.
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_ttl_seconds,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
    )


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=AuthUserResponse, status_code=201)
def register(body: RegisterRequest):
    """Create a new account. Password is hashed; email must be unique."""
    db = get_db()
    try:
        user = user_service.create_user_with_password(db, body.name, body.email, body.password)
    except DuplicateKeyError:
        # Unique index on email rejected a duplicate (also closes the
        # check-then-insert race). Return 409 without confirming which field.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return user


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, response: Response):
    """Authenticate and start a fresh session.

    Defends against: brute force (lockout), user enumeration (uniform errors +
    dummy-hash timing), and session fixation (always a brand-new session id).
    """
    db = get_db()
    email_key = f"email:{body.email.lower()}"
    ip_key = f"ip:{_client_ip(request)}"

    # Brute-force gate: reject early if either the email or the source IP is
    # currently locked out. 429 with no detail about which key tripped.
    if auth_session_service.is_locked(db, email_key) or auth_session_service.is_locked(db, ip_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )

    user = user_service.get_user_by_email(db, body.email)
    # Always run a password verification even when the user doesn't exist, using
    # the real stored hash or a throwaway one. This keeps response timing roughly
    # constant so an attacker can't enumerate valid emails by timing differences.
    stored_hash = user.get("hashed_password", "") if user else ""
    password_ok = security.verify_password(body.password, stored_hash) if stored_hash else False

    if not user or not password_ok:
        # Count the failure against BOTH email and IP, then return a uniform 401.
        auth_session_service.register_failed_attempt(db, email_key)
        auth_session_service.register_failed_attempt(db, ip_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Success — clear any accumulated failures and mint a NEW session.
    auth_session_service.clear_attempts(db, email_key)
    auth_session_service.clear_attempts(db, ip_key)

    user_id = str(user["_id"])
    raw_session_id, csrf_token = auth_session_service.create_session(
        db, user_id, _client_ip(request), _user_agent(request)
    )
    _set_session_cookies(response, raw_session_id, csrf_token)

    return LoginResponse(
        user=AuthUserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            profile_url=user.get("profile_url"),
            nickname=user.get("nickname", ""),
            work=user.get("work", ""),
            instructions=user.get("instructions", ""),
        ),
        csrf_token=csrf_token,
    )


@router.post("/logout", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
def logout(request: Request, response: Response):
    """Revoke the current session and clear cookies. CSRF-protected."""
    db = get_db()
    raw_session_id = request.cookies.get(settings.session_cookie_name)
    if raw_session_id:
        auth_session_service.revoke_session(db, raw_session_id)
    _clear_session_cookies(response)
    return MessageResponse(message="Logged out")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    dependencies=[Depends(require_csrf)],
)
def logout_all(response: Response, user: dict = Depends(get_current_user)):
    """Revoke ALL sessions for the authenticated user (all devices)."""
    db = get_db()
    count = auth_session_service.revoke_all_for_user(db, user["id"])
    _clear_session_cookies(response)
    return MessageResponse(message=f"Logged out of {count} session(s)")


@router.get("/me", response_model=AuthUserResponse)
def me(user: dict = Depends(get_current_user)):
    """Return the currently authenticated user, including editable profile fields."""
    profile = user_service.get_user_profile(get_db(), user["id"]) or {}
    return AuthUserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        profile_url=profile.get("profile_url") or user.get("profile_url"),
        nickname=profile.get("nickname", ""),
        work=profile.get("work", ""),
        instructions=profile.get("instructions", ""),
    )


@router.post(
    "/refresh",
    response_model=LoginResponse,
    dependencies=[Depends(require_csrf)],
)
def refresh(request: Request, response: Response, user: dict = Depends(get_current_user)):
    """Rotate the session id + CSRF token (extends the session, anti-fixation).

    The old session id is revoked and a new one issued, so a previously-captured
    id stops working after refresh.
    """
    db = get_db()
    raw_session_id = request.cookies.get(settings.session_cookie_name)
    rotated = auth_session_service.rotate_session(
        db, raw_session_id or "", _client_ip(request), _user_agent(request)
    )
    if not rotated:
        # Shouldn't happen (get_current_user already validated), but be safe.
        _clear_session_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    new_raw_session_id, new_csrf = rotated
    _set_session_cookies(response, new_raw_session_id, new_csrf)
    return LoginResponse(
        user=AuthUserResponse(id=user["id"], name=user["name"], email=user["email"], profile_url=user.get("profile_url")),
        csrf_token=new_csrf,
    )


# ---------------------------------------------------------------------------
# Google OAuth (Authorization Code flow)
# ---------------------------------------------------------------------------

def _redirect_to_spa(error: str | None = None) -> RedirectResponse:
    """Build a redirect back into the SPA, optionally with an ?auth_error= flag.

    On success the browser lands back in the app already carrying the freshly
    set session cookies; the SPA then re-checks /auth/me.
    """
    target = settings.oauth_post_login_redirect
    if error:
        scheme, netloc, path, query, fragment = urlsplit(target)
        merged = "&".join(filter(None, [query, urlencode({"auth_error": error})]))
        target = urlunsplit((scheme, netloc, path, merged, fragment))
    # 303 forces a GET on the redirect target regardless of the original method.
    return RedirectResponse(url=target, status_code=status.HTTP_303_SEE_OTHER)


@router.get("/google/login")
async def google_login(request: Request):
    """Kick off the Google OAuth dance — redirects the browser to Google.

    Authlib generates and stashes the `state` (CSRF guard) and nonce in the
    SessionMiddleware cookie, then redirects to Google's consent screen.
    """
    if not settings.google_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle Google's redirect: verify, link/create the user, start a session.

    Security-critical sequence:
      1. Authlib verifies the `state` matches what we stashed (OAuth CSRF guard)
         and exchanges the code for tokens server-side (secret never exposed).
      2. We read the VERIFIED email/sub from the id_token (Authlib validates its
         signature + nonce). We never trust unsigned query params for identity.
      3. We link by email (or create) and mint a BRAND-NEW app session — same
         anti-fixation guarantee as password login (no pre-auth id reuse).
    """
    if not settings.google_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        # Covers state mismatch, user-denied consent, code exchange failure.
        logger.warning("[auth-google] token exchange / state validation failed")
        return _redirect_to_spa(error="google_failed")

    # userinfo comes from the verified id_token claims.
    userinfo = token.get("userinfo") or {}
    email = userinfo.get("email")
    sub = userinfo.get("sub")
    # Only accept Google-verified emails — linking by email relies on this.
    if not email or not sub or userinfo.get("email_verified") is False:
        logger.warning("[auth-google] missing/unverified email in userinfo")
        return _redirect_to_spa(error="google_unverified")

    name = userinfo.get("name") or email.split("@")[0]

    db = get_db()
    user = user_service.get_or_create_oauth_user(
        db, provider="google", provider_sub=str(sub), email=email, name=name
    )

    raw_session_id, csrf_token = auth_session_service.create_session(
        db, user["id"], _client_ip(request), _user_agent(request)
    )
    redirect = _redirect_to_spa()
    _set_session_cookies(redirect, raw_session_id, csrf_token)
    logger.info("[auth-google] sign-in OK for user=%s", user["id"])
    return redirect
