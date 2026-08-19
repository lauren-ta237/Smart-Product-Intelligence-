import enum
import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.core.base_model import BaseModel

class APITier(str, enum.Enum):
    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"

class APIKey(BaseModel):
    __tablename__ = "api_keys"

    developer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    prefix: Mapped[str] = mapped_column(String(10), nullable=False)
    tier: Mapped[APITier] = mapped_column(
        String(50), 
        default=APITier.FREE.value, 
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    calls_made: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rate_limit_max: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)