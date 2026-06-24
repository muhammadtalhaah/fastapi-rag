"""Router / classifier tests (PBI 25324, task 25327).

The LLM classifier is always injected here, so these tests make no network
calls and assert routing logic in isolation.
"""
from services import router_service


# --- Manual override always wins ------------------------------------------

def test_manual_override_each_route():
    for route in ("rag", "general", "web"):
        # A classifier that would disagree must be ignored on a manual override.
        decided, reason = router_service.resolve_route(
            "anything", route, classifier=lambda q: "web"
        )
        assert decided == route
        assert reason == "manual-override"


def test_manual_override_is_normalized():
    decided, reason = router_service.resolve_route("q", "  RAG  ", classifier=lambda q: "web")
    assert decided == "rag"
    assert reason == "manual-override"


# --- Auto routing via the LLM classifier -----------------------------------

def test_auto_uses_classifier_result():
    decided, reason = router_service.resolve_route("q", "auto", classifier=lambda q: "general")
    assert decided == "general"
    assert reason == "llm-classifier"


def test_blank_and_unknown_mode_fall_through_to_auto():
    for mode in ("", None, "auto", "bogus-mode"):
        decided, reason = router_service.resolve_route("q", mode, classifier=lambda q: "web")
        assert decided == "web"
        assert reason == "llm-classifier"


# --- Fallback when the classifier can't decide -----------------------------

def test_classifier_junk_falls_back_to_keywords():
    decided, reason = router_service.resolve_route(
        "tell me about the document", "auto", classifier=lambda q: "banana"
    )
    assert decided == "rag"
    assert reason == "keyword-fallback:default"


def test_classifier_exception_never_raises_and_falls_back():
    def boom(_q):
        raise RuntimeError("LLM down")

    decided, reason = router_service.resolve_route(
        "what is the latest news today", "auto", classifier=boom
    )
    assert decided == "web"
    assert reason == "keyword-fallback:web"


# --- Deterministic keyword rules -------------------------------------------

def test_keyword_rules_web_general_default():
    # classifier returns None -> keyword rules decide
    none = lambda q: None
    assert router_service.resolve_route("what's the weather today", "auto", classifier=none)[0] == "web"
    assert router_service.resolve_route("hello there", "auto", classifier=none)[0] == "general"
    assert router_service.resolve_route("summarize chapter three", "auto", classifier=none)[0] == "rag"
