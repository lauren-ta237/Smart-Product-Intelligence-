from abc import ABC, abstractmethod

class VisionProvider(ABC):
    """
    Base contract for all AI vision providers.
    Any AI service we add in the future
    must follow this interface.
    Example:
    - Google Vision
    - Claude Vision
    - OpenAI Vision
    - Custom ML model
    """
    @abstractmethod
    async def analyze_image(
        self,
        image_url: str,
        context: dict
    ) -> dict:
        """
        Receives:
        image_url:
            Location of uploaded image
        context:
            Vendor location information
        Returns:
            Raw AI response
        """
        pass