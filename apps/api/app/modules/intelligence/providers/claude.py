import json
import anthropic
from .base import VisionProvider

class ClaudeVisionProvider(
    VisionProvider
):
    """
    Claude vision provider.
    Useful for:
    - descriptions
    - reasoning
    - difficult products
    """
    def __init__(
        self,
        api_key:str
    ):
        self.client = anthropic.Anthropic(
            api_key=api_key
        )
    async def analyze_image(
        self,
        image_url:str,
        context:dict
    ):
        prompt = context["prompt"]
        response = (
            self.client
            .messages.create(
                model="claude-sonnet-4",
                max_tokens=2000,
                messages=[
                    {
                    "role":"user",
                    "content":prompt
                    }
                ]
            )
        )
        try:
            return json.loads(
                response.content[0].text
            )
        except:
            return {
                "products":[]
            }