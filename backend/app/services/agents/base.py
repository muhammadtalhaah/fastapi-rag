"""Agent contract for the multi-agent orchestration layer.

An *agent* is a single answering strategy (RAG over documents, a general LLM
chat, a web search, ...). The layer is **function-based**: an agent is just a
``stream`` function plus a little metadata, registered as a record in
``registry.py``. There are no agent classes — concrete agents live in sibling
modules (see ``rag_agent.py``, ``web_agent.py``) and expose a module-level
``stream`` function matching :data:`AgentStream`.

Every agent streams its answer as **SSE-formatted frames** — the exact same wire
contract ``query_service.query_stream`` already emits
(``event: <name>\\ndata: <json>\\n\\n``). Keeping one frame format means the SSE
endpoint can pass frames straight through and the WebSocket endpoint can keep
parsing them the way it does today; no transport code needs to know which agent
answered.
"""

from __future__ import annotations

from typing import AsyncIterator, Callable, TypedDict

#: Signature every agent's ``stream`` function must implement.
#:
#: ``stream(db, question, *, top_k, session, request_id, client_ip=None)`` yields
#: SSE-formatted frames answering ``question``. The orchestrator emits the
#: ``agent`` route event *before* calling this, so implementations should begin
#: with their own ``status``/``sources``/``token`` frames and finish with a
#: ``done`` frame, exactly as ``query_service.query_stream`` does. User-facing
#: failures should be raised as ``ValueError`` (the route layer renders them as
#: an ``error`` event); unexpected failures may propagate. ``client_ip`` is the
#: caller identity for agents that rate-limit (e.g. the Web Search agent bounding
#: guest spend); agents that don't care about it simply ignore it.
AgentStream = Callable[..., AsyncIterator[str]]


class AgentSpec(TypedDict):
    """The record stored in the registry for one agent.

    A plain dict (not an object) so registration stays data, not behaviour.
    """

    #: Stable route key the router emits and the registry is keyed on.
    name: str
    #: Whether the agent answers via the streaming contract. Reserved for future
    #: non-streaming agents; all current agents stream.
    supports_stream: bool
    #: The agent's answering function (see :data:`AgentStream`).
    stream: AgentStream
