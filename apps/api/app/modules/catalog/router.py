# app/modules/catalog/router.py
import uuid
from typing import List, Optional
import traceback

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select, tuple_
from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.models import DetectedProduct, Product
from app.modules.intelligence.models import AIAnalysis
from app.modules.products.schemas import ProductResponse

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


def normalize_batch_payload(payload):
    """Accept the legacy array payload sent by the frontend and the wrapped object payload used by some API clients."""
    if isinstance(payload, list):
        products = []
        for item in payload:
            if isinstance(item, ProductUpdateItem):
                products.append(item)
            elif isinstance(item, dict):
                products.append(ProductUpdateItem.model_validate(item))
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Each batch item must be an object with product fields.",
                )
        return BatchUpdatePayload(products=products)

    if isinstance(payload, dict):
        return BatchUpdatePayload.model_validate(payload)

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Batch payload must be either a list of products or an object containing a products list.",
    )


async def resolve_product_image_fields(
    db: AsyncSession,
    products: List[Product],
) -> dict[uuid.UUID, dict[str, Optional[str]]]:
    products_by_key = {}
    products_by_identity = {}
    source_keys = set()
    identity_keys = set()
    image_fields: dict[uuid.UUID, dict[str, Optional[str]]] = {}

    for product in products:
        image_url = product.image_url or ""
        path_segments = {
            segment.lower()
            for segment in image_url.split("?")[0].split("/")
            if segment
        }
        if path_segments.intersection({"crops", "cropped"}):
            image_fields[product.id] = {"crop_url": image_url}
            continue
        if not product.vendor_id or not product.name:
            continue

        if image_url.startswith("blob:") or not image_url:
            key = (product.vendor_id, product.name.lower())
            identity_keys.add(key)
            products_by_identity.setdefault(key, []).append(product)
        else:
            key = (product.vendor_id, product.name.lower(), image_url)
            source_keys.add(key)
            products_by_key.setdefault(key, []).append(product)

    if not source_keys and not identity_keys:
        return image_fields

    conditions = []
    if source_keys:
        conditions.append(
            tuple_(
                AIAnalysis.vendor_id,
                func.lower(DetectedProduct.name),
                DetectedProduct.image_url,
            ).in_(list(source_keys))
        )
    if identity_keys:
        conditions.append(
            tuple_(
                AIAnalysis.vendor_id,
                func.lower(DetectedProduct.name),
            ).in_(list(identity_keys))
        )

    result = await db.execute(
        select(DetectedProduct, AIAnalysis.vendor_id)
        .join(AIAnalysis, AIAnalysis.id == DetectedProduct.analysis_id)
        .where(or_(*conditions))
    )

    candidates: dict[uuid.UUID, set[tuple[Optional[str], Optional[str]]]] = {}
    for detection, vendor_id in result.all():
        source_key = (vendor_id, detection.name.lower(), detection.image_url)
        identity_key = (vendor_id, detection.name.lower())
        matched_products = list(products_by_key.get(source_key, []))
        matched_products.extend(products_by_identity.get(identity_key, []))
        for product in matched_products:
            if detection.bounding_box == product.bounding_box:
                candidates.setdefault(product.id, set()).add(
                    (detection.image_url, detection.cropped_image_url)
                )

    for product in products:
        records = candidates.get(product.id, set())
        if not records:
            continue

        crop_urls = {crop_url for _, crop_url in records if crop_url}
        if len(crop_urls) == 1:
            image_fields.setdefault(product.id, {})["crop_url"] = next(iter(crop_urls))

        if (product.image_url or "").startswith("blob:") or not product.image_url:
            source_urls = {source_url for source_url, _ in records if source_url}
            if len(source_urls) == 1:
                image_fields.setdefault(product.id, {})["image_url"] = next(iter(source_urls))

    return image_fields


# ============================================================
# GET PRODUCTS (WITH OR WITHOUT TRAILING SLASH SUPPORT)
# ============================================================

@router.get("", response_model=List[ProductResponse])
@router.get("/", response_model=List[ProductResponse])
async def get_all_products(
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor_optional),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    approved: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    size: Optional[int] = Query(None, ge=1, le=100),
):
    try:
        # If vendor is optional, handle both cases safely
        vendor_id = getattr(vendor, "id", vendor) if vendor else None
        
        stmt = select(Product)
        if vendor_id:
            stmt = stmt.where(Product.vendor_id == vendor_id)

        if category is not None:
            stmt = stmt.where(Product.category == category)
        if brand is not None:
            stmt = stmt.where(Product.brand == brand)
        if approved is not None:
            stmt = stmt.where(Product.approved == approved)
        if q:
            search_term = f"%{q}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(search_term),
                    Product.description.ilike(search_term),
                    Product.sku.ilike(search_term),
                    Product.market_sku.ilike(search_term),
                )
            )

        stmt = stmt.order_by(Product.created_at.desc(), Product.id.desc())
        if page is not None or size is not None:
            page_number = page or 1
            page_size = size or 20
            stmt = stmt.offset((page_number - 1) * page_size).limit(page_size)

        result = await db.execute(stmt)
        products = result.scalars().all()
        image_fields = await resolve_product_image_fields(db, products)
        return [
            ProductResponse.model_validate(product).model_copy(
                update=image_fields.get(product.id, {"crop_url": None})
            )
            for product in products
        ]

    except Exception as e:
        trace = traceback.format_exc()
        print(trace)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "trace": trace},
        )


# ============================================================
# SEARCH CATALOG INVENTORY
# ============================================================

@router.get("/search", response_model=List[InventorySearchResponse])
async def search_catalog_inventory(
    q: str = Query(..., description="The product search query term"),
    db: AsyncSession = Depends(get_db)
):
    """Search catalog inventory by name."""
    try:
        stmt = select(Product).where(Product.name.ilike(f"%{q}%")).limit(5)
        result = await db.execute(stmt)
        return result.scalars().all()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


# ============================================================
# BATCH UPDATE PRODUCTS
# ============================================================

@router.post("/batch-update")
async def batch_update_products(
    payload: object = Body(...),
    db: AsyncSession = Depends(get_db),
    vendor_id=Depends(get_current_vendor)
):
    """Persist AI-detected products with normalized image paths."""
    normalized = normalize_batch_payload(payload)
    if not normalized.products:
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
                if "/uploads/" in clean:
                    clean = clean.split("/uploads/")[-1]
                else:
                    return clean

            # Already has uploads/ prefix
            if clean.startswith("uploads/"):
                return clean

            # Ensure uploads/ prefix exists
            filename = clean.split("/")[-1]
            return f"uploads/{filename}"

        default_img = clean_img_path(normalized.image_url)

        for item in normalized.products:
            if not item.name:
                continue

            product_stmt = select(Product).where(
                Product.name == item.name,
                Product.vendor_id == vendor_id
            ).limit(1)

            result = await db.execute(product_stmt)
            product = result.scalars().first()

            # Resolve the correct permanent URL.
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