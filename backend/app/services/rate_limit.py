"""In-memory rate limiting (PBI 25335, task 25337).

A tiny fixed-window counter used to bound web-search spend/abuse now that the
Web Search agent is available to guests. Keyed by client identity (IP, falling
back to session id) so one caller can't burn the Tavily quota for everyone.

Scope/limits, matching the rest of the unauth stack (``session_service``):
  - Process-memory only; not shared across workers and reset on restart. That is
    acceptable for a soft abuse-control guard — it is not a security control.
  - Thread-safe (the streaming path touches this from request threads).

The check is deliberately allow-on-missing-key: if no identity is available we
do not block, because the alternative (one shared bucket for everyone) would let
a single abuser lock out all anonymous users.
"""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

# Web-search budget per identity (tunable). 10 searches / 60 s comfortably covers
# real interactive use while capping a runaway script.
WEB_SEARCH_MAX_PER_WINDOW = 10
WEB_SEARCH_WINDOW_SECONDS = 60

_lock = threading.Lock()
# key -> (window_start_epoch, count_in_window)
_buckets: dict[str, tuple[float, int]] = {}


def check(key: str | None, *, max_per_window: int, window_seconds: int) -> bool:
    """Record one hit for ``key`` and return ``True`` if it is within budget.

    Returns ``True`` (allow) when ``key`` is falsy — see module docstring. The
    counter is incremented only for allowed-or-blocked real keys; a blocked hit
    still counts so sustained abuse stays blocked for the rest of the window.
    """
    if not key:
        return True
    now = time.time()
    with _lock:
        window_start, count = _buckets.get(key, (now, 0))
        if now - window_start >= window_seconds:
            # Window elapsed — reset.
            window_start, count = now, 0
        count += 1
        _buckets[key] = (window_start, count)
    allowed = count <= max_per_window
    if not allowed:
        logger.info("[rate-limit] key=%s over budget (%d/%d in window)", key, count, max_per_window)
    return allowed


def check_web_search(key: str | None) -> bool:
    """Convenience wrapper applying the web-search budget."""
    return check(
        key,
        max_per_window=WEB_SEARCH_MAX_PER_WINDOW,
        window_seconds=WEB_SEARCH_WINDOW_SECONDS,
    )


def reset() -> None:
    """Clear all buckets. Test-only helper."""
    with _lock:
        _buckets.clear()
