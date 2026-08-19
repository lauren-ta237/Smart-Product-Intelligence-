# app/core/database.py
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


async def _run_migration_step(statement: str, description: str, params: dict | None = None, *, raise_on_error: bool = False) -> None:
    """Execute a DDL/DML migration step in its own transaction so one failure does not poison later steps."""
    try:
        async with engine.begin() as conn:
            if params is None:
                await conn.execute(text(statement))
            else:
                await conn.execute(text(statement), params)
        print(f"[INIT_DB] {description} completed.")
    except Exception as e:
        print(f"[INIT_DB WARNING] {description} failed: {e}")
        if raise_on_error:
            raise


async def _create_schema_if_missing() -> None:
    """Create the ORM schema if the tables do not exist yet."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency provider for FastAPI route operations with built-in transaction safety."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Physically runs schema creation scripts and seeds default values during lifespan startup."""
    print("[INIT_DB] Starting database initialization lifespan...")
    try:
        # Ensure pg_trgm extension exists for fuzzy matching.
        await _run_migration_step(
            "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
            "Creating extension pg_trgm if not exists"
        )

        # Run the enum compatibility block in its own transaction.
        await _run_migration_step(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'userrole' AND n.nspname = current_schema()
                ) THEN
                    IF EXISTS (
                        SELECT 1
                        FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE t.typname = 'userrole' AND n.nspname = current_schema() AND e.enumlabel = 'MARKETPLACE'
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE t.typname = 'userrole' AND n.nspname = current_schema() AND e.enumlabel = 'BUYER'
                    ) THEN
                        ALTER TYPE userrole RENAME VALUE 'MARKETPLACE' TO 'BUYER';
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE t.typname = 'userrole' AND n.nspname = current_schema() AND e.enumlabel = 'BUYER'
                    ) THEN
                        ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'BUYER';
                    END IF;
                END IF;
            END
            $$;
            """,
            "Running userrole enum compatibility checks"
        )

        # Force registration of all models on Base.metadata before create_all.
        import app.models_registry

        # Creates all tables cleanly with the latest entity structure.
        print("[INIT_DB] Creating database tables if missing...")
        await _create_schema_if_missing()

        # Re-route foreign key constraints individually to prevent transaction abort errors.
        print("[INIT_DB] Redirecting stale foreign key constraints...")
        
        # 🟢 Correcting the Products FK
        await _run_migration_step(
            "ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey;",
            "Dropping stale products vendor FK"
        )
        await _run_migration_step(
            "ALTER TABLE products ADD CONSTRAINT products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE;",
            "Re-routing products vendor FK to users table"
        )

        await _run_migration_step(
            "ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_vendor_id_fkey;",
            "Dropping stale product_images vendor FK"
        )
        await _run_migration_step(
            "ALTER TABLE product_images ADD CONSTRAINT product_images_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE;",
            "Re-routing product_images vendor FK"
        )
        await _run_migration_step(
            "ALTER TABLE ai_analyses DROP CONSTRAINT IF EXISTS ai_analyses_vendor_id_fkey;",
            "Dropping stale ai_analyses vendor FK"
        )
        await _run_migration_step(
            "ALTER TABLE ai_analyses ADD CONSTRAINT ai_analyses_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE;",
            "Re-routing ai_analyses vendor FK"
        )

        # Upgrade users table to ensure google_id exists (for Google OAuth).
        await _run_migration_step(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'users'
                      AND column_name = 'google_id'
                ) THEN
                    RETURN;
                END IF;

                ALTER TABLE users ADD COLUMN google_id VARCHAR(255);
            END
            $$;
            """,
            "Ensuring users.google_id exists"
        )

        # Seed initial administrator account (admin@smartproduct.ai / AdminPass123!).
        print("[INIT_DB] Generating admin password hash...")
        from app.core.security import hash_password
        admin_hash = hash_password("AdminPass123!")

        # Clean up any conflicting emails to prevent unique key index constraint crashes.
        await _run_migration_step(
            """
            DELETE FROM users WHERE email = 'admin@smartproduct.ai' AND id != 'd03e1cba-0150-45e2-8ee9-8815ce6602e4';
            """,
            "Cleaning conflicting admin emails"
        )

        # Perform a full upsert to overwrite email, password_hash, and role metadata on conflict.
        await _run_migration_step(
            """
            INSERT INTO users (
                id, email, password_hash, provider, role, is_active, is_verified, created_at, updated_at
            ) VALUES (
                'd03e1cba-0150-45e2-8ee9-8815ce6602e4',
                'admin@smartproduct.ai',
                :password_hash,
                'local',
                'ADMIN',
                true,
                true,
                NOW(),
                NOW()
            ) ON CONFLICT (id) DO UPDATE SET 
                email = EXCLUDED.email, 
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active,
                is_verified = EXCLUDED.is_verified;
            """,
            "Upserting admin account",
            {"password_hash": admin_hash}
        )
        print("[INIT_DB] Seeding completed successfully!")

    except Exception as e:
        print(f"[INIT_DB ERROR] Database initialization failed with exception: {e}")
        import traceback
        traceback.print_exc()
        raise e

async_session_maker = AsyncSessionLocal