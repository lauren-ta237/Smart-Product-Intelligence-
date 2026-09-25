from app.core.config.settings import settings
from .gemini import GeminiVisionProvider
from .claude import ClaudeVisionProvider

class AIProviderFactory:
    """
    Creates the AI provider.
    We can switch providers without changing business logic.
    """
    @staticmethod
    def create():
        if settings.AI_PROVIDER == "google":
            return GeminiVisionProvider(
                settings.GOOGLE_AI_KEY
            )
        if settings.AI_PROVIDER == "anthropic":
            return ClaudeVisionProvider(
                settings.ANTHROPIC_API_KEY
            )
        raise Exception(
            "Unsupported AI provider"
        )

    @staticmethod
    def create_by_name(name: str):
        """
        🟢 Allows the automated failover system to dynamically spin up 
        a specific backup provider when a network outage hits.
        """
        name = name.lower()
        try:
            if name in ("google", "gemini"):
                if not settings.GOOGLE_AI_KEY:
                    print(f"[FACTORY ERROR] Cannot load {name.upper()} - 'settings.GOOGLE_AI_KEY' is empty or not loaded!")
                    return None
                print(f"[FACTORY] Successfully instantiating provider wrapper: {name.upper()}")
                return GeminiVisionProvider(settings.GOOGLE_AI_KEY)
                
            if name in ("anthropic", "claude"):
                if not settings.ANTHROPIC_API_KEY:
                    print(f"[FACTORY ERROR] Cannot load {name.upper()} - 'settings.ANTHROPIC_API_KEY' is empty or not loaded!")
                    return None
                print(f"[FACTORY] Successfully instantiating provider wrapper: {name.upper()}")
                return ClaudeVisionProvider(settings.ANTHROPIC_API_KEY)
                
        except Exception as e:
            print(f"[FACTORY CRITICAL FAILURE] Exception hit while spinning up '{name}': {str(e)}")
            return None
            
        print(f"[FACTORY WARNING] Requested provider name '{name}' matched no known provider keys.")
        return None 