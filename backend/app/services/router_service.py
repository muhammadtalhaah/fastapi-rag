"""Intent router — picks exactly one agent route per turn.

Decision order (decided on PBI 25324):
  1. **Manual override.** An explicit ``mode`` of ``rag`` / ``general`` / ``web``
     always wins; classification is skipped entirely.
  2. **LLM classifier.** For ``auto`` (or any unrecognised value), a single
     cheap Chat Completions call labels the question as ``rag|general|web``.
  3. **Keyword-rule fallback.** If the LLM errors, times out, or returns junk,
     deterministic keyword rules decide.
  4. **Safe default.** If even the rules are inconclusive we fall back to
     :data:`DEFAULT_ROUTE`. The routing step therefore *never* raises — a
     failure degrades to a route, never a hard error (NFR on 25324).

The router only decides a *route string*; it does not know which agents are
actually registered. The orchestrator owns the "route has no agent yet"
fallback. This keeps routing logic independent of deployment state and easy to
unit-test by mocking the classifier.
"""

from __future__ import annotations

import logging
import time
from typing import Callable

logger = logging.getLogger(__name__)

#: Every route the router may emit, in priority order for the keyword fallback.
ROUTES: tuple[str, ...] = ("rag", "general", "web")

#: Where inconclusive auto-routing lands. RAG is the primary capability and the
#: only registered agent this sprint, so it is the safest place to default.
DEFAULT_ROUTE = "rag"

# Keyword heuristics for the deterministic fallback. Order matters: web
# (time-sensitive / live-lookup intent) is checked before general chit-chat.
_WEB_KEYWORDS = (
    "latest", "news", "today", "tonight", "currently", "current ", "right now",
    "this week", "this year", "recent", "breaking", "weather", "forecast",
    "stock price", "share price", "exchange rate", "score", "who won",
    "release date", "released", "as of", "up to date", "up-to-date",
)
_GENERAL_KEYWORDS = (
    "hello", "hi ", "hey", "thanks", "thank you", "how are you",
    "write me", "write a", "compose", "draft", "translate", "summarize this",
    "tell me a joke", "what can you do", "who are you",
)

# Single-token prompt so classification adds minimal latency/cost.
_CLASSIFIER_SYSTEM_PROMPT = (
    "You are an intent router for an assistant with three capabilities. "
    "Classify the user's message into EXACTLY ONE label and reply with only "
    "that lowercase word, nothing else:\n"
    "- rag: questions that should be answered from the user's own uploaded "
    "documents/knowledge base, or any question with no clear sign it needs live "
    "data or is pure chit-chat.\n"
    "- general: general knowledge, reasoning, writing, coding, math, or casual "
    "conversation that needs no documents and no live/web data.\n"
    "- web: anything needing current, real-time, or post-training information "
    "(news, prices, weather, recent events, 'latest', 'today').\n"
    "A follow-up that refers back to the previous turn (e.g. 'summarize it', "
    "'tell me more', 'what about X') should usually keep the SAME capability the "
    "previous turn used — if the prior turn was about the user's documents, a "
    "request to summarize or expand on it is still 'rag'.\n"
    "Reply with one word: rag, general, or web."
)


def _keyword_route(question: str) -> tuple[str, str]:
    """Deterministic fallback classifier. Returns (route, reason)."""
    q = question.lower()
    if any(kw in q for kw in _WEB_KEYWORDS):
        return "web", "keyword-fallback:web"
    if any(kw in q for kw in _GENERAL_KEYWORDS):
        return "general", "keyword-fallback:general"
    return DEFAULT_ROUTE, "keyword-fallback:default"


def _llm_classify(question: str, prior_user: str | None = None) -> str | None:
    """Single cheap LLM call -> one of ROUTES, or None if it can't decide.

    ``prior_user`` is the most recent prior user turn, supplied so the classifier
    can keep a follow-up ("summarize it") on the same capability the topic was
    being answered with. Imported lazily so test collection and modules that only
    need routing constants don't pull in the Azure/Voyage client initialisation.
    """
    from services.query_service import AZURE_DEPLOYMENT, azure_client

    user_content = question
    if prior_user:
        user_content = (
            f"Previous user turn: {prior_user}\n"
            f"Current user turn to classify: {question}"
        )

    resp = azure_client.chat.completions.create(
        model=AZURE_DEPLOYMENT,
        messages=[
            {"role": "system", "content": _CLASSIFIER_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_completion_tokens=4,
    )
    raw = (resp.choices[0].message.content or "").strip().lower()
    # Be liberal in what we accept: the model may add punctuation/quotes.
    for route in ROUTES:
        if route in raw:
            return route
    return None


def resolve_route(
    question: str,
    mode: str | None = "auto",
    *,
    web_search: bool = True,
    prior_user: str | None = None,
    classifier: Callable[..., str | None] | None = None,
) -> tuple[str, str]:
    """Resolve the route for a turn. Returns ``(route, reason)``.

    ``mode`` is the client-supplied override; anything outside ROUTES (including
    ``""``/``None``/``"auto"``) means "decide automatically". ``classifier`` is
    injectable for testing; it defaults to the LLM classifier.

    ``prior_user`` is the most recent prior user turn (if any), passed to the
    classifier so a follow-up stays on the same capability as the topic it
    refers back to.

    ``web_search`` gates auto-routing only: when ``False``, an auto-picked
    ``web`` route is downgraded to ``DEFAULT_ROUTE`` so the assistant answers
    from documents / model knowledge instead. An explicit ``mode="web"``
    override is intentional and bypasses the gate.
    """
    normalized = (mode or "").strip().lower()
    if normalized in ROUTES:
        logger.info("[router] manual override -> %s", normalized)
        return normalized, "manual-override"

    classify = classifier or _llm_classify
    t0 = time.perf_counter()
    try:
        # The injected test classifier may accept only (question); fall back to
        # a single-arg call so prior-turn context never breaks a custom classifier.
        try:
            route = classify(question, prior_user)
        except TypeError:
            route = classify(question)
    except Exception:
        logger.warning("[router] classifier failed, using keyword fallback", exc_info=True)
        route = None
    elapsed_ms = (time.perf_counter() - t0) * 1000

    if route in ROUTES:
        if route == "web" and not web_search:
            logger.info("[router] llm classifier -> web but web_search disabled -> %s", DEFAULT_ROUTE)
            return DEFAULT_ROUTE, "web-disabled"
        logger.info("[router] llm classifier -> %s (%.0f ms)", route, elapsed_ms)
        return route, "llm-classifier"

    fallback_route, reason = _keyword_route(question)
    if fallback_route == "web" and not web_search:
        logger.info("[router] keyword fallback -> web but web_search disabled -> %s", DEFAULT_ROUTE)
        return DEFAULT_ROUTE, "web-disabled"
    logger.info("[router] %s -> %s (classifier inconclusive, %.0f ms)", reason, fallback_route, elapsed_ms)
    return fallback_route, reason
