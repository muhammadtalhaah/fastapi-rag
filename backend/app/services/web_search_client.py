"""Web search provider client (PBI 25335, task 25337).

A thin **provider-agnostic** module so the Web Search agent never talks to a
vendor SDK directly. Today the only provider is Tavily (REST over ``requests``);
swapping providers means reimplementing :func:`search` and nothing else changes.
Tests inject a fake by monkeypatching :func:`search` (or :data:`requests.post`).

Design choices, consistent with the rest of the codebase (function-based service
modules like ``query_service``):
  - Synchronous (the agent offloads the call to a thread, like the RAG pipeline
    offloads Voyage/Azure calls).
  - Results are returned as plain ``dict``s (the same way ``query_service``
    returns ``sources``), not objects.
  - Provider exceptions are mapped to friendly ``ValueError`` messages, mirroring
    the Voyage error-handling in ``query_service._embed``. The route layer renders
    a ``ValueError`` as a safe ``error`` event; raw provider text never leaks.
  - A bounded timeout (NFR: ~8 s) and a per-call result cap keep latency and
    spend in check. Outbound traffic is restricted to the Tavily API endpoint.
"""

from __future__ import annotations

import logging

import requests

from config import TAVILY_API_KEY

logger = logging.getLogger(__name__)

# --- Tunables (NFRs on PBI 25335) ------------------------------------------
TAVILY_ENDPOINT = "https://api.tavily.com/search"
SEARCH_TIMEOUT_SECONDS = 8.0   # bounded per-turn latency
DEFAULT_MAX_RESULTS = 5        # per-turn result cap (cost/abuse control)
RESULT_CAP = 10                # hard upper bound regardless of caller request


def is_configured() -> bool:
    """Whether a Tavily API key is present. The agent checks this so a missing
    key degrades to a friendly 'unavailable' message rather than a 401."""
    return bool(TAVILY_API_KEY)


def search(query: str, *, max_results: int = DEFAULT_MAX_RESULTS) -> list[dict]:
    """Return up to ``max_results`` hits for ``query`` as dicts.

    Each hit is ``{"title", "url", "content", "score"}``. A well-formed response
    with zero usable hits returns ``[]`` (the agent renders the 'couldn't find
    results' message), never an error. Raises ``ValueError`` with a safe,
    user-facing message on any provider failure (timeout, auth, rate-limit,
    transport, bad response).
    """
    if not TAVILY_API_KEY:
        # Callers should gate on is_configured(); defend anyway.
        raise ValueError("Web search is not available right now. Please try again later.")

    capped = max(1, min(max_results, RESULT_CAP))
    logger.info("[web-search] Tavily query=%r max_results=%d", query[:80], capped)

    try:
        resp = requests.post(
            TAVILY_ENDPOINT,
            json={"query": query, "max_results": capped, "search_depth": "basic"},
            headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
            timeout=SEARCH_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.Timeout:
        logger.warning("[web-search] Tavily timed out after %.1fs", SEARCH_TIMEOUT_SECONDS, exc_info=True)
        raise ValueError("The web search timed out. Please try again in a moment.")
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (401, 403):
            logger.error("[web-search] Tavily auth/config error (status=%s)", status, exc_info=True)
            raise ValueError("Web search isn't configured correctly. Please try again later.")
        if status == 429:
            logger.warning("[web-search] Tavily rate limit hit", exc_info=True)
            raise ValueError("Web search is busy right now. Please wait a moment and try again.")
        logger.warning("[web-search] Tavily HTTP error (status=%s)", status, exc_info=True)
        raise ValueError("The web search service is temporarily unavailable. Please try again in a moment.")
    except requests.ConnectionError:
        logger.warning("[web-search] Tavily connection error", exc_info=True)
        raise ValueError("The web search service is temporarily unavailable. Please try again in a moment.")
    except requests.RequestException:
        logger.error("[web-search] Tavily request error", exc_info=True)
        raise ValueError("We couldn't run a web search right now. Please try again later.")

    try:
        payload = resp.json()
    except ValueError:
        logger.error("[web-search] Tavily returned non-JSON response", exc_info=True)
        raise ValueError("We couldn't run a web search right now. Please try again later.")

    return _parse_results(payload)


def _parse_results(payload: dict) -> list[dict]:
    """Map a Tavily ``/search`` response into result dicts, skipping malformed
    entries (e.g. a hit with no URL — a citation without a URL is useless)."""
    raw = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return []
    results: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        url = (item.get("url") or "").strip()
        if not url:
            continue
        results.append({
            "title": (item.get("title") or url).strip(),
            "url": url,
            "content": (item.get("content") or "").strip(),
            "score": float(item.get("score") or 0.0),
            # Tavily returns published_date only for some results (mainly news);
            # carry it through when present so the UI can show recency.
            "published_date": (item.get("published_date") or "").strip(),
        })
    return results
