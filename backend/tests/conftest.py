"""
Pytest fixtures for the auth test suite.

Uses mongomock so tests run with NO live MongoDB. The app uses bare imports with
`app/` on the path (e.g. `from services import ...`), so we add `backend/app` to
sys.path here to match the runtime import layout.
"""
import sys
from pathlib import Path

import mongomock
import pytest

# Match runtime import style: app modules import each other bare ("from db ...").
_APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(_APP_DIR) not in sys.path:
    sys.path.insert(0, str(_APP_DIR))


@pytest.fixture
def db():
    """A fresh in-memory mongomock `rag_db` database with auth indexes applied."""
    client = mongomock.MongoClient()
    database = client["rag_db"]
    from db.indexes import ensure_indexes

    ensure_indexes(database)
    return database


@pytest.fixture
def client(db, monkeypatch):
    """A FastAPI TestClient wired to the mongomock db.

    We point the global PyMongo client at mongomock so every `get_db()` in the
    app returns the in-memory database, then build a TestClient WITHOUT the
    lifespan (no real Mongo connection needed).
    """
    import db.connection as db_connection

    monkeypatch.setattr(db_connection, "client", db.client)

    from fastapi import FastAPI
    from api.v1 import router as v1_router

    app = FastAPI()  # no lifespan — db is already wired via the patched client
    app.include_router(v1_router)

    from fastapi.testclient import TestClient

    # base_url uses http; in tests COOKIE_SECURE must be false so the TestClient
    # stores the Set-Cookie (Secure cookies are dropped over http). We force it.
    from config import settings

    monkeypatch.setattr(settings, "cookie_secure", False)

    with TestClient(app) as c:
        # A stable User-Agent so session UA-binding doesn't reject follow-ups.
        c.headers.update({"User-Agent": "pytest-client/1.0"})
        yield c
