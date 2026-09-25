import asyncio
from app.core.database import engine
from sqlalchemy import text


async def main():
    async with engine.begin() as conn:
        for stmt in [
            "ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey;",
            "ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey_1;",
            "ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey_2;",
            "ALTER TABLE products ADD CONSTRAINT products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE;",
        ]:
            try:
                await conn.execute(text(stmt))
                print("OK:", stmt)
            except Exception as e:
                print("ERR:", stmt, e)

    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.products'::regclass AND contype='f'"))
        rows = result.fetchall()
        print("CURRENT FKS:")
        for row in rows:
            print(row)


asyncio.run(main())
