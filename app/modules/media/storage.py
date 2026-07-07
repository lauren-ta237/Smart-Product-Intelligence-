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