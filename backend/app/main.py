import logging

from db import lifespan
from fastapi import FastAPI
from api.v1 import router as v1_router
from config import settings
from config.api_keys import DEBUG, LOG_LEVEL
from typing import cast, Literal
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(lifespan=lifespan)

# SessionMiddleware holds the short-lived OAuth `state`/nonce during the Google
# redirect round-trip (Authlib stores it here). This is unrelated to our app's
# server-side session store — it only secures the OAuth handshake. Cookie flags
# match the auth cookies so it behaves consistently in dev vs prod.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.oauth_state_secret,
    same_site=cast(Literal["lax", "strict", "none"], settings.cookie_samesite),
    https_only=settings.cookie_secure,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)

def main():
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=DEBUG,
        log_level=LOG_LEVEL,
    )

if __name__ == "__main__":
    main()
