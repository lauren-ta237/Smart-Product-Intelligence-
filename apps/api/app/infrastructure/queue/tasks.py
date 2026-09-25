# app/infrastructure/queue/tasks.py
import asyncio
from uuid import UUID
from app.infrastructure.queue.celery import celery_app
from app.core.database import AsyncSessionLocal
from app.modules.media.models import ProductImage
from app.modules.identity.models import User
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.intelligence.service import IntelligenceService
from sqlalchemy.future import select


async def run_async_analysis(image_id: str, vendor_id: str, analysis_id: str):
    """Encapsulates async database matching and AI processing outside FastAPI."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch image
            img_res = await db.execute(
                select(ProductImage).where(ProductImage.id == image_id)
            )
            real_image = img_res.scalar_one_or_none()
            if not real_image:
                print(f"[CELERY WORKER ❌] Image {image_id} not found.")
                return

            # 2. Fetch vendor/user
            user_res = await db.execute(
                select(User).where(User.id == vendor_id)
            )
            real_vendor = user_res.scalar_one_or_none()
            if not real_vendor:
                print(f"[CELERY WORKER ❌] Vendor {vendor_id} not found.")
                return

            # 3. Localize geographic & financial context
            vendor_country = getattr(real_vendor, "country", "Cameroon") or "Cameroon"
            vendor_region = getattr(real_vendor, "city", "Bamenda") or "Bamenda"
            vendor_language = getattr(real_vendor, "language", "en") or "en"

            localization_prompt = (
                f"The vendor uploading this retail batch is located in: Country: {vendor_country}, "
                f"Region/State: {vendor_region}. "
                f"CRITICAL PRICING & NAMING RULE: All estimated prices MUST be returned directly in whole local Central African CFA franc (FCFA / CFA) "
                f"matching realistic retail market values for {vendor_region}, {vendor_country} (e.g., a single fresh item like an apple should cost between 150 to 400 FCFA, "
                f"and standard apparel or footwear should range between 3,000 to 15,000 FCFA). "
                f"Never output tiny base units like 8 or extreme dollar figures, and avoid incorrect weight units like '/ kg' for shoes. "
                f"Output all localized SKU names, native spelling variations, and market-specific product variants common to that geography. "
                f"Generate descriptions and text fields primarily in the language code: '{vendor_language}'."
            )

            ai_context = {
                "prompt": localization_prompt,
                "country": vendor_country,
                "region": vendor_region,
                "language": vendor_language
            }

            # 4. Trigger Service Layer
            service = IntelligenceService(db)
            await service.analyze(
                image=real_image,
                vendor=real_vendor,
                analysis_id=analysis_id,
                context=ai_context
            )
            print(f"[CELERY WORKER 🎉] Successfully processed analysis {analysis_id}")
        except Exception as e:
            print(f"[CELERY WORKER 🚨] Analysis failed: {e}")
            try:
                analysis_res = await db.execute(
                    select(AIAnalysis).where(
                        AIAnalysis.id == UUID(analysis_id)
                    )
                )
                analysis_obj = analysis_res.scalar_one_or_none()
                if analysis_obj:
                    analysis_obj.status = AnalysisStatus.FAILED
                    await db.commit()
            except Exception as rollback_err:
                print(f"[CELERY WORKER ❌] Rollback state update failed: {rollback_err}")
            raise e


@celery_app.task(bind=True, max_retries=3)
def analyze_product_image_task(self, image_id: str, vendor_id: str, analysis_id: str):
    """
    Celery background worker task for running product image AI analysis.
    Offloads asynchronous execution cleanly to the event loop.
    """
    try:
        asyncio.run(run_async_analysis(image_id, vendor_id, analysis_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10)