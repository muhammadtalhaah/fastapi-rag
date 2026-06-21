"""
Application API key configuration.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_BASE_URL = os.getenv("AZURE_OPENAI_BASE_URL")
MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")
