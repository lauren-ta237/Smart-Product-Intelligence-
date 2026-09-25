from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.modules.orders.models import OrderStatus


# --- Item Schemas ---
class OrderItemCreate(BaseModel):
    product_id: Optional[UUID] = None
    product_name: str
    quantity: int = Field(gt=0, description="Quantity must be at least 1")
    price: Decimal = Field(gt=0, description="Unit price of the item")


class OrderItemResponse(OrderItemCreate):
    id: UUID
    order_id: UUID

    model_config = ConfigDict(from_attributes=True)


# --- Shipment Schemas ---
class ShipmentUpdatePayload(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None


class ShipmentResponse(BaseModel):
    id: UUID
    order_id: UUID
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Order Schemas ---
class OrderCreateRequest(BaseModel):
    vendor_id: UUID
    items: List[OrderItemCreate]
    total_price: Decimal


class OrderResponse(BaseModel):
    id: UUID
    buyer_id: UUID
    vendor_id: UUID
    status: OrderStatus
    total_price: Decimal
    items: List[OrderItemResponse] = []
    shipment: Optional[ShipmentResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)