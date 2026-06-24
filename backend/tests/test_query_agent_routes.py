"""End-to-end route tests for the agent layer on /query/stream (PBI 25324).

Proves the contract at the HTTP boundary: the additive `agent` event reaches
the client, a non-document question no longer 404s, and the RAG document gate
still fires on the RAG route. The classifier is monkeypatched so no LLM is
called; the SSE body is buffered by TestClient and inspected as text.
"""
import types

from services import rate_limit, router_service, web_search_client
from services.agents import web_agent as web_agent_module


def test_stream_emits_agent_event_and_does_not_404_for_non_doc(client, monkeypatch):
    # Force the auto route to "general" (no agent registered -> default response).
    monkeypatch.setattr(router_service, "_llm_classify", lambda q: "general")

    resp = client.post("/api/v1/query/stream", json={"question": "tell me a joke"})

    assert resp.status_code == 200  # empty KB no longer blocks a non-doc question
    body = resp.text
    assert "event: session" in body
    assert "event: agent" in body
    assert '"agent": "general"' in body
    assert "event: token" in body  # default-route response streamed
    assert "event: done" in body


def test_stream_rag_route_without_documents_emits_error_not_404(client):
    # Manual override to RAG with an empty KB: validation passes (200), then the
    # orchestrator's RAG gate raises -> rendered as an SSE error event.
    resp = client.post("/api/v1/query/stream", json={"question": "what's in my doc?", "mode": "rag"})

    assert resp.status_code == 200
    body = resp.text
    assert "event: agent" in body
    assert '"agent": "rag"' in body
    assert "event: error" in body
    assert "No documents" in body


def test_stream_rejects_empty_question_422(client):
    resp = client.post("/api/v1/query/stream", json={"question": "   "})
    assert resp.status_code == 422


def _fake_web_stream(tokens):
    def _chunk(text):
        return types.SimpleNamespace(choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content=text))])

    class _Stream:
        def __enter__(self):
            return iter([_chunk(t) for t in tokens])

        def __exit__(self, *a):
            return False

    return types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=lambda **k: _Stream()))
    )


def test_stream_web_mode_emits_web_citations_and_answer(client, monkeypatch):
    # Manual mode:web routes to the registered Web Search agent. Inject a fake
    # provider + fake synthesis so no network/LLM is touched.
    rate_limit.reset()
    monkeypatch.setattr(web_search_client, "is_configured", lambda: True)
    monkeypatch.setattr(
        web_search_client, "search",
        lambda q, *, max_results=5: [
            {"title": "Headline", "url": "https://ex.com/x", "content": "fresh fact", "score": 0.9}
        ],
    )
    monkeypatch.setattr(web_agent_module, "azure_client", _fake_web_stream(["Fresh ", "answer [1]."]))

    resp = client.post("/api/v1/query/stream", json={"question": "latest news?", "mode": "web"})

    assert resp.status_code == 200
    body = resp.text
    assert 'event: agent' in body
    assert '"agent": "web"' in body
    assert 'event: sources' in body
    assert '"type": "web"' in body
    assert "https://ex.com/x" in body
    assert "event: token" in body
    assert "event: done" in body
    assert "event: error" not in body
