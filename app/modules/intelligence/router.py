import asyncio
import json
import logging
import traceback
import uuid
from typing import List, Union
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
    BackgroundTasks,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.auth import get_current_vendor
from app.core.database import async_session_maker, get_db
from app.modules.catalog.models import DetectedProduct
from app.modules.identity.models import User
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.schemas import DetectedProductResponse
from app.modules.intelligence.service import IntelligenceService
from app.modules.media.models import ProductImage

from .websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/analysis",
    tags=["AI Analysis"]
)

# Registry to hold strong references to running background tasks to prevent GC cleanups
BACKGROUND_TASKS_REGISTRY: set[asyncio.Task] = set()
MAX_BATCH_SIZE = 10


def _extract_vendor_id(vendor: Union[User, dict, UUID, str]) -> Union[UUID, str]:
    """
    Safely resolves the vendor ID regardless of whether dependency injection returns
    an ORM model, a dict, or a raw UUID instance.
    """
    if isinstance(vendor, dict):
        return vendor.get("id")
    if hasattr(vendor, "id"):
        return vendor.id
    return vendor


# ---------------------------------------------------------
# Real-Time WebSocket Endpoint
# ---------------------------------------------------------
@router.websocket("/ws/{vendor_id}")
async def websocket_analysis_endpoint(websocket: WebSocket, vendor_id: str):
    """
    Two-way WebSocket endpoint:
    1. Server streams real-time AI progress updates back to the vendor.
    2. Vendor can send control signals (e.g., job cancellation) back to the server.
    """
    await ws_manager.connect(vendor_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data) if data.startswith("{") else {"action": data}

            if payload.get("action") == "CANCEL_JOB":
                analysis_id = payload.get("analysis_id")
                logger.info(f"[WS CLIENT CMD 🛑] Vendor requested cancel for Analysis {analysis_id}")
                
                await ws_manager.send_personal_message({
                    "event": "JOB_CANCELLED",
                    "analysis_id": analysis_id,
                    "message": "Cancellation request acknowledged by server."
                }, websocket)

    except WebSocketDisconnect:
        ws_manager.disconnect(vendor_id, websocket)
    except Exception as err:
        logger.error(f"[WS DISCONNECT EXCEPTION 🚨] {err}")
        ws_manager.disconnect(vendor_id, websocket)


# ---------------------------------------------------------
# Background Worker with Live WS Event Broadcasts
# ---------------------------------------------------------
def _coerce_uuid(value: Union[str, UUID, None], field_name: str) -> Union[UUID, None]:
    if value in (None, "", "None", "null"):
        return None
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except (ValueError, AttributeError, TypeError):
            logger.warning(f"[BACKGROUND WORKER ⚠️] Invalid {field_name}: {value}")
            return None
    return None


