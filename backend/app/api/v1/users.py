from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user, require_csrf
from models.user import (
    UserCreate,
    UserProfile,
    UserProfileUpdate,
    UserSettings,
    UserSettingsUpdate,
    UserUpdate,
    UserResponse,
)
from services import user_service
import db.connection as db_connection

router = APIRouter(prefix="/users", tags=["users"])


def get_db():
    return db_connection.client["rag_db"]


# --- Settings for the authenticated user ------------------------------------
# Scoped to the caller (via the session) rather than a path `user_id`, so a user
# can only ever read/write their own preferences. Declared before the dynamic
# `/{user_id}` routes so "me" is matched as a literal, not captured as an id.
@router.get("/me/settings", response_model=UserSettings)
def get_my_settings(user: dict = Depends(get_current_user)):
    settings = user_service.get_user_settings(get_db(), user["id"])
    if settings is None:
        raise HTTPException(status_code=404, detail="User not found")
    return settings


@router.patch(
    "/me/settings",
    response_model=UserSettings,
    dependencies=[Depends(require_csrf)],
)
def update_my_settings(
    body: UserSettingsUpdate, user: dict = Depends(get_current_user)
):
    settings = user_service.update_user_settings(get_db(), user["id"], body)
    if settings is None:
        raise HTTPException(status_code=404, detail="User not found")
    return settings


# --- Editable profile for the authenticated user ----------------------------
# Same "scoped to the caller via the session" rule as settings above, and
# declared before the dynamic `/{user_id}` routes so "me" stays a literal match.
@router.get("/me/profile", response_model=UserProfile)
def get_my_profile(user: dict = Depends(get_current_user)):
    profile = user_service.get_user_profile(get_db(), user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.patch(
    "/me/profile",
    response_model=UserProfile,
    dependencies=[Depends(require_csrf)],
)
def update_my_profile(
    body: UserProfileUpdate, user: dict = Depends(get_current_user)
):
    profile = user_service.update_user_profile(get_db(), user["id"], body)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.post(
    "/me/avatar/shuffle",
    response_model=UserProfile,
    dependencies=[Depends(require_csrf)],
)
def shuffle_my_avatar(user: dict = Depends(get_current_user)):
    """Assign a fresh random avatar URL to the caller and return the new profile."""
    profile = user_service.shuffle_avatar(get_db(), user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


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
