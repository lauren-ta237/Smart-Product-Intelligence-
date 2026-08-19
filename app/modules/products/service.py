import uuid
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID

from sqlalchemy import func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.modules.catalog.models import Product
from app.modules.media.models import ProductImage
from app.modules.products.schemas import ProductCreate, ProductUpdate


class ProductCRUDService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_product(self, data: ProductCreate, vendor_id: UUID) -> Product:
        # If an image_id relation is provided, confirm possession and resolve absolute path URL
        if data.image_id:
            img_result = await self.db.execute(
                select(ProductImage).where(
                    and_(
                        ProductImage.id == data.image_id,
                        ProductImage.vendor_id == vendor_id
                    )
                )
            )
            image_record = img_result.scalar_one_or_none()
            if image_record and not data.image_url:
                data.image_url = image_record.storage_url

        product = Product(
            vendor_id=vendor_id,
            name=data.name,
            description=data.description,
            category=data.category,
            brand=data.brand,
            sku=data.sku,
            sku_us=data.sku_us,
            sku_cm=data.sku_cm,
            market_sku=data.market_sku,
            image_url=data.image_url,
            image_id=data.image_id,
            bounding_box=data.bounding_box,
            approved=data.approved,

            # transactional extensions
            price=data.price,
            stock_quantity=data.stock_quantity,
            location=data.location
        )
        self.db.add(product)
        try:
            await self.db.commit()
            await self.db.refresh(product)
        except Exception:
            await self.db.rollback()
            raise
        return product

    async def batch_update_products(
        self, 
        items: List[Dict[str, Any]], 
        vendor_id: UUID
    ) -> List[Product]:
        saved_products: List[Product] = []
        try:
            for item in items:
                async with self.db.begin_nested():
                    # STEP 2.1: Clean the image path to store a relative URL
                    raw_url = item.get("image_url", "") 
                    temp_path = raw_url.split("localhost:8000/")[-1] if "localhost:8000" in raw_url else raw_url
                    clean_path = temp_path.replace("\\", "/")
                    
                    # Ensure strictly valid numbers
                    try:
                        price = float(item.get("price", 0.0))
                        stock = int(item.get("stock_quantity", 10))
                    except (ValueError, TypeError):
                        price, stock = 5.0, 10

                    item_name = item.get("name", "Scanned Product")
                    stmt = select(Product).where(and_(Product.name == item_name, Product.vendor_id == vendor_id))
                    result = await self.db.execute(stmt)
                    existing = result.scalars().first()
                    
                    if existing:
                        existing.image_url = clean_path
                        existing.bounding_box = item.get("bounding_box")
                        existing.price = price
                        existing.approved = True # STEP 2.2: Force visibility for buyers
                        saved_products.append(existing)
                    else:
                        new_product = Product(
                            id=uuid.uuid4(),
                            vendor_id=vendor_id,
                            name=item_name,
                            image_url=clean_path,
                            bounding_box=item.get("bounding_box"),
                            approved=True, # STEP 2.2: Ensure new products show up for buyers
                            price=price,
                            stock_quantity=stock,
                            category=item.get("category", "General"),
                            description=item.get("description", "")
                        )
                        self.db.add(new_product)
                        saved_products.append(new_product)
            await self.db.commit()
            return saved_products
        except Exception as err:
            await self.db.rollback()
            raise err

    async def get_product_by_id(self, product_id: UUID) -> Optional[Product]:
        result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def update_product(self, product_id: UUID, data: ProductUpdate, vendor_id: UUID, is_admin: bool = False) -> Optional[Product]:
        product = await self.get_product_by_id(product_id)
        if not product:
            return None

        # Scope restriction access gates
        if not is_admin and product.vendor_id != vendor_id:
            raise ValueError("You do not have permission to modify this product.")

        if data.image_id:
            img_result = await self.db.execute(
                select(ProductImage).where(
                    and_(
                        ProductImage.id == data.image_id,
                        or_(ProductImage.vendor_id == vendor_id, is_admin)
                    )
                )
            )
            image_record = img_result.scalar_one_or_none()
            if image_record and not data.image_url:
                product.image_url = image_record.storage_url

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(product, key, value)

        try:
            await self.db.commit()
            await self.db.refresh(product)
        except Exception:
            await self.db.rollback()
            raise
        return product

    async def delete_product(self, product_id: UUID, vendor_id: UUID, is_admin: bool = False) -> bool:
        product = await self.get_product_by_id(product_id)
        if not product:
            return False

        if not is_admin and product.vendor_id != vendor_id:
            raise ValueError("You do not have permission to delete this product.")

        try:
            await self.db.delete(product)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        return True

    async def list_products(
        self,
        vendor_id: Optional[UUID] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        approved: Optional[bool] = None,
        search_query: Optional[str] = None,
        page: int = 1,
        size: int = 20
    ) -> Tuple[List[Product], int]:
        filters = []

        if vendor_id is not None:
            filters.append(Product.vendor_id == vendor_id)

        if category is not None:
            filters.append(Product.category == category)

        if brand is not None:
            filters.append(Product.brand == brand)

        if approved is not None:
            filters.append(Product.approved == approved)

        if search_query is not None:
            query_str = f"%{search_query}%"
            filters.append(
                or_(
                    Product.name.ilike(query_str),
                    Product.description.ilike(query_str),
                    Product.sku.ilike(query_str),
                    Product.market_sku.ilike(query_str)
                )
            )

        query = select(Product)
        count_query = select(func.count(Product.id))

        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))

        try:
            total_result = await self.db.execute(count_query)
            total = total_result.scalar() or 0

            offset = (page - 1) * size
            paged_query = query.order_by(Product.created_at.desc()).offset(offset).limit(size)
            
            result = await self.db.execute(paged_query)
            items = result.scalars().all()

            for p in items:
                if not hasattr(p, "vendor_location") or not p.vendor_location:
                    p.vendor_location = "Global"

            return list(items), total

        except Exception:
            await self.db.rollback()
            raise