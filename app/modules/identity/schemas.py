from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.modules.identity.models import UserRole


# ==========================================
# Authentication & Registration Inputs
# ==========================================

class UserCreate(BaseModel):
    """Payload for standard email/password registration."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    role: UserRole = Field(default=UserRole.BUYER, description="Account role: buyer, vendor, or admin")
    
    # Optional Profile Details
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = "en"

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v: Any) -> Any:
        """Normalizes incoming strings to uppercase for model compatibility."""
        if isinstance(v, str):
            return v.strip().upper()
        return v


class UserLogin(BaseModel):
    """Payload for traditional password login."""
    email: EmailStr
    password: str


class RefreshTokenInput(BaseModel):
    """Payload required to request a new access token."""
    refresh_token: str


class GoogleAuthInput(BaseModel):
    """Payload received from frontend after Google OAuth verification."""
    credential: str = Field(..., description="Google ID Token (JWT) sent from the client")


# ==========================================
# Account Update & Profile Inputs
# ==========================================

class UserUpdate(BaseModel):
    """Payload for updating user profile information."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    company_name: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field(None, max_length=10)
    avatar: Optional[str] = None


class PasswordChange(BaseModel):
    """Payload for updating user password."""
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)


# ==========================================
# Output & Serialization Schemas
# ==========================================

class UserResponse(BaseModel):
    """
    Public representation of a user.
    Strictly excludes `password_hash` and internal security fields.
    """
    id: UUID
    email: EmailStr
    provider: str
    role: UserRole
    is_active: bool
    is_verified: bool
    
    # Profile Details
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = "en"
    avatar: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """JWT Token payload returned upon successful login, registration, or refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None