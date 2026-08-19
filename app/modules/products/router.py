# app/modules/products/router.py
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_vendor, get_current_vendor_optional
from app.core.database import get_db
from app.modules.catalog.models import Product
from app.modules.identity.models import UserRole
from app.modules.products.schemas import ProductCreate, ProductResponse, ProductUpdate
from app.modules.products.service import ProductCRUDService

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

def extract_vendor_context(vendor: any) -> tuple[Optional[UUID], bool]:
    """
    Safely resolves vendor_id and is_admin flag regardless of whether
    the auth dependency returns an ORM Model, dict, or UUID directly.
    """
    if not vendor:
        return None, False

    if isinstance(vendor, UUID):
        return vendor, False

    if isinstance(vendor, dict):
        v_id = vendor.get("id")
        v_id = UUID(str(v_id)) if v_id and not isinstance(v_id, UUID) else v_id
        is_admin = vendor.get("role") == UserRole.ADMIN
        return v_id, is_admin

    v_id = getattr(vendor, "id", None)
    is_admin = getattr(vendor, "role", None) == UserRole.ADMIN
    return v_id, is_admin


@router.get("", response_model=List[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor_optional),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    approved: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100)
):
    """
    Retrieves product entries. Falls back to only approved catalog 
    items if the visitor is a buyer or unauthenticated.
    """
    service = ProductCRUDService(db)
    vendor_id, is_admin = extract_vendor_context(vendor)

    if not vendor_id:
        items, _ = await service.list_products(
            vendor_id=None,
            category=category,
            brand=brand,
            approved=True,  # Force guest/buyer view
            search_query=q,
            page=page,
            size=size
        )
        return items

    scoped_vendor_id = None if is_admin else vendor_id

    items, _ = await service.list_products(
        vendor_id=scoped_vendor_id,
        category=category,
        brand=brand,
        approved=approved,
        search_query=q,
        page=page,
        size=size
    )
    return items


# --- 🟢 PATH PRIORITY REMAPPING (SUB-PATHS BEFORE PARAMETERS) ---

@router.post("/approve")
async def approve_product(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    """
    Approves or auto-populates product status. Restricted to admin role.
    """
    vendor_id, is_admin = extract_vendor_context(vendor)

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can approve products."
        )

    name = payload.get("name")
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name parameter is required."
        )

    result = await db.execute(select(Product).where(Product.name == name))
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
            location=payload.get("location")
        )
        db.add(product)
    else:
        product.approved = True
        product.price = payload.get("price", product.price)
        product.stock_quantity = payload.get("stock_quantity", product.stock_quantity)
        product.location = payload.get("location", product.location)

    await db.commit()
    return {"status": "success", "message": "Product approved successfully."}


@router.post("/batch-update", response_model=List[ProductResponse])
async def batch_update_products(
    payload: List[Any], # 🟢 Accepts the raw list from the frontend
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    """
    Handles bulk/batch product updates and insertions.
    """
    from .router import extract_vendor_context # Ensure local import context
    vendor_id, _ = extract_vendor_context(vendor)
    
    if not vendor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve a valid vendor identity for this operation."
        )

    service = ProductCRUDService(db)
    
    try:
        # Pass the raw payload list directly to the service
        updated_products = await service.batch_update_products(
            items=payload, 
            vendor_id=vendor_id
        )
        return updated_products
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process batch update: {str(e)}"
        )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    """
    Vendor manually lists an individual product catalog asset.
    """
    vendor_id, _ = extract_vendor_context(vendor)
    service = ProductCRUDService(db)
    return await service.create_product(payload, vendor_id=vendor_id)


# --- 🟢 MOVED PARAMETER BASED ID ROUTES BELOW STATIC SUB-PATHS ---

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor_optional)
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    service = ProductCRUDService(db)
    product = await service.get_product_by_id(product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found."
        )

    if not product.approved and not is_admin and product.vendor_id != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this unapproved product."
        )

    return product


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    service = ProductCRUDService(db)
    try:
        updated = await service.update_product(
            product_id=product_id,
            data=payload,
            vendor_id=vendor_id,
            is_admin=is_admin
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found."
        )

    return updated


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    vendor = Depends(get_current_vendor)
):
    vendor_id, is_admin = extract_vendor_context(vendor)

    service = ProductCRUDService(db)
    try:
        deleted = await service.delete_product(
            product_id=product_id,
            vendor_id=vendor_id,
            is_admin=is_admin
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found."
        )

    return None