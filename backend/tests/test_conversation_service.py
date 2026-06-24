from services import conversation_service


def test_create_conversation_uses_generated_title(db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Leave Policy Summary")

    conversation_id = conversation_service.create_conversation(db, "user-1", "what is our leave policy?")
    convo = conversation_service.get_conversation(db, conversation_id, "user-1")

    assert convo is not None
    assert convo["title"] == "Leave Policy Summary"
    assert convo["messages"] == []


def test_generate_title_falls_back_to_derived_question(monkeypatch):
    class FailingCompletions:
        def create(self, **kwargs):
            raise RuntimeError("boom")

    class FailingChat:
        completions = FailingCompletions()

    class FailingClient:
        chat = FailingChat()

    monkeypatch.setattr(conversation_service, "azure_client", FailingClient())

    title = conversation_service.generate_title("   Explain the incident response process for contractors   ")

    assert title == "Explain the incident response process for contractors"


def test_rename_conversation_updates_sidebar_title(db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Initial Topic")
    conversation_id = conversation_service.create_conversation(db, "user-1", "how does PTO work?")

    updated = conversation_service.rename_conversation(db, conversation_id, "user-1", "Paid Time Off Rules")

    assert updated is not None
    assert updated["title"] == "Paid Time Off Rules"
    convo = conversation_service.get_conversation(db, conversation_id, "user-1")
    assert convo is not None
    assert convo["title"] == "Paid Time Off Rules"


def _seed(db, user_id, title):
    """Insert a conversation directly (bypassing LLM title generation)."""
    convo_id = db.conversations.insert_one({
        "user_id": user_id,
        "title": title,
        "messages": [],
        "created_at": conversation_service._now(),
        "updated_at": conversation_service._now(),
    }).inserted_id
    return str(convo_id)


def test_search_matches_message_body_and_returns_navigable_snippet(db):
    convo_id = _seed(db, "user-1", "Benefits questions")
    conversation_service.append_turn(
        db, convo_id, "user-1",
        question="How does the parental leave policy work?",
        answer="Parental leave is 12 weeks of paid time off.",
        sources=[],
    )

    out = conversation_service.search_conversations(db, "user-1", "parental leave")

    assert out["total"] == 1
    result = out["results"][0]
    assert result["id"] == convo_id
    # Both the question (index 0) and answer (index 1) mention "leave"; snippets
    # carry the array index used by the frontend to scroll to the message.
    indexes = {s["message_index"] for s in result["snippets"]}
    assert 0 in indexes
    assert any("leave" in s["snippet"].lower() for s in result["snippets"])


def test_search_matches_title_only(db):
    convo_id = _seed(db, "user-1", "Quarterly revenue report")

    out = conversation_service.search_conversations(db, "user-1", "revenue")

    assert out["total"] == 1
    assert out["results"][0]["title_match"] is True
    assert out["results"][0]["snippets"] == []


def test_search_is_scoped_to_user(db):
    mine = _seed(db, "user-1", "Onboarding checklist")
    _seed(db, "user-2", "Onboarding for new hires")

    out = conversation_service.search_conversations(db, "user-1", "onboarding")

    assert [r["id"] for r in out["results"]] == [mine]


def test_search_blank_query_returns_empty(db):
    _seed(db, "user-1", "Anything")
    out = conversation_service.search_conversations(db, "user-1", "   ")
    assert out == {"results": [], "total": 0, "limit": 20, "offset": 0, "has_more": False}


def test_search_pagination(db):
    for i in range(5):
        _seed(db, "user-1", f"Budget memo {i}")

    page1 = conversation_service.search_conversations(db, "user-1", "budget", limit=2, offset=0)
    page2 = conversation_service.search_conversations(db, "user-1", "budget", limit=2, offset=2)

    assert page1["total"] == 5
    assert len(page1["results"]) == 2
    assert page1["has_more"] is True
    assert len(page2["results"]) == 2
    # No overlap between pages.
    assert not ({r["id"] for r in page1["results"]} & {r["id"] for r in page2["results"]})
