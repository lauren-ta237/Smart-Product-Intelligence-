import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.auth import get_current_user
from app.core.dependencies import get_identity_service
from app.modules.identity.models import User
from app.modules.identity.schemas import (
    GoogleAuthInput,
    RefreshTokenInput,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.modules.identity.service import IdentityService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: UserCreate,
    service: IdentityService = Depends(get_identity_service),
):
    """Registers a new user account in the system."""
    try:
        user = await service.register_user(data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    service: IdentityService = Depends(get_identity_service),
):
    """Authenticates user using JSON payload (email and password)."""
    try:
        token_data = await service.authenticate_user(
            email=payload.email,
            password=payload.password,
        )
        return token_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal authentication pipeline failure.",
        )


@router.post("/login/form", response_model=TokenResponse, include_in_schema=False)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: IdentityService = Depends(get_identity_service),
):
    """OAuth2 Form Data compatibility endpoint for Swagger UI Authorization button."""
    try:
        token_data = await service.authenticate_user(
            email=form_data.username,
            password=form_data.password,
        )
        return token_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenInput,
    service: IdentityService = Depends(get_identity_service),
):
    """Exchanges a valid refresh token for a new access token pair."""
    try:
        return await service.refresh_access_token(payload.refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh pipeline failure.",
        )


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthInput,
    service: IdentityService = Depends(get_identity_service),
):
    """Authenticates or registers a user via Google OAuth ID token."""
    try:
        token_data = await service.authenticate_google_user(payload.credential)
        return token_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication processing failed.",
        )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Fetches the profile details of the currently authenticated user."""
    return current_user