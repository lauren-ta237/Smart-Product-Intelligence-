import os
import time
import logging
import traceback
from typing import List, Dict, Any, Optional
from uuid import UUID
from urllib.parse import urlparse

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from rapidfuzz import fuzz

from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.processor import AIProcessor, InvalidDatasetException
from app.modules.catalog.models import DetectedProduct, Product

logger = logging.getLogger(__name__)


class IntelligenceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.processor = AIProcessor()

    @staticmethod
    def _to_dict(item: Any) -> dict:
        """Helper to uniformly convert Pydantic models or dicts to a flat dictionary."""
        if hasattr(item, "model_dump"):
            return item.model_dump()
        elif hasattr(item, "dict"):
            return item.dict()
        elif isinstance(item, dict):
            return item
        return {}

    async def _match_product_pg_trgm(self, product_name: str, threshold: float = 0.3) -> Optional[Product]:
        """
        Database-level fuzzy matching using PostgreSQL pg_trgm similarity.
        """
        clean_name = product_name.strip() if product_name else ""
        if len(clean_name) < 2:
            return None

        try:
            async with self.db.begin_nested():
                sim_score = func.similarity(Product.name, clean_name)

                stmt = (
                    select(Product)
                    .where(Product.name.op("%")(clean_name))
                    .order_by(sim_score.desc())
                    .limit(5)
                )
                result = await self.db.execute(stmt)
                candidates = result.scalars().all()

                if not candidates:
                    stmt_fallback = (
                        select(Product)
                        .where(sim_score > threshold)
                        .order_by(sim_score.desc())
                        .limit(5)
                    )
                    res = await self.db.execute(stmt_fallback)
                    candidates = res.scalars().all()

                if not candidates:
                    return None

                return max(candidates, key=lambda p: self.compute_match_score(clean_name, p))

        except Exception as e:
            logger.warning(f"[DB MATCH] pg_trgm similarity query failed or extension missing: {e}")
            return None

    def compute_match_score(self, ai_name: str, product: Product) -> float:
        """Calculates a weighted similarity score."""
        ai_name_lower = (ai_name or "").lower()
        product_name_lower = (product.name or "").lower()

        name_score = fuzz.WRatio(ai_name_lower, product_name_lower)
        brand_score = 100 if product.brand and product.brand.lower() in ai_name_lower else 0
        category_score = 100 if product.category and product.category.lower() in ai_name_lower else 0
        sku_score = 100 if product.sku and product.sku.lower() in ai_name_lower else 0

        return (
            name_score * 0.55 +
            brand_score * 0.20 +
            category_score * 0.15 +
            sku_score * 0.10
        )

    async def analyze(self, image: Any, vendor: Any, analysis_id: str, context: Optional[dict] = None) -> Optional[AIAnalysis]:
        start = time.time()
        context = context or {}

        try:
            parsed_analysis_id = UUID(str(analysis_id))
        except (ValueError, AttributeError, TypeError):
            logger.error(f"[ERROR] Invalid analysis_id supplied: {analysis_id}")
            return None

        result_set = await self.db.execute(
            select(AIAnalysis).where(AIAnalysis.id == parsed_analysis_id)
        )
        analysis = result_set.scalar_one_or_none()

        if not analysis:
            logger.error(f"[ERROR] Analysis ID {parsed_analysis_id} not found.")
            return None

        try:
            # Context Prompt Assembly
            vendor_country = context.get("country") or getattr(vendor, "country", "Global")
            vendor_city = context.get("city") or getattr(vendor, "city", "Any City")
            vendor_lang = context.get("language") or getattr(vendor, "preferred_language", "en")

            context["prompt"] = (
                f"Identify products in image from {vendor_city}, {vendor_country}. "
                f"Language: {vendor_lang}. Return JSON with bounding boxes normalized 0–1. "
                f"Extract visible text for SKU and estimated price."
            )

            # Model Execution
            result = await self.processor.process_image(image, context=context)

            raw_products = (
                result.products if hasattr(result, "products")
                else result if isinstance(result, list)
                else result.get("products", []) if isinstance(result, dict)
                else []
            )

            # Process Detections
            for raw_item in raw_products:
                item = self._to_dict(raw_item)

                product_name = item.get("name") or item.get("product_name") or "Unknown Product"
                confidence = float(item.get("confidence_score") or item.get("confidence") or 1.0)
                box = self._to_dict(item.get("bounding_box"))

                sku_val = item.get("sku") or item.get("possible_sku")
                
                try:
                    raw_price = item.get("estimated_price") or item.get("price")
                    extracted_price = float(raw_price) if raw_price is not None else 0.0
                except (ValueError, TypeError):
                    extracted_price = 0.0

                # Fuzzy Matching
                best_product = await self._match_product_pg_trgm(product_name, threshold=0.3)

                # Determine Price
                if best_product and best_product.price is not None and float(best_product.price) > 0:
                    final_price = float(best_product.price)
                else:
                    final_price = extracted_price

                # Queue Record
                detected = DetectedProduct(
                    analysis_id=analysis.id,
                    name=product_name,
                    description=item.get("description"),
                    category=item.get("category"),
                    brand=item.get("brand"),
                    sku=sku_val,
                    market_sku=sku_val,
                    confidence_score=confidence,
                    bounding_box=box,
                    price=final_price,
                    image_url=analysis.image_url  # 🟢 Storing the path here
                )
                self.db.add(detected)

            analysis.detected_count = len(raw_products)
            analysis.status = AnalysisStatus.COMPLETED
            analysis.processing_time = time.time() - start

            await self.db.commit()
            return analysis

        except Exception as exc:
            logger.error(f"[ERROR] Intelligence Service Failed: {exc}")
            traceback.print_exc()
            return await self._mark_failed(parsed_analysis_id, start)

    async def _mark_failed(self, analysis_id: UUID, start_time: float) -> Optional[AIAnalysis]:
        try:
            await self.db.rollback()
            fresh_result = await self.db.execute(
                select(AIAnalysis).where(AIAnalysis.id == analysis_id)
            )
            analysis = fresh_result.scalar_one_or_none()
            if analysis:
                analysis.status = AnalysisStatus.FAILED
                analysis.processing_time = time.time() - start_time
                await self.db.commit()
                return analysis
        except Exception as err:
            logger.error(f"[FATAL] Failed to update failure status: {err}")
        return None