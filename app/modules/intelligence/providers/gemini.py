import os
import json
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types


# 🟢 Bounding box model
class BoundingBoxCoordinate(BaseModel):
    x: float = Field(description="Top-left X coordinate normalized relative to image width (0.0 to 1.0).")
    y: float = Field(description="Top-left Y coordinate normalized relative to image height (0.0 to 1.0).")
    width: float = Field(description="The normalized width of the bounding box container box (0.0 to 1.0).")
    height: float = Field(description="The normalized height of the bounding box container box (0.0 to 1.0).")


# 🟢 Product item schema with explicit price estimation fields
class ProductItem(BaseModel):
    product_name: str = Field(description="The identified name or brand variant of the product.")
    category: Optional[str] = Field(default=None, description="Product category.")
    brand: Optional[str] = Field(default=None, description="Brand or manufacturer.")
    sku: Optional[str] = Field(default=None, description="Product SKU or model identifier.")
    description: Optional[str] = Field(default=None, description="Brief product description.")
    confidence_score: float = Field(default=1.0, description="The confidence calculation score between 0.0 and 1.0.")
    estimated_price: float = Field(
        default=0.0,
        description="Estimated market retail price in Central African CFA franc (FCFA/XAF). MUST NOT be 0.0 if item is identified."
    )
    currency: str = Field(
        default="XAF",
        description="3-letter ISO currency code for estimated price (XAF)."
    )
    bounding_box: BoundingBoxCoordinate = Field(description="Normalized coordinates tracking object bounding wrapper.")


class TargetAnalysisSchema(BaseModel):
    products: List[ProductItem]


class ProductDetectionPrompt:
    """
    Creates AI instructions with market-aware context and explicit pricing requirements.
    """
    def build(self, country: str, language: str) -> str:
        return f"""
    You are a strict retail audit AI specialized in the Cameroonian market.
    Analyze the image and ONLY return products you actually see. 
    - Return coordinates in normalized decimals (0.0 to 1.0).
    - Format: [ymin, xmin, ymax, xmax].
    
    PRICING RULES (FCFA):
    - All prices MUST be in FCFA (XAF).
    - NEVER return small numbers like 1, 2, 5, or 10.
    - Standard produce (fruits/veg) prices are usually 200, 500, or 1000 FCFA.
    - Apparel/Shoes are usually 5000, 10000, or 25000 FCFA.
    - If you think an item costs 2 Dollars, you MUST return 1200 FCFA.
    """


# 🟢 HELPER FUNCTION TO STRIP REJECTED KEYWORDS FOR GEMINI DEVELOPER API
def clean_schema(schema_dict: dict) -> dict:
    """Recursively removes 'additionalProperties' from the JSON schema dictionary."""
    if isinstance(schema_dict, dict):
        schema_dict.pop("additionalProperties", None)
        for key, value in schema_dict.items():
            clean_schema(value)
    elif isinstance(schema_dict, list):
        for item in schema_dict:
            clean_schema(item)
    return schema_dict


class GeminiVisionProvider:
    def __init__(self, *args, **kwargs):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        if not api_key:
            load_dotenv(dotenv_path=os.path.join(os.getcwd(), ".env"), override=True)
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            
        if not api_key:
            raise ValueError("[ERROR] Gemini API Key could not be resolved from local configuration.")

        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-3.6-flash"

    async def analyze_image(self, image_url: str, context: dict) -> dict:
        country = context.get("country", "Cameroon")
        language = context.get("language", "en")

        default_prompt = ProductDetectionPrompt().build(country=country, language=language)
        user_prompt = context.get("prompt")

        # 🟢 Enforce pricing rules even when context['prompt'] overrides the default prompt
        if user_prompt:
            prompt = f"{user_prompt}\n\nIMPORTANT PRICING MAGNITUDE INSTRUCTION: Prices MUST be in FCFA. NEVER use single digits like 2 or 5. 1 USD = 600 FCFA. Return realistic Cameroonian prices (e.g., 500, 1500, 2000)."
        else:
            prompt = default_prompt
        
        try:
            image_bytes = None

            if "image_bytes" in context:
                image_bytes = context["image_bytes"]
            elif "file_bytes" in context:
                image_bytes = context["file_bytes"]
            elif isinstance(image_url, bytes):
                image_bytes = image_url

            if not image_bytes and isinstance(image_url, str):
                target_path = image_url
                if not os.path.exists(target_path):
                    target_path = os.path.join(os.getcwd(), image_url)
                
                if os.path.exists(target_path):
                    with open(target_path, "rb") as f:
                        image_bytes = f.read()

            if not image_bytes:
                raise FileNotFoundError(f"Could not locate image resource from path input: {image_url}")

            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg",
            )

            # Generate schema dict and clean OpenAPI additionalProperties keyword
            raw_schema = TargetAnalysisSchema.model_json_schema()
            safe_schema = clean_schema(raw_schema)

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=safe_schema,
                ),
            )
            
            if response.text:
                data = json.loads(response.text)
                
                # 🟢 Zero-price safeguard & alias mapping for backend and UI key compatibility
                for prod in data.get("products", []):
                    # Align 'name' key for services expecting either 'name' or 'product_name'
                    if "name" not in prod and "product_name" in prod:
                        prod["name"] = prod["product_name"]
                    elif "product_name" not in prod and "name" in prod:
                        prod["product_name"] = prod["name"]

                    current_price = prod.get("estimated_price")
                    if current_price is None or float(current_price) == 0.0:
                        prod["estimated_price"] = 1500.0  # Fallback market estimation
                        prod["currency"] = "XAF"
                    
                    # Provide 'price' key alias so callers relying on 'price' receive it directly
                    prod["price"] = prod["estimated_price"]
                
                return data
                
            return {"products": []}

        except Exception as e:
            print(f"[CRITICAL] Provider caught exception: {str(e)}")
            raise e