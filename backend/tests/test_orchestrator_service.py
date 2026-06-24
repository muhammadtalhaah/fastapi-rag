"""Orchestrator tests (PBI 25324, task 25328).

Cover: the additive `agent` event, registry dispatch, the default-route
response for an unregistered route, and the RAG-only document gate. Agents and
the classifier are stubbed so no network or real RAG pipeline runs.

The orchestrator is an async generator; `_collect` drains it synchronously via
asyncio.run so we don't need pytest-asyncio.
"""
import asyncio
import json

import pytest

from services import orchestrator_service
from services.agents import registry


def _collect(agen):
    async def _run():
        return [frame async for frame in agen]

    return asyncio.run(_run())


def _parse(frame):
    """Parse one SSE frame string into (event, data_dict)."""
    event = data = None
    for line in frame.splitlines():
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data = json.loads(line[len("data:"):].strip())
    return event, data


def _fake_stream(db, question, *, top_k, session, request_id, client_ip=None):
    async def _gen():
        yield "event: token\ndata: {\"text\": \"hi\"}\n\n"
        yield "event: done\ndata: {}\n\n"

    return _gen()


def _fake_spec():
    return {"name": "rag", "supports_stream": True, "stream": _fake_stream}


def test_agent_event_first_then_dispatch(db, monkeypatch):
    db.chunks.insert_one({"_id": "c1", "embedding": [0.1], "text": "x"})
    monkeypatch.setattr(registry, "get", lambda route: _fake_spec() if route == "rag" else None)

    frames = _collect(
        orchestrator_service.run_stream(db, "a doc question", mode="auto", classifier=lambda q: "rag")
    )
    events = [_parse(f) for f in frames]

    # First frame is the additive agent (route) event, before any tokens.
    assert events[0][0] == "agent"
    assert events[0][1] == {"agent": "rag", "reason": "llm-classifier", "registered": True}
    # Then the agent's own frames, unchanged.
    assert ("token", {"text": "hi"}) in events
    assert events[-1][0] == "done"


def test_unregistered_route_returns_default_response(db, monkeypatch):
    monkeypatch.setattr(registry, "get", lambda route: None)

    frames = _collect(
        orchestrator_service.run_stream(db, "tell me a joke", mode="general")
    )
    events = [_parse(f) for f in frames]

    agent_evt = events[0]
    assert agent_evt[0] == "agent"
    assert agent_evt[1]["agent"] == "general"
    assert agent_evt[1]["registered"] is False
    # A defined, streamed default-route response — no error, ends with done.
    assert any(e == "token" for e, _ in events)
    assert events[-1][0] == "done"
    assert not any(e == "error" for e, _ in events)


def test_rag_route_without_documents_raises_user_facing(db, monkeypatch):
    # Empty knowledge base + RAG route -> user-facing ValueError (rendered as an
    # error event by the route layer), NOT a crash.
    monkeypatch.setattr(registry, "get", lambda route: _fake_spec())

    with pytest.raises(ValueError, match="No documents"):
        _collect(orchestrator_service.run_stream(db, "doc q", mode="rag"))


def test_non_rag_route_not_blocked_by_empty_kb(db, monkeypatch):
    # Same empty KB, but a general question must NOT be gated.
    monkeypatch.setattr(registry, "get", lambda route: None)
    frames = _collect(orchestrator_service.run_stream(db, "hi", mode="general"))
    events = [_parse(f) for f in frames]
    assert not any(e == "error" for e, _ in events)
    assert events[-1][0] == "done"
