from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.modules.orders.models import OrderStatus, PaymentStatus
from app.modules.orders.router import get_buyer_orders


class FakeScalars:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return FakeScalars(self.values)


class FakeDatabase:
    def __init__(self, values):
        self.values = values
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return FakeResult(self.values)


@pytest.mark.asyncio
async def test_buyer_order_details_return_existing_order_fields_and_scope_to_buyer():
    buyer_id = uuid4()
    order_id = uuid4()
    created_at = datetime(2026, 10, 16, 12, 30, tzinfo=timezone.utc)
    order = SimpleNamespace(
        id=order_id,
        buyer_id=buyer_id,
        status=OrderStatus.PENDING,
        created_at=created_at,
        total_price=42.5,
        payments=[SimpleNamespace(status=PaymentStatus.PAID)],
        shipment=SimpleNamespace(
            carrier="Courier",
            tracking_number="TRACK-123",
            estimated_delivery="2026-10-20",
        ),
        items=[SimpleNamespace(product_name="Product", quantity=2, price=21.25)],
    )
    db = FakeDatabase([order])

    result = await get_buyer_orders(db=db, user=SimpleNamespace(id=buyer_id))

    assert "orders.buyer_id" in str(db.statements[0])
    assert result == [
        {
            "id": str(order_id),
            "status": OrderStatus.PENDING,
            "date": created_at.isoformat(),
            "payment_status": "PAID",
            "total_price": 42.5,
            "carrier": "Courier",
            "tracking_number": "TRACK-123",
            "estimated_delivery": "2026-10-20",
            "items": [{"product_name": "Product", "quantity": 2, "price": 21.25}],
        }
    ]


@pytest.mark.asyncio
async def test_buyer_order_details_do_not_invent_missing_shipment_values():
    order = SimpleNamespace(
        id=uuid4(),
        status=OrderStatus.PENDING,
        created_at=datetime(2026, 10, 16, tzinfo=timezone.utc),
        total_price=10,
        payments=[],
        shipment=None,
        items=[],
    )

    result = await get_buyer_orders(
        db=FakeDatabase([order]),
        user=SimpleNamespace(id=uuid4()),
    )

    assert result[0]["payment_status"] is None
    assert result[0]["carrier"] is None
    assert result[0]["tracking_number"] is None
    assert result[0]["estimated_delivery"] is None
