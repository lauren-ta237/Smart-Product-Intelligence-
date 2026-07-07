from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.identity.repository import VendorRepository



# Tells FastAPI where to extract JWT token from.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

async def get_current_vendor(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """
    Protects private endpoints.
    Flow:
    Request
       |
       |
    JWT token
       |
       |
    Decode token
       |
       |
    Find vendor
       |
       |
    Continue request
    """
    payload = decode_access_token(
        token
    )


    vendor_id = payload.get("sub")
    repository = VendorRepository(db)
    vendor = await repository.get_by_id(
        vendor_id
    )
    if not vendor:
        raise Exception(
            "Vendor not found"
        )
    return vendor


async def get_current_vendor_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Return vendor if Authorization header present and valid, else None."""
    auth = request.headers.get("Authorization")
    if not auth:
        return None

    # extract token (allow `Bearer <token>` or raw token)
    token = auth.split(" ", 1)[1] if " " in auth else auth
    try:
        payload = decode_access_token(token)
        vendor_id = payload.get("sub")
        repository = VendorRepository(db)
        vendor = await repository.get_by_id(vendor_id)
        return vendor
    except Exception:
        # Treat invalid token as anonymous for presentation flows
        return None