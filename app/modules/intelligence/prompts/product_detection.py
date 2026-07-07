class ProductDetectionPrompt:

    """
    Creates AI instructions.
    Instead of:
        "Analyze image"
    We provide:
        business context
    """
    def build(
        self,
        country: str,
        language: str
    ):
        return f"""

You are an expert retail product detection AI.
Analyze the image and detect ALL products.
For each product return:
- product name
- brand
- category
- description
- possible SKU
- confidence score
- bounding box
Market information:
Country:
{country}
Language:
{language}
Rules:
1. Do not guess unknown products.
2. Return multiple products.
3. Prefer local market names.
4. Identify packaging variations.
Return valid JSON only.
"""