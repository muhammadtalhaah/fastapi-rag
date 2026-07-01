"""RAG agent — the first agent behind the orchestrator.

A thin **function** adapter over the existing ``query_service.query_stream``
pipeline. It deliberately adds no behaviour: embedding, retrieval, relevance
gating, token streaming and session compaction all stay exactly as they are, so
document questions answer byte-for-byte the same as before the orchestrator was
introduced. The risk noted on PBI 25324 ("refactor regresses streaming") is
mitigated by delegating rather than rewriting.
"""

from __future__ import annotations

from typing import AsyncIterator

from pymongo.database import Database

from services import query_service


def stream(
    db: Database,
    question: str,
    *,
    top_k: int,
    session: dict | None,
    request_id: str,
    client_ip: str | None = None,
    user: dict | None = None,
) -> AsyncIterator[str]:
    """Answer ``question`` from ingested documents via the RAG pipeline.

    ``request_id`` and ``client_ip`` are accepted for interface uniformity; RAG
    mints its own id and does not rate-limit. ``user`` (the resolved profile, or
    None for guests) personalizes the system prompt.
    """
    return query_service.query_stream(db, question, top_k, session, user)
