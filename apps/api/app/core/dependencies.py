from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.identity.repository import UserRepository
from app.modules.identity.service import IdentityService


def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_identity_service(
    repo: UserRepository = Depends(get_user_repository),
) -> IdentityService:
    return IdentityService(repo)