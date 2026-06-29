"""Web Search agent (PBI 25335) — search the live web, then synthesize a cited
answer.

Function-based, mirroring ``query_service.query_stream``: a module-level
:func:`stream` async generator plus small helper functions. It is registered as
an agent record in ``registry.py``.

Pipeline per turn:
  1. **Rate-limit gate** — bound web-search spend/abuse per client identity.
  2. **Search** — call the provider via ``web_search_client.search`` (Tavily),
     capped to a per-turn result count, with a bounded timeout.
  3. **Cite** — emit the hits as ``WebSource`` citations through the shared
     ``sources`` stream event (with a ``type`` discriminator so the UI can tell
     them apart from document sources).
  4. **Synthesize** — stream an answer from Azure ``gpt-5.4`` constrained to the
     fetched results only, citing each claim. No results -> a clear "couldn't
     find" message, never a fabricated answer.

It reuses the exact SSE frame contract and thread-offload streaming pattern from
``query_service.query_stream`` so the SSE/WS transports need no changes, and the
WS layer's frame-capture persistence records web turns automatically. Provider
failures surface as friendly ``ValueError``s (rendered as an ``error`` event);
they never crash the orchestrator.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import AsyncIterator
from urllib.parse import urlsplit

from openai import BadRequestError
from pymongo.database import Database

from services import rate_limit, session_service, web_search_client
from services.query_service import (
    AZURE_DEPLOYMENT,
    azure_client,
    _count_tokens,
    _retrieval_query,
    _trim_history,
    summarize_overflow,
)

logger = logging.getLogger(__name__)

# Token budgets for the synthesis call (tunable, independent of the RAG budgets).
BUDGET_CONTEXT = 6_000
BUDGET_ANSWER = 1_500

# Per-result snippet cap for the citation payload (UI preview length).
SNIPPET_MAX_CHARS = 300

SYNTHESIS_SYSTEM_PROMPT = (
    "You are a web-research assistant. Answer the user's question using ONLY the "
    "numbered web search results provided below — do not invent facts. Cite the "
    "result number in square brackets (e.g. [1], [2]) immediately after each claim "
    "it supports. If the results do not contain enough information to answer, say so "
    "plainly and do not guess.\n\n"
    "Use the conversation history to resolve follow-up questions and pronouns "
    "(e.g. 'it', 'that', 'the score') — the conversation gives you the topic the "
    "user is asking about, and the web results give you the facts to answer with.\n\n"
    "Format the answer as clean GitHub-flavored Markdown: use short paragraphs, "
    "bullet lists, and **bold** for key terms where they aid readability. Keep it "
    "concise and directly responsive to the question."
)

# Friendly answer when the provider returns nothing usable. Streamed as a normal
# token frame so the client renders it like any other answer.
NO_RESULTS_MESSAGE = (
    "I couldn't find relevant web results for that. Try rephrasing your question "
    "or adding more specific details."
)

# Friendly answer when web search isn't configured (no API key). Lets the
# capability degrade gracefully instead of erroring.
UNAVAILABLE_MESSAGE = (
    "Web search isn't available right now. You can still ask about your uploaded "
    "documents or switch to general chat."
)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# Multi-part public suffixes we shouldn't mistake for the brand label. When the
# registrable domain ends in one of these, the brand is the label *before* it
# (e.g. ``abc.net.au`` → "Abc", ``bbc.co.uk`` → "Bbc").
_COMPOUND_TLDS = (".net.au", ".com.au", ".co.uk", ".co.nz", ".com.br", ".co.in", ".org.uk")


def _source_name(url: str) -> str:
    """Derive a human-readable publisher name from a URL's host.

    Tavily does not return a publisher field, so we prettify the registrable
    domain: drop ``www.``, strip the TLD (handling common compound suffixes like
    ``.net.au``), and title-case the remaining label. ``abc.net.au`` → "Abc",
    ``theguardian.com`` → "Theguardian". Falls back to the raw host/URL when the
    URL can't be parsed.
    """
    host = (urlsplit(url).hostname or url or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if not host:
        return url
    for suffix in _COMPOUND_TLDS:
        if host.endswith(suffix):
            host = host[: -len(suffix)]
            break
    else:
        host = host.rsplit(".", 1)[0] if "." in host else host
    # The brand is the last remaining dotted label (drops leading subdomains).
    label = host.rsplit(".", 1)[-1]
    return label.replace("-", " ").title() if label else url


def _to_sources(results: list[dict]) -> list[dict]:
    """Map provider hits into the public WebSource citation dicts (with the
    ``type`` discriminator the UI branches on)."""
    sources: list[dict] = []
    for r in results:
        content = r.get("content") or ""
        snippet = content[:SNIPPET_MAX_CHARS].strip()
        if len(content) > SNIPPET_MAX_CHARS:
            snippet += "…"
        url = r.get("url", "")
        sources.append({"type": "web", "title": r.get("title") or url,
                        "url": url, "snippet": snippet,
                        "source_name": _source_name(url),
                        "published_date": r.get("published_date") or ""})
    return sources


def _build_context(results: list[dict]) -> str:
    """Assemble a numbered, token-budgeted context block from the results. The
    numbering is what the model cites with [n], so it must match the order of the
    emitted sources."""
    parts: list[str] = []
    budget = BUDGET_CONTEXT
    separator = "\n\n"
    for i, r in enumerate(results, start=1):
        block = f"[{i}] {r.get('title', '')}\nURL: {r.get('url', '')}\n{r.get('content', '')}"
        cost = _count_tokens(block + (separator if parts else ""))
        if cost > budget:
            logger.info("[web-agent] context budget exhausted at result %d", i)
            break
        budget -= cost
        parts.append(block)
    return separator.join(parts)


async def stream(
    db: Database,
    question: str,
    *,
    top_k: int,
    session: dict | None,
    request_id: str,
    client_ip: str | None = None,
) -> AsyncIterator[str]:
    """Answer current/external questions via web search + cited synthesis."""
    rid = request_id
    t_total = time.perf_counter()

    # --- Provider availability (missing API key) ---------------------------
    if not web_search_client.is_configured():
        logger.info("[web-agent:%s] not configured — graceful fallback", rid)
        yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
        yield _sse("token", {"text": UNAVAILABLE_MESSAGE})
        yield _sse("done", {})
        return

    # --- Rate limit (cost/abuse control for guests) ------------------------
    if not rate_limit.check_web_search(client_ip):
        logger.info("[web-agent:%s] rate limited ip=%s", rid, client_ip)
        raise ValueError(
            "You've reached the web search limit for now. Please wait a moment and try again."
        )

    # --- Search ------------------------------------------------------------
    yield _sse("status", {"stage": "searching", "message": "Searching the web..."})
    max_results = max(1, min(top_k, web_search_client.DEFAULT_MAX_RESULTS))
    t0 = time.perf_counter()
    history = session_service.build_history(session) if session else []
    search_query = _retrieval_query(question, history)
    # Provider call is blocking I/O -> offload so the event loop stays free.
    # ValueError (friendly provider errors) propagates to the route layer.
    results = await asyncio.to_thread(web_search_client.search, search_query, max_results=max_results)
    logger.info("[web-agent:%s] search done in %.2fs, %d results",
                rid, time.perf_counter() - t0, len(results))

    # --- Empty results: clear message, no fabrication ----------------------
    if not results:
        yield _sse("sources", {"sources": []})
        yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
        yield _sse("token", {"text": NO_RESULTS_MESSAGE})
        if session is not None:
            await asyncio.to_thread(
                session_service.append_turn, session, question, NO_RESULTS_MESSAGE, summarize_overflow
            )
        yield _sse("done", {})
        logger.info("[web-agent:%s] DONE (no results) total=%.2fs", rid, time.perf_counter() - t_total)
        return

    # --- Citations (same contract as RAG sources) --------------------------
    yield _sse("sources", {"sources": _to_sources(results)})

    # --- Synthesize (streamed, constrained to the fetched results) ---------
    yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
    context = _build_context(results)
    messages = [
        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
        *_trim_history(history),
        {"role": "user", "content": f"Web search results:\n{context}\n\nQuestion: {question}"},
    ]

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    def _run_and_enqueue():
        try:
            with azure_client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=messages,
                stream=True,
                timeout=120,
                max_completion_tokens=BUDGET_ANSWER,
            ) as response_stream:
                for chunk in response_stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta.content:
                        loop.call_soon_threadsafe(queue.put_nowait, ("token", delta.content))
        except BadRequestError as exc:
            if "content_filter" in str(exc) or (hasattr(exc, "code") and exc.code == "content_filter"):
                friendly = ValueError("Your message was flagged by the content filter and could not be processed.")
                loop.call_soon_threadsafe(queue.put_nowait, friendly)
            else:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
        except Exception as exc:
            logger.error("[web-agent:%s] synthesis thread error: %s", rid, exc, exc_info=True)
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)

    t = threading.Thread(target=_run_and_enqueue, daemon=True)
    t.start()

    t0 = time.perf_counter()
    token_count = 0
    answer_parts: list[str] = []
    while True:
        item = await queue.get()
        if item is _DONE:
            break
        if isinstance(item, Exception):
            raise item
        kind, payload = item
        if kind == "token":
            token_count += 1
            answer_parts.append(payload)
            yield _sse("token", {"text": payload})

    t.join()
    if session is not None:
        await asyncio.to_thread(
            session_service.append_turn, session, question, "".join(answer_parts), summarize_overflow
        )
    logger.info("[web-agent:%s] synthesis done in %.2fs tokens=%d total=%.2fs",
                rid, time.perf_counter() - t0, token_count, time.perf_counter() - t_total)
    yield _sse("done", {})
