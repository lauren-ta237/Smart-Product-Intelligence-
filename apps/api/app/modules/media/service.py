# app/modules/media/service.py
from sqlalchemy.ext.asyncio import AsyncSession
from .models import ProductImage
from app.core.config.settings import settings
from .local_storage import LocalStorage
from app.modules.media.models import ImageStatus


def create_storage_provider():
    if settings.STORAGE_TYPE == "s3":
        from .s3_storage import S3Storage
        return S3Storage()
    if settings.STORAGE_TYPE == "cloudinary":
        from .cloudinary_storage import CloudinaryStorage
        return CloudinaryStorage()
    return LocalStorage()


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = create_storage_provider()

    async def upload_image(self, vendor_id, file, commit: bool = True) -> ProductImage:
        """
        Upload flow:
        1. Store file using the loaded StorageProvider (local filesystem or AWS S3)
        2. Create database metadata record
        """
        url = await self.storage.upload(file, file.filename)
        try:
            image = ProductImage(
                vendor_id=vendor_id,
                storage_url=url,
                file_name=file.filename,
                status=ImageStatus.UPLOADED,
                mime_type=file.content_type,
                width=None,
                height=None,
            )
            self.db.add(image)
            if commit:
                await self.db.commit()
                await self.db.refresh(image)
            else:
                await self.db.flush()
            return image
        except Exception:
            await self.db.rollback()
            try:
                await self.storage.delete(url)
            except Exception:
                pass
            raise

    async def upload_bytes(
        self,
        contents: bytes,
        filename: str,
        content_type: str,
        folder: str = "",
    ) -> str:
        return await self.storage.upload_bytes(contents, filename, content_type, folder)

    async def download(self, storage_url: str) -> bytes:
        return await self.storage.download(storage_url)

    async def delete(self, storage_url: str) -> None:
        await self.storage.delete(storage_url)