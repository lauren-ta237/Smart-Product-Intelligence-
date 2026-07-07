from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.modules.identity.repository import VendorRepository
from app.modules.identity.service import IdentityService

async def get_vendor_repository(db: AsyncSession = Depends(get_db)) -> VendorRepository:
    return VendorRepository(db)

async def get_identity_service(repo: VendorRepository = Depends(get_vendor_repository)) -> IdentityService:
    return IdentityService(repo)