from fastapi import APIRouter
from api.v1 import users, documents, ingest, query

router = APIRouter(prefix="/api/v1", redirect_slashes=False)
router.include_router(users.router)
router.include_router(documents.router)
router.include_router(ingest.router)
router.include_router(query.router)
