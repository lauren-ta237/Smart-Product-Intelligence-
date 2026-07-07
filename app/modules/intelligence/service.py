import time
import traceback
import os

from rapidfuzz import process, fuzz
from sqlalchemy import select

from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.processor import AIProcessor, InvalidDatasetException
from app.modules.catalog.models import DetectedProduct, Product


class IntelligenceService:
    def __init__(self, db):
        self.db = db
        self.processor = AIProcessor()

    async def analyze(self, image, vendor, analysis_id: str, context: dict = None):
        """
        AI pipeline:
        - Runs vision model with dynamic SKU instructions
        - Matches products with fuzzy score
        - Enriches or gracefully falls back to raw extracted text data
        - Stores detected products
        """
        start = time.time()
        context = context or {}

        # ----------------------------
        # FETCH ANALYSIS TRACKER
        # ----------------------------
        result_set = await self.db.execute(
            select(AIAnalysis).where(AIAnalysis.id == analysis_id)
        )
        analysis = result_set.scalar_one_or_none()

        if not analysis:
            print(f"[ERROR] Analysis ID {analysis_id} not found.")
            return None

        try:
            # ----------------------------
            # DEBUG FILE PATH
            # ----------------------------
            clean_path = (
                image.storage_url.split("localhost:8000/")[-1]
                if "localhost" in image.storage_url
                else image.storage_url
            )
            absolute_path = os.path.abspath(clean_path)
            print(f"[DIAGNOSTIC] File exists: {os.path.exists(absolute_path)}")

            # ----------------------------
            # CONTEXT PROMPT (METHOD 2: DYNAMIC EXTRACTION INSTRUCTIONS)
            # ----------------------------
            vendor_country = context.get("country") or getattr(vendor, "country", "Global")
            vendor_city = context.get("city") or getattr(vendor, "city", "Any City")
            vendor_lang = context.get("language") or getattr(vendor, "preferred_language", "en")

            context["prompt"] = (
                f"Identify products in image from {vendor_city}, {vendor_country}. "
                f"Language: {vendor_lang}. Return JSON with bounding boxes normalized 0–1. "
                f"CRITICAL INSTRUCTION: Closely read all text inside the image packaging, price tags, "
                f"shelf labels, or visible barcodes. Extract any serial numbers, model numbers, or serial strings "
                f"and map them directly to the 'sku' string field. If a regional variant identifier is explicitly "
                f"distinguishable, map it into 'sku_us' or 'sku_cm' respectively."
            )

            # ----------------------------
            # RUN AI MODEL (Guardrail Intercept point)
            # ----------------------------
            result = await self.processor.process_image(image, context=context)

            products_list = (
                result.products
                if hasattr(result, "products")
                else result
                if isinstance(result, list)
                else result.get("products", [])
            )

            # ----------------------------
            # LOAD PRODUCTS ONCE (IMPORTANT)
            # ----------------------------
            db_result = await self.db.execute(select(Product))
            all_products = db_result.scalars().all()
            product_names = [p.name for p in all_products]

            # ----------------------------
            # PROCESS DETECTIONS
            # ----------------------------
            for item in products_list:
                is_pydantic = not isinstance(item, dict)

                product_name = (
                    getattr(item, "name", None)
                    or getattr(item, "product_name", None)
                    if is_pydantic
                    else item.get("name")
                    or item.get("product_name")
                    or "Unknown Product"
                )

                confidence = float(
                    getattr(item, "confidence_score", None)
                    or getattr(item, "confidence", None)
                    if is_pydantic
                    else item.get("confidence_score")
                    or item.get("confidence")
                    or 1.0
                )

                raw_box = (
                    getattr(item, "bounding_box", None)
                    if is_pydantic
                    else item.get("bounding_box")
                ) or {}

                box = raw_box.model_dump() if hasattr(raw_box, "model_dump") else raw_box

                sku_val = (
                    getattr(item, "sku", None)
                    if is_pydantic
                    else item.get("sku") or item.get("possible_sku")
                )
                
                # Extract optional specific regional keys if populated directly by the AI parser
                ai_sku_us = getattr(item, "sku_us", None) if is_pydantic else item.get("sku_us")
                ai_sku_cm = getattr(item, "sku_cm", None) if is_pydantic else item.get("sku_cm")

                # ----------------------------
                # FUZZY MATCHING
                # ----------------------------
                best_product = None

                match = process.extractOne(
                    product_name,
                    product_names,
                    scorer=fuzz.WRatio
                )

                if match:
                    matched_name, score, _ = match
                    if score >= 80:
                        best_product = next(
                            (p for p in all_products if p.name == matched_name),
                            None
                        )

                # ----------------------------
                # SKU ENRICHMENT & DYNAMIC FALLBACK
                # ----------------------------
                sku_us = best_product.sku_us if best_product else (ai_sku_us or sku_val)
                sku_cm = best_product.sku_cm if best_product else (ai_sku_cm or sku_val)
                
                # 🎯 PRESENTATION PATCH: Automatically match the current active market setting
                active_market = context.get("market_active") or (vendor_country if vendor_country in ["CM", "US"] else "CM")
                
                if best_product and best_product.market_sku:
                    market_sku = best_product.market_sku
                else:
                    if active_market == "CM":
                        market_sku = sku_cm or sku_val or "SKU-CM-DUMMY"
                    elif active_market == "US":
                        market_sku = sku_us or sku_val or "SKU-US-DUMMY"
                    else:
                        market_sku = sku_val or "SKU-GENERIC"

                # ----------------------------
                # SAVE DETECTION
                # ----------------------------
                detected = DetectedProduct(
                    analysis_id=analysis.id,
                    name=product_name,
                    description=getattr(item, "description", None) if is_pydantic else item.get("description"),
                    category=getattr(item, "category", None) if is_pydantic else item.get("category"),
                    brand=getattr(item, "brand", None) if is_pydantic else item.get("brand"),
                    sku=sku_val,
                    sku_us=sku_us,
                    sku_cm=sku_cm,
                    market_sku=market_sku, 
                    confidence_score=confidence,
                    bounding_box=box
                )

                self.db.add(detected)

            # ----------------------------
            # UPDATE TRACKER ON SUCCESS
            # ----------------------------
            analysis.raw_response = (
                result.model_dump()
                if hasattr(result, "model_dump")
                else result
                if isinstance(result, list)
                else result
            )
            analysis.detected_count = len(products_list)
            analysis.status = AnalysisStatus.COMPLETED
            
            analysis.processing_time = time.time() - start
            await self.db.commit()

        except InvalidDatasetException as ide:
            print(f"\n[GUARDRAIL HALT] Intelligence Service caught invalid dataset: {ide}\n")
            await self.db.rollback()
            
            try:
                fresh_result = await self.db.execute(
                    select(AIAnalysis).where(AIAnalysis.id == analysis_id)
                )
                analysis = fresh_result.scalar_one_or_none()
                if analysis:
                    analysis.status = AnalysisStatus.FAILED
                    analysis.processing_time = time.time() - start
                    await self.db.commit()
                    print("[FALLBACK] Saved FAILED state successfully for invalid image.")
            except Exception as fallback_err:
                print(f"[FATAL] Failed to update status on guardrail intercept: {fallback_err}")
                
            # Re-raise to bubble up to the FastAPI router handler level
            raise ide

        except Exception:
            print("\n[ERROR] Intelligence Service Failed\n")
            traceback.print_exc()
            
            # 1. Clear the poisoned transaction block immediately
            await self.db.rollback()
            
            try:
                # 2. Re-fetch tracking block inside a fresh transaction sequence
                fresh_result = await self.db.execute(
                    select(AIAnalysis).where(AIAnalysis.id == analysis_id)
                )
                analysis = fresh_result.scalar_one_or_none()
                
                if analysis:
                    analysis.status = AnalysisStatus.FAILED
                    analysis.processing_time = time.time() - start
                    await self.db.commit()
                    print("[FALLBACK] Saved FAILED state successfully.")
            except Exception as fallback_err:
                print(f"[FATAL] Failed to record engine failure status: {fallback_err}")

        return analysis

    def compute_match_score(self, ai_name, product):
        name_score = fuzz.WRatio(ai_name, product.name)
        brand_score = 100 if product.brand and product.brand.lower() in ai_name.lower() else 0
        category_score = 100 if product.category and product.category.lower() in ai_name.lower() else 0
        sku_score = 100 if product.sku and product.sku.lower() in ai_name.lower() else 0

        return (
            name_score * 0.55 +
            brand_score * 0.20 +
            category_score * 0.15 +
            sku_score * 0.10
        )