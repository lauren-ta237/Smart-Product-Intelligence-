import asyncio
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from app.core.config.settings import settings
import asyncpg

async def main():
    dsn = settings.DATABASE_URL
    if dsn.startswith('postgresql+asyncpg://'):
        dsn = dsn.replace('postgresql+asyncpg://', 'postgresql://', 1)
    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch('SELECT vendor_id, name, created_at FROM products ORDER BY created_at DESC LIMIT 10')
        for r in rows:
            print(r['vendor_id'], r['name'], r['created_at'])
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
