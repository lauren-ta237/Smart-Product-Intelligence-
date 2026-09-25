from difflib import SequenceMatcher

class ProductMatcher:
    """
    Finds similar existing products.
    Later we can upgrade this to:
    - pgvector
    - embeddings
    - semantic search
    """
    def similarity(
        self,
        a:str,
        b:str
    ):
        return SequenceMatcher(
            None,
            a.lower(),
            b.lower()
        ).ratio()

    def find_match(
        self,
        name,
        existing_products
    ):
        for product in existing_products:
            score = self.similarity(
                name,
                product.name
            )
            if score > 0.85:
                return product
        return None