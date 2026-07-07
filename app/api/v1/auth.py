import traceback
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.identity.repository import VendorRepository
from app.modules.identity.schemas import VendorCreate, VendorResponse
from app.modules.identity.service import IdentityService
from app.core.dependencies import get_identity_service
from app.core.security import verify_password, create_access_token

router = APIRouter(
    prefix="/auth", 
    tags=["Authentication"]
)

@router.post("/register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: VendorCreate,
    service: IdentityService = Depends(get_identity_service)
):
    """
    Registers a new vendor account into the ecosystem system database tier.
    """
    print(f"\n🚀 [BACKEND HIT] Received registration data for: {data.email}\n", flush=True)
    try:
        vendor = await service.register_vendor(data)
        return vendor
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=str(e)
        )


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates vendor using Standard OAuth2 Form Data (username/password keys).
    Returns a valid encrypted JWT bearer token interface payload.
    """
    try:
        repo = VendorRepository(db)
        
        # OAuth2PasswordRequestForm reads the raw payload from form-data "username"
        vendor = await repo.get_by_email(form_data.username)
        
        # Unified security boundary checks to protect against credential enumeration attacks
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        valid = verify_password(form_data.password, vendor.password_hash)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        token = create_access_token(
            data={"sub": str(vendor.id)}
        )
        
        return {
            "access_token": token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Internal authentication pipeline failure."
        )