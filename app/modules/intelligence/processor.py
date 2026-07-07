import asyncio
import os
from app.modules.localization.service import LocalizationService
from app.modules.intelligence.confidence import ConfidenceEngine
from app.modules.intelligence.prompts.product_detection import ProductDetectionPrompt
from app.modules.intelligence.providers.factory import AIProviderFactory
from app.modules.intelligence.schemas import AnalysisResult

# 🟢 Try importing anthropic errors to selectively bypass out-of-credit exceptions
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# 🛡️ Custom Exception to halt the downstream pipeline instantly
class InvalidDatasetException(Exception):
    """Raised when the uploaded image does not contain valid product sets."""
    pass

class AIProcessor:

    def __init__(self):
        self.localization = LocalizationService()
        self.confidence = ConfidenceEngine()
        self.prompt = ProductDetectionPrompt()
        
        # ⚡ Read primary provider setting from environment variables
        primary_provider = os.getenv("AI_PROVIDER", "google").lower()

        # Build raw strategy pool instances
        raw_pool = [
            {"name": "google", "instance": AIProviderFactory.create_by_name("google")},
            {"name": "gemini", "instance": AIProviderFactory.create_by_name("gemini")},
            {"name": "claude", "instance": AIProviderFactory.create_by_name("claude")},
            {"name": "anthropic", "instance": AIProviderFactory.create_by_name("anthropic")}
        ]

        # ⚡ Strict Dynamic Sorting Pipeline
        # Ensures chosen provider comes first, handling google/gemini interchangeably
        def sort_key(p):
            name = p["name"]
            if primary_provider in ["google", "gemini"] and name in ["google", "gemini"]:
                return 0
            if primary_provider == name:
                return 0
            return 1

        self.providers_pool = sorted(raw_pool, key=sort_key)
        
        # Diagnostic alert to terminal to confirm configuration layout on startup
        print(f"[AI CORE INITIALIZATION] Ordered provider sequence: {[p['name'].upper() for p in self.providers_pool]}")

    async def process_image(self, image, vendor=None, context: dict = None):
        """
        Processes a raw image asset through the available AI provider pool stack.
        Accepts vendor parameters or an explicit localized context mapping payload.
        """
        # Initialize default configurations
        instruction = None
        localization_context = {}

        # 1. Resolve localization settings via incoming parameters
        if vendor:
            localization_context = self.localization.build_context(
                getattr(vendor, "country", "Global"),
                getattr(vendor, "city", "Any City"),
                getattr(vendor, "language", "en")
            )
            instruction = self.prompt.build(
                localization_context.get("country"),
                localization_context.get("language")
            )
        # 🟢 FIX 1: Safely catch context mappings passed from router/service layers if vendor entity is omitted
        elif context and ("country" in context or "language" in context):
            localization_context = {
                "country": context.get("country", "Global"),
                "city": context.get("city", "Any City"),
                "language": context.get("language", "en")
            }

        # 2. Extract and prioritize an explicitly passed context override prompt string
        if context and "prompt" in context:
            instruction = context["prompt"]

        # Fallback safe instruction layout if context creation engines yield empty strings
        if not instruction:
            instruction = "Identify products on shelves and return structured count data as JSON."

        # Ensure explicit instruction language instructs Gemini regarding bounding box generation
        if "bounding" not in instruction.lower():
            instruction += " Make sure to extract precise bounding boxes with coordinates for each product found."

        # 🟢 SAFELY RESOLVE THE LOCAL FILE PATH ON WINDOWS
        clean_path = image.storage_url.split("localhost:8000/")[-1] if "localhost" in image.storage_url else image.storage_url
        absolute_path = os.path.abspath(clean_path)
        
        if not os.path.exists(absolute_path):
            print(f"[CRITICAL ERROR] File missing on disk at: {absolute_path}")
            raise FileNotFoundError(f"Image asset missing on path: {absolute_path}")
            
        # 🟢 READ IMAGE DATA STREAM TO RAW BINARY BYTES
        print(f"[AI ENGINE] Loading raw image binary bytes from: {clean_path}")
        with open(absolute_path, "rb") as image_file:
            image_bytes = image_file.read()

        last_exception = None
        attempted_any = False

        # 🟢 FIX 2: Correctly loop and intercept balance exceptions to fall back smoothly
        for provider_entry in self.providers_pool:
            provider_name = provider_entry["name"]
            provider_instance = provider_entry["instance"]

            if not provider_instance:
                print(f"[DYNAMIC ROUTER] Skipping {provider_name.upper()} - factory failed to instantiate (check config/keys)")
                continue

            attempted_any = True
            try:
                print(f"[DYNAMIC ROUTER] Attempting analysis using provider: {provider_name.upper()}...")
                
                # 🟢 FIX 3: Unify payloads to prevent provider parsing extraction failures
                provider_payload = {
                    "prompt": instruction,
                    "image_bytes": image_bytes,
                    "location": localization_context,
                    "country": localization_context.get("country", "Global"),
                    "city": localization_context.get("city", "Any City"),
                    "language": localization_context.get("language", "en"),
                    "response_schema": AnalysisResult
                }
                
                response = await provider_instance.analyze_image(
                    image_bytes,  
                    provider_payload
                )
                
                # Handle both structural Pydantic wraps, dicts, or arrays safely
                if hasattr(response, "products"):
                    raw_products = response.products
                elif isinstance(response, list):
                    raw_products = response
                elif isinstance(response, dict):
                    raw_products = response.get("products", [])
                else:
                    raw_products = []
                
                # 🟢 DIAGNOSTIC LOGS: Inspect incoming structural response data
                print("\n" + "="*80)
                print(f"[DIAGNOSTIC] RAW PRODUCTS FROM {provider_name.upper()} (TYPE: {type(raw_products).__name__})")
                print(f"[DIAGNOSTIC] CONTENT: {raw_products}")
                print("="*80 + "\n")
                
                # Filter items using the confidence engine evaluation framework
                filtered_products = self.confidence.filter_products(raw_products)
                
                # 🟢 DIAGNOSTIC LOGS: Inspect what survived the filtration threshold
                print("\n" + "="*80)
                print(f"[DIAGNOSTIC] PRODUCTS SURVIVED FILTER: {filtered_products}")
                print(f"[DIAGNOSTIC] SURVIVED COUNT: {len(filtered_products)}")
                print("="*80 + "\n")
                
                # 🛡️ INTERCEPT ZERO-PRODUCT OR EMPTY/HUMAN DATASETS IMMEDIATELY
                if len(filtered_products) == 0:
                    print(f"[GUARDRAIL ALERT] Zero retail products identified. This image appears to be an empty space or a non-product asset.")
                    raise InvalidDatasetException("This is not a product. Please upload a real product image.")

                print(f"[SUCCESS] Execution completed cleanly using stable engine: {provider_name.upper()}!")
                return {
                    "products": filtered_products,
                    "count": len(filtered_products)
                }

            except InvalidDatasetException as ide:
                # Re-raise guardrail exception immediately to bypass downstream fallback attempts
                raise ide
            
            except Exception as e:
                # Catch implicit Anthropic API billing depletion explicitly
                if ANTHROPIC_AVAILABLE and isinstance(e, anthropic.BadRequestError):
                    print(f"[FAILOVER ALERT] Anthropic wallet depleted! Error: {str(e)}")
                else:
                    print(f"[FAILOVER WARNING] Provider {provider_name.upper()} failed with error: {str(e)}")
                
                print(f"[FAILOVER] Shifting core context execution payload down line to next available provider...")
                last_exception = e
                continue

        # If everything in the loop was skipped because instances were None
        if not attempted_any:
            raise RuntimeError("Zero valid AI engine providers could be loaded. Verify your .env API keys.")

        print(f"\n" + "!"*40 + " ALL PROVIDERS UNSTABLE " + "!"*40)
        print("[CRITICAL] Entire provider chain exhausted. Failing root task context chain.")
        print("!"*104 + "\n")
        raise last_exception