# app/modules/media/service.py
from sqlalchemy.ext.asyncio import AsyncSession
from .models import ProductImage
from app.core.config.settings import settings
from .local_storage import LocalStorage
from app.modules.media.models import ImageStatus

class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        # 🟢 Dynamically select storage provider based on environment config settings
        if settings.STORAGE_TYPE == "s3":
            from .s3_storage import S3Storage
            self.storage = S3Storage()
        else:
            self.storage = LocalStorage()

    async def upload_image(self, vendor_id, file) -> ProductImage:
        """
        Upload flow:
        1. Store file using the loaded StorageProvider (local filesystem or AWS S3)
        2. Create database metadata record
        """
        url = await self.storage.upload(
            file,
            file.filename
        )
        
        image = ProductImage(
            vendor_id=vendor_id,
            storage_url=url,
            file_name=file.filename,
            status=ImageStatus.UPLOADED,
            mime_type=file.content_type,
            width=None,
            height=None
        )
        self.db.add(image)
        await self.db.commit()
        await self.db.refresh(image)
        return image