"""
Authentication & session configuration.

Flat module-level constants loaded from environment variables / the project
``.env`` file. ``settings`` is a SimpleNamespace that exposes every constant
as an attribute so all ``settings.<attr>`` call-sites work without modification.
"""
import os
import types
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ENV_FILE, override=False)


# ---------------------------------------------------------------------------
# Helpers — read typed values from the environment
# ---------------------------------------------------------------------------

def _bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off")


def _int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    return int(raw) if raw is not None else default


def _str(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _str_or_none(key: str) -> str | None:
    return os.environ.get(key) or None


def _list(key: str, default: list[str]) -> list[str]:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Cookie names
# ---------------------------------------------------------------------------
session_cookie_name: str = _str("SESSION_COOKIE_NAME", "session_id")
csrf_cookie_name: str = _str("CSRF_COOKIE_NAME", "csrf_token")

# ---------------------------------------------------------------------------
# Session lifetime
# ---------------------------------------------------------------------------
session_ttl_seconds: int = _int("SESSION_TTL_SECONDS", 86_400)
# Sliding window: every successful validation pushes expires_at forward.
session_sliding: bool = _bool("SESSION_SLIDING", True)

# ---------------------------------------------------------------------------
# Cookie security flags
# HttpOnly is always enforced in code — JS must never read the session id.
# ---------------------------------------------------------------------------
cookie_secure: bool = _bool("COOKIE_SECURE", True)
cookie_samesite: Literal["lax", "strict", "none"] = _str("COOKIE_SAMESITE", "lax")  # type: ignore[assignment]
cookie_domain: str | None = _str_or_none("COOKIE_DOMAIN")
cookie_path: str = _str("COOKIE_PATH", "/")

# ---------------------------------------------------------------------------
# Brute-force / lockout
# ---------------------------------------------------------------------------
login_max_attempts: int = _int("LOGIN_MAX_ATTEMPTS", 5)
login_lockout_seconds: int = _int("LOGIN_LOCKOUT_SECONDS", 900)
# Failed-attempt records are TTL-expired after this many seconds of inactivity.
login_attempt_ttl_seconds: int = _int("LOGIN_ATTEMPT_TTL_SECONDS", 3_600)

# ---------------------------------------------------------------------------
# Session binding (hijacking mitigation)
# IP binding is off by default — mobile/NAT IPs change mid-session legitimately.
# ---------------------------------------------------------------------------
bind_session_to_user_agent: bool = _bool("BIND_SESSION_TO_USER_AGENT", True)
bind_session_to_ip: bool = _bool("BIND_SESSION_TO_IP", False)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
cors_allowed_origins: list[str] = _list(
    "CORS_ALLOWED_ORIGINS", ["http://localhost:5173"]
)

# ---------------------------------------------------------------------------
# Password policy
# bcrypt considers only the first 72 bytes; max_length prevents silent truncation.
# ---------------------------------------------------------------------------
password_min_length: int = _int("PASSWORD_MIN_LENGTH", 8)
password_max_length: int = _int("PASSWORD_MAX_LENGTH", 72)

# ---------------------------------------------------------------------------
# Google OAuth (Authorization Code flow)
# Leave client_id/secret empty to disable Google sign-in (routes return 503).
# ---------------------------------------------------------------------------
google_client_id: str = _str("GOOGLE_CLIENT_ID", "")
google_client_secret: str = _str("GOOGLE_CLIENT_SECRET", "")
google_redirect_uri: str = _str(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback"
)
# Where the callback redirects the browser after a successful login (back to the SPA).
oauth_post_login_redirect: str = _str("OAUTH_POST_LOGIN_REDIRECT", "http://localhost:5173/")
# Signs the short-lived OAuth state cookie during the redirect round-trip only.
oauth_state_secret: str = _str("OAUTH_STATE_SECRET", "change-me-dev-only-oauth-state-secret")


# ---------------------------------------------------------------------------
# Derived helpers
# ---------------------------------------------------------------------------

def google_enabled() -> bool:
    return bool(google_client_id and google_client_secret)


# ---------------------------------------------------------------------------
# Compatibility namespace — ``from config import settings; settings.foo``
# keeps working everywhere without touching callers.
# google_enabled is stored as the evaluated bool so ``settings.google_enabled``
# (no call parens) works identically to the former @property.
# ---------------------------------------------------------------------------

settings = types.SimpleNamespace(
    session_cookie_name=session_cookie_name,
    csrf_cookie_name=csrf_cookie_name,
    session_ttl_seconds=session_ttl_seconds,
    session_sliding=session_sliding,
    cookie_secure=cookie_secure,
    cookie_samesite=cookie_samesite,
    cookie_domain=cookie_domain,
    cookie_path=cookie_path,
    login_max_attempts=login_max_attempts,
    login_lockout_seconds=login_lockout_seconds,
    login_attempt_ttl_seconds=login_attempt_ttl_seconds,
    bind_session_to_user_agent=bind_session_to_user_agent,
    bind_session_to_ip=bind_session_to_ip,
    cors_allowed_origins=cors_allowed_origins,
    password_min_length=password_min_length,
    password_max_length=password_max_length,
    google_client_id=google_client_id,
    google_client_secret=google_client_secret,
    google_redirect_uri=google_redirect_uri,
    oauth_post_login_redirect=oauth_post_login_redirect,
    oauth_state_secret=oauth_state_secret,
    google_enabled=google_enabled(),
)

# Kept for the ``from config.settings import AuthSettings`` import in __init__.py.
AuthSettings = type(settings)
