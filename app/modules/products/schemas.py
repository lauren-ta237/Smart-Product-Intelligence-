from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    sku_us: Optional[str] = None
    sku_cm: Optional[str] = None
    market_sku: Optional[str] = None
    image_url: Optional[str] = None
    image_id: Optional[UUID] = None
    bounding_box: Optional[Any] = None 
    approved: bool = False
    price: Optional[float] = 0.0
    stock_quantity: Optional[int] = 0
    location: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    sku_us: Optional[str] = None
    sku_cm: Optional[str] = None
    market_sku: Optional[str] = None
    image_url: Optional[str] = None
    image_id: Optional[UUID] = None
    bounding_box: Optional[Any] = None
    approved: Optional[bool] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    location: Optional[str] = None

class ProductResponse(BaseModel):
    id: UUID
    vendor_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    sku_us: Optional[str] = None
    sku_cm: Optional[str] = None
    market_sku: Optional[str] = None
    image_url: Optional[str] = None
    image_id: Optional[UUID] = None
    bounding_box: Optional[Any] = None
    approved: bool
    created_at: datetime
    updated_at: datetime

    # Transactional attributes
    price: Optional[float] = 0.0
    stock_quantity: Optional[int] = 0
    location: Optional[str] = None
    vendor_location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ProductPaginationResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    size: int
    pages: int