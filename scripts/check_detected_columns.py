import asyncio
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from app.core.config.settings import settings
import asyncpg

async def main():
    db = settings.DATABASE_URL
    # asyncpg expects a simple 'postgresql://' DSN. Convert if SQLAlchemy style present.
    print("Using DATABASE_URL:", db)
    if db.startswith("postgresql+asyncpg://"):
        db = db.replace("postgresql+asyncpg://", "postgresql://", 1)
        print("Converted DSN for asyncpg:", db)
    try:
        conn = await asyncpg.connect(db)
    except Exception as exc:
        print("ERROR: could not connect using asyncpg:", exc)
        raise
    try:
        rows = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='detected_products';")
        if not rows:
            print("Table 'detected_products' not found or has no columns.")
            return
        print("detected_products columns:")
        for r in rows:
            print(f" - {r['column_name']} ({r['data_type']})")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
