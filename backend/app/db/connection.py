import certifi
from fastapi import FastAPI
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from contextlib import asynccontextmanager
from config import MONGODB_CONNECTION_STRING
from db.indexes import ensure_indexes

client: MongoClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = MongoClient(
        MONGODB_CONNECTION_STRING,
        server_api=ServerApi('1'),
        tlsCAFile=certifi.where()
    )
    try:
        client.admin.command('ping')
        print("Connected to MongoDB!")
        # Ensure auth/session indexes exist (TTL, unique email/session_id).
        # Idempotent — safe to run on every boot.
        ensure_indexes(client["rag_db"])
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

    yield

    client.close()
    print("MongoDB connection closed.")
