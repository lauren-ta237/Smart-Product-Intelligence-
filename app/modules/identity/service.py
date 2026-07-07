from app.core.security import hash_password
from app.modules.identity.models import Vendor
from app.modules.identity.repository import VendorRepository
from app.modules.identity.schemas import VendorCreate

class IdentityService:
    def __init__(self, repository: VendorRepository):
        self.repo = repository

    async def register_vendor(self, data: VendorCreate) -> Vendor:
        # 1. Use repository to check if user exists
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ValueError("Vendor already exists")
    
        # 2. Map and hash password incoming data
        new_vendor = Vendor(
            email=data.email,
            password_hash=hash_password(data.password),
            company_name=data.company_name,
            country=data.country,
            city=data.city
        )
        
        # 3. Offload saving/committing to the repository
        return await self.repo.create(new_vendor)