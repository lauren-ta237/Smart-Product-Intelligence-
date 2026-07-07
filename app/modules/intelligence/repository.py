from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import AIAnalysis
from app.modules.catalog.models import DetectedProduct

class AnalysisRepository:
    """
    Handles AI database operations.
    Keeps database logic away
    from API routes.
    """
    def __init__(
        self,
        db: AsyncSession
    ):
        self.db = db

    async def get_analysis(
        self,
        analysis_id
    ):
        result = await self.db.execute(
            select(AIAnalysis)
            .where(
                AIAnalysis.id == analysis_id
            )
        )
        return result.scalar_one_or_none()
    async def get_detected_products(
        self,
        analysis_id
    ):
        result = await self.db.execute(
            select(DetectedProduct)
            .where(
                DetectedProduct.analysis_id
                == analysis_id
            )
        )
        return result.scalars().all()