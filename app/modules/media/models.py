import uuid
import enum
from sqlalchemy import String, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel

class ImageStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ProductImage(BaseModel):
    """
    Stores vendor uploaded images.
    This table represents the raw input before AI processing.
    """
    __table_args__ = (
        Index("idx_image_vendor", "vendor_id"),
        Index("idx_image_status", "status")
    )
    __tablename__ = "product_images"

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"),
        nullable=False
    )
    storage_url: Mapped[str]
    file_name: Mapped[str]
    status: Mapped[ImageStatus] = mapped_column(
        Enum(ImageStatus),
        default=ImageStatus.UPLOADED
    )
    width: Mapped[int | None]
    height: Mapped[int | None]
    mime_type: Mapped[str | None]