from typing import Literal

from pydantic import BaseModel


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    session_id: str | None = None
    # Which agent should answer this turn. "auto" (default) lets the router
    # classify; an explicit route ("rag" | "general" | "web") is a manual
    # override that always wins. Unknown/empty values are treated as "auto" by
    # the router, so this stays a plain string rather than an enum — it must
    # never reject a request on the routing field alone.
    mode: str = "auto"
    # Whether the assistant may search the web on this turn. Enabled by default.
    # When ``False``, auto-routing still picks between ``rag`` and ``general``
    # but never the ``web`` route (the router downgrades a web pick to the
    # default route). An explicit ``mode="web"`` override still wins — a manual
    # route is intentional and not gated by this flag.
    web_search: bool = True
    # When ``True``, this turn is a *regeneration* of the conversation's last
    # answer rather than a new question. For logged-in users the backend then
    # appends a new answer *version* to the last assistant turn (replacing it as
    # the active answer) instead of appending a fresh user + assistant exchange.
    # Ignored for guests (no durable history). See conversation_service.
    regenerate: bool = False


class SourceChunk(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    text: str
    score: float


class WebSource(BaseModel):
    """A web citation emitted by the Web Search agent (PBI 25335).

    Deliberately distinct from :class:`SourceChunk` (document chunks) so the
    ``sources`` stream event can carry either kind. The ``type`` field is the
    discriminator the UI branches on: web citations link out to a ``url``;
    document sources do not have one. RAG document sources are emitted without a
    ``type`` (treated as ``"document"`` by clients), so the RAG wire contract is
    unchanged.
    """

    type: Literal["web"] = "web"
    title: str
    url: str
    snippet: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    session_id: str | None = None
