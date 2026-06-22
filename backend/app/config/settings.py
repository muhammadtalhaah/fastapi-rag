"""
Authentication & session configuration.

Uses Pydantic Settings so every security-relevant knob (cookie flags, session
lifetime, lockout policy, session-binding) is centralized, typed, and overridable
via environment variables / the project ``.env`` file. This keeps the existing
``config/api_keys.py`` untouched — this module is purely additive.
"""
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at backend/.env — two levels up from this file (config/ -> app/ -> backend/).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class AuthSettings(BaseSettings):
    """Security configuration for session-based auth.

    Defaults are production-safe (Secure cookies, SameSite=Lax, UA binding on).
    For local HTTP development set ``COOKIE_SECURE=false`` so the browser will
    actually store the cookie over http://localhost.
    """

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",  # tolerate the many non-auth keys already in .env
    )

    # --- Cookie names --------------------------------------------------------
    session_cookie_name: str = "session_id"
    csrf_cookie_name: str = "csrf_token"

    # --- Session lifetime ----------------------------------------------------
    # Total lifetime of a session, in seconds. Also drives cookie Max-Age and
    # the server-side ``expires_at`` field (the authoritative expiry check).
    session_ttl_seconds: int = 86_400  # 24h
    # If true, every successful validation pushes expires_at forward (sliding
    # window). If false, sessions expire a fixed time after creation.
    session_sliding: bool = True

    # --- Cookie security flags ----------------------------------------------
    # HttpOnly is ALWAYS true (not configurable) — JS must never read the
    # session id. Secure/SameSite are configurable for dev ergonomics.
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None
    cookie_path: str = "/"

    # --- Brute-force / lockout ----------------------------------------------
    login_max_attempts: int = 5
    login_lockout_seconds: int = 900  # 15 min lockout after max attempts
    # Failed-attempt records are TTL-expired after this many seconds of
    # inactivity so the collection stays small.
    login_attempt_ttl_seconds: int = 3_600

    # --- Session binding (hijacking mitigation) -----------------------------
    # Binding to User-Agent is cheap and catches stolen-cookie replay from a
    # different client. IP binding is OFF by default because mobile/NAT IPs
    # legitimately change mid-session and would cause false logouts.
    bind_session_to_user_agent: bool = True
    bind_session_to_ip: bool = False

    # --- Password policy -----------------------------------------------------
    password_min_length: int = 8
    # bcrypt only considers the first 72 bytes; we cap input length explicitly
    # at registration so users aren't silently truncated (see security.py).
    password_max_length: int = 72

    # --- Google OAuth (Authorization Code flow) -----------------------------
    # Obtain these from the Google Cloud Console (APIs & Services -> Credentials
    # -> OAuth 2.0 Client ID, type "Web application"). The redirect URI must be
    # registered there EXACTLY and must point at our /auth/google/callback.
    # Leave the id/secret empty to disable Google sign-in (the endpoints then
    # return 503 instead of crashing).
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Where the callback sends the browser after a successful (or failed) login —
    # i.e. back into the SPA. The frontend then re-checks /auth/me.
    oauth_post_login_redirect: str = "http://localhost:5173/"

    # Secret used by Starlette's SessionMiddleware to sign the short-lived cookie
    # that holds the OAuth `state`/nonce during the redirect round-trip. This is
    # NOT our app session (that's the server-side session store); it only guards
    # the OAuth handshake against CSRF. Override in production with a long random
    # value. MUST be set to something non-empty.
    oauth_state_secret: str = "change-me-dev-only-oauth-state-secret"

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


# Single shared instance — import this everywhere.
settings = AuthSettings()
