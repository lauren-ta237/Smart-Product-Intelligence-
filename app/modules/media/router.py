# app/modules/media/router.py
import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_vendor
from app.core.config.settings import settings
from app.modules.media.service import MediaService
from app.modules.media.schemas import ImageResponse
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.infrastructure.queue.tasks import analyze_product_image_task

router = APIRouter(
    prefix="/media",
    tags=["Media"]
)


@router.post("/upload", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    vendor_id: UUID = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Vendor uploads an image, stores metadata with validation limits,
    and automatically initiates the background Celery task analysis.
    """
    # 1. Content Type Verification
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Supported types: JPEG, PNG, and WEBP."
        )

    # 2. Maximum Size Cap Verification
    max_size_bytes = settings.MAX_UPLOAD_SIZE * 1024 * 1024
    content_length = file.headers.get("content-length")
    if content_length and int(content_length) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum allowed size is {settings.MAX_UPLOAD_SIZE}MB."
        )

    # 3. Save File and Commit Database Record
    service = MediaService(db)
    image = await service.upload_image(vendor_id, file)

    # 4. Auto-generate tracking row
    analysis_record = AIAnalysis(
        vendor_id=vendor_id,
        image_id=image.id,
        image_url=image.storage_url,
        batch_id=None,
        provider="google",
        model_name="gemini-2.5-flash",
        status=AnalysisStatus.PROCESSING
    )
    db.add(analysis_record)
    await db.commit()
    await db.refresh(analysis_record)

    # 5. Hand Off to Celery Task Queue, fallback to FastAPI BackgroundTasks out-of-the-box
    try:
        analyze_product_image_task.delay(
            str(image.id),
            str(vendor_id),
            str(analysis_record.id)
        )
    except Exception:
        if background_tasks:
            from app.infrastructure.queue.tasks import run_async_analysis
            background_tasks.add_task(
                run_async_analysis,
                str(image.id),
                str(vendor_id),
                str(analysis_record.id)
            )

    return image