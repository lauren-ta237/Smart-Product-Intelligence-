from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Keep TYPE_CHECKING imports for static analysis only (no runtime import)
if TYPE_CHECKING:
    try:
        from app.modules.catalog.models import Product, DetectedProduct
    except Exception:
        from .models import Product, DetectedProduct


class ProductRepository:
    """Database access layer for products."""

    async def get_by_name(
        self,
        db: AsyncSession,
        name: str,
    ) -> "Product | None":
        # Local import to avoid circular import at module import time
        from app.modules.catalog.models import Product

        result = await db.execute(
            select(Product).where(Product.name == name)
        )
        return result.scalar_one_or_none()

    async def get_all_ordered(
        self,
        db: AsyncSession
    ) -> list["DetectedProduct"]:
        # Local import to avoid circular import at module import time
        from app.modules.catalog.models import DetectedProduct

        result = await db.execute(
            select(DetectedProduct).order_by(DetectedProduct.id.desc())
        )
        return list(result.scalars().all())