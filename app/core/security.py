from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, status
from passlib.context import CryptContext
from app.core.config.settings import settings

# Password hashing engine.
# We never store raw passwords in the database.
password_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    """
    Converts plain password into a secure hash.
    Database stores:
        $2b$12$....

    Not:
        password123
    """
    return password_context.hash(password)

def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """
    Compares user entered password
    against stored encrypted hash.
    """
    return password_context.verify(
        plain_password,
        hashed_password
    )
def create_access_token(
    data: dict,
    expires_minutes: int = 60
):
    """
    Creates JWT token.
    Example payload:
    {
        "sub": "vendor_id",
        "exp": expiration_time
    }
    The frontend sends this token
    with every protected request.
    """
    payload = data.copy()
    payload["exp"] = (
        datetime.utcnow()
        +
        timedelta(
            minutes=expires_minutes
        )
    )
    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
def decode_access_token(
    token: str
):
    """
    Validates incoming JWT token.

    If invalid:
    reject request.

    If valid:
    return vendor identity.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[
                settings.JWT_ALGORITHM
            ]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )