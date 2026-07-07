import asyncio
import asyncpg
import sys
from app.core.config import settings

async def run_alter():
    # 1. Grab the active URL from your app settings
    raw_url = settings.DATABASE_URL
    print(f"📡 Detected Raw URL: {raw_url}")
    
    # 2. Clean the string so asyncpg can read it perfectly
    cleaned_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
    print(f"🧹 Cleaned URL for asyncpg: {cleaned_url}")
    
    print("\n🔄 Connecting to the real database instance on port 5433...")
    try:
        conn = await asyncpg.connect(cleaned_url)
        
        # 3. Apply the structural change
        print("⚙️ Altering table to inject 'image_url' column...")
        await conn.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR;")
        
        print("✅ SUCCESS! The 'image_url' column has been successfully injected into port 5433!")
        await conn.close()
    except Exception as e:
        print(f"❌ Error during database modification: {e}")

if __name__ == '__main__':
    # Fix for asyncio loops on Windows 11
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_alter())