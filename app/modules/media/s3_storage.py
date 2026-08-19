# app/modules/media/s3_storage.py
import boto3
import uuid
import os
from starlette.concurrency import run_in_threadpool
from .storage import StorageProvider
from app.core.config.settings import settings

class S3Storage(StorageProvider):
    """
    Cloud-native storage provider using Amazon AWS S3 bucket resources.
    Executes standard boto3 payload transfers inside thread pools.
    """
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.AWS_BUCKET_NAME

    async def upload(self, file, filename: str) -> str:
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(filename)[1]
        s3_key = f"uploads/{file_id}{ext}"
        
        contents = await file.read()
        
        def sync_upload():
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=contents,
                ContentType=file.content_type
            )
            # Return public S3 URL
            return f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"

        return await run_in_threadpool(sync_upload)