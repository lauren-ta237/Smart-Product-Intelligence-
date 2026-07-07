import uuid
from typing import Any

from sqlalchemy import (
    String,
    Float,
    Boolean,
    JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import BaseModel


class Product(BaseModel):
    __tablename__ = "products"

    vendor_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)

    sku: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_us: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_cm: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market_sku: Mapped[str | None] = mapped_column(String(128), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    approved: Mapped[bool] = mapped_column(Boolean, default=False)


class DetectedProduct(BaseModel):
    __tablename__ = "detected_products"

    analysis_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
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


__all__ = ["Product", "DetectedProduct"]