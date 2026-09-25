# app/modules/products/router.py

from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.models import Product
from app.modules.identity.models import UserRole
from app.modules.products.schemas import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.modules.products.service import ProductCRUDService


router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


def extract_vendor_context(vendor: Any) -> tuple[Optional[UUID], bool]:
    """
    Safely resolves vendor_id and is_admin regardless of whether
    the auth dependency returns an ORM model, dict, or UUID.
    """
    if not vendor:
        return None, False

    # Auth dependency returned a UUID directly.
    if isinstance(vendor, UUID):
        return vendor, False

    # Auth dependency returned a dictionary.
    if isinstance(vendor, dict):
        v_id = vendor.get("id")

        if v_id and not isinstance(v_id, UUID):
            try:
                v_id = UUID(str(v_id))
            except (ValueError, TypeError):
                v_id = None

        role = vendor.get("role")

        # Handle enum or string role values.
        is_admin = (
            role == UserRole.ADMIN
            or str(role).lower() == str(UserRole.ADMIN).lower()
            or str(role).lower() == "admin"
        )

        return v_id, is_admin

    # Auth dependency returned an ORM object.
    v_id = getattr(vendor, "id", None)
    role = getattr(vendor, "role", None)

    is_admin = (
        role == UserRole.ADMIN
        or str(role).lower() == str(UserRole.ADMIN).lower()
        or str(role).lower() == "admin"
    )

    if v_id and not isinstance(v_id, UUID):
        try:
            v_id = UUID(str(v_id))
        except (ValueError, TypeError):
            v_id = None

    return v_id, is_admin


# ============================================================
# LIST PRODUCTS
# ============================================================

@router.get("", response_model=List[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor_optional),
    vendor_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    approved: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """
    Retrieves products.

    Products do not require admin approval before being shown to buyers.
    When vendor_id query parameter is provided, filters to that vendor.
    Otherwise, returns products for the public marketplace.
    """
    service = ProductCRUDService(db)

    items, _ = await service.list_products(
        vendor_id=vendor_id,
        category=category,
        brand=brand,
        approved=approved,
        search_query=q,
        page=page,
        size=size,
    )

    return items


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
    Approves or creates a product.

    Restricted to admin users.
    """

    vendor_id, is_admin = extract_vendor_context(vendor)

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can approve products.",
        )

    name = payload.get("name")

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name parameter is required.",
        )

    result = await db.execute(
        select(Product).where(Product.name == name)
    )

    product = result.scalars().first()

    if not product:
        product = Product(
            vendor_id=vendor_id,
            name=name,
            description=payload.get("description"),
            category=payload.get("category"),
            brand=payload.get("brand"),
            sku=payload.get("sku"),
            sku_us=payload.get("sku_us"),
            sku_cm=payload.get("sku_cm"),
            market_sku=payload.get("market_sku"),
            image_url=payload.get("image_url"),
            bounding_box=payload.get("bounding_box"),
            approved=True,
            price=payload.get("price", 0.0),
            stock_quantity=payload.get("stock_quantity", 0),
            location=payload.get("location"),
        )

        db.add(product)

    else:
        product.approved = True

        if "price" in payload:
            product.price = payload.get("price")

        if "stock_quantity" in payload:
            product.stock_quantity = payload.get("stock_quantity")

        if "location" in payload:
            product.location = payload.get("location")

        # IMPORTANT:
        # If approval payload contains bounding_box, preserve it.
        if "bounding_box" in payload:
            product.bounding_box = payload.get("bounding_box")

        if "image_url" in payload:
            product.image_url = payload.get("image_url")

    await db.commit()
    await db.refresh(product)

    return {
        "status": "success",
        "message": "Product approved successfully.",
    }


# ============================================================
# BATCH UPDATE / PUBLISH RESULTS
# ============================================================

@router.post(
    "/batch-update",
    response_model=List[ProductResponse],
)
async def batch_update_products(
    payload: List[Any],
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Receives all AI-detected products from AnalysisViewer.tsx.

    Each item may contain:

        {
            "name": "...",
            "image_url": "...",
            "bounding_box": [...]
        }

    The bounding_box is passed unchanged to the service and then
    persisted in the products.bounding_box JSON column.
    """

    vendor_id, _ = extract_vendor_context(vendor)

    if not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not resolve a valid vendor identity.",
        )

    if not isinstance(payload, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch payload must be a list of products.",
        )

    if len(payload) == 0:
        return []

    service = ProductCRUDService(db)

    try:
        updated_products = await service.batch_update_products(
            items=payload,
            vendor_id=vendor_id,
        )

        return updated_products

    except Exception as e:
        import traceback

        traceback.print_exc()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process batch update: {str(e)}",
        )


# ============================================================
# CREATE PRODUCT
# ============================================================

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    """
    Vendor manually creates one product.
    """

    vendor_id, _ = extract_vendor_context(vendor)

    if not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vendor authentication required.",
        )

    service = ProductCRUDService(db)

    return await service.create_product(
        payload,
        vendor_id=vendor_id,
    )


# ============================================================
# GET PRODUCT
# ============================================================

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor_optional),
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    service = ProductCRUDService(db)

    product = await service.get_product_by_id(product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found.",
        )

    # Products are viewable in the marketplace without admin approval gating.
    return product


# ============================================================
# UPDATE PRODUCT
# ============================================================

@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    if not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vendor authentication required.",
        )

    service = ProductCRUDService(db)

    try:
        updated = await service.update_product(
            product_id=product_id,
            data=payload,
            vendor_id=vendor_id,
            is_admin=is_admin,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found.",
        )

    return updated


# ============================================================
# DELETE PRODUCT
# ============================================================

@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    vendor=Depends(get_current_vendor),
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    if not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vendor authentication required.",
        )
    service = ProductCRUDService(db)
    try:
        deleted = await service.delete_product(
            product_id=product_id,
            vendor_id=vendor_id,
            is_admin=is_admin,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found.",
        )
    return None