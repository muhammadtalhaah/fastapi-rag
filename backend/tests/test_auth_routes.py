"""End-to-end HTTP tests for the auth flow using TestClient + mongomock."""
from config import settings

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
LOGOUT_ALL = "/api/v1/auth/logout-all"
ME = "/api/v1/auth/me"
REFRESH = "/api/v1/auth/refresh"

CREDS = {"name": "Ada", "email": "ada@example.com", "password": "supersecret1"}


def _register(client):
    return client.post(REGISTER, json=CREDS)


def _login(client, password=None):
    return client.post(LOGIN, json={"email": CREDS["email"], "password": password or CREDS["password"]})


def test_register_then_login_sets_cookies(client):
    r = _register(client)
    assert r.status_code == 201
    assert r.json()["email"] == CREDS["email"]
    assert "password" not in r.json() and "hashed_password" not in r.json()

    r = _login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == CREDS["email"]
    csrf = body["csrf_token"]
    assert csrf
    # Session + CSRF cookies were set.
    assert settings.session_cookie_name in client.cookies
    assert settings.csrf_cookie_name in client.cookies


def test_register_duplicate_email_conflicts(client):
    assert _register(client).status_code == 201
    r = _register(client)
    assert r.status_code == 409


def test_register_rejects_short_password(client):
    r = client.post(REGISTER, json={"name": "X", "email": "x@example.com", "password": "short"})
    assert r.status_code == 422  # pydantic validation


def test_me_requires_auth(client):
    assert client.get(ME).status_code == 401


def test_full_flow_me_logout(client):
    _register(client)
    csrf = _login(client).json()["csrf_token"]

    # Authenticated /me works.
    r = client.get(ME)
    assert r.status_code == 200
    assert r.json()["email"] == CREDS["email"]

    # Logout without CSRF header -> 403.
    assert client.post(LOGOUT).status_code == 403

    # Logout WITH CSRF header -> 200, session invalidated.
    r = client.post(LOGOUT, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert client.get(ME).status_code == 401


def test_login_wrong_password_rejected(client):
    _register(client)
    r = _login(client, password="wrong-password")
    assert r.status_code == 401


def test_brute_force_lockout(client, monkeypatch):
    monkeypatch.setattr(settings, "login_max_attempts", 3)
    _register(client)
    for _ in range(3):
        assert _login(client, password="wrong").status_code == 401
    # Now locked — even the CORRECT password is refused with 429.
    r = _login(client, password=CREDS["password"])
    assert r.status_code == 429


def test_refresh_rotates_session(client):
    _register(client)
    csrf = _login(client).json()["csrf_token"]
    old_session = client.cookies.get(settings.session_cookie_name)

    r = client.post(REFRESH, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    new_csrf = r.json()["csrf_token"]
    new_session = client.cookies.get(settings.session_cookie_name)

    assert new_session != old_session  # id rotated
    assert new_csrf != csrf
    # New session still authenticates.
    assert client.get(ME).status_code == 200


def test_logout_all_invalidates_session(client):
    _register(client)
    csrf = _login(client).json()["csrf_token"]
    r = client.post(LOGOUT_ALL, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert client.get(ME).status_code == 401


def test_login_does_not_leak_user_existence(client):
    # Unknown email and known-email-wrong-password both return identical 401.
    r1 = client.post(LOGIN, json={"email": "nobody@example.com", "password": "whatever12"})
    _register(client)
    r2 = _login(client, password="wrong-password")
    assert r1.status_code == r2.status_code == 401
    assert r1.json() == r2.json()
