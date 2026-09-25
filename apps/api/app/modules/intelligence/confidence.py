from typing import List

class ConfidenceEngine:
    """
    Evaluates AI detection quality.
    AI providers give probabilities,
    but we need business rules.
    Example:
        0.95+       -> Very reliable
        0.75 - 0.95 -> Needs review
        Below 0.75  -> Low confidence
    """
    def evaluate(
        self,
        confidence: float
    ) -> str:
        if confidence >= 0.95:
            return "high"
        if confidence >= 0.75:
            return "medium"
        return "low"

    def filter_products(
        self,
        products: List[dict],
        minimum: float = 0.65
    ) -> List[dict]:
        """
        Remove weak detections with resilient key matching and value parsing.
        This prevents garbage from entering the marketplace database.
        """
        filtered = []
        for product in products:
            # 1. Attempt to find the confidence value across common keys
            raw_conf = (
                product.get("confidence") 
                if product.get("confidence") is not None 
                else product.get("confidence_score", product.get("score", product.get("prob")))
            )
            
            # 2. Parse value safely if it's missing or malformed
            if raw_conf is None:
                parsed_conf = 0.0
            elif isinstance(raw_conf, (int, float)):
                parsed_conf = float(raw_conf)
            elif isinstance(raw_conf, str):
                try:
                    # Strip percentage signs if present (e.g., "85%")
                    clean_str = raw_conf.replace("%", "").strip()
                    val = float(clean_str)
                    # Convert whole percentages (like 85.0) down to standard 0.85 scale
                    parsed_conf = val / 100.0 if val > 1.0 else val
                except ValueError:
                    parsed_conf = 0.0
            else:
                parsed_conf = 0.0

            # 3. Apply business filtration rule threshold
            if parsed_conf >= minimum:
                # Normalize the key back to 'confidence' so the UI reads it cleanly
                product["confidence"] = parsed_conf
                filtered.append(product)
                
        return filtered