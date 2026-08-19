# app/api/v1/developer.py
import hashlib
import uuid
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.modules.admin.models import APIKey
from app.modules.catalog.models import Product
from app.modules.orders.models import Order
from app.modules.media.models import ProductImage
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.router import run_background_analysis, BACKGROUND_TASKS_REGISTRY

router = APIRouter(
    prefix="/developer",
    tags=["Developer APIs"]
)

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=True)


async def verify_api_key(
    x_api_key: str = Security(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> APIKey:
    """Verifies that the provided API key matches a hashed active record."""
    hashed = hashlib.sha256(x_api_key.encode()).hexdigest()
    stmt = select(APIKey).where(APIKey.key_hash == hashed, APIKey.is_active == True)
    res = await db.execute(stmt)
    key_obj = res.scalar_one_or_none()

    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or deactivated API Key."
        )

    # Increment calls made
    try:
        key_obj.calls_made += 1
        await db.commit()
    except Exception:
        await db.rollback()

    return key_obj


@router.get("/products")
async def developer_list_products(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key)
):
    """Developer API: Query standard approved product catalogs."""
    stmt = select(Product).where(Product.approved == True).limit(50)
    res = await db.execute(stmt)
    products = res.scalars().all()
    return [{
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "category": p.category,
        "brand": p.brand,
        "sku": p.sku,
        "price": p.price,
        "stock_quantity": p.stock_quantity,
        "image_url": p.image_url
    } for p in products]


@router.get("/orders")
async def developer_list_orders(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key)
):
    """Developer API: Query order tracking structures."""
    stmt = select(Order).limit(50)
    res = await db.execute(stmt)
    orders = res.scalars().all()
    return [{
        "id": str(o.id),
        "status": o.status,
        "total_price": float(o.total_price),
        "created_at": o.created_at
    } for o in orders]


@router.post("/vision", status_code=status.HTTP_202_ACCEPTED)
async def developer_trigger_vision(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key)
):
    """Developer API: Programmatically queue an image for Gemini AI analysis."""
    # Lookup the image
    img_stmt = select(ProductImage).where(ProductImage.id == image_id)
    img_res = await db.execute(img_stmt)
    real_image = img_res.scalar_one_or_none()

    if not real_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image record not found in system."
        )

    # Auto-generate tracking row
    analysis_record = AIAnalysis(
        vendor_id=api_key.developer_id, # developer acts as vendor context
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

    # Spawn background task
    task = asyncio.create_task(
        run_background_analysis(
            image_id=str(real_image.id),
            vendor_id=str(api_key.developer_id),
            analysis_id=str(analysis_record.id)
        )
    )
    BACKGROUND_TASKS_REGISTRY.add(task)
    task.add_done_callback(BACKGROUND_TASKS_REGISTRY.discard)

    return {
        "status": "queued",
        "message": "AI Vision pipeline triggered programmatically.",
        "analysis_id": str(analysis_record.id)
    }