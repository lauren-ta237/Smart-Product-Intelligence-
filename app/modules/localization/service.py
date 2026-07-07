class LocalizationService:
    """
    Adjusts AI understanding based
    on vendor location.
    Example:
    Country:
        Cameroon
    Language:
        French/English
    Market:
        African retail
    """

    def build_context(
        self,
        country: str,
        city: str,
        language: str | None
    ):
        return {
            "country": country,
            "city": city,
            "language": language or "en",
            # Future:
            # regional SKU database
            # currency
            # common brands
            "market":
            "local"
        }