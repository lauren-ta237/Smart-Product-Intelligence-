from pydantic import BaseModel, EmailStr
from uuid import UUID

class VendorCreate(BaseModel):
    email: EmailStr
    password: str
    company_name: str
    country: str
    city: str

class VendorResponse(BaseModel):
    id: UUID
    email: EmailStr
    company_name: str
    country: str

    class Config:
        from_attributes = True