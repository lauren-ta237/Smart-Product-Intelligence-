from unittest.mock import AsyncMock

import pytest

from app.core import database as database_module


@pytest.mark.asyncio
async def test_ensure_ai_analysis_error_message_column_executes_legacy_fix(monkeypatch):
    captured = []

    async def fake_execute(statement, params=None):
        captured.append(statement)

    class FakeConnection:
        async def execute(self, statement, params=None):
            await fake_execute(statement, params)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeEngine:
        def begin(self):
            return FakeConnection()

    monkeypatch.setattr(database_module, "engine", FakeEngine())

    await database_module.ensure_ai_analysis_error_message_column()

    assert any("ADD COLUMN IF NOT EXISTS error_message" in str(statement) for statement in captured)
