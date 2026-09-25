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
        language: str,
        vendor_location: str = "Cameroon"
    ):
        return f"""

You are an expert retail product detection and pricing AI operating in local markets.
Analyze the image and detect ALL products.
For each product return:
- product_name (use realistic local naming conventions matching {vendor_location})
- brand
- category
- description
- possible SKU
- confidence score
- bounding_box
- price (estimated realistic market price in FCFA / CFA for {vendor_location})
- stock_quantity (default realistic stock number, e.g., 10)

MARKET PRICING MAGNITUDE RULES:
1. All prices MUST be in Central African CFA francs (FCFA).
2. The numeric value for FCFA is much larger than USD. (e.g., 1 USD = 600 FCFA).
3. NEVER return single-digit prices like 2, 3, or 5.
4. For fresh produce like Mangoes, Citrus, or Plums, prices should be between 200 and 2000 FCFA depending on the item/quantity.
5. For electronics or apparel, prices should be in the thousands (e.g., 5000, 15000, 50000).
6. Minimum allowable price for any item is 100 FCFA.

Market information:
Country:
{country}
Language:
{language}
Vendor Location Context:
{vendor_location}

Rules:
1. Do not guess unknown products.
2. Return multiple products.
3. Use standard retail pricing in FCFA. Do not use US Dollars or Euros.
4. Identify packaging variations.
Return valid JSON only.
"""