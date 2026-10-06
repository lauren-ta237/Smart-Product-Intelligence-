import os
import uuid
from pathlib import Path
from urllib.parse import urlparse
from starlette.concurrency import run_in_threadpool
from app.core.config.settings import settings
from .storage import StorageProvider

class LocalStorage(StorageProvider):
    """
    Development storage.
    Saves files locally without blocking the asyncio event loop.
    Returns the path relative to the project root to ensure correct static routing.
    """
    def __init__(self):
        self.folder = settings.UPLOADS_DIR
        os.makedirs(self.folder, exist_ok=True)

    async def upload(self, file, filename: str):
        contents = await file.read()
        return await self.upload_bytes(contents, filename, file.content_type or "application/octet-stream")

    async def upload_bytes(
        self,
        contents: bytes,
        filename: str,
        content_type: str,
        folder: str = "",
    ) -> str:
        extension = os.path.splitext(filename)[1]
        file_id = f"{uuid.uuid4()}{extension}"
        relative_path = Path(folder) / file_id if folder else Path(file_id)
        path = self.folder / relative_path

        def write_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(contents)

        await run_in_threadpool(write_file)
        return (Path("uploads") / relative_path).as_posix()

    async def download(self, storage_url: str) -> bytes:
        parsed_path = Path(urlparse(storage_url).path.lstrip("/"))
        relative_path = Path(*parsed_path.parts[1:]) if parsed_path.parts[:1] == ("uploads",) else parsed_path
        path = (self.folder / relative_path).resolve()
        if self.folder.resolve() not in path.parents:
            raise ValueError("Image path is outside the local uploads directory.")
        return await run_in_threadpool(path.read_bytes)

    async def delete(self, storage_url: str) -> None:
        parsed_path = Path(urlparse(storage_url).path.lstrip("/"))
        relative_path = Path(*parsed_path.parts[1:]) if parsed_path.parts[:1] == ("uploads",) else parsed_path
        path = (self.folder / relative_path).resolve()
        if self.folder.resolve() not in path.parents:
            raise ValueError("Image path is outside the local uploads directory.")
        await run_in_threadpool(lambda: path.unlink(missing_ok=True))