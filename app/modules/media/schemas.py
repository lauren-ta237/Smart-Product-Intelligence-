from pydantic import BaseModel
from uuid import UUID

class ImageResponse(BaseModel):

    id: UUID

    storage_url: str

    status: str


    class Config:

        from_attributes=True