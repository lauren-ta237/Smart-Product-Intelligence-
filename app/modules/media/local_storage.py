import os
import uuid
from starlette.concurrency import run_in_threadpool
from .storage import StorageProvider

class LocalStorage(StorageProvider):
    """
    Development storage.
    Saves files locally without blocking the asyncio event loop.
    Production will use S3.
    """
    def __init__(self):
        self.folder = "uploads"
        # Create folder if missing
        os.makedirs(
            self.folder,
            exist_ok=True
        )

    async def upload(
        self,
        file,
        filename: str
    ):
        # Create unique filename to prevent collisions
        file_id = str(uuid.uuid4())
        path = f"{self.folder}/{file_id}_{filename}"
        
        # 1. Read file asynchronously 
        contents = await file.read()
        
        # 2. Define a clean synchronous write function
        def write_file():
            with open(path, "wb") as image_file:
                image_file.write(contents)
        
        # 3. Offload the synchronous disk write to an external thread pool
        # This keeps the Windows asyncio event loop fully responsive!
        await run_in_threadpool(write_file)
        
        return path