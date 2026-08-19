"""add_media_and_product_tables

Revision ID: 392ab61b482e
Revises: 988348837466
Create Date: 2026-07-27 09:14:55.096991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '392ab61b482e'
down_revision: Union[str, Sequence[str], None] = '988348837466'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Reference existing Postgres enum type without issuing CREATE TYPE
    userrole_enum = postgresql.ENUM(
        'BUYER', 'VENDOR', 'ADMIN', 
        name='userrole', 
        create_type=False
    )

    op.create_table(
        'users',
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('company_name', sa.String(length=255), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('language', sa.String(length=10), nullable=True),
        sa.Column('avatar', sa.String(length=500), nullable=True),
        sa.Column('role', userrole_enum, nullable=False),  # <--- Using create_type=False enum
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Drop old tables
    op.drop_index(op.f('ix_vendors_email'), table_name='vendors')
    op.drop_table('vendors')
    op.drop_table('products')


def downgrade() -> None:
    """Downgrade schema."""
    userrole_enum = postgresql.ENUM(
        'VENDOR', 'ADMIN', 'MARKETPLACE', 
        name='userrole', 
        create_type=False
    )

    op.create_table(
        'products',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('vendor_id', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('name', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column('category', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('brand', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('sku', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('sku_us', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('sku_cm', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('market_sku', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('image_url', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('bounding_box', sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column('approved', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), autoincrement=False, nullable=True),
        sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('products_pkey'))
    )

    op.create_table(
        'vendors',
        sa.Column('email', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
        sa.Column('password_hash', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
        sa.Column('company_name', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('country', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('city', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('language', sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column('role', userrole_enum, autoincrement=False, nullable=False),
        sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('vendors_pkey'))
    )
    op.create_index(op.f('ix_vendors_email'), 'vendors', ['email'], unique=True)
    
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')