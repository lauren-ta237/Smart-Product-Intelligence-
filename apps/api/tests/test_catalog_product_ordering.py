import pytest

from app.modules.catalog.router import get_all_products


class FakeScalars:
    def all(self):
        return []


class FakeResult:
    def scalars(self):
        return FakeScalars()


class FakeDatabase:
    def __init__(self):
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return FakeResult()


@pytest.mark.asyncio
async def test_catalog_products_are_newest_first_and_apply_requested_page():
    db = FakeDatabase()

    products = await get_all_products(
        db=db,
        vendor=None,
        approved=True,
        page=2,
        size=5,
    )

    statement = str(db.statements[0])
    assert products == []
    assert "ORDER BY products.created_at DESC, products.id DESC" in statement
    assert "LIMIT" in statement
    assert "OFFSET" in statement
    assert "products.approved = true" in statement