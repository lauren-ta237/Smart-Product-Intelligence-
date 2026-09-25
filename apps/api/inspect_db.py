import psycopg2
from app.core.config.settings import settings

def find_tables():
    try:
        database_url = settings.DATABASE_URL.replace('+asyncpg', '', 1)
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # 1. Let's see all tables and their actual schema locations
        cursor.execute("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
        """)
        tables = cursor.fetchall()
        print("\n📊 --- TABLES FOUND IN DATABASE ---")
        if not tables:
            print("No tables found inside 'smart_product_ai'. It is completely empty!")
        for schema, table in tables:
            print(f" Schema: {schema} | Table Name: {table}")
        print("-----------------------------------\n")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    find_tables()
