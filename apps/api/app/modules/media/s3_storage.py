import uuid
import os
from urllib.parse import urlparse
from starlette.concurrency import run_in_threadpool
from supabase import create_client, Client
from .storage import StorageProvider
from app.core.config.settings import settings

class S3Storage(StorageProvider):
    """
    Storage provider using Supabase Storage buckets.
    Keeps the same class interface so your app routes don't need to change.
    """
    def __init__(self):
        self.supabase_url = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
        self.supabase_key = getattr(settings, "SUPABASE_KEY", os.getenv("SUPABASE_KEY"))
        self.bucket_name = getattr(settings, "SUPABASE_BUCKET_NAME", "product-images")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)

    async def upload(self, file, filename: str) -> str:
        contents = await file.read()
        content_type = getattr(file, "content_type", "application/octet-stream")
        return await self.upload_bytes(contents, filename, content_type)

    def _storage_path(self, storage_url: str) -> str:
        marker = f"/object/public/{self.bucket_name}/"
        if marker in storage_url:
            return storage_url.split(marker, 1)[1]
        path = urlparse(storage_url).path.lstrip("/")
        return path.removeprefix(f"{self.bucket_name}/")

    async def upload_bytes(
        self,
        contents: bytes,
        filename: str,
        content_type: str,
        folder: str = "",
    ) -> str:
        extension = os.path.splitext(filename)[1]
        file_path = "/".join(part for part in ("uploads", folder, f"{uuid.uuid4()}{extension}") if part)

        def sync_upload():
            self.supabase.storage.from_(self.bucket_name).upload(
                path=file_path,
                file=contents,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            return self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)

        return await run_in_threadpool(sync_upload)

    async def download(self, storage_url: str) -> bytes:
        path = self._storage_path(storage_url)
        return await run_in_threadpool(
            lambda: self.supabase.storage.from_(self.bucket_name).download(path)
        )

    async def delete(self, storage_url: str) -> None:
        path = self._storage_path(storage_url)
        await run_in_threadpool(
            lambda: self.supabase.storage.from_(self.bucket_name).remove([path])
        )