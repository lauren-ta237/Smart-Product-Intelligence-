import psycopg2

def find_tables():
    try:
        conn = psycopg2.connect(
            dbname='smart_product_ai', 
            user='postgres', 
            password='l#urenT-123', 
            host='localhost', 
            port='5432'
        )
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
