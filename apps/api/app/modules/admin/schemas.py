from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.modules.admin.models import APITier

class APIKeyCreateRequest(BaseModel):
    developer_id: UUID
    tier: APITier
    rate_limit_max: int = 1000

class APIKeyResponse(BaseModel):
    id: UUID
    developer_id: UUID
    prefix: str
    tier: APITier
    is_active: bool
    calls_made: int
    rate_limit_max: int
    raw_key: Optional[str] = None # Filled only upon generation
    developer_email: Optional[str] = None  # 🟢 Added developer email
    created_at: Optional[datetime] = None  # 🟢 Added created_at timestamp

    class Config:
        from_attributes = True

class PriceSuggestionRequest(BaseModel):
    product_name: str
    grade: str = Field("Grade A Premium", description="produce grade, e.g. Grade A Premium, Grade B Choice, Standard")

class PriceSuggestionResponse(BaseModel):
    product_name: str
    grade: str
    min_price: float
    target_price: float
    max_price: float
    suggestion_reason: str

# 🟢 NEW: Admin Management Schemas
class AdminCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = "en"

class AdminUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None

class AdminPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8)

class AdminResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = "en"
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True