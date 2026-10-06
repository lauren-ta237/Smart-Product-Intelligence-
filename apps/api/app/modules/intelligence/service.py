import os
import time
import logging
import traceback
import math

from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from rapidfuzz import fuzz

from app.core.config.settings import settings
from app.utils.image_utils import crop_product_image

from app.modules.intelligence.models import (
    AIAnalysis,
    AnalysisStatus,
)

from app.modules.intelligence.processor import (
    AIProcessor,
    InvalidDatasetException,
)

from app.modules.catalog.models import (
    DetectedProduct,
    Product,
)
from app.modules.media.models import ImageStatus, ProductImage
from app.modules.media.service import MediaService


logger = logging.getLogger(__name__)


class IntelligenceService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.processor = AIProcessor()
        self.media = MediaService(db)

    # ---------------------------------------------------------
    # Utility: Convert Pydantic / dict objects into dictionaries
    # ---------------------------------------------------------
    @staticmethod
    def _to_dict(item: Any) -> dict:

        if hasattr(item, "model_dump"):
            return item.model_dump()

        elif hasattr(item, "dict"):
            return item.dict()

        elif isinstance(item, dict):
            return item

        return {}

    # ---------------------------------------------------------
    # PostgreSQL fuzzy product matching
    # ---------------------------------------------------------
    async def _match_product_pg_trgm(
        self,
        product_name: str,
        threshold: float = 0.3,
    ) -> Optional[Product]:

        clean_name = product_name.strip() if product_name else ""

        if len(clean_name) < 2:
            return None

        try:

            async with self.db.begin_nested():

                sim_score = func.similarity(
                    Product.name,
                    clean_name,
                )

                stmt = (
                    select(Product)
                    .where(
                        Product.name.op("%")(clean_name)
                    )
                    .order_by(
                        sim_score.desc()
                    )
                    .limit(5)
                )

                result = await self.db.execute(stmt)

                candidates = result.scalars().all()

                if not candidates:

                    stmt_fallback = (
                        select(Product)
                        .where(
                            sim_score > threshold
                        )
                        .order_by(
                            sim_score.desc()
                        )
                        .limit(5)
                    )

                    res = await self.db.execute(
                        stmt_fallback
                    )

                    candidates = res.scalars().all()

                if not candidates:
                    return None

                return max(
                    candidates,
                    key=lambda p: self.compute_match_score(
                        clean_name,
                        p,
                    ),
                )

        except Exception as exc:

            logger.warning(
                "[DB MATCH] pg_trgm similarity query failed "
                f"or extension missing: {exc}"
            )

            # Roll back the nested transaction state cleanly if supported, or let exception propagate safety
            try:
                await self.db.rollback()
            except Exception:
                pass

            return None

    # ---------------------------------------------------------
    # Product similarity scoring
    # ---------------------------------------------------------
    def compute_match_score(
        self,
        ai_name: str,
        product: Product,
    ) -> float:

        ai_name_lower = (
            ai_name or ""
        ).lower()

        product_name_lower = (
            product.name or ""
        ).lower()

        name_score = fuzz.WRatio(
            ai_name_lower,
            product_name_lower,
        )

        brand_score = (
            100
            if product.brand
            and product.brand.lower() in ai_name_lower
            else 0
        )

        category_score = (
            100
            if product.category
            and product.category.lower() in ai_name_lower
            else 0
        )

        sku_score = (
            100
            if product.sku
            and product.sku.lower() in ai_name_lower
            else 0
        )

        return (
            name_score * 0.55
            + brand_score * 0.20
            + category_score * 0.15
            + sku_score * 0.10
        )

    # ---------------------------------------------------------
    # Main AI analysis pipeline
    # ---------------------------------------------------------
    async def analyze(
        self,
        image: Any,
        vendor: Any,
        analysis_id: str,
        context: Optional[dict] = None,
    ) -> Optional[AIAnalysis]:

        start = time.time()
        context = context or {}
        uploaded_crop_urls: list[str] = []

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
            # =================================================
            # 1. Resolve real vendor information from database
            # =================================================
            db_vendor = vendor
            if isinstance(vendor, (str, UUID)):
                from app.modules.identity.models import User
                vendor_query = await self.db.execute(
                    select(User).where(User.id == vendor)
                )
                db_vendor = vendor_query.scalar_one_or_none()

            vendor_country = (
                getattr(db_vendor, "country", None)
                or context.get("country")
                or "Cameroon"
            )
            vendor_city = (
                getattr(db_vendor, "city", None)
                or context.get("city")
                or "Yaounde"
            )
            vendor_lang = (
                getattr(db_vendor, "preferred_language", None)
                or context.get("language")
                or "en"
            )

            context["prompt"] = (
                f"Identify products in image from "
                f"{vendor_city}, {vendor_country}. "
                f"Language: {vendor_lang}. "
                f"Return JSON with bounding boxes "
                f"normalized 0–1. "
                f"Each bounding box MUST contain "
                f"x, y, width, and height. "
                f"Extract visible text for SKU "
                f"and estimated price. "
                f"IMPORTANT: Use Central African CFA franc (FCFA) magnitude. "
                f"Retail prices should be in hundreds or thousands (e.g. 500, 1000). "
                f"NEVER return values like 2, 3, or 5."
            )

            # =================================================
            # 2. Ask AI to analyze image
            # =================================================
            result = await self.processor.process_image(
                image,
                context=context,
            )

            raw_products = (
                result.products
                if hasattr(result, "products")
                else result
                if isinstance(result, list)
                else result.get("products", [])
                if isinstance(result, dict)
                else []
            )

            logger.info(f"[INTELLIGENCE] AI detected {len(raw_products)} products.")

            # =================================================
            # 3. Resolve source image path
            # =================================================
            source_image_url = (
                getattr(image, "storage_url", None)
                or analysis.image_url
            )

            if not source_image_url:
                raise FileNotFoundError("The analysis does not contain a source image URL.")

            source_image_bytes = context.get("_source_image_bytes")
            if not source_image_bytes:
                source_image_bytes = await self.media.download(source_image_url)

            # =================================================
            # 5. Process every detected product
            # =================================================
            for raw_item in raw_products:
                item = self._to_dict(raw_item)
                
                product_name = (
                    item.get("name")
                    or item.get("product_name")
                    or "Unknown Product"
                )
                try:
                    confidence = float(
                        item.get("confidence_score")
                        or item.get("confidence")
                        or 1.0
                    )
                except (ValueError, TypeError):
                    confidence = 1.0

                box_raw = self._to_dict(item.get("bounding_box"))
                box = {}
                if box_raw:
                    try:
                        candidate_box = {
                            "x": float(box_raw.get("x", 0.0)),
                            "y": float(box_raw.get("y", 0.0)),
                            "width": float(box_raw.get("width", 0.0)),
                            "height": float(box_raw.get("height", 0.0)),
                        }
                        if (
                            all(math.isfinite(value) for value in candidate_box.values())
                            and -0.05 <= candidate_box["x"] <= 1.05
                            and -0.05 <= candidate_box["y"] <= 1.05
                            and 0 < candidate_box["width"] <= 1.05
                            and 0 < candidate_box["height"] <= 1.05
                            and -0.05 <= candidate_box["x"] + candidate_box["width"] <= 1.05
                            and -0.05 <= candidate_box["y"] + candidate_box["height"] <= 1.05
                        ):
                            box = candidate_box
                    except (ValueError, TypeError):
                        box = {}

                sku_val = item.get("sku") or item.get("possible_sku")

                try:
                    raw_price = item.get("estimated_price") or item.get("price")
                    extracted_price = float(raw_price) if raw_price is not None else 0.0
                except (ValueError, TypeError):
                    extracted_price = 0.0

                best_product = await self._match_product_pg_trgm(
                    product_name,
                    threshold=0.3,
                )

                # =================================================
                # 🟢 SANITY GUARD (MAGNITUDE CORRECTION)
                # =================================================
                # If the price is extremely low (e.g. 2, 3, 5), the AI 
                # returned a "Dollar-scale" value. We scale it by 
                # ~600 to match the FCFA economy before saving.
                # If it's already > 100, we assume it's already FCFA.
                # =================================================
                CURRENCY_MULTIPLIER = 600.0  
                MINIMUM_REALISTIC_FCFA = 100.0  

                if 0 < extracted_price < MINIMUM_REALISTIC_FCFA:
                    price_to_store = extracted_price * CURRENCY_MULTIPLIER
                else:
                    price_to_store = extracted_price

                # Prefer database value if found, otherwise use our sanity-checked AI price
                if (
                    best_product
                    and best_product.price is not None
                    and float(best_product.price) > 0
                ):
                    final_price = float(best_product.price)
                else:
                    final_price = price_to_store

                detected_product_id = uuid4()
                cropped_image_url = None
                if box:
                    cropped_image = crop_product_image(source_image_bytes, box)
                    if cropped_image:
                        cropped_image_url = await self.media.upload_bytes(
                            cropped_image,
                            f"{detected_product_id}.jpg",
                            "image/jpeg",
                            folder="crops",
                        )
                        uploaded_crop_urls.append(cropped_image_url)
                    else:
                        box = {}

                detected = DetectedProduct(
                    id=detected_product_id,
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
                    image_url=analysis.image_url,
                    cropped_image_url=cropped_image_url,
                    attributes=item.get("attributes"),
                    approved=False,
                    stock_quantity=0,
                    location=None,
                )
                self.db.add(detected)

            # =================================================
            # 6. Mark analysis complete & commit transaction
            # =================================================
            analysis.detected_count = len(raw_products)
            analysis.status = AnalysisStatus.COMPLETED
            analysis.error_message = None
            analysis.processing_time = time.time() - start
            image.status = ImageStatus.COMPLETED
            await self.db.commit()
            
            return analysis

        except InvalidDatasetException as exc:
            logger.warning(f"[INTELLIGENCE] Invalid dataset for analysis {parsed_analysis_id}")
            await self._cleanup_uploaded_crops(uploaded_crop_urls)
            return await self._mark_failed(parsed_analysis_id, start, self._safe_error_message(exc))
        except Exception as exc:
            logger.error(f"[ERROR] Intelligence Service Failed: {exc}")
            traceback.print_exc()
            await self._cleanup_uploaded_crops(uploaded_crop_urls)
            return await self._mark_failed(parsed_analysis_id, start, self._safe_error_message(exc))

    async def _cleanup_uploaded_crops(self, crop_urls: list[str]) -> None:
        for crop_url in crop_urls:
            try:
                await self.media.delete(crop_url)
            except Exception:
                logger.exception("Could not clean up crop asset %s", crop_url)

    @staticmethod
    def _safe_error_message(error: Exception) -> str:
        message = f"{type(error).__name__}: {error}"
        for secret in (
            settings.GOOGLE_AI_KEY,
            settings.GOOGLE_API_KEY,
            settings.GEMINI_API_KEY,
            settings.ANTHROPIC_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ):
            if secret:
                message = message.replace(secret, "[redacted]")
        return message[:2000]

    # ---------------------------------------------------------
    # Failure handler
    # ---------------------------------------------------------
    async def _mark_failed(
        self,
        analysis_id: UUID,
        start_time: float,
        error_message: str,
    ) -> Optional[AIAnalysis]:
        try:
            try:
                await self.db.rollback()
            except Exception:
                pass
            fresh_result = await self.db.execute(
                select(AIAnalysis).where(
                    AIAnalysis.id == analysis_id
                )
            )
            analysis = (
                fresh_result.scalar_one_or_none()
            )
            if analysis:
                analysis.status = (
                    AnalysisStatus.FAILED
                )
                analysis.error_message = error_message
                analysis.processing_time = (
                    time.time()
                    - start_time
                )
                image_result = await self.db.execute(
                    select(ProductImage).where(ProductImage.id == analysis.image_id)
                )
                image = image_result.scalar_one_or_none()
                if image:
                    image.status = ImageStatus.FAILED
                await self.db.commit()
                return analysis
        except Exception as err:
            logger.error(
                "[FATAL] Failed to update "
                f"failure status: {err}"
            )
        return None