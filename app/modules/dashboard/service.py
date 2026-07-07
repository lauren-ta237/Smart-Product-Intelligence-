from sqlalchemy import select, func
from app.modules.media.models import ProductImage
from app.modules.catalog.models import Product


class DashboardService:

    """
    Handles vendor dashboard metrics.
    Keeps statistics logic away
    from API routes.
    """
    def __init__(self, db):
        self.db=db

    async def get_stats(self, vendor_id):

        images=await self.db.scalar(
            select(func.count(ProductImage.id))
            .where(
                ProductImage.vendor_id==vendor_id
            )
        )

        products=await self.db.scalar(
            select(func.count(Product.id))
            .where(
                Product.vendor_id==vendor_id
            )
        )

        return {
            "images":images or 0,
            "products":products or 0,
            "accuracy":0.96,
            "approved":products or 0
        }