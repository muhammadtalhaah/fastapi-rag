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
# Tavily web-search API key (PBI 25335). Optional: when unset the Web Search
# agent degrades to a friendly "unavailable" message instead of crashing.
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

DEBUG = os.getenv("DEBUG", "false").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
