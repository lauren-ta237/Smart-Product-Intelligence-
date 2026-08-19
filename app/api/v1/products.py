from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.schemas import ProductApproveRequest
from app.modules.products.service import ProductCRUDService
from uuid import UUID
from typing import List, Union, Dict, Any

# Define router with vendor catalog prefix
router = APIRouter(
    prefix="/products",
    tags=["Products"]
)


@router.get("/")
async def get_all_products(
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor_optional)
):
    """
    Fetches vendor-scoped products for the frontend review dashboard.
    """
    if not vendor:
        return []
    vendor_id = vendor

    try:
        service = ProductCRUDService(db)
        db_results, _ = await service.list_products(vendor_id=vendor_id)
        return db_results
    except Exception as e:
        print(f"[PRESENTATION WARNING] DB fetch failed: {str(e)}.")
        return []


@router.post("/")
async def save_analyzed_product(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor)
):
    """
    Captures the live saving event directly from the frontend 'Save Analysis to Database' button.
    """
    vendor_id = vendor
    if not vendor_id:
        raise HTTPException(status_code=401, detail="Vendor authentication required.")

    try:
        from app.modules.products.schemas import ProductCreate
        service = ProductCRUDService(db)
        
        # Map raw dict to Pydantic schema
        data = ProductCreate(**payload)
        saved = await service.create_product(data, vendor_id=vendor_id)
        return saved
    except Exception as e:
        print(f"[SAVE ERROR] Failed to persist analyzed product: {e}")
        raise HTTPException(status_code=500, detail="Unable to save product to database.")


@router.post("/approve")
async def approve_product(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    # Reuse logical approval path from main router
    from app.modules.products.router import approve_product as approve_fn
    return await approve_product(payload, db, vendor)


@router.patch("/{product_id}")
async def update_product_direct(
    product_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    from app.modules.products.schemas import ProductUpdate
    service = ProductCRUDService(db)
    data = ProductUpdate(**payload)
    return await service.update_product(product_id, data, vendor_id=vendor)