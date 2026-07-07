from unittest import result

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.identity.models import Vendor
from uuid import UUID

class VendorRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Vendor | None:
        result = await self.db.execute(select(Vendor).where(Vendor.email == email))
        return result.scalar_one_or_none()

    async def create(self, vendor: Vendor) -> Vendor:
        self.db.add(vendor)
        await self.db.commit()
        await self.db.refresh(vendor)
        return vendor
    
    async def get_by_id(
        self,
        vendor_id: UUID
    ):
        """
        Finds vendor using JWT subject id.
        """
        result = await self.db.execute(

            select(Vendor)
            .where(
                Vendor.id == vendor_id
            )
        )
        return result.scalar_one_or_none()