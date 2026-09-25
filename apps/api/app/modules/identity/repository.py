# app/modules/identity/repository.py
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import User, UserRole


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str | UUID) -> Optional[User]:
        """Fetch a single user by primary key ID."""
        if isinstance(user_id, str):
            try:
                user_id = UUID(user_id)
            except ValueError:
                return None
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Fetch a user by email address."""
        stmt = select(User).where(User.email == email.lower().strip())
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_google_id(self, google_id: str) -> Optional[User]:
        """Fetch a user by their Google OAuth ID claim."""
        stmt = select(User).where(User.google_id == google_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """Persist a new user to the database."""
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User) -> User:
        """Save updates to an existing user entity."""
        await self.db.commit()
        await self.db.refresh(user)
        return user


class VendorRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: str | UUID) -> Optional[User]:
        """Fetch a user ensuring they have the VENDOR role."""
        if isinstance(user_id, str):
            try:
                user_id = UUID(user_id)
            except ValueError:
                return None

        stmt = select(User).where(
            User.id == user_id,
            User.role == UserRole.VENDOR
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, vendor_id: str | UUID) -> Optional[User]:
        """Alias for get_by_user_id since user ID doubles as vendor identity."""
        return await self.get_by_user_id(vendor_id)