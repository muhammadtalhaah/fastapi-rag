"""
Conversation history router (authenticated users only).

List / read / delete durable conversations. Writing happens in the query WS flow
(query.py), not here — these are the read+manage endpoints the sidebar uses.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

import db.connection as db_connection
from api.deps import get_current_user, require_csrf
from models.conversation import ConversationDetail, ConversationSummary, ConversationUpdate
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
