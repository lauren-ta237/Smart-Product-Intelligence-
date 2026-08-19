# app/core/auth.py
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.identity.models import User, UserRole
from app.modules.identity.repository import UserRepository

security_scheme = HTTPBearer(auto_error=True)
security_scheme_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Protects private endpoints.
    Flow: Request -> Extract JWT Token -> Decode Payload -> Find User in DB -> Return User
    """
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_repo = UserRepository(db)
    
    try:
        parsed_id = UUID(user_id) if isinstance(user_id, str) else user_id
        user = await user_repo.get_by_id(parsed_id)
    except ValueError:
        user = await user_repo.get_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user


async def get_current_vendor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """
    Protects vendor-only endpoints.
    A newly registered vendor account is set to is_verified = False.
    They cannot access vendor dashboard actions or upload catalogs until approved by an administrator.
    """
    if current_user.role not in (UserRole.VENDOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors and admins can access this resource",
        )
    
    if current_user.role == UserRole.VENDOR and not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your vendor profile is currently pending administrator verification approval.",
        )

    return current_user.id


async def get_current_vendor_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme_optional),
    db: AsyncSession = Depends(get_db)
) -> UUID | None:
    """
    Returns vendor_id if Authorization header is present, valid, and user has VENDOR/ADMIN role.
    Returns None if not authenticated or user has an unverified vendor profile.
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
            
        user_repo = UserRepository(db)
        parsed_id = UUID(user_id) if isinstance(user_id, str) else user_id
        user = await user_repo.get_by_id(parsed_id)
        
        if not user or user.role not in (UserRole.VENDOR, UserRole.ADMIN):
            return None
            
        if user.role == UserRole.VENDOR and not user.is_verified:
            return None

        return user.id
    except Exception:
        return None


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme_optional),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    """
    Returns user if Authorization header is present and valid, else returns None.
    Allows public or soft-authenticated presentation routes.
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
            
        user_repo = UserRepository(db)
        parsed_id = UUID(user_id) if isinstance(user_id, str) else user_id
        user = await user_repo.get_by_id(parsed_id)
        return user
    except Exception:
        return None