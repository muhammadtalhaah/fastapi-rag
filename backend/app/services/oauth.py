"""
Google OAuth client (Authorization Code flow) via Authlib.

We let Authlib drive the OAuth dance: it generates and verifies the `state`
(CSRF guard for the redirect), discovers Google's endpoints from the OpenID
config, exchanges the auth code for tokens server-side (the client secret never
leaves the backend), and verifies the returned id_token's signature/nonce.

The resulting OAuth tokens are NOT used as app credentials — we only read the
verified email/profile and then mint our own server-side session (no JWT).
"""
from authlib.integrations.starlette_client import OAuth

from config import settings

# Google's OpenID discovery document — Authlib pulls authorize/token/jwks URLs
# from here so we don't hardcode them.
_GOOGLE_DISCOVERY = "https://accounts.google.com/.well-known/openid-configuration"

oauth = OAuth()

# Registration is cheap and lazy (no network call until first use). Registering
# even when disabled is harmless; the routes gate on settings.google_enabled.
oauth.register(
    name="google",
    client_id=settings.google_client_id or None,
    client_secret=settings.google_client_secret or None,
    server_metadata_url=_GOOGLE_DISCOVERY,
    client_kwargs={
        # openid+email+profile yields a verified email and basic profile in the
        # id_token. We request nothing beyond what's needed to identify the user.
        "scope": "openid email profile",
    },
)
