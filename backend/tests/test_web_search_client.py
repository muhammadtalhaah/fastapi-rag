"""web_search_client tests (PBI 25335, task 25337).

Cover the provider-exception -> friendly ``ValueError`` mapping (the Voyage
pattern), response parsing, the result cap, and the not-configured guard. No
network: ``requests.post`` is monkeypatched and the module-level API key is set
via monkeypatch. Real ``requests`` exception classes are used so the client's
``except`` clauses match what would fire in production.
"""
import pytest
import requests

from services import web_search_client


class _FakeResponse:
    def __init__(self, status_code=200, payload=None, json_raises=False):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self._json_raises = json_raises

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)

    def json(self):
        if self._json_raises:
            raise ValueError("not json")
        return self._payload


@pytest.fixture(autouse=True)
def _set_key(monkeypatch):
    """Give the module a key so search() runs; client tests don't hit the net."""
    monkeypatch.setattr(web_search_client, "TAVILY_API_KEY", "tvly-test-key")


def _patch_post(monkeypatch, fn):
    monkeypatch.setattr(web_search_client.requests, "post", fn)


def test_is_configured_reflects_key(monkeypatch):
    assert web_search_client.is_configured() is True
    monkeypatch.setattr(web_search_client, "TAVILY_API_KEY", None)
    assert web_search_client.is_configured() is False


def test_search_happy_path_parses_results(monkeypatch):
    payload = {
        "results": [
            {"title": "Doc One", "url": "https://a.com", "content": "alpha", "score": 0.9},
            {"title": "Doc Two", "url": "https://b.com", "content": "beta", "score": 0.5},
        ]
    }
    _patch_post(monkeypatch, lambda *a, **k: _FakeResponse(payload=payload))

    results = web_search_client.search("q", max_results=5)

    assert results == [
        {"title": "Doc One", "url": "https://a.com", "content": "alpha", "score": 0.9},
        {"title": "Doc Two", "url": "https://b.com", "content": "beta", "score": 0.5},
    ]


def test_search_skips_entries_without_url(monkeypatch):
    payload = {"results": [{"title": "no url", "content": "x"}, {"url": "https://ok.com"}]}
    _patch_post(monkeypatch, lambda *a, **k: _FakeResponse(payload=payload))

    results = web_search_client.search("q")

    assert len(results) == 1
    assert results[0]["url"] == "https://ok.com"
    assert results[0]["title"] == "https://ok.com"  # falls back to url when title missing


def test_search_caps_max_results(monkeypatch):
    captured = {}

    def _post(url, json, headers, timeout):
        captured["max_results"] = json["max_results"]
        return _FakeResponse(payload={"results": []})

    _patch_post(monkeypatch, _post)
    web_search_client.search("q", max_results=999)
    assert captured["max_results"] == web_search_client.RESULT_CAP


def test_timeout_maps_to_friendly_value_error(monkeypatch):
    def _post(*a, **k):
        raise requests.Timeout()

    _patch_post(monkeypatch, _post)
    with pytest.raises(ValueError, match="timed out"):
        web_search_client.search("q")


def test_auth_error_maps_to_config_message(monkeypatch):
    _patch_post(monkeypatch, lambda *a, **k: _FakeResponse(status_code=401))
    with pytest.raises(ValueError, match="configured"):
        web_search_client.search("q")


def test_rate_limit_maps_to_busy_message(monkeypatch):
    _patch_post(monkeypatch, lambda *a, **k: _FakeResponse(status_code=429))
    with pytest.raises(ValueError, match="busy"):
        web_search_client.search("q")


def test_connection_error_maps_to_unavailable(monkeypatch):
    def _post(*a, **k):
        raise requests.ConnectionError()

    _patch_post(monkeypatch, _post)
    with pytest.raises(ValueError, match="temporarily unavailable"):
        web_search_client.search("q")


def test_non_json_response_maps_to_friendly_error(monkeypatch):
    _patch_post(monkeypatch, lambda *a, **k: _FakeResponse(json_raises=True))
    with pytest.raises(ValueError, match="couldn't run a web search"):
        web_search_client.search("q")


def test_search_without_key_raises_without_calling_provider(monkeypatch):
    monkeypatch.setattr(web_search_client, "TAVILY_API_KEY", None)
    with pytest.raises(ValueError):
        web_search_client.search("q")