async def run_background_analysis(image_id: str, vendor_id: str, analysis_id: str):
    """
    Decoupled background worker running outside the HTTP request timeline.
    Spins up an isolated DB session and pushes live updates via WebSocket.
    """
    analysis_uuid = _coerce_uuid(analysis_id, "analysis_id")
    image_uuid = _coerce_uuid(image_id, "image_id")
    vendor_uuid = _coerce_uuid(vendor_id, "vendor_id")

    if analysis_uuid is None:
        logger.error("[BACKGROUND WORKER ❌] Aborting: analysis_id is missing or invalid.")
        return

    logger.info(f"[BACKGROUND WORKER] 🚀 Starting async analysis pipeline loop for ID: {analysis_uuid}")

    # 1. WS Broadcast: Processing Started
    await ws_manager.broadcast_to_vendor(str(vendor_uuid or vendor_id), {
        "event": "ANALYSIS_STARTED",
        "analysis_id": str(analysis_uuid),
        "image_id": str(image_uuid or image_id),
        "status": "PROCESSING"
    })

    async with async_session_maker() as standalone_db:
        try:
            if image_uuid is None:
                logger.error("[BACKGROUND WORKER ❌] Aborting: image_id is missing or invalid.")
                return

            # Fetch product image
            img_result = await standalone_db.execute(
                select(ProductImage).where(ProductImage.id == image_uuid)
            )
            real_image = img_result.scalar_one_or_none()
            if not real_image:
                logger.error(f"[BACKGROUND WORKER ❌] Aborting: Image {image_uuid} could not be resolved.")
                return

            # Fetch vendor profile
            vendor_result = await standalone_db.execute(
                select(User).where(User.id == vendor_uuid)
            )
            real_vendor = vendor_result.scalar_one_or_none()
            if not real_vendor:
                logger.error(f"[BACKGROUND WORKER ❌] Aborting: Vendor {vendor_uuid} could not be found in database.")
                return

            # Build geographic context profile
            vendor_country = getattr(real_vendor, "country", "Global") or "Global"
            vendor_region = getattr(real_vendor, "region_code", "Standard") or "Standard"
            vendor_language = getattr(real_vendor, "preferred_language", "en") or "en"

            localization_prompt = (
                f"The vendor uploading this retail batch is located in: Country: {vendor_country}, "
                f"Region/State: {vendor_region}. Output all localized SKU names, native spelling variations, "
                f"and market-specific product variants common to that geography. "
                f"Generate the descriptions and text fields primarily in the language code: '{vendor_language}'."
            )

            ai_context = {
                "prompt": localization_prompt,
                "country": vendor_country,
                "region": vendor_region,
                "language": vendor_language
            }

            service = IntelligenceService(standalone_db)
            logger.info(f"[BACKGROUND WORKER] Handing off real data + Location Context ({vendor_country}) to IntelligenceService...")
            
            await service.analyze(image=real_image, vendor=real_vendor, analysis_id=str(analysis_uuid), context=ai_context)

            # 2. WS Broadcast: Processing Succeeded
            await ws_manager.broadcast_to_vendor(str(vendor_uuid or vendor_id), {
                "event": "ANALYSIS_COMPLETED",
                "analysis_id": str(analysis_uuid),
                "image_id": str(image_uuid or image_id),
                "status": "COMPLETED"
            })
            logger.info(f"[BACKGROUND WORKER 🎉] Successfully updated analysis state table for row {analysis_uuid}")

        except Exception as bg_err:
            logger.error(f"[BACKGROUND WORKER 🚨] Task execution crash: {str(bg_err)}")
            traceback.print_exc()

            # 3. WS Broadcast: Processing Failed
            await ws_manager.broadcast_to_vendor(str(vendor_uuid or vendor_id), {
                "event": "ANALYSIS_FAILED",
                "analysis_id": str(analysis_uuid),
                "image_id": str(image_uuid or image_id),
                "error": str(bg_err),
                "status": "FAILED"
            })

            try:
                analysis_result = await standalone_db.execute(
                    select(AIAnalysis).where(AIAnalysis.id == analysis_uuid)
                )
                failed_analysis = analysis_result.scalar_one_or_none()
                if failed_analysis:
                    failed_analysis.status = AnalysisStatus.FAILED
                    await standalone_db.commit()
                    logger.warning("[BACKGROUND WORKER ⚠️] Fallback status forced to FAILED.")
            except Exception as rollback_err:
                logger.error(f"[BACKGROUND WORKER ❌] Could not save fallback safety error state flag: {rollback_err}")


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.post("/batch/start", status_code=status.HTTP_202_ACCEPTED)
async def start_batch_analysis(
    image_ids: List[str],
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Production Batch Endpoint: Accepts up to 10 image IDs, groups them under a single 
    batch_id tracking profile, and triggers asynchronous parallel processing streams.
    """
    if not image_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="The image IDs payload array cannot be empty."
        )
        
    if len(image_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size exceeds maximum production allowance limit of {MAX_BATCH_SIZE} images."
        )

    try:
        vendor_id = _extract_vendor_id(vendor)
        generated_batch_id = uuid.uuid4()
        processing_manifest = []

        for img_id in image_ids:
            result = await db.execute(
                select(ProductImage).where(ProductImage.id == img_id)
            )
            real_image = result.scalar_one_or_none()

            if not real_image:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=f"Image asset {img_id} not found."
                )

            analysis_record = AIAnalysis(
                vendor_id=vendor_id,
                image_id=real_image.id,
                image_url=real_image.storage_url,  
                batch_id=generated_batch_id,
                provider="google",
                model_name="gemini-2.5-flash",
                status=AnalysisStatus.PROCESSING
            )
            db.add(analysis_record)
            processing_manifest.append((str(real_image.id), str(analysis_record.id)))

        await db.commit()

        for image_uuid, analysis_uuid in processing_manifest:
            task = asyncio.create_task(
                run_background_analysis(
                    image_id=image_uuid,
                    vendor_id=str(vendor_id),
                    analysis_id=analysis_uuid
                )
            )
            BACKGROUND_TASKS_REGISTRY.add(task)  
            task.add_done_callback(BACKGROUND_TASKS_REGISTRY.discard)

        return {
            "status": "queued",
            "message": f"Successfully initiated structured batch analytics for {len(processing_manifest)} files.",
            "batch_id": str(generated_batch_id),
            "individual_task_ids": [tid for _, tid in processing_manifest]
        }
    except Exception as e:
        await db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# app/modules/intelligence/router.py (Abbreviated section around start_single_analysis)
# ...
@router.post("/start/{image_id}", status_code=status.HTTP_202_ACCEPTED)
async def start_single_analysis(
    image_id: str,
    background_tasks: BackgroundTasks,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db),
):
    try:
        vendor_id = _extract_vendor_id(vendor) # vendor is a UUID
        
        result = await db.execute(
            select(ProductImage).where(ProductImage.id == image_id)
        )
        real_image = result.scalar_one_or_none()

        if not real_image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Image asset {image_id} not found."
            )

        analysis_record = AIAnalysis(
            vendor_id=vendor_id,
            image_id=real_image.id,
            image_url=real_image.storage_url,  
            batch_id=None,  
            provider="google",
            model_name="gemini-2.5-flash",
            status=AnalysisStatus.PROCESSING
        )
        db.add(analysis_record)
        await db.commit()
        await db.refresh(analysis_record)

        # 🟢 Queue task in Celery, fallback to FastAPI BackgroundTasks out-of-the-box
        try:
            from app.infrastructure.queue.tasks import analyze_product_image_task
            analyze_product_image_task.delay(
                str(real_image.id),
                str(vendor_id),
                str(analysis_record.id)
            )
        except Exception:
            if background_tasks is not None:
                from app.infrastructure.queue.tasks import run_async_analysis
                background_tasks.add_task(
                    run_async_analysis,
                    str(real_image.id),
                    str(vendor_id),
                    str(analysis_record.id)
                )
            else:
                from app.infrastructure.queue.tasks import run_async_analysis
                asyncio.create_task(
                    run_async_analysis(
                        str(real_image.id),
                        str(vendor_id),
                        str(analysis_record.id)
                    )
                )

        return {
            "status": "queued",
            "message": "Single asset analysis pipeline initiated successfully.",
            "id": str(analysis_record.id),
            "analysis_id": str(analysis_record.id),
            "image_id": str(real_image.id)
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
@router.post("/test-bypass", status_code=status.HTTP_202_ACCEPTED)
async def start_analysis_test(
    db: AsyncSession = Depends(get_db)
):
    """🔥 TEMPORARY TEST ENDPOINT: Bypasses OAuth2 authentication entirely."""
    try:
        img_result = await db.execute(select(ProductImage).limit(3))
        images = img_result.scalars().all()

        if not images:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Your product_images table is empty! Upload assets first."
            )
        
        vendor_select = await db.execute(select(User).limit(1))
        fallback_vendor = vendor_select.scalar_one_or_none()
        
        if not fallback_vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registered vendors exist to attach the test-bypass payload to."
            )

        generated_batch_id = uuid.uuid4()
        test_manifest = []

        for img in images:
            analysis_record = AIAnalysis(
                vendor_id=fallback_vendor.id,
                image_id=img.id,
                image_url=img.storage_url,  
                batch_id=generated_batch_id,
                provider="google",
                model_name="gemini-2.5-flash",
                status=AnalysisStatus.PROCESSING
            )
            db.add(analysis_record)
            test_manifest.append((str(img.id), str(analysis_record.id)))

        await db.commit()
        
        for image_uuid, analysis_uuid in test_manifest:
            task = asyncio.create_task(
                run_background_analysis(
                    image_id=image_uuid,
                    vendor_id=str(fallback_vendor.id),
                    analysis_id=analysis_uuid
                )
            )
            BACKGROUND_TASKS_REGISTRY.add(task)
            task.add_done_callback(BACKGROUND_TASKS_REGISTRY.discard)
        
        return {
            "message": "🔥 SUCCESS! Batch Test Bypass Triggered.",
            "batch_id": str(generated_batch_id),
            "queued_task_count": len(test_manifest)
        }
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/batch/{batch_id}")
async def get_batch_status(
    batch_id: UUID,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the combined tracking status for all images uploaded together under one batch_id."""
    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.batch_id == batch_id)
    )
    analyses = result.scalars().all()
    
    if not analyses:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No analytics records found for this batch ID.")
        
    return {
        "batch_id": str(batch_id),
        "total_images": len(analyses),
        "statuses": [
            {
                "analysis_id": str(a.id),
                "image_id": str(a.image_id),
                "status": a.status,
                "detected_count": a.detected_count,
                "processing_time": a.processing_time
            } for a in analyses
        ]
    }


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: UUID,  
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """Vendor checks a specific individual AI processing status row."""
    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis record not found")
    return analysis


