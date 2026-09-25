import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.identity.models import User
from app.modules.catalog.models import Product, WishlistItem

router = APIRouter(
    prefix="/wishlist",
    tags=["Buyer Wishlist"]
)

@router.get("", dependencies=[Depends(get_current_user)])
async def get_user_wishlist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve saved wishlist items joined with product catalog metadata for the current buyer."""
    stmt = (
        select(WishlistItem, Product)
        .join(Product, WishlistItem.product_id == Product.id)
        .where(WishlistItem.buyer_id == current_user.id)
        .order_by(WishlistItem.created_at.desc())
    )
    res = await db.execute(stmt)
    results = res.all()

    output = []
    for item, prod in results:
        output.append({
            "wishlist_id": str(item.id),
            "id": str(prod.id),
            "name": prod.name,
            "category": prod.category,
            "brand": prod.brand,
            "price": prod.price,
            "stock_quantity": prod.stock_quantity,
            "image_url": prod.image_url,
            "created_at": item.created_at
        })
    return output


@router.post("/{product_id}", dependencies=[Depends(get_current_user)])
async def add_to_wishlist(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a target product to the current buyer's wishlist."""
    prod_stmt = select(Product).where(Product.id == product_id)
    prod_res = await db.execute(prod_stmt)
    if not prod_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found in catalog.")

    dup_stmt = select(WishlistItem).where(
        WishlistItem.buyer_id == current_user.id,
        WishlistItem.product_id == product_id
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        return {"status": "success", "message": "Product is already in your wishlist."}

    try:
        wishlist_entry = WishlistItem(
            buyer_id=current_user.id,
            product_id=product_id
        )
        db.add(wishlist_entry)
        await db.commit()
        return {"status": "success", "message": "Product added to wishlist."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add item: {str(e)}")


@router.delete("/{product_id}", dependencies=[Depends(get_current_user)])
async def remove_from_wishlist(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a product from the current buyer's wishlist."""
    stmt = select(WishlistItem).where(
        WishlistItem.buyer_id == current_user.id,
        WishlistItem.product_id == product_id
    )
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found in wishlist.")

    try:
        await db.delete(item)
        await db.commit()
        return {"status": "success", "message": "Product removed from wishlist."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove item: {str(e)}")