import uuid

from sqlalchemy import (
    String,
    Boolean,
    Enum
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column
)

from app.core.base_model import BaseModel


import enum



class UserRole(str, enum.Enum):

    VENDOR = "vendor"

    ADMIN = "admin"

    MARKETPLACE = "marketplace"



class Vendor(BaseModel):

    __tablename__ = "vendors"


    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )


    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )


    company_name: Mapped[str | None]


    country: Mapped[str | None]


    city: Mapped[str | None]


    language: Mapped[str | None]


    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        default=UserRole.VENDOR
    )


    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True
    )