import asyncio
from uuid import UUID

from app.core.database import get_db
from app.modules.catalog.router import batch_update_products, BatchUpdatePayload, ProductUpdateItem


async def main():
    async for session in get_db():
        payload = BatchUpdatePayload(
            products=[
                ProductUpdateItem(
                    name='Laptop',
                    description='Generic silver laptop.',
                    category='Electronics',
                    brand=None,
                    sku='SKU-CM-DUMMY',
                    market_sku='SKU-CM-DUMMY',
                    image_url='http://example.com/test.jpg',
                    bounding_box={'x': 0.05, 'y': 0.05, 'width': 0.45, 'height': 0.45},
                    approved=True,
                    price=3500.0,
                    stock_quantity=0,
                    location=None,
                )
            ],
            image_url='http://example.com/test.jpg',
        )
        try:
            result = await batch_update_products(payload, db=session, vendor_id=UUID('3f4a76a4-67c1-4abb-9a16-055fd2b6a1df'))
            print('RESULT', result)
        except Exception as e:
            print('ERROR', type(e).__name__, e)
            await session.rollback()
            raise


asyncio.run(main())
