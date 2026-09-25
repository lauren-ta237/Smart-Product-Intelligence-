from .base import VisionProvider

class AnthropicVisionProvider(
    VisionProvider
):
    """
    Claude Vision provider.

    Used for:
    - product descriptions
    - reasoning
    - regional understanding
    """
    def __init__(
        self,
        api_key: str
    ):
        self.api_key = api_key
    async def analyze_image(
        self,
        image_url: str,
        context: dict
    ):
        """
        Claude can receive:
        - image
        - country
        - language
        - marketplace rules
        and generate better descriptions.
        """
        return {

            "provider": "anthropic",

            "products": []

        }