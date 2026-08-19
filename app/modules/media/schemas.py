from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class ImageResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    storage_url: str
    file_name: str
    status: str
    width: Optional[int] = None
    height: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)