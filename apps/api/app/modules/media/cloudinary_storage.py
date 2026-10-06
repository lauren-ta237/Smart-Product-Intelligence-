from io import BytesIO
import os
from pathlib import PurePosixPath
from urllib.parse import urlparse
from urllib.request import urlopen
import uuid

from starlette.concurrency import run_in_threadpool

from app.core.config.settings import settings
from .storage import StorageProvider


class CloudinaryStorage(StorageProvider):
    def __init__(self):
        import cloudinary
        import cloudinary.uploader

        if not all((settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET)):
            raise ValueError("Cloudinary storage requires cloud name, API key, and API secret.")

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        self.uploader = cloudinary.uploader

    async def upload(self, file, filename: str) -> str:
        contents = await file.read()
        return await self.upload_bytes(
            contents,
            filename,
            file.content_type or "application/octet-stream",
        )

    async def upload_bytes(
        self,
        contents: bytes,
        filename: str,
        content_type: str,
        folder: str = "",
    ) -> str:
        extension = os.path.splitext(filename)[1]
        public_id = str(uuid.uuid4())
        stream = BytesIO(contents)
        stream.name = f"{public_id}{extension}"

        def sync_upload():
            result = self.uploader.upload(
                stream,
                folder="/".join(part for part in ("smart-product-ai", folder) if part),
                public_id=public_id,
                resource_type="image",
                overwrite=False,
            )
            return result["secure_url"]

        return await run_in_threadpool(sync_upload)

    async def download(self, storage_url: str) -> bytes:
        parsed = urlparse(storage_url)
        host = parsed.hostname or ""
        if parsed.scheme != "https" or not (
            host == "res.cloudinary.com" or host.endswith(".res.cloudinary.com")
        ):
            raise ValueError("Expected a secure Cloudinary image URL.")

        def sync_download():
            with urlopen(storage_url, timeout=30) as response:
                return response.read()

        return await run_in_threadpool(sync_download)

    async def delete(self, storage_url: str) -> None:
        parsed = urlparse(storage_url)
        try:
            resource_path = parsed.path.split("/image/upload/", 1)[1]
        except IndexError as exc:
            raise ValueError("Invalid Cloudinary image URL.") from exc

        path_parts = resource_path.split("/")
        if path_parts and path_parts[0].startswith("v") and path_parts[0][1:].isdigit():
            path_parts = path_parts[1:]
        public_id = str(PurePosixPath("/".join(path_parts)).with_suffix(""))
        await run_in_threadpool(
            lambda: self.uploader.destroy(public_id, resource_type="image")
        )