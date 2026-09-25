import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from app.core.config.settings import settings

def add_missing_column():
    try:
        # Connect directly to the smart_product_ai database
        database_url = settings.DATABASE_URL.replace('+asyncpg', '', 1)
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        print("Connecting to 'smart_product_ai' database...")
        
        # Inject the missing image_url column into the products table
        cursor.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR;")
        print("✅ Success! 'image_url' column successfully injected into the products table.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error occurred while patching table: {e}")

if __name__ == "__main__":
    add_missing_column()