@router.get("/{analysis_id}/products", response_model=List[DetectedProductResponse])
async def get_detected_products(
    analysis_id: UUID,  
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches processed records from the database instead of the raw AI JSON dump,
    forcing Pydantic to convert 'market_sku' into 'sku' for the dashboard.
    """
    analysis_check = await db.execute(
        select(AIAnalysis).where(AIAnalysis.id == analysis_id)
    )
    analysis = analysis_check.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis record not found")

    result = await db.execute(
        select(DetectedProduct).where(DetectedProduct.analysis_id == analysis_id)
    )
    return result.scalars().all()


@router.get("/test-batch/{batch_id}")
async def get_test_batch_status(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """🔥 TEST ONLY: Bypass auth to inspect batch status."""
    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.batch_id == batch_id)
    )
    analyses = result.scalars().all()

    if not analyses:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No analysis records found for this batch ID.")

    return {
        "batch_id": str(batch_id),
        "total_images": len(analyses),
        "statuses": [
            {
                "analysis_id": str(a.id),
                "image_id": str(a.image_id),
                "status": a.status,
                "detected_count": a.detected_count,
                "processing_time": a.processing_time
            } for a in analyses
        ]
    }


@router.get("/test-products/{analysis_id}", response_model=List[DetectedProductResponse])
async def get_test_detected_products(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """🔥 TEST ONLY: Bypass auth to fetch extracted products."""
    result = await db.execute(
        select(DetectedProduct).where(DetectedProduct.analysis_id == analysis_id)
    )
    products = result.scalars().all()
    return products