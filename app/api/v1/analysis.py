import traceback  # 🟢 Added to print the precise router-level stack trace
import json
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    BackgroundTasks,  # 🟢 Added to handle non-blocking asynchronous tasks
    status            # 🟢 Added to return proper 202 ACCEPTED status codes
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select  # 🟢 Used to perform async database model queries
from app.core.database import get_db
from app.core.auth import get_current_vendor
from app.modules.media.models import ProductImage  # 🟢 Explicitly import your ProductImage database model
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus # 🟢 Explicitly import analysis models
from app.modules.intelligence.repository import (
    AnalysisRepository
)
from app.modules.intelligence.schemas import (
    AnalysisResponse,
    DetectedProductResponse
)
# Import your IntelligenceService to actually run the pipeline
from app.modules.intelligence.service import IntelligenceService
from app.modules.catalog.models import DetectedProduct  # 🟢 Import model to fetch results directly

# 1. DEFINE ROUTER FIRST so it can be used below
router = APIRouter(
    prefix="/analysis",
    tags=["AI Analysis"]
)

@router.post("/start/{image_id}", status_code=status.HTTP_202_ACCEPTED) # 🟢 Returns 202 instantly so Axios doesn't timeout
async def analyze_image(
    image_id: str,
    background_tasks: BackgroundTasks, # 🟢 Injected FastAPI background tasks manager
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Kicks off AI processing in a non-blocking background queue.
    Instantly returns a 202 status code alongside the analysis tracker ID.
    """
    print("\n" + "="*40 + " ROUTER SUBMISSION START (BACKGROUND ASYNC) " + "="*40)
    try:
        # Initialize your intelligence service
        service = IntelligenceService(db)
        
        # 🟢 Fetch the REAL database instance to prevent ORM relationship commitment errors
        print(f"[DEBUG] Fetching image row from database for UUID: {image_id}")
        result = await db.execute(
            select(ProductImage).where(ProductImage.id == image_id)
        )
        real_image = result.scalar_one_or_none()
        print(f"[DEBUG] Image database record found: {real_image}")

        # 🟢 Guard case if frontend passes an invalid or missing image ID reference
        if not real_image:
            print(f"[DEBUG] Validation Failed: Image ID {image_id} does not exist.")
            raise HTTPException(
                status_code=404,
                detail=f"Image record with ID {image_id} not found in database."
            )
        
        # 🟢 Extract Vendor ID safely
        vendor_id = vendor.id if hasattr(vendor, "id") else vendor.get("id")

        # 🟢 CREATE MASTER TRACKER RECORD INITIALLY
        # This gives us our unique UUID key immediately to track polling states
        analysis_record = AIAnalysis(
            vendor_id=vendor_id,
            image_id=real_image.id,
            image_url=real_image.storage_url,  
            provider="google",
            model_name="vision-v1",
            status=AnalysisStatus.PROCESSING  # Ticked initially as processing
        )
        db.add(analysis_record)
        await db.commit()
        
        print(f"[DEBUG] Initial analysis tracker successfully committed with ID: {analysis_record.id}")
        print("[DEBUG] Offloading execution to background loop context...")
        
        # 🟢 PASS THE ANALYSIS RECORD ID DOWN INTO THE SERVICE LAYER TASK
        background_tasks.add_task(
            service.analyze,
            image=real_image,
            vendor=vendor,
            analysis_id=str(analysis_record.id)
        )
        
        # 🟢 RETURN TRACKER INSTANTLY: No heavy processing calculations blocking the response anymore!
        return {
            "id": str(analysis_record.id),
            "status": "processing",
            "message": "AI computer vision analysis pipeline successfully triggered.",
            "vendor_id": str(vendor_id),
            "image_id": str(real_image.id),
            "image_url": real_image.storage_url
        }

    except Exception as e:
        print("\n" + "!"*40 + " ROUTER CRASH DETECTED " + "!"*40)
        traceback.print_exc()
        print("!"*103 + "\n")
        
        if isinstance(e, HTTPException):
            raise e
            
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process image analysis task creation: {str(e)}"
        )

@router.get("/{analysis_id}/products")
async def get_detected_products(
    analysis_id: str,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns products found by AI.
    Used by vendor review screen.
    """
    # 🟢 Reuse your database formatting logic here if your repository returns unparsed strings
    prod_result = await db.execute(
        select(DetectedProduct).where(DetectedProduct.analysis_id == analysis_id)
    )
    detected_products = prod_result.scalars().all()
    
    formatted_products = []
    for p in detected_products:
        box_coords = p.bounding_box
        while isinstance(box_coords, str):
            try:
                parsed = json.loads(box_coords)
                if parsed == box_coords:
                    break
                box_coords = parsed
            except Exception:
                break

        if not isinstance(box_coords, list):
            box_coords = [0, 0, 0, 0]

        formatted_products.append({
            "id": str(p.id),
            "name": p.name,
            "product_name": p.name,  
            "description": p.description,
            "category": p.category,
            "brand": p.brand,
            "sku": p.sku,
            "confidence_score": p.confidence_score,
            "bounding_box": box_coords  
        })
        
    return formatted_products

@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Vendor checks AI processing status.
    Frontend polls this endpoint until status becomes completed or failed.
    """
    repo = AnalysisRepository(db)
    analysis = await repo.get_analysis(analysis_id)
    
    if not analysis:
        raise HTTPException(
            status_code=404, 
            detail="Analysis record not found"
        )
        
    return analysis