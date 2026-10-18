import uuid

import pytest

from fastapi import HTTPException

from app.modules.catalog.router import get_all_products, get_product_by_id


class FakeScalars:
    def all(self):
        return []


class FakeResult:
    def __init__(self, product=None):
        self.product = product

    def scalars(self):
        return FakeScalars()

    def scalar_one_or_none(self):
        return self.product


class FakeDatabase:
    def __init__(self, product=None):
        self.statements = []
        self.product = product

    async def execute(self, statement):
        self.statements.append(statement)
        return FakeResult(self.product)


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


@pytest.mark.asyncio
async def test_product_detail_returns_not_found_for_missing_or_unapproved_product():
    db = FakeDatabase()

    with pytest.raises(HTTPException) as error:
        await get_product_by_id(uuid.uuid4(), db=db)

    assert error.value.status_code == 404
    statement = str(db.statements[0])
    assert "products.id =" in statement
    assert "products.approved IS true" in statement