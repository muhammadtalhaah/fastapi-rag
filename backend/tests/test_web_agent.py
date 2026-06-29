"""Web Search agent tests (PBI 25335, task 25341).

Cover the pipeline with a **mocked** search provider and a **mocked** Azure
synthesis stream — no network, no real LLM. The agent is function-based, so the
provider is injected by monkeypatching ``web_search_client.search`` /
``is_configured`` and the synthesis client by monkeypatching
``web_agent.azure_client``.

Cases:
  - happy path: searching status, web citations via the `sources` contract,
    streamed synthesized tokens, done, and in-memory session persistence;
  - empty results: a clear "couldn't find" message, no synthesis, no error;
  - provider error / timeout: friendly ValueError propagates (rendered as an
    `error` event by the route layer), orchestrator not crashed;
  - rate limiting: over-budget calls raise a friendly ValueError;
  - not configured: graceful "unavailable" message instead of a crash.

The agent is an async generator; `_collect` drains it synchronously.
"""
import asyncio
import json
import types

import pytest

from services import rate_limit, web_search_client
from services.agents import web_agent


def _collect(agen):
    async def _run():
        return [frame async for frame in agen]

    return asyncio.run(_run())


def _parse(frame):
    event = data = None
    for line in frame.splitlines():
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data = json.loads(line[len("data:"):].strip())
    return event, data


def _events(frames):
    return [_parse(f) for f in frames]


def _fake_azure_streaming(tokens):
    """Build a fake azure_client whose chat.completions.create() returns a
    context-manager stream yielding `tokens` as delta.content chunks."""

    def _chunk(text):
        delta = types.SimpleNamespace(content=text)
        return types.SimpleNamespace(choices=[types.SimpleNamespace(delta=delta)])

    class _Stream:
        def __enter__(self):
            return iter([_chunk(t) for t in tokens])

        def __exit__(self, *a):
            return False

    return types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=lambda **k: _Stream()))
    )


def _patch_provider(monkeypatch, *, results=None, error=None, configured=True):
    monkeypatch.setattr(web_search_client, "is_configured", lambda: configured)

    def _search(query, *, max_results=5):
        if error is not None:
            raise error
        return results or []

    monkeypatch.setattr(web_search_client, "search", _search)


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    rate_limit.reset()
    yield
    rate_limit.reset()


# --- happy path -------------------------------------------------------------

def test_happy_path_streams_citations_and_synthesized_answer(db, monkeypatch):
    results = [
        {"title": "Latest News", "url": "https://news.com/a", "content": "Something happened today.", "score": 0.9},
        {"title": "More Context", "url": "https://news.com/b", "content": "Background info.", "score": 0.7},
    ]
    _patch_provider(monkeypatch, results=results)
    monkeypatch.setattr(web_agent, "azure_client", _fake_azure_streaming(["Today ", "[1]."]))
    session = {"summary": "", "recent": []}

    frames = _collect(web_agent.stream(db, "what's the latest?", top_k=5, session=session, request_id="r1"))
    events = _events(frames)
    names = [e for e, _ in events]

    assert "status" in names
    assert names[-1] == "done"
    assert not any(e == "error" for e in names)

    # Web citations emitted via the shared `sources` contract, with the
    # discriminator + schema fields the UI branches on.
    sources_evt = next(d for e, d in events if e == "sources")
    cites = sources_evt["sources"]
    assert len(cites) == 2
    assert cites[0] == {
        "type": "web",
        "title": "Latest News",
        "url": "https://news.com/a",
        "snippet": "Something happened today.",
        # Publisher name derived from the host; date empty when none supplied.
        "source_name": "News",
        "published_date": "",
    }

    # Synthesized answer streamed token-by-token.
    answer = "".join(d["text"] for e, d in events if e == "token")
    assert answer == "Today [1]."

    # In-memory session persistence (so follow-ups keep the thread).
    assert session["recent"][-2:] == [
        {"role": "user", "content": "what's the latest?"},
        {"role": "assistant", "content": "Today [1]."},
    ]


# --- empty results ----------------------------------------------------------

def test_empty_results_returns_clear_message_without_synthesizing(db, monkeypatch):
    _patch_provider(monkeypatch, results=[])

    def _boom(**kwargs):
        raise AssertionError("synthesis must not run on empty results")

    monkeypatch.setattr(web_agent, "azure_client",
                        types.SimpleNamespace(chat=types.SimpleNamespace(
                            completions=types.SimpleNamespace(create=_boom))))
    session = {"summary": "", "recent": []}

    frames = _collect(web_agent.stream(db, "nonsense query", top_k=5, session=session, request_id="r2"))
    events = _events(frames)
    names = [e for e, _ in events]

    assert not any(e == "error" for e in names)
    assert names[-1] == "done"
    answer = "".join(d["text"] for e, d in events if e == "token")
    assert "couldn't find" in answer.lower()
    sources_evt = next(d for e, d in events if e == "sources")
    assert sources_evt["sources"] == []
    assert session["recent"][-1]["role"] == "assistant"


# --- provider failure -------------------------------------------------------

def test_provider_error_propagates_as_value_error(db, monkeypatch):
    _patch_provider(monkeypatch, error=ValueError("The web search timed out. Please try again in a moment."))
    with pytest.raises(ValueError, match="timed out"):
        _collect(web_agent.stream(db, "q", top_k=5, session=None, request_id="r3"))


# --- rate limiting ----------------------------------------------------------

def test_rate_limit_blocks_over_budget(db, monkeypatch):
    _patch_provider(monkeypatch, results=[{"title": "t", "url": "https://x.com", "content": "c", "score": 0.1}])
    monkeypatch.setattr(web_agent, "azure_client", _fake_azure_streaming(["ok"]))

    for _ in range(rate_limit.WEB_SEARCH_MAX_PER_WINDOW):
        frames = _collect(web_agent.stream(db, "q", top_k=5, session=None, request_id="r", client_ip="1.2.3.4"))
        assert _events(frames)[-1][0] == "done"

    with pytest.raises(ValueError, match="web search limit"):
        _collect(web_agent.stream(db, "q", top_k=5, session=None, request_id="r", client_ip="1.2.3.4"))


def test_rate_limit_allows_when_no_identity(db, monkeypatch):
    _patch_provider(monkeypatch, results=[{"title": "t", "url": "https://x.com", "content": "c", "score": 0.1}])
    monkeypatch.setattr(web_agent, "azure_client", _fake_azure_streaming(["ok"]))
    for _ in range(rate_limit.WEB_SEARCH_MAX_PER_WINDOW + 3):
        frames = _collect(web_agent.stream(db, "q", top_k=5, session=None, request_id="r", client_ip=None))
        assert _events(frames)[-1][0] == "done"


# --- not configured ---------------------------------------------------------

def test_not_configured_returns_graceful_message(db, monkeypatch):
    _patch_provider(monkeypatch, configured=False)
    frames = _collect(web_agent.stream(db, "q", top_k=5, session=None, request_id="r4"))
    events = _events(frames)
    names = [e for e, _ in events]
    assert not any(e == "error" for e in names)
    assert names[-1] == "done"
    answer = "".join(d["text"] for e, d in events if e == "token")
    assert "isn't available" in answer
