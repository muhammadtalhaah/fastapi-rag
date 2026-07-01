"""Random avatar URLs.

The Account-settings avatar is "shuffle to a new random image" rather than an
upload. We hand back a DiceBear URL (a free, deterministic, key-less avatar
service) seeded with a fresh random token, and store that URL on the user. No
image bytes are downloaded or persisted — the stored value is the external URL,
which the frontend renders directly in an <img>.

Function-based and dependency-free (just stdlib `secrets`), so it's trivially
unit-testable and has no network call of its own — the browser fetches the
image when it renders.
"""
from __future__ import annotations

import secrets

# DiceBear v9 HTTP API. `seed` fully determines the generated face, so a random
# seed yields a random-but-stable avatar (the same URL always renders the same
# image). "thumbs" is a clean, neutral style that suits the archive aesthetic.
_DICEBEAR_STYLE = "thumbs"
_DICEBEAR_BASE = "https://api.dicebear.com/9.x"


def random_avatar_url() -> str:
    """Return a DiceBear avatar URL with a fresh random seed."""
    seed = secrets.token_hex(8)
    return f"{_DICEBEAR_BASE}/{_DICEBEAR_STYLE}/svg?seed={seed}"
