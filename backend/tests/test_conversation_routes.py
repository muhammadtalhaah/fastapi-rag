from services import conversation_service

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
CONVERSATIONS = "/api/v1/conversations"

CREDS = {"name": "Ada", "email": "ada@example.com", "password": "supersecret1"}


def _register_and_login(client):
    assert client.post(REGISTER, json=CREDS).status_code == 201
    response = client.post(LOGIN, json={"email": CREDS["email"], "password": CREDS["password"]})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _register_and_login_full(client):
    """Like _register_and_login but also returns the authenticated user's id, so
    tests can seed data owned by the logged-in user (the id is a real ObjectId
    string, not a fixed value)."""
    assert client.post(REGISTER, json=CREDS).status_code == 201
    response = client.post(LOGIN, json={"email": CREDS["email"], "password": CREDS["password"]})
    assert response.status_code == 200
    body = response.json()
    return body["csrf_token"], body["user"]["id"]


def test_patch_conversation_renames_owned_conversation(client, db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Original Title")
    csrf, user_id = _register_and_login_full(client)
    conversation_id = conversation_service.create_conversation(db, user_id, "what is our leave policy?")

    response = client.patch(
        f"{CONVERSATIONS}/{conversation_id}",
        json={"title": "Leave Policy Overview"},
        headers={"X-CSRF-Token": csrf},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == conversation_id
    assert body["title"] == "Leave Policy Overview"


def test_delete_conversation_removes_owned_conversation(client, db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Original Title")
    csrf, user_id = _register_and_login_full(client)
    conversation_id = conversation_service.create_conversation(db, user_id, "what is our leave policy?")

    response = client.delete(
        f"{CONVERSATIONS}/{conversation_id}",
        headers={"X-CSRF-Token": csrf},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert conversation_service.get_conversation(db, conversation_id, user_id) is None


def test_search_endpoint_returns_matching_conversations(client, db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Leave Policy")
    _, user_id = _register_and_login_full(client)
    conversation_id = conversation_service.create_conversation(db, user_id, "what is our leave policy?")
    conversation_service.append_turn(
        db, conversation_id, user_id,
        question="what is our leave policy?",
        answer="Employees get 20 days of annual leave.",
        sources=[],
    )

    response = client.get(f"{CONVERSATIONS}/search", params={"q": "annual leave"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["results"][0]["id"] == conversation_id
    assert body["limit"] == 20
    assert body["offset"] == 0
    assert body["has_more"] is False


def test_search_endpoint_requires_query(client):
    _register_and_login(client)
    response = client.get(f"{CONVERSATIONS}/search")
    assert response.status_code == 422


def test_search_endpoint_requires_auth(client):
    response = client.get(f"{CONVERSATIONS}/search", params={"q": "anything"})
    assert response.status_code == 401