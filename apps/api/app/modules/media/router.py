# app/modules/media/router.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_vendor
from app.core.config.settings import settings
from app.modules.media.service import MediaService
from app.modules.media.schemas import ImageResponse
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus

router = APIRouter(
    prefix="/media",
    tags=["Media"]
)


@router.post("/upload", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    vendor_id: UUID = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads one image, creates its analysis record, and schedules one
    in-process FastAPI background analysis task.
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

    if len(await file.read(max_size_bytes + 1)) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum allowed size is {settings.MAX_UPLOAD_SIZE}MB.",
        )
    await file.seek(0)

    # 3. Save File and Commit Database Record
    service = MediaService(db)
    image = None
    try:
        image = await service.upload_image(vendor_id, file, commit=False)
        analysis_record = AIAnalysis(
            vendor_id=vendor_id,
            image_id=image.id,
            image_url=image.storage_url,
            batch_id=None,
            provider=settings.AI_PROVIDER,
            model_name="gemini-3.6-flash" if settings.AI_PROVIDER in ("google", "gemini") else settings.AI_PROVIDER,
            status=AnalysisStatus.PROCESSING,
        )
        db.add(analysis_record)
        await db.commit()
        await db.refresh(image)
        await db.refresh(analysis_record)
    except Exception:
        await db.rollback()
        if image is not None:
            try:
                await service.delete(image.storage_url)
            except Exception:
                pass
        raise

    from app.modules.intelligence.router import run_background_analysis
    background_tasks.add_task(
        run_background_analysis,
        str(image.id),
        str(vendor_id),
        str(analysis_record.id),
    )

    return {**ImageResponse.model_validate(image).model_dump(), "analysis_id": analysis_record.id}