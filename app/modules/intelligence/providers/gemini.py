import os
import json
from typing import List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 🟢 NEW: Explicit schema structure so Gemini knows exactly what fields to fill
class BoundingBoxCoordinate(BaseModel):
    x: float = Field(description="Top-left X coordinate normalized relative to image width (0.0 to 1.0).")
    y: float = Field(description="Top-left Y coordinate normalized relative to image height (0.0 to 1.0).")
    width: float = Field(description="The normalized width of the bounding box container box (0.0 to 1.0).")
    height: float = Field(description="The normalized height of the bounding box container box (0.0 to 1.0).")

class ProductItem(BaseModel):
    product_name: str = Field(description="The identified name or brand variant of the product.")
    category: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    confidence_score: float = Field(default=1.0, description="The confidence calculation threshold.")
    # 🟢 CHANGED: Swap from generic dict to explicit sub-model coordinate wrapper
    bounding_box: BoundingBoxCoordinate = Field(description="Normalized coordinates tracking object bounding wrapper.")

class TargetAnalysisSchema(BaseModel):
    products: List[ProductItem]

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
        self.model_name = "gemini-2.5-flash"

    async def analyze_image(self, image_url: str, context: dict) -> dict:
        # 🟢 OPTIMIZED DEFAULT PROMPT: Explicitly commands object localization detection
        default_prompt = (
            "Identify all products in the image. For each detected product, provide its name, "
            "category, brand, and calculate highly accurate normalized 2D bounding boxes "
            "[x, y, width, height] tracking where the item is located on the layout canopy."
        )
        prompt = context.get("prompt", default_prompt)
        
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

            # Generate the schema dict from Pydantic and strip out additionalProperties
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
                return json.loads(response.text)
                
            return {"products": []}

        except Exception as e:
            print(f"[CRITICAL] Provider caught exception: {str(e)}")
            raise e