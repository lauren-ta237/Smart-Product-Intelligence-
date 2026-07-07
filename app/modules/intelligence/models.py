# app/modules/intelligence/models.py
import enum
import uuid
from sqlalchemy import String, ForeignKey, Integer, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB, UUID, ENUM as PG_ENUM
from app.core.base_model import BaseModel

class AnalysisStatus(str, enum.Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AIAnalysis(BaseModel):
    """
    Stores one AI processing attempt and its extracted history.
    Groups separate image analytics transactions under a single optional batch tracker.
    """
    __table_args__ = (
        Index("idx_analysis_image", "image_id"),
        Index("idx_analysis_status", "status"),
        Index("idx_analysis_batch", "batch_id")  # 🌟 Added index for high-speed batch status lookups
    )
    __tablename__ = "ai_analyses"

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_images.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # 🌟 NEW: Links individual analyses rows together under a unified multi-image batch transaction
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        default=None
    )
    
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[AnalysisStatus] = mapped_column(
        PG_ENUM(AnalysisStatus, name="analysis_status_enum"),
        default=AnalysisStatus.PROCESSING,
        nullable=False
    )
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    detected_count: Mapped[int] = mapped_column(Integer, default=0)
    processing_time: Mapped[float | None] = mapped_column(Float, nullable=True)