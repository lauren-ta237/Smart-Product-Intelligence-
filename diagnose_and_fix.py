import asyncio
import os
import sys
from pathlib import Path

# Ensure the repository root is on sys.path so app imports resolve correctly.
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from app.core.config.settings import settings
except Exception as exc:
    print("ERROR: Failed to import application settings from app.core.config.settings.")
    print(f"Exception: {exc}")
    raise

DATABASE_URL = settings.DATABASE_URL
print("Detected DATABASE_URL:")
print(DATABASE_URL)
print()

try:
    import asyncpg
except ImportError as exc:
    print("ERROR: asyncpg is not installed in your current Python environment.")
    print("Install it with: pip install asyncpg")
    raise

ALTER_SQL = "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR;"

async def run_alter():
    print("Connecting to the database using the detected DATABASE_URL...")
    conn = None
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected successfully.")

        print("Running ALTER TABLE statement:")
        print(ALTER_SQL)
        await conn.execute(ALTER_SQL)
        print("ALTER TABLE completed successfully.")
    except Exception as exc:
        print("ERROR: Failed while running the database schema update.")
        print(f"Exception: {exc}")
        raise
    finally:
        if conn is not None:
            await conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    asyncio.run(run_alter())
