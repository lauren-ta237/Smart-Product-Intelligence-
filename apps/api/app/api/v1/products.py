from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
)
import shutil
import uuid
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.schemas import ProductApproveRequest
from app.modules.products.service import ProductCRUDService
from uuid import UUID
from typing import List, Dict, Any


# ============================================================
# UPLOAD CONFIGURATION
# ============================================================

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


# ============================================================
# IMAGE UPLOAD
# ============================================================

@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    vendor=Depends(get_current_vendor),
):
    """
    Upload a product image and save it permanently to the server.
    """
    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    if not vendor_id:
        raise HTTPException(
            status_code=401,
            detail="Vendor authentication required.",
        )

    try:
        # Get file extension
        file_extension = (
            Path(file.filename).suffix.lower()
            if file.filename
            else ".jpg"
        )

        # Create unique filename
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        # Full path on server
        file_path = UPLOAD_DIR / unique_filename

        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Path stored in database
        relative_path = f"uploads/{unique_filename}"

        return {
            "image_url": relative_path
        }

    except Exception as e:
        print(
            f"[UPLOAD ERROR] Failed to save image file: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to upload image file.",
        )


# ============================================================
# GET PRODUCTS
# ============================================================

@router.get("/")
async def get_all_products(
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor_optional),
):
    """
    Fetches vendor-scoped products for the frontend review dashboard.
    """

    if not vendor:
        return []

    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    try:
        service = ProductCRUDService(db)

        db_results, _ = await service.list_products(
            vendor_id=vendor_id
        )

        return db_results

    except Exception as e:
        print(
            f"[PRESENTATION WARNING] DB fetch failed: {str(e)}."
        )

        return []


# ============================================================
# SAVE SINGLE ANALYZED PRODUCT
# ============================================================

@router.post("/")
async def save_analyzed_product(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Captures the live saving event directly from the frontend
    'Save Analysis to Database' button.
    """

    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    if not vendor_id:
        raise HTTPException(
            status_code=401,
            detail="Vendor authentication required.",
        )

    try:
        from app.modules.products.schemas import ProductCreate

        service = ProductCRUDService(db)

        # Convert the incoming dictionary into the backend schema.
        #
        # IMPORTANT:
        # ProductCreate must contain bounding_box if we want
        # the AI coordinates to reach the database.
        data = ProductCreate(**payload)

        saved = await service.create_product(
            data,
            vendor_id=vendor_id,
        )

        return saved

    except Exception as e:
        print(
            f"[SAVE ERROR] Failed to persist analyzed product: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to save product to database.",
        )


# ============================================================
# BATCH UPDATE / PUBLISH ANALYSIS
# ============================================================

@router.post("/batch-update")
async def batch_update_products(
    payload: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Bulk-save AI-analyzed products from AnalysisViewer.tsx.

    Each item is expected to contain its own:

        bounding_box

    together with:

        name
        description
        category
        price
        image_url
        approved
        stock_quantity

    The bounding_box is intentionally preserved when converting
    the incoming dictionary into ProductCreate.
    """

    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    if not vendor_id:
        raise HTTPException(
            status_code=401,
            detail="Vendor authentication required.",
        )

    if not isinstance(payload, list):
        raise HTTPException(
            status_code=400,
            detail="Batch payload must be an array of products.",
        )

    if len(payload) == 0:
        return {
            "status": "success",
            "count": 0,
            "products": [],
        }

    try:
        from app.modules.products.schemas import ProductCreate

        service = ProductCRUDService(db)

        saved_products = []

        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Invalid product at index {index}. "
                        "Each product must be an object."
                    ),
                )

            # ----------------------------------------------------
            # Extract bounding box explicitly.
            #
            # This is the critical part of the fix.
            # ----------------------------------------------------

            bounding_box = item.get("bounding_box")

            # Debug output so we can verify what reaches FastAPI.
            print(
                f"[BATCH SAVE] Product {index}: "
                f"{item.get('name')} | "
                f"bounding_box={bounding_box}"
            )

            # ----------------------------------------------------
            # Create a clean payload for ProductCreate.
            # ----------------------------------------------------

            product_payload = {
                "name": str(
                    item.get(
                        "name",
                        "Unnamed Product",
                    )
                ),

                "description": item.get(
                    "description",
                    "AI-detected item",
                ),

                "category": item.get(
                    "category",
                    "General",
                ),

                "price": item.get(
                    "price",
                    0.0,
                ),

                "image_url": item.get(
                    "image_url"
                ),

                # ------------------------------------------------
                # CRITICAL:
                # Preserve the exact AI bounding box.
                # ------------------------------------------------
                "bounding_box": bounding_box,

                "approved": item.get(
                    "approved",
                    True,
                ),

                "stock_quantity": item.get(
                    "stock_quantity",
                    10,
                ),
            }

            # ----------------------------------------------------
            # Convert to backend Pydantic schema.
            # ----------------------------------------------------

            product_data = ProductCreate(
                **product_payload
            )

            # ----------------------------------------------------
            # Persist product.
            # ----------------------------------------------------

            saved = await service.create_product(
                product_data,
                vendor_id=vendor_id,
            )

            saved_products.append(saved)

        # --------------------------------------------------------
        # Return useful information to frontend/debugging.
        # --------------------------------------------------------

        return {
            "status": "success",
            "count": len(saved_products),
            "products": saved_products,
        }

    except HTTPException:
        raise

    except Exception as e:
        print(
            "[BATCH SAVE ERROR] "
            f"Failed to persist batch products: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to batch-save products to database."
            ),
        )


# ============================================================
# APPROVE PRODUCT
# ============================================================

@router.post("/approve")
async def approve_product(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Approves a product using the existing product approval logic.
    """
    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    # Reuse the existing logical approval path.
    from app.modules.products.router import (
        approve_product as approve_fn,
    )

    return await approve_fn(
        payload,
        db,
        vendor_id,
    )


# ============================================================
# UPDATE PRODUCT
# ============================================================

@router.patch("/{product_id}")
async def update_product_direct(
    product_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Updates an existing vendor product.
    """
    vendor_id = vendor.id if hasattr(vendor, "id") else vendor

    from app.modules.products.schemas import ProductUpdate

    service = ProductCRUDService(db)

    data = ProductUpdate(**payload)

    return await service.update_product(
        product_id,
        data,
        vendor_id=vendor_id,
    )