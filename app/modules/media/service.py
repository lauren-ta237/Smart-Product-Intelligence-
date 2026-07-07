from sqlalchemy.ext.asyncio import AsyncSession
from .models import ProductImage
from .local_storage import LocalStorage
from app.modules.media.models import ImageStatus


class MediaService:
    def __init__(
        self,
        db: AsyncSession
    ):
        self.db = db
        # Storage dependency
        self.storage = LocalStorage()
    async def upload_image(
        self,
        vendor_id,
        file
    ):
        """
        Upload flow:
        1. Store file
        2. Create database record
        3. Return image info
        """
        url = await self.storage.upload(
            file,
            file.filename
        )
        image = ProductImage(
            vendor_id=vendor_id,
            storage_url=url,
            file_name=file.filename,
            status=ImageStatus.UPLOADED
        )
        self.db.add(image)
        await self.db.commit()
        await self.db.refresh(image)
        return image