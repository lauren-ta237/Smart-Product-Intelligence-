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

    # Scoped directly to the master identity table
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    storage_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ImageStatus] = mapped_column(
        Enum(ImageStatus),
        default=ImageStatus.UPLOADED,
        nullable=False
    )
    width: Mapped[int | None] = mapped_column(nullable=True, default=None)
    height: Mapped[int | None] = mapped_column(nullable=True, default=None)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)