# app/modules/identity/models.py
import enum
import uuid
from sqlalchemy import (
    Boolean,
    Enum,
    String,
    ForeignKey,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.core.base_model import BaseModel


class UserRole(str, enum.Enum):
    BUYER = "BUYER"
    VENDOR = "VENDOR"
    ADMIN = "ADMIN"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            normalized = value.strip().upper()
            for member in cls:
                if member.value == normalized:
                    return member
        return None


class User(BaseModel):
    __tablename__ = "users"

    # Core Identity & Authentication
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    
    # Nullable to support OAuth / Google Sign-In users
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )
    
    # Auth Provider Tracking ("local", "google", etc.)
    provider: Mapped[str] = mapped_column(
        String(50),
        default="local",
        nullable=False
    )

    # Google OAuth Identifier
    google_id: Mapped[str | None] = mapped_column(
        String(255), 
        nullable=True, 
        unique=True, 
        index=True
    )
    
    # Profile & Regional Metadata
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True, default="en")
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Role & Status Controls
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="userrole",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        default=UserRole.BUYER,
        nullable=False
    )
    
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)