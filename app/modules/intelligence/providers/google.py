import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

class GoogleVisionProvider:  # Updated class name for clarity
    def __init__(self, *args, **kwargs):
        # 1. Look for existing loaded environment variables
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        # 2. Hard fallback: Explicitly find and parse the root .env file if empty
        if not api_key:
            load_dotenv(dotenv_path=os.path.join(os.getcwd(), ".env"), override=True)
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            
        if not api_key:
            raise ValueError("[ERROR] Google API Key could not be resolved from local configuration.")

        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"

    async def analyze_image(self, image_url: str, context: dict) -> dict:
        prompt = context.get("prompt", "Identify products on shelves and return structured count data.")
        # 🟢 Extract the passed Pydantic schema structure out of execution context parameters
        schema = context.get("response_schema")
        
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

            # 🟢 Build structured configuration setup safely
            config_args = {"response_mime_type": "application/json"}
            if schema:
                config_args["response_schema"] = schema

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(**config_args),
            )
            
            if response.text:
                # 🟢 If a structured Pydantic schema was used, the modern client can return parsed schema values
                # directly, or we can unpack the text response string using native JSON handling
                return json.loads(response.text)
                
            return {"detected_count": 0, "products": []}

        except Exception as e:
            print(f"[CRITICAL] Provider caught exception: {str(e)}")
            raise e