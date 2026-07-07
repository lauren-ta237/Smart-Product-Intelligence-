from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.modules.catalog.repository import ProductRepository


class ProductService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = ProductRepository()

    async def get_all_products(self, vendor_id: str | None = None) -> list["Product"]:
        """Retrieves all historical records from the catalog database table."""
        from app.modules.catalog.models import Product

        try:
            query = select(Product)
            if vendor_id:
                query = query.where(Product.vendor_id == vendor_id)
            query = query.order_by(Product.id.desc())

            result = await self.db.execute(query)
            return result.scalars().all()
        except Exception as e:
            print(f"[SERVICE ERROR] Failed to query product records: {str(e)}")
            return []

    async def create_product(self, data: dict, vendor_id: str | None = None) -> "Product":
        """Persists a newly captured frontend AI evaluation run directly into the database."""
        from app.modules.catalog.models import Product

        product = Product(
            vendor_id=vendor_id,
            name=data.get("name", "Unknown AI Product"),
            description=data.get("description", "Detected Marketplace Asset"),
            category=data.get("category", "Generic"),
            brand=data.get("brand", "Generic"),
            sku=data.get("market_sku", data.get("sku", "N/A")),
            market_sku=data.get("market_sku", "N/A"),
            image_url=data.get("image_url", ""),
            bounding_box=data.get("bounding_box", None),
            approved=False,
        )

        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def approve_product(
        self,
        vendor_id,
        data
    ) -> "Product":
        """Converts AI output into a real marketplace product."""
        from app.modules.catalog.models import Product

        product = Product(
            vendor_id=vendor_id,
            name=data.name,
            description=data.description,
            category=data.category,
            brand=data.brand,
            sku=data.sku,
            sku_us=getattr(data, "sku_us", None),
            sku_cm=getattr(data, "sku_cm", None),
            market_sku=getattr(data, "market_sku", None),
            approved=True,
        )

        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def update_product(
        self,
        product_id,
        data
    ) -> "Product | None":
        from app.modules.catalog.models import Product

        product = await self.db.get(
            Product,
            product_id
        )

        if not product:
            return None

        product.name = data.name
        product.description = data.description
        product.category = data.category
        product.brand = data.brand

        product.sku = data.sku
        product.sku_us = getattr(data, "sku_us", None)
        product.sku_cm = getattr(data, "sku_cm", None)
        product.market_sku = getattr(data, "market_sku", None)

        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def get_product_by_name(
        self,
        name: str,
    ) -> "Product | None":
        return await self.repository.get_by_name(
            self.db,
            name,
        )

    async def enrich_detection(
        self,
        ai_result: dict,
    ) -> dict:
        detected_name = ai_result.get("name")

        if not detected_name:
            return ai_result

        product = await self.get_product_by_name(detected_name)

        if product is None:
            return ai_result

        return {
            **ai_result,
            # Prefer database values
            "brand": product.brand,
            "category": product.category,
            # Regional SKUs
            "sku": product.sku,
            "sku_us": product.sku_us,
            "sku_cm": product.sku_cm,
            "market_sku": product.market_sku,
        }