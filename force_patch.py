import asyncio
import sys
import uuid
from sqlalchemy.sql import text

try:
    from app.infrastructure.database import engine
except ImportError:
    from app.core.database import engine

async def seed_products():
    print("🔄 Connecting to port 5433 to inject structured sample metrics...")
    
    async with engine.begin() as conn:
        # 1. Fetch cross-referenced active vendor ID
        try:
            result = await conn.execute(text("SELECT id FROM vendors LIMIT 1;"))
            vendor_row = result.fetchone()
            vendor_id = str(vendor_row[0]) if vendor_row else str(uuid.uuid4())
            print(f"🔗 Bound Vendor ID: {vendor_id}")
        except Exception:
            vendor_id = str(uuid.uuid4())
            print(f"⚠️ Vendor lookup bypass. Using fresh mockup UUID: {vendor_id}")

        # 2. Pre-generate separate random UUIDs for the product records themselves
        prod_id_1 = str(uuid.uuid4())
        prod_id_2 = str(uuid.uuid4())

        # 3. Build insert query explicitly including unique record IDs and timestamp defaults
        insert_query = text("""
            INSERT INTO products (
                id, vendor_id, name, description, category, brand, sku, 
                market_sku, image_url, bounding_box, approved, created_at, updated_at
            ) VALUES (
                CAST(:id_1 AS UUID), 
                CAST(:vendor_id AS UUID), 
                'Premium Wireless Headphones', 
                'Noise-canceling over-ear headphones with smart ambient sound analytics controls.', 
                'Electronics', 
                'SonicBound', 
                'SB-HP-09X', 
                'MKT-SONIC-99', 
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', 
                CAST(:bbox_1 AS JSON), 
                FALSE,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ), (
                CAST(:id_2 AS UUID), 
                CAST(:vendor_id AS UUID), 
                'Ergonomic Mechanical Keyboard', 
                'Hot-swappable RGB mechanical keyboard optimized for high-throughput development pipelines.', 
                'Peripherals', 
                'KeyForge', 
                'KF-MECH-87', 
                'MKT-KEYFORGE-87', 
                'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', 
                CAST(:bbox_2 AS JSON), 
                FALSE,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        """)

        try:
            # Wipe old schema structural debris, then populate records explicitly
            await conn.execute(text("TRUNCATE TABLE products RESTART IDENTITY CASCADE;"))
            await conn.execute(insert_query, {
                "id_1": prod_id_1,
                "id_2": prod_id_2,
                "vendor_id": vendor_id,
                "bbox_1": '[0.15, 0.20, 0.85, 0.90]',
                "bbox_2": '[0.05, 0.10, 0.95, 0.85]'
            })
            print("✅ SUCCESS! 2 sample catalog entries fully seeded with clean tracking UUIDs.")
        except Exception as e:
            print(f"❌ Structural insert failed: {e}")

if __name__ == '__main__':
    # Modern Python handles the Windows event loop automatically, 
    # so we can drop the explicit policy setup entirely.
    asyncio.run(seed_products())