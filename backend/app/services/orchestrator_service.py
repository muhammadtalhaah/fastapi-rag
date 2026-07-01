"""Orchestrator — the single entry point every answered turn flows through.

Responsibilities (PBI 25324):
  1. Ask the router which agent should answer (manual override or auto-classify).
  2. Emit the additive ``agent`` route event *before* any answer tokens, so the
     client always learns who is answering first.
  3. Dispatch to the registered agent and stream its frames through unchanged.
  4. Degrade safely: a route with no registered agent yet (``general``/``web``
     this sprint) produces a defined default-route response — never a 500 or a
     silent hang.
  5. Apply the RAG-only "no documents" gate here, so non-RAG routes are no
     longer blocked by an empty knowledge base.

Frames are SSE strings (``event: ...\\ndata: ...\\n\\n``) — the same contract
the SSE endpoint streams verbatim and the WS endpoint parses. The orchestrator
adds the ``agent`` event and otherwise passes agent frames straight through.
"""

from __future__ import annotations

import json
import logging
import time
from typing import AsyncIterator, Callable

from pymongo.database import Database

from services import query_service, router_service
from services.agents import registry

logger = logging.getLogger(__name__)

# Raised (as a user-facing message) when the RAG route is chosen but nothing has
# been ingested. Mirrors the message the old pre-stream 404 gate returned.
NO_DOCUMENTS_MESSAGE = "No documents have been ingested yet."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _fallback_stream(route: str) -> AsyncIterator[str]:
    """Defined default-route response for a route with no registered agent.

    Streamed through the normal status/token/done contract so clients render it
    exactly like a real answer (no special-casing required).
    """
    message = (
        f"The **{route}** capability isn't available yet — only document Q&A is "
        "currently enabled. Try asking about your uploaded documents, or set "
        "`mode` to `rag`."
    )

    async def _gen() -> AsyncIterator[str]:
        yield _sse("status", {"stage": "generating", "message": "Generating answer..."})
        yield _sse("token", {"text": message})
        yield _sse("done", {})

    return _gen()


async def run_stream(
    db: Database,
    question: str,
    *,
    top_k: int = 5,
    mode: str | None = "auto",
    web_search: bool = True,
    session: dict | None = None,
    request_id: str | None = None,
    client_ip: str | None = None,
    user: dict | None = None,
    classifier: Callable[[str], str | None] | None = None,
) -> AsyncIterator[str]:
    """Route ``question`` to an agent and yield its SSE frames.

    Emits the ``agent`` route event first, then the chosen agent's frames (or a
    default-route response if no agent is registered for the route). Raises
    ``ValueError`` for user-facing conditions (e.g. RAG with no documents); the
    route layer renders those as an ``error`` event.
    """
    rid = request_id or f"{time.time():.0f}"
    t_total = time.perf_counter()

    # --- Stage 1: routing ---------------------------------------------------
    t0 = time.perf_counter()
    # Most recent prior user turn (if any) anchors a follow-up to the same
    # capability the topic was being answered with.
    prior_user = None
    if session:
        prior_user = next(
            (m.get("content") for m in reversed(session.get("recent", []))
             if m.get("role") == "user" and m.get("content")),
            None,
        )
    route, reason = router_service.resolve_route(
        question, mode, web_search=web_search, prior_user=prior_user, classifier=classifier
    )
    routing_ms = (time.perf_counter() - t0) * 1000

    agent = registry.get(route)
    logger.info(
        "[orchestrator:%s] route=%s reason=%s registered=%s routing=%.0fms mode=%r q=%r",
        rid, route, reason, agent is not None, routing_ms, mode, question[:80],
    )

    # Additive route event — always before any answer tokens.
    yield _sse("agent", {"agent": route, "reason": reason, "registered": agent is not None})

    # --- Stage 2: dispatch --------------------------------------------------
    t0 = time.perf_counter()
    if agent is None:
        # Router picked a route whose agent isn't built yet -> safe default.
        logger.info("[orchestrator:%s] no agent for route %s — default-route response", rid, route)
        async for frame in _fallback_stream(route):
            yield frame
        logger.info(
            "[orchestrator:%s] DONE (fallback) answer=%.0fms total=%.0fms",
            rid, (time.perf_counter() - t0) * 1000, (time.perf_counter() - t_total) * 1000,
        )
        return

    # RAG-only document gate (relaxed from the old global 404): only the RAG
    # route requires ingested documents. Other routes never touch chunks.
    if route == "rag" and db.chunks.count_documents({}) == 0:
        logger.info("[orchestrator:%s] RAG route but no documents ingested", rid)
        raise ValueError(NO_DOCUMENTS_MESSAGE)

    # Announce the model that will generate this answer, before any tokens. The
    # WS layer captures it to persist alongside the assistant turn, and the
    # client renders it as metadata under the answer. All registered agents
    # generate through the same Azure deployment today.
    yield _sse("model", {"name": query_service.MODEL_DISPLAY_NAME})

    async for frame in agent["stream"](
        db, question, top_k=top_k, session=session, request_id=rid, client_ip=client_ip, user=user
    ):
        yield frame
    logger.info(
        "[orchestrator:%s] DONE agent=%s answer=%.0fms total=%.0fms",
        rid, route, (time.perf_counter() - t0) * 1000, (time.perf_counter() - t_total) * 1000,
    )
