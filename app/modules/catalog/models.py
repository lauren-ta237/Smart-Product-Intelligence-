# app/modules/catalog/models.py
import uuid
from typing import Any

from sqlalchemy import (
    String,
    Float,
    Integer,
    Boolean,
    JSON,
    ForeignKey,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import BaseModel
from app.modules.media.models import ProductImage


class Category(BaseModel):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Product(BaseModel):
    __tablename__ = "products"

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    sku: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    sku_us: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_cm: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market_sku: Mapped[str | None] = mapped_column(String(128), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    
    # Referenced Media Relationship Pointer
    image_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{ProductImage.__tablename__}.id", ondelete="SET NULL"),
        nullable=True
    )
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # --- TRANSACTIONAL EXTENSIONS ---
    price: Mapped[float | None] = mapped_column(Float, default=0.0, nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)


class DetectedProduct(BaseModel):
    __tablename__ = "detected_products"

    analysis_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)

    sku: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_us: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_cm: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market_sku: Mapped[str | None] = mapped_column(String(128), nullable=True)

    confidence_score: Mapped[float | None] = mapped_column(Float, default=0.0)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    approved: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- TRANSACTIONAL EXTENSIONS ---
    price: Mapped[float | None] = mapped_column(Float, default=0.0, nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Review(BaseModel):
    __tablename__ = "reviews"

    product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False) # e.g. 1 to 5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class WishlistItem(BaseModel):
    __tablename__ = "wishlist_items"

    buyer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


__all__ = ["Product", "DetectedProduct", "Category", "Review", "WishlistItem"]