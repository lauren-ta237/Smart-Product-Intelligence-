import asyncio
import json
import requests
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from app.core.config.settings import settings
import asyncpg

async def gather():
    dsn = settings.DATABASE_URL
    if dsn.startswith("postgresql+asyncpg://"):
        dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(dsn)
    try:
        analysis = await conn.fetchrow("SELECT id, image_url FROM ai_analyses ORDER BY created_at DESC LIMIT 1")
        if not analysis:
            print("No ai_analysis rows found")
            return
        aid = analysis['id']
        image_url = analysis['image_url']
        print("Using analysis:", aid, image_url)
        rows = await conn.fetch("SELECT name, category, brand, sku, sku_us, sku_cm, market_sku, confidence_score, image_url, bounding_box FROM detected_products WHERE analysis_id=$1", aid)
        products = []
        for r in rows:
            products.append({
                'name': r['name'],
                'category': r['category'],
                'brand': r['brand'],
                'sku': r['sku'],
                'sku_us': r['sku_us'],
                'sku_cm': r['sku_cm'],
                'market_sku': r['market_sku'],
                'confidence_score': r['confidence_score'],
                'image_url': r['image_url'],
                'bounding_box': r['bounding_box']
            })
        payload = {'image_url': image_url, 'products': products}
        print('Posting payload to batch-update with', len(products), 'products')
        resp = requests.post('http://localhost:8000/api/products/batch-update', json=payload)
        print('Status:', resp.status_code, resp.text)
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(gather())
