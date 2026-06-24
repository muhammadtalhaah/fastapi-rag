import conversation_service


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
