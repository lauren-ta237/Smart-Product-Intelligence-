"""Add persisted AI analysis failure detail."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a67fc2d1045e"
down_revision: Union[str, Sequence[str], None] = "b6e78ff7344c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("ai_analyses") and "error_message" not in {
        column["name"] for column in inspector.get_columns("ai_analyses")
    }:
        op.add_column("ai_analyses", sa.Column("error_message", sa.String(length=2000), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("ai_analyses") and "error_message" in {
        column["name"] for column in inspector.get_columns("ai_analyses")
    }:
        op.drop_column("ai_analyses", "error_message")