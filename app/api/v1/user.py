from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.identity.models import User
from app.modules.identity.repository import UserRepository
from app.modules.identity.schemas import UserResponse, UserUpdate, PasswordChange
from app.modules.identity.service import IdentityService

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
):
    """
    Returns logged-in user profile.
    """
    return user


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates logged-in user profile fields.
    """
    service = IdentityService(UserRepository(db))
    try:
        return await service.update_profile(user, payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.patch("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Changes password for the current user.
    """
    service = IdentityService(UserRepository(db))
    try:
        await service.change_password(user, payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_my_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivates (soft-deletes) the current user account.
    """
    service = IdentityService(UserRepository(db))
    await service.deactivate_account(user)
    