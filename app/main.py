from fastapi import FastAPI
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from contextlib import asynccontextmanager
from config import MONGODB_CONNECTION_STRING
import certifi

client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    # runs once on startup
    client = MongoClient(MONGODB_CONNECTION_STRING, server_api=ServerApi('1'), tlsCAFile=certifi.where())
    try:
        client.admin.command('ping')
        print("Connected to MongoDB!")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
    
    yield  # app runs here
    
    # runs once on shutdown
    client.close()
    print("MongoDB connection closed.")

app = FastAPI(lifespan=lifespan)
