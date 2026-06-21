from fastapi import APIRouter, HTTPException
from models.user import UserCreate, UserUpdate, UserResponse
from services import user_service
import db.connection as db_connection

router = APIRouter(prefix="/users", tags=["users"])


def get_db():
    return db_connection.client["rag_db"]


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(body: UserCreate):
    return user_service.create_user(get_db(), body)


@router.get("/", response_model=list[UserResponse])
def list_users():
    return user_service.list_users(get_db())


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user = user_service.get_user(get_db(), user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, body: UserUpdate):
    user = user_service.update_user(get_db(), user_id, body)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str):
    if not user_service.delete_user(get_db(), user_id):
        raise HTTPException(status_code=404, detail="User not found")
