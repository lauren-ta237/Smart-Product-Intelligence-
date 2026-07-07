from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.models import Product

router = APIRouter(
    prefix="",
    tags=["Inventory Management"]
)

class InventorySearchResponse(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    market_sku: Optional[str] = None
    sku_cm: Optional[str] = None
    sku_us: Optional[str] = None

    class Config:
        from_attributes = True

class ProductUpdateItem(BaseModel):
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    market_sku: Optional[str] = None
    sku_cm: Optional[str] = None
    sku_us: Optional[str] = None
    image_url: Optional[str] = None
    bounding_box: Optional[dict] = None
    approved: bool = False

class BatchUpdatePayload(BaseModel):
    products: List[ProductUpdateItem]
    image_url: Optional[str] = None


@router.get("/inventory/search", response_model=List[InventorySearchResponse])
async def search_catalog_inventory(
    q: str = Query(..., description="The product search query term"),
    db: AsyncSession = Depends(get_db)
):
    print(f"[CATALOG SEARCH] Incoming frontend query: '{q}'")
    
    stmt = select(Product).where(Product.name.ilike(f"%{q}%")).limit(5)
    result = await db.execute(stmt)
    matched_products = result.scalars().all()
    
    return matched_products


@router.post("/products/batch-update")
async def batch_update_products(
    payload: BatchUpdatePayload,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor_optional)
):
    """Persist AI-detected product updates for the current vendor."""
    print(f"[BATCH UPDATE] Processing batch save for {len(payload.products)} items.")

    if not payload.products:
        return {"status": "success", "message": "No products to process."}

    try:
        vendor_id = None
        if vendor is not None:
            vendor_id = getattr(vendor, "id", None) or vendor.get("id")

        if vendor_id is None and getattr(payload, "image_url", None):
            try:
                from app.modules.intelligence.models import AIAnalysis

                stmt = select(AIAnalysis).where(AIAnalysis.image_url == payload.image_url).limit(1)
                res = await db.execute(stmt)
                analysis_row = res.scalars().first()
                if analysis_row and getattr(analysis_row, "vendor_id", None):
                    vendor_id = getattr(analysis_row, "vendor_id")
                    vendor = type("_V", (), {"id": vendor_id})()
                    print(f"[BATCH INFO] Inferred vendor_id {vendor_id} from AIAnalysis")
            except Exception as infer_err:
                print(f"[BATCH INFO] Could not infer vendor from image_url: {infer_err}")

        for item in payload.products:
            if not item.name:
                continue

            stmt = select(Product).where(Product.name == item.name)
            if vendor_id is not None:
                stmt = stmt.where(Product.vendor_id == vendor_id)
            else:
                stmt = stmt.where(Product.vendor_id.is_(None))
            stmt = stmt.limit(1)

            result = await db.execute(stmt)
            product = result.scalars().first()

            if product is not None:
                product.description = item.description
                product.brand = item.brand
                product.category = item.category
                product.sku = item.sku
                product.market_sku = item.market_sku
                product.sku_cm = item.sku_cm
                product.sku_us = item.sku_us
                product.image_url = item.image_url or payload.image_url
                product.bounding_box = item.bounding_box
                product.approved = item.approved
            else:
                new_product = Product(
                    vendor_id=vendor_id,
                    name=item.name,
                    description=item.description,
                    brand=item.brand,
                    category=item.category,
                    sku=item.sku,
                    market_sku=item.market_sku,
                    sku_cm=item.sku_cm,
                    sku_us=item.sku_us,
                    image_url=item.image_url or payload.image_url,
                    bounding_box=item.bounding_box,
                    approved=item.approved,
                )
                db.add(new_product)

            await db.flush()

        await db.commit()
        return {"status": "success", "message": "Product configurations verified and saved successfully."}

    except Exception as global_err:
        print(f"[CRITICAL FAILURE] Global commit block explicitly failed: {global_err}")
        await db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Database persistent storage rejected: {str(global_err)}"
        )