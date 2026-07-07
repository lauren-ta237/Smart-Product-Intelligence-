import traceback
import asyncio  
import uuid  # 🟢 Added alongside uppercase class to safely resolve raw generation methods
from uuid import UUID  # 🟢 Capitalized UUID for strict path param type annotations
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.modules.catalog.models import DetectedProduct, Product
# Adjust this path to wherever your schemas file lives:
from app.modules.intelligence.schemas import DetectedProductResponse

from app.core.database import get_db, async_session_maker
from app.core.auth import get_current_vendor  
from app.modules.media.models import ProductImage
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.service import IntelligenceService
from app.modules.identity.models import Vendor  

router = APIRouter(
    prefix="/analysis",
    tags=["AI Analysis"]
)

# Protect background tasks from garbage collection mid-execution
BACKGROUND_TASKS_REGISTRY = set()
MAX_BATCH_SIZE = 10

async def run_background_analysis(image_id: str, vendor_id: str, analysis_id: str):
    """
    Decoupled background worker running outside the HTTP request timeline.
    Spins up an isolated session to prevent premature connection timeouts.
    """
    print(f"\n[BACKGROUND WORKER] 🚀 Starting async analysis pipeline loop for ID: {analysis_id}", flush=True)
    
    async with async_session_maker() as standalone_db:
        try:
            # 1. Fetch the real product image record
            img_result = await standalone_db.execute(
                select(ProductImage).where(ProductImage.id == image_id)
            )
            real_image = img_result.scalar_one_or_none()
            
            if not real_image:
                print(f"[BACKGROUND WORKER ❌] Aborting: Image {image_id} could not be resolved.", flush=True)
                return

            # 2. Fetch the REAL database vendor record to provide all required profile attributes dynamically
            vendor_result = await standalone_db.execute(
                select(Vendor).where(Vendor.id == vendor_id)
            )
            real_vendor = vendor_result.scalar_one_or_none()
            
            if not real_vendor:
                print(f"[BACKGROUND WORKER ❌] Aborting: Vendor {vendor_id} could not be found in database.", flush=True)
                return
            
            # 🟢 STEP 3: Build a rich geographic context profile from vendor attributes
            # Fallback securely if the fields are unpopulated or null
            vendor_country = getattr(real_vendor, "country", "Global") or "Global"
            vendor_region = getattr(real_vendor, "region_code", "Standard") or "Standard"
            vendor_language = getattr(real_vendor, "preferred_language", "en") or "en"

            # Formulate location prompt instructions to injected into the VLM prompt matrix
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

            # 4. Hand off the actual database entities along with the location context parameters to the service engine
            service = IntelligenceService(standalone_db)
            print(f"[BACKGROUND WORKER] Handing off real data + Location Context ({vendor_country}) to IntelligenceService...", flush=True)
            
            # 🟢 CHANGED: Forwarded the ai_context object wrapper directly into the engine handler call
            await service.analyze(image=real_image, vendor=real_vendor, analysis_id=analysis_id, context=ai_context)
            print(f"[BACKGROUND WORKER 🎉] Successfully updated analysis state table for row {analysis_id}", flush=True)
            
        except Exception as bg_err:
            print(f"[BACKGROUND WORKER 🚨] Task execution crash: {str(bg_err)}", flush=True)
            traceback.print_exc()
            
            try:
                analysis_result = await standalone_db.execute(
                    select(AIAnalysis).where(AIAnalysis.id == analysis_id)
                )
                failed_analysis = analysis_result.scalar_one_or_none()
                if failed_analysis:
                    failed_analysis.status = AnalysisStatus.FAILED
                    await standalone_db.commit()
                    print("[BACKGROUND WORKER ⚠️] Fallback status forced to FAILED.", flush=True)
            except Exception:
                print("[BACKGROUND WORKER ❌] Could not save fallback safety error state flag.", flush=True)


