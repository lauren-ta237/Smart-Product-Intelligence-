# app/modules/catalog/router.py
import uuid
from typing import List, Optional
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.auth import get_current_vendor
from app.core.database import get_db
from app.modules.catalog.models import Product

router = APIRouter(
    prefix="/products",
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
    price: Optional[float] = 0.0
    stock_quantity: Optional[int] = 0
    location: Optional[str] = None


class BatchUpdatePayload(BaseModel):
    products: List[ProductUpdateItem]
    image_url: Optional[str] = None
    vendor_id: Optional[str] = None
    market_region: Optional[str] = "Global"


@router.get("/search", response_model=List[InventorySearchResponse])
async def search_catalog_inventory(
    q: str = Query(..., description="The product search query term"),
    db: AsyncSession = Depends(get_db)
):
    """Search catalog inventory by name."""
    stmt = select(Product).where(Product.name.ilike(f"%{q}%")).limit(5)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/batch-update")
async def batch_update_products(
    payload: BatchUpdatePayload,
    db: AsyncSession = Depends(get_db),
    vendor_id=Depends(get_current_vendor)
):
    """Persist AI-detected products with normalized image paths."""
    if not payload.products:
        return {"status": "success", "message": "No products to process."}

    try:
        # Normalize image paths while preserving uploads/ folder.
        def clean_img_path(path: str | None):
            if not path or path.startswith("blob:"):
                return None

            # Normalize slashes and trim leading/trailing slashes
            clean = path.replace("\\", "/").strip("/")

            # Handle absolute URLs
            if clean.startswith("http://") or clean.startswith("https://"):
                # If this is a local uploads URL, extract the uploads path
                if "/uploads/" in clean:
                    clean = clean.split("/uploads/")[-1]
                else:
                    # External URL, leave unchanged
                    return clean

            # Already has uploads/ prefix
            if clean.startswith("uploads/"):
                return clean

            # Ensure uploads/ prefix exists
            filename = clean.split("/")[-1]
            return f"uploads/{filename}"

        default_img = clean_img_path(payload.image_url)

        for item in payload.products:
            if not item.name:
                continue

            product_stmt = select(Product).where(
                Product.name == item.name,
                Product.vendor_id == vendor_id
            ).limit(1)

            result = await db.execute(product_stmt)
            product = result.scalars().first()

            # Resolve the correct permanent URL.
            # Reject any blob: URLs coming from the frontend preview.
            final_image_path = clean_img_path(item.image_url) or default_img

            if product:
                product.description = item.description
                product.brand = item.brand
                product.category = item.category
                product.sku = item.sku or product.sku
                product.market_sku = item.market_sku or product.market_sku
                product.sku_cm = item.sku_cm
                product.sku_us = item.sku_us

                if final_image_path:
                    product.image_url = final_image_path

                product.bounding_box = item.bounding_box
                product.approved = item.approved
                product.price = item.price
                product.stock_quantity = item.stock_quantity
                product.location = item.location

            else:
                new_product = Product(
                    vendor_id=vendor_id,
                    name=item.name,
                    description=item.description,
                    brand=item.brand,
                    category=item.category,
                    sku=item.sku or f"SKU-{uuid.uuid4().hex[:8].upper()}",
                    market_sku=item.market_sku,
                    sku_cm=item.sku_cm,
                    sku_us=item.sku_us,
                    image_url=final_image_path,
                    bounding_box=item.bounding_box,
                    approved=item.approved,
                    price=item.price,
                    stock_quantity=item.stock_quantity,
                    location=item.location
                )
                db.add(new_product)

        await db.commit()

        return {
            "status": "success",
            "message": "Product configurations saved successfully."
        }

    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Database commit failed: {str(e)}"
        )