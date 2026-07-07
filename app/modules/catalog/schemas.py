from pydantic import BaseModel, Field, AliasChoices
from uuid import UUID
from typing import Optional

class ProductApproveRequest(BaseModel):
    """
    Vendor edits AI result
    before making it public.
    """
    name: str
    description: str
    category: str
    brand: Optional[str] = None
    sku: Optional[str] = None

class ProductResponse(BaseModel):
    id: UUID
    name: str
    description: str
    category: str
    approved: bool

    class Config:
        from_attributes = True

# 🟢 ADD THIS NEW SCHEMA MODEL TO THE BOTTOM OF THE FILE:
class DetectedProductResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    name: str
    confidence: float
    box_coordinates: Optional[list] = None
    
    # 🟢 THE FIX: Tells Pydantic to look for 'market_sku' or 'sku' in the database,
    # but serialization outputs it to the frontend as 'sku'
    sku: Optional[str] = Field(
        None, 
        validation_alias=AliasChoices("market_sku", "sku"),
        serialization_alias="sku"
    )

    class Config:
        from_attributes = True
        # Ensure aliases work seamlessly during serialization
        populate_by_name = True