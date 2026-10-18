import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.orders.router import get_buyer_order, get_vendor_order


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDatabase:
    def __init__(self, value):
        self.value = value
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeResult(self.value)


def order_for(buyer_id, vendor_id):
    return SimpleNamespace(
        id=uuid.uuid4(),
        buyer_id=buyer_id,
        vendor_id=vendor_id,
        created_at=datetime.now(timezone.utc),
        status="pending",
        total_price=12.5,
        shipment=None,
        items=[],
    )


@pytest.mark.asyncio
async def test_buyer_order_detail_is_scoped_to_current_buyer():
    buyer_id = uuid.uuid4()
    order = order_for(buyer_id, uuid.uuid4())
    db = FakeDatabase(order)

    response = await get_buyer_order(order.id, db=db, user=SimpleNamespace(id=buyer_id))

    assert response["id"] == str(order.id)
    assert "orders.buyer_id =" in str(db.statement)
    assert response["carrier"] is None
    assert response["tracking_number"] is None


@pytest.mark.asyncio
async def test_buyer_cannot_fetch_another_buyers_order():
    db = FakeDatabase(None)

    with pytest.raises(HTTPException) as error:
        await get_buyer_order(
            uuid.uuid4(),
            db=db,
            user=SimpleNamespace(id=uuid.uuid4()),
        )

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_vendor_order_detail_is_scoped_to_current_vendor():
    vendor_id = uuid.uuid4()
    order = order_for(uuid.uuid4(), vendor_id)
    db = FakeDatabase(order)

    response = await get_vendor_order(order.id, db=db, v_id=vendor_id)

    assert response["id"] == str(order.id)
    assert "orders.vendor_id =" in str(db.statement)


@pytest.mark.asyncio
async def test_vendor_cannot_fetch_another_vendors_order():
    db = FakeDatabase(None)

    with pytest.raises(HTTPException) as error:
        await get_vendor_order(uuid.uuid4(), db=db, v_id=uuid.uuid4())

    assert error.value.status_code == 404
