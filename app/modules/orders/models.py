# app/modules/orders/models.py
import enum
import uuid
from sqlalchemy import String, Float, Integer, ForeignKey, Enum, DateTime, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.core.base_model import BaseModel

class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    PACKED = "PACKED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"

class Order(BaseModel):
    __tablename__ = "orders"

    buyer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False), 
        default=OrderStatus.PENDING, 
        nullable=False
    )
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    
    # Relationships
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", 
        back_populates="order", 
        cascade="all, delete-orphan", 
        lazy="selectin"
    )
    shipment: Mapped["Shipment"] = relationship(
        "Shipment", 
        back_populates="order", 
        uselist=False, 
        cascade="all, delete-orphan", 
        lazy="selectin"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

class OrderItem(BaseModel):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("orders.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("products.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")

class Shipment(BaseModel):
    __tablename__ = "shipments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("orders.id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True,
        index=True
    )
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_delivery: Mapped[str | None] = mapped_column(String(100), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="shipment")

class Payment(BaseModel):
    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="MOCK_GATEWAY", nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False),
        default=PaymentStatus.PENDING,
        nullable=False
    )
    transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="payments")