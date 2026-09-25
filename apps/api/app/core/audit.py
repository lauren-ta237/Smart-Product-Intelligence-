# app/core/audit.py
import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel
from app.core.database import AsyncSessionLocal

class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    resource: Mapped[str] = mapped_column(String(1024), nullable=False)

class AuditLogger:
    """
    Tracks important actions.
    Persists them into the PostgreSQL audit_logs table for administrative ledger reviews.
    """
    async def log(
        self,
        user_id: uuid.UUID | str | None,
        action: str,
        resource: str
    ):
        # Convert string sub ID safely
        parsed_user_id = None
        if user_id:
            try:
                parsed_user_id = uuid.UUID(str(user_id))
            except ValueError:
                pass

        print(
            {
                "user": str(user_id),
                "action": action,
                "resource": resource
            }
        )

        try:
            async with AsyncSessionLocal() as session:
                log_entry = AuditLog(
                    user_id=parsed_user_id,
                    action=action,
                    resource=resource
                )
                session.add(log_entry)
                await session.commit()
        except Exception as e:
            print(f"[AUDIT LOG FAILURE] Unable to write audit log entry to database: {e}")