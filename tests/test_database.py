import pytest

from app.core.database import engine



@pytest.mark.asyncio
async def test_database_connection():

    async with engine.begin() as conn:

        result = await conn.execute(
            "SELECT 1"
        )

        assert result is not None