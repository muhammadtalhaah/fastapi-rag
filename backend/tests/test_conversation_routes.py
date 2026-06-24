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


def test_patch_conversation_renames_owned_conversation(client, db, monkeypatch):
    monkeypatch.setattr(conversation_service, "generate_title", lambda question, answer="": "Original Title")
    csrf = _register_and_login(client)
    conversation_id = conversation_service.create_conversation(db, "1", "what is our leave policy?")

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
    csrf = _register_and_login(client)
    conversation_id = conversation_service.create_conversation(db, "1", "what is our leave policy?")

    response = client.delete(
        f"{CONVERSATIONS}/{conversation_id}",
        headers={"X-CSRF-Token": csrf},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert conversation_service.get_conversation(db, conversation_id, "1") is None