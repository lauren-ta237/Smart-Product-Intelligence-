from pydantic import BaseModel, Field, AliasChoices
from typing import List, Dict, Any
from datetime import datetime
from uuid import UUID

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

    class Config:
        from_attributes = True

class BoundingBoxSchema(BaseModel):
    """
    Coordinates of detected object
    inside the image.
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
    description: str | None = None
    category: str | None = None
    brand: str | None = None
    # Support mapping from 'market_sku' or 'sku' during extraction validation
    sku: str | None = Field(
        default=None, 
        validation_alias=AliasChoices("sku", "market_sku")
    )
    # 🟢 ADDED: Allow AI to explicitly extract regional variants from packaging text
    sku_us: str | None = None
    sku_cm: str | None = None
    
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
    description: str | None = None
    category: str | None = None
    brand: str | None = None
    
    # Allow the field to read from 'market_sku' (DB column) or 'sku' (AI output)
    sku: str | None = Field(
        default=None, 
        validation_alias=AliasChoices("market_sku", "sku"),
        serialization_alias="sku" # Guarantees the frontend always receives key name "sku"
    )
    
    # 🟢 ADDED: Send regional SKUs to your frontend dashboard metrics/view
    sku_us: str | None = None
    sku_cm: str | None = None
    
    # Safely bind confidence metrics regardless of attribute sourcing
    confidence_score: float = Field(
        validation_alias=AliasChoices("confidence_score", "confidence")
    )
    bounding_box: Dict[str, Any]

    class Config:
        from_attributes = True
        populate_by_name = True # Allows instantiating with either the field name or alias