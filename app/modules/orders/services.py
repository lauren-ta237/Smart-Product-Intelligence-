from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.modules.orders.models import Order, OrderItem, Shipment, OrderStatus
from app.modules.orders.schemas import OrderCreateRequest, ShipmentUpdatePayload


async def create_order(db: AsyncSession, buyer_id: UUID, payload: OrderCreateRequest) -> Order:
    """Create a new order along with its items."""
    new_order = Order(
        buyer_id=buyer_id,
        vendor_id=payload.vendor_id,
        status=OrderStatus.PENDING,
        total_price=payload.total_price,
    )
    db.add(new_order)
    await db.flush()  # Generates new_order.id

    for item in payload.items:
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            price=item.price,
        )
        db.add(order_item)

    await db.commit()
    
    # Reload order with nested relationships
    stmt = (
        select(Order)
        .where(Order.id == new_order.id)
        .options(selectinload(Order.items), selectinload(Order.shipment))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def get_user_orders(db: AsyncSession, user_id: UUID) -> List[Order]:
    """Retrieve all orders where the user is either buyer or vendor."""
    stmt = (
        select(Order)
        .where((Order.buyer_id == user_id) | (Order.vendor_id == user_id))
        .options(selectinload(Order.items), selectinload(Order.shipment))
        .order_by(Order.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_order_shipment(
    db: AsyncSession, order_id: UUID, vendor_id: UUID, payload: ShipmentUpdatePayload
) -> Order:
    """Update order status and shipment tracking (Vendor only)."""
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.shipment))
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    order.status = payload.status

    if order.shipment:
        if payload.tracking_number:
            order.shipment.tracking_number = payload.tracking_number
        if payload.carrier:
            order.shipment.carrier = payload.carrier
        if payload.estimated_delivery:
            order.shipment.estimated_delivery = payload.estimated_delivery
    else:
        shipment = Shipment(
            order_id=order.id,
            tracking_number=payload.tracking_number,
            carrier=payload.carrier,
            estimated_delivery=payload.estimated_delivery,
        )
        db.add(shipment)

    await db.commit()
    await db.refresh(order)
    return order