@router.post("/batch/start", status_code=status.HTTP_202_ACCEPTED)
async def start_batch_analysis(
    image_ids: list[str],
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Production Batch Endpoint: Accepts up to 10 image IDs, groups them under a single 
    batch_id tracking profile, and triggers asynchronous parallel processing streams.
    """
    if not image_ids:
        raise HTTPException(status_code=400, detail="The image IDs payload array cannot be empty.")
        
    if len(image_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size exceeds maximum production allowance limit of {MAX_BATCH_SIZE} images."
        )

    try:
        vendor_id = vendor.id if hasattr(vendor, "id") else vendor.get("id")
        generated_batch_id = UUID(int=uuid.uuid4().int)
        processing_manifest = []

        for img_id in image_ids:
            result = await db.execute(
                select(ProductImage).where(ProductImage.id == img_id)
            )
            real_image = result.scalar_one_or_none()

            if not real_image:
                raise HTTPException(status_code=404, detail=f"Image asset {img_id} not found.")

            analysis_record = AIAnalysis(
                vendor_id=vendor_id,
                image_id=real_image.id,
                image_url=real_image.storage_url,  
                batch_id=generated_batch_id,
                provider="google",
                model_name="gemini-2.5-flash", # Updated target naming to match your active provider class
                status=AnalysisStatus.PROCESSING
            )
            db.add(analysis_record)
            processing_manifest.append((str(real_image.id), str(analysis_record.id)))

        await db.commit()

        # Fire worker task threads asynchronously using completely isolated session pools
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
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start/{image_id}", status_code=status.HTTP_202_ACCEPTED)
async def start_single_analysis(
    image_id: str,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    On-demand single image analysis pipeline trigger.
    Matches frontend POST requests to /api/v1/analysis/start/{image_id}
    """
    try:
        vendor_id = vendor.id if hasattr(vendor, "id") else vendor.get("id")
        
        # Verify the target image exists and belongs to the ecosystem
        result = await db.execute(
            select(ProductImage).where(ProductImage.id == image_id)
        )
        real_image = result.scalar_one_or_none()

        if not real_image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Image asset {image_id} not found."
            )

        # Create an individual tracking manifest record
        analysis_record = AIAnalysis(
            vendor_id=vendor_id,
            image_id=real_image.id,
            image_url=real_image.storage_url,  
            batch_id=None,  
            provider="google",
            model_name="gemini-2.5-flash", # Synced string value targeting
            status=AnalysisStatus.PROCESSING
        )
        db.add(analysis_record)
        await db.commit()
        await db.refresh(analysis_record)

        # Offload computer vision processing loops to the background registry thread
        task = asyncio.create_task(
            run_background_analysis(
                image_id=str(real_image.id),
                vendor_id=str(vendor_id),
                analysis_id=str(analysis_record.id)
            )
        )
        BACKGROUND_TASKS_REGISTRY.add(task)
        task.add_done_callback(BACKGROUND_TASKS_REGISTRY.discard)

        return {
            "status": "queued",
            "message": "Single asset analysis pipeline initiated successfully.",
            "id": str(analysis_record.id),
            "analysis_id": str(analysis_record.id),
            "image_id": str(real_image.id)
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-bypass", status_code=status.HTTP_202_ACCEPTED)
async def start_analysis_test(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    🔥 TEMPORARY TEST ENDPOINT: Bypasses OAuth2 authentication entirely.
    """
    try:
        img_result = await db.execute(select(ProductImage).limit(3))
        images = img_result.scalars().all()

        if not images:
            raise HTTPException(
                status_code=404,
                detail="Your product_images table is empty! Upload assets first."
            )
        
        vendor_select = await db.execute(select(Vendor).limit(1))
        fallback_vendor = vendor_select.scalar_one_or_none()
        
        if not fallback_vendor:
            raise HTTPException(
                status_code=404,
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
            background_tasks.add_task(
                run_background_analysis,
                image_id=image_uuid,
                vendor_id=str(fallback_vendor.id),
                analysis_id=analysis_uuid
            )
        
        return {
            "message": "🔥 SUCCESS! Batch Test Bypass Triggered.",
            "batch_id": str(generated_batch_id),
            "queued_task_count": len(test_manifest)
        }
    except Exception as e:
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/{batch_id}")
async def get_batch_status(
    batch_id: str,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """Fetches the combined tracking status for all images uploaded together under one batch_id."""
    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.batch_id == batch_id)
    )
    analyses = result.scalars().all()
    
    if not analyses:
        raise HTTPException(status_code=404, detail="No analytics records found for this batch ID.")
        
    return {
    "batch_id": batch_id,
    "total_images": len(analyses),
    "statuses": [
        {
            "analysis_id": str(a.id),
            "image_id": str(a.image_id),
            "status": a.status,
            "detected_count": a.detected_count,
            "processing_time": a.processing_time
        } for a in analyses # 🟢 Changed ) to } here
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
        raise HTTPException(status_code=404, detail="Analysis record not found")
    return analysis


@router.get("/{analysis_id}/products", response_model=list[DetectedProductResponse])
async def get_detected_products(
    analysis_id: UUID,  
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches processed records from the database instead of the raw AI JSON dump,
    forcing Pydantic to convert 'market_sku' into 'sku' for the dashboard.
    """
    # 1. Verify the analysis exists
    analysis_check = await db.execute(
        select(AIAnalysis).where(AIAnalysis.id == analysis_id)
    )
    analysis = analysis_check.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found")

    # 2. 🟢 CHANGE: Query the real database table where your service updates live
    result = await db.execute(
        select(DetectedProduct).where(DetectedProduct.analysis_id == analysis_id)
    )
    detected_products = result.scalars().all()
    
    # 3. Return the database objects. FastAPI will automatically pass them through 
    # your DetectedProductResponse schema, renaming 'market_sku' to 'sku' on the fly!
    return detected_products