import os
import uuid
from starlette.concurrency import run_in_threadpool
from .storage import StorageProvider

class LocalStorage(StorageProvider):
    """
    Development storage.
    Saves files locally without blocking the asyncio event loop.
    Returns the path relative to the project root to ensure correct static routing.
    """
    def __init__(self):
        self.folder = "uploads"
        os.makedirs(self.folder, exist_ok=True)

    async def upload(self, file, filename: str):
        # Create unique filename to prevent collisions
        file_ext = os.path.splitext(filename)[1]
        file_id = f"{uuid.uuid4()}{file_ext}"
        path = os.path.join(self.folder, file_id)
        
        contents = await file.read()
        
        def write_file():
            with open(path, "wb") as image_file:
                image_file.write(contents)
        
        await run_in_threadpool(write_file)
        
        # Return the path prefixed with the folder name for FastAPI StaticFiles compatibility
        return f"uploads/{file_id}"