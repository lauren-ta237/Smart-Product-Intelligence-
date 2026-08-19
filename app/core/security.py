# app/core/security.py
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.config.settings import settings


def hash_password(password: str) -> str:
    """
    Converts plain password into a secure hash using native bcrypt.
    Guarantees 100% compatibility across Python 3.11/3.12/3.13+.
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares user entered password against stored encrypted hash using native bcrypt.
    """
    try:
        plain_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception as e:
        print(f"[SECURITY WARNING] Native bcrypt checkpw failed: {e}")
        return False


def create_token(data: dict, expires_delta: timedelta, token_type: str = "access") -> str:
    """Internal helper to generate signed JWTs with a token type claim."""
    payload = data.copy()
    now = datetime.now(timezone.utc)
    payload.update({
        "exp": now + expires_delta,
        "iat": now,
        "type": token_type
    })
    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


def create_access_token(data: dict, expires_minutes: int = 60) -> str:
    """Creates short-lived access JWT token."""
    return create_token(
        data=data,
        expires_delta=timedelta(minutes=expires_minutes),
        token_type="access"
    )


def create_refresh_token(data: dict, expires_days: int = 7) -> str:
    """Creates long-lived refresh JWT token."""
    return create_token(
        data=data,
        expires_delta=timedelta(days=expires_days),
        token_type="refresh"
    )


def decode_access_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Validates incoming JWT token, checks type, and returns payload dict."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type and token_type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected '{expected_type}' token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_access_token(token: str) -> Optional[dict]:
    """Safely verifies access token returning payload or None on error."""
    try:
        return decode_access_token(token, expected_type="access")
    except HTTPException:
        return None