"""
Conversation history router (authenticated users only).

List / read / delete durable conversations. Writing happens in the query WS flow
(query.py), not here — these are the read+manage endpoints the sidebar uses.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

import db.connection as db_connection
from api.deps import get_current_user, require_csrf
from models.conversation import (
    ConversationDetail,
    ConversationSearchResponse,
    ConversationSummary,
    ConversationUpdate,
)
from services import conversation_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["conversations"])


def get_db() -> Database:
    return db_connection.client["rag_db"]


@router.get("", response_model=list[ConversationSummary])
def list_conversations(user: dict = Depends(get_current_user)):
    """All of the current user's conversations, newest first (no message bodies)."""
    db = get_db()
    return conversation_service.list_conversations(db, user["id"])


@router.get("/search", response_model=ConversationSearchResponse)
def search_conversations(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """Search the current user's conversation titles and message bodies.

    Returns relevance-ordered matches with message snippets and the metadata the
    sidebar search modal needs to navigate to a matching message. Declared before
    the `/{conversation_id}` route so "search" isn't captured as a conversation id.
    """
    db = get_db()
    return conversation_service.search_conversations(db, user["id"], q, limit=limit, offset=offset)


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Full transcript of one conversation. 404 if it isn't the user's."""
    db = get_db()
    convo = conversation_service.get_conversation(db, conversation_id, user["id"])
    if not convo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return convo


@router.patch("/{conversation_id}", response_model=ConversationSummary, dependencies=[Depends(require_csrf)])
def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    user: dict = Depends(get_current_user),
):
    """Rename one of the user's conversations."""
    db = get_db()
    convo = conversation_service.rename_conversation(db, conversation_id, user["id"], body.title)
    if not convo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return convo


@router.delete("/{conversation_id}", dependencies=[Depends(require_csrf)])
def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Delete one of the user's conversations."""
    db = get_db()
    deleted = conversation_service.delete_conversation(db, conversation_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"deleted": True}
