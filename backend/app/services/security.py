"""
Pure security primitives: password hashing and secure token generation.

This module has NO database or FastAPI dependencies so it is trivially unit
testable. Everything security-critical that doesn't touch storage lives here.

We use the ``bcrypt`` library directly rather than passlib: passlib 1.7.4 is
incompatible with bcrypt 5.x (it crashes reading ``bcrypt.__about__`` and on the
72-byte detection probe). Direct bcrypt is the actual crypto, simpler, and gives
us explicit control over the 72-byte truncation behaviour.
"""
import hashlib
import hmac
import secrets

import bcrypt

# bcrypt only hashes the first 72 BYTES of input. Anything beyond is silently
# ignored, which is a subtle security footgun (two distinct long passwords can
# collide). We cap explicitly at the API layer (password_max_length) and also
# truncate here as defense-in-depth so the limit is enforced in exactly one
# well-understood place.
_BCRYPT_MAX_BYTES = 72

# Work factor for bcrypt. 12 is a sane production default (~250ms/hash on modern
# hardware) — high enough to slow offline cracking, low enough to not DoS login.
_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt. Returns a str safe to store.

    The salt is generated per-call and embedded in the output hash, so no
    separate salt storage is needed.
    """
    pw_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time verify a plaintext password against a stored bcrypt hash.

    Returns False (never raises) on malformed hashes so callers can treat the
    "unknown user" and "bad password" cases identically — see the dummy-hash
    usage in auth_session_service to avoid user-enumeration timing attacks.
    """
    try:
        pw_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def generate_session_id() -> str:
    """Generate a cryptographically secure, opaque session id.

    ``token_urlsafe(32)`` yields 32 random bytes (256 bits of entropy) encoded
    URL-safe — far beyond brute-force/guessing range. This raw value is sent to
    the client in the cookie and NEVER stored as-is (see hash_session_id).
    """
    return secrets.token_urlsafe(32)


def hash_session_id(raw_session_id: str) -> str:
    """Return the SHA-256 hex digest of a raw session id.

    We store this digest server-side instead of the raw token. If the sessions
    collection is ever leaked, the attacker gets hashes — not usable session
    cookies — because they cannot reverse SHA-256 to recover the raw token.
    Lookups hash the incoming cookie value before querying. (Plain SHA-256 is
    appropriate here because the input is high-entropy random, not a low-entropy
    password, so no salting/KDF is required.)
    """
    return hashlib.sha256(raw_session_id.encode("utf-8")).hexdigest()


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF (synchronizer) token."""
    return secrets.token_urlsafe(32)


def tokens_equal(a: str, b: str) -> bool:
    """Constant-time string comparison for secrets (CSRF tokens, etc.).

    Uses hmac.compare_digest to avoid leaking match length via timing.
    """
    return hmac.compare_digest(a, b)
