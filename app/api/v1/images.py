from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_current_vendor
from app.modules.media.service import MediaService

router = APIRouter(
    prefix="/images",
    tags=["Images"]
)

@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Vendor uploads product image.
    Requires authentication.
    The image belongs to the
    logged-in vendor.
    """
    service = MediaService(db)
    image = await service.upload_image(
        vendor.id,
        file
    )
    return {
        "id": image.id,
        "status": image.status,
        "url": image.storage_url
    }