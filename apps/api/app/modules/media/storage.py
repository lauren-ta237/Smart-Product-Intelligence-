from abc import ABC, abstractmethod

class StorageProvider(ABC):
    """
    Abstract storage contract.

    Every storage engine must implement
    these methods.
    """
    @abstractmethod
    async def upload(
        self,
        file,
        filename: str
    ) -> str:
        pass

    @abstractmethod
    async def upload_bytes(
        self,
        contents: bytes,
        filename: str,
        content_type: str,
        folder: str = "",
    ) -> str:
        pass

    @abstractmethod
    async def download(self, storage_url: str) -> bytes:
        pass

    @abstractmethod
    async def delete(self, storage_url: str) -> None:
        pass