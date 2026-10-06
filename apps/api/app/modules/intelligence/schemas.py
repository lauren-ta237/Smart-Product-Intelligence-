from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ImageUploadResponse(BaseModel):
    id: UUID
    status: str
    url: str = Field(..., validation_alias="storage_url")

    model_config = ConfigDict(from_attributes=True)


class AnalysisResponse(BaseModel):
    """
    Returned to frontend.
    Shows current AI job status.
    """
    id: UUID
    image_id: UUID
    provider: str
    status: str
    detected_count: int
    created_at: datetime
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BoundingBoxSchema(BaseModel):
    """
    Coordinates of detected object inside the image.
    """
    x: float
    y: float
    width: float
    height: float


class DetectedItem(BaseModel):
    """
    Standard product format.
    Every AI provider must eventually map into this structure.
    """
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    
    sku: Optional[str] = Field(
        default=None, 
        validation_alias=AliasChoices("sku", "market_sku")
    )
    
    sku_us: Optional[str] = None
    sku_cm: Optional[str] = None
    confidence: float
    bounding_box: BoundingBoxSchema


class AnalysisResult(BaseModel):
    products: List[DetectedItem]


class DetectedProductResponse(BaseModel):
    """
    Product detected by AI.
    Vendor can review/edit it.
    """
    id: UUID
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    
    sku: Optional[str] = Field(
        default=None, 
        validation_alias=AliasChoices("market_sku", "sku"),
        serialization_alias="sku"
    )
    
    sku_us: Optional[str] = None
    sku_cm: Optional[str] = None
    
    confidence_score: float = Field(
        validation_alias=AliasChoices("confidence_score", "confidence")
    )
    bounding_box: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    crop_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("crop_url", "cropped_image_url"),
        serialization_alias="crop_url",
    )

    # Dynamic Attributes
    price: Optional[float] = 0.0
    stock_quantity: Optional[int] = 0
    location: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )