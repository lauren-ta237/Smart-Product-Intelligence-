import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, get_current_vendor
from app.modules.orders.models import Order, OrderItem, Shipment, OrderStatus, Payment, PaymentStatus
from app.modules.orders.schemas import OrderCreateRequest, ShipmentUpdatePayload
from app.modules.catalog.models import Product
from app.modules.identity.models import User

router = APIRouter(
    prefix="/orders",
    tags=["Order Tracking"]
)

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_orders(
    payload: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Groups items by their actual vendor and creates separate orders."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    try:
        grouped_orders = {}

        for item in payload.items:
            # Look up the product to find the REAL vendor
            prod_stmt = select(Product).where(Product.id == item.product_id)
            res = await db.execute(prod_stmt)
            product = res.scalar_one_or_none()
            
            # Use the product's vendor_id, or fallback to payload, or default admin
            v_id = product.vendor_id if product else payload.vendor_id
            v_str = str(v_id)

            if v_str not in grouped_orders:
                grouped_orders[v_str] = []
            grouped_orders[v_str].append(item)

        order_ids = []
        for v_id_str, items in grouped_orders.items():
            total = sum(float(i.price) * i.quantity for i in items)
            
            new_order = Order(
                buyer_id=current_user.id,
                vendor_id=uuid.UUID(v_id_str),
                status=OrderStatus.PENDING,
                total_price=total
            )
            db.add(new_order)
            await db.flush()

            for i in items:
                db.add(OrderItem(
                    order_id=new_order.id,
                    product_id=i.product_id,
                    product_name=i.product_name,
                    quantity=i.quantity,
                    price=i.price
                ))
            
            db.add(Payment(order_id=new_order.id, amount=total, status=PaymentStatus.PAID))
            db.add(Shipment(order_id=new_order.id, estimated_delivery="Pending Update"))
            order_ids.append(str(new_order.id))

        await db.commit()
        return {"status": "success", "order_ids": order_ids}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/buyer")
async def get_buyer_orders(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    """Fetches orders bought by the current user with details."""
    stmt = select(Order).where(Order.buyer_id == user.id).options(
        selectinload(Order.items), 
        selectinload(Order.shipment)
    ).order_by(Order.created_at.desc())
    result = await db.execute(stmt)
    orders = result.scalars().all()
    
    response = []
    for order in orders:
        response.append({
            "id": str(order.id),
            "status": order.status,
            "total_price": float(order.total_price),
            "carrier": order.shipment.carrier if order.shipment else "Pending",
            "tracking_number": order.shipment.tracking_number if order.shipment else "Awaiting Dispatch",
            "estimated_delivery": order.shipment.estimated_delivery if order.shipment else "Processing",
            "items": [{"product_name": i.product_name, "quantity": i.quantity, "price": float(i.price)} for i in order.items]
        })
    return response

@router.get("/vendor")
async def get_vendor_orders(db: AsyncSession = Depends(get_db), v_id = Depends(get_current_vendor)):
    """Fetches orders placed at the vendor's store."""
    stmt = select(Order).where(Order.vendor_id == v_id).options(
        selectinload(Order.items), 
        selectinload(Order.shipment)
    ).order_by(Order.created_at.desc())
    result = await db.execute(stmt)
    
    response = []
    for order in result.scalars().all():
        buyer_res = await db.execute(select(User).where(User.id == order.buyer_id))
        buyer = buyer_res.scalar_one_or_none()
        response.append({
            "id": str(order.id),
            "status": order.status,
            "total_price": float(order.total_price),
            "buyer_name": f"{buyer.first_name} {buyer.last_name}" if (buyer and buyer.first_name) else "Marketplace Guest",
            "buyer_contact": buyer.email if buyer else "N/A",
            "delivery_address": f"{buyer.city}, {buyer.country}" if (buyer and buyer.city) else "Global Hub",
            "items": [{"product_name": i.product_name, "quantity": i.quantity, "price": float(i.price)} for i in order.items],
            "carrier": order.shipment.carrier if order.shipment else None,
            "tracking_number": order.shipment.tracking_number if order.shipment else None
        })
    return response

@router.patch("/{order_id}/status")
async def update_order_status(order_id: uuid.UUID, payload: ShipmentUpdatePayload, db: AsyncSession = Depends(get_db), v_id = Depends(get_current_vendor)):
    stmt = select(Order).where(Order.id == order_id, Order.vendor_id == v_id)
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order: raise HTTPException(status_code=404)
    
    order.status = payload.status
    ship_res = await db.execute(select(Shipment).where(Shipment.order_id == order.id))
    shipment = ship_res.scalar_one_or_none()
    if shipment:
        if payload.tracking_number: shipment.tracking_number = payload.tracking_number
        if payload.carrier: shipment.carrier = payload.carrier
    
    await db.commit()
    return {"status": "success"}