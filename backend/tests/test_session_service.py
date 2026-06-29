from services import session_service


def test_pop_last_exchange_removes_trailing_user_assistant_pair():
    session = {"summary": "", "recent": [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
    ]}

    session_service.pop_last_exchange(session)

    assert session["recent"] == [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
    ]


def test_pop_last_exchange_handles_empty_window():
    session = {"summary": "", "recent": []}
    session_service.pop_last_exchange(session)
    assert session["recent"] == []


def test_pop_last_exchange_pops_lone_user_turn():
    # A trailing user turn without its assistant answer (e.g. an in-flight turn)
    # is still removed so a regeneration doesn't double the question.
    session = {"summary": "", "recent": [{"role": "user", "content": "q1"}]}
    session_service.pop_last_exchange(session)
    assert session["recent"] == []
