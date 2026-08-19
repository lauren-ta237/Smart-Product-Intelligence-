import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:l%23urenT-123@localhost:5433/smart_product_ai"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Check valid enum values for userrole
        res = await conn.execute(text("""
            SELECT enumlabel FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'userrole';
        """))
        enum_values = [r[0] for r in res.fetchall()]
        print(f"Valid 'userrole' enum values: {enum_values}")

        # Choose VENDOR / vendor matching the enum
        target_role = 'VENDOR' if 'VENDOR' in enum_values else 'vendor'

        await conn.execute(text(f"""
            INSERT INTO vendors (
                id, 
                email, 
                password_hash, 
                role, 
                is_active, 
                company_name, 
                created_at, 
                updated_at
            )
            SELECT 
                id, 
                email, 
                password_hash, 
                '{target_role}'::userrole, 
                COALESCE(is_active, true), 
                'Test Store', 
                NOW(), 
                NOW()
            FROM users
            WHERE id = 'd03e1cba-0150-45e2-8ee9-8815ce6602e4'
            ON CONFLICT (id) DO NOTHING;
        """))

    print("Vendor profile successfully created!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())