import uuid
from sqlalchemy import (
    String,
    Enum,
    ForeignKey
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column
)
from app.core.base_model import BaseModel

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

class AIJob(BaseModel):
    """
    Represents a background AI task.
    One image can have multiple jobs.
    Example:
    Gemini analysis
    Claude verification
    Reprocessing
    """
    __tablename__ = "ai_jobs"

    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "product_images.id"
        )
    )

    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus),
        default=JobStatus.QUEUED
    )
    provider: Mapped[str]
    retry_count: Mapped[int] = mapped_column(
        default=0
    )
    error_message: Mapped[str | None]