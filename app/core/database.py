import os
import importlib
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config.settings import settings

# Configure the async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

# Create session maker factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Master declarative base class for all SQLAlchemy models
class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency provider for FastAPI route operations."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Physically runs schema creation scripts during lifespan startup."""
    async with engine.begin() as conn:
        # ⚠️ WARNING: Drops existing tables to force alignment with your updated models.
        # Remove or comment out the line below after the application successfully restarts once!
        # await conn.run_sync(Base.metadata.drop_all)

        # Creates all tables cleanly with the new detected_product_id column
        await conn.run_sync(Base.metadata.create_all)

        # Ensure required model columns exist in the running products table.
        await conn.execute(text(
            """
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS image_url VARCHAR,
            ADD COLUMN IF NOT EXISTS bounding_box JSON;
            """
        ))

        # Ensure required model columns exist in the running detected_products table.
        await conn.execute(text(
            """
            ALTER TABLE detected_products
            ADD COLUMN IF NOT EXISTS image_url VARCHAR,
            ADD COLUMN IF NOT EXISTS bounding_box JSON;
            """
        ))

        # Additional detected_products columns recently added to the ORM.
        # Keep these idempotent and safe across environments.
        await conn.execute(text(
            """
            ALTER TABLE detected_products
            ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS attributes JSON,
            ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
            """
        ))
# 🟢 Clean alias for your background task worker across components
async_session_maker = AsyncSessionLocal