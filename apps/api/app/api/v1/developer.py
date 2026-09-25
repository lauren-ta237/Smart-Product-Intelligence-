# app/api/v1/developer.py

import asyncio
import hashlib
import secrets
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Security,
    status,
)
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.auth import get_current_user
from app.core.database import get_db

from app.modules.admin.models import APIKey, APITier
from app.modules.catalog.models import Product
from app.modules.identity.models import User, UserRole
from app.modules.intelligence.models import (
    AIAnalysis,
    AnalysisStatus,
)
from app.modules.intelligence.router import (
    BACKGROUND_TASKS_REGISTRY,
    run_background_analysis,
)
from app.modules.media.models import ProductImage
from app.modules.orders.models import Order


router = APIRouter(
    prefix="/developer",
    tags=["Developer APIs"],
)


api_key_header = APIKeyHeader(
    name="X-API-KEY",
    auto_error=True,
)


# ---------------------------------------------------------
# TIER CONFIGURATION
# ---------------------------------------------------------

TIER_LIMITS: dict[str, int] = {
    APITier.FREE.value: 1000,
    APITier.PRO.value: 10000,
    APITier.ENTERPRISE.value: 100000,
}


# ---------------------------------------------------------
# AUTHENTICATED USER HELPERS
# ---------------------------------------------------------

def can_manage_developer_keys(user: User) -> bool:
    """
    Buyers and vendors can manage their own developer keys.

    Admins are also allowed here so the endpoint remains usable
    if an administrator wants a developer key for their own account.
    """

    return user.role in (
        UserRole.BUYER,
        UserRole.VENDOR,
        UserRole.ADMIN,
    )


def can_use_vision(user: User) -> bool:
    """
    Only vendors and admins can trigger AI Vision.
    Buyers are strictly read-only.
    """

    return user.role in (
        UserRole.VENDOR,
        UserRole.ADMIN,
    )


# ---------------------------------------------------------
# USER API KEY MANAGEMENT
# ---------------------------------------------------------

@router.get("/api-keys")
async def list_my_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return only API keys owned by the currently authenticated user.

    This is intentionally NOT the same as /admin/api-keys.
    """

    if not can_manage_developer_keys(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account role is not permitted to manage "
                "developer API keys."
            ),
        )

    stmt = (
        select(APIKey)
        .where(APIKey.developer_id == current_user.id)
        .order_by(APIKey.created_at.desc())
    )

    result = await db.execute(stmt)
    keys = result.scalars().all()

    return [
        {
            "id": str(key.id),
            "developer_id": str(key.developer_id),
            "prefix": key.prefix,
            "tier": (
                key.tier.value
                if hasattr(key.tier, "value")
                else str(key.tier)
            ),
            "is_active": bool(key.is_active),
            "calls_made": int(key.calls_made or 0),
            "rate_limit_max": int(key.rate_limit_max or 0),
            "created_at": key.created_at,
        }
        for key in keys
    ]


@router.post("/api-keys")
async def create_my_api_key(
    payload: dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an API key for the currently authenticated user.

    IMPORTANT:
    The client cannot specify another developer_id.
    Ownership always comes from current_user.id.
    """

    if not can_manage_developer_keys(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account role is not permitted to create "
                "developer API keys."
            ),
        )

    requested_tier = str(
        payload.get("tier", APITier.FREE.value)
    ).upper().strip()

    valid_tiers = {
        APITier.FREE.value,
        APITier.PRO.value,
        APITier.ENTERPRISE.value,
    }

    if requested_tier not in valid_tiers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid API tier. Choose FREE, PRO, "
                "or ENTERPRISE."
            ),
        )

    rate_limit = TIER_LIMITS[requested_tier]

    raw_key = (
        f"sp_live_{secrets.token_hex(24)}"
    )

    key_hash = hashlib.sha256(
        raw_key.encode("utf-8")
    ).hexdigest()

    prefix = raw_key[:10]

    # Prevent an extremely unlikely hash collision.
    existing_stmt = select(APIKey).where(
        APIKey.key_hash == key_hash
    )

    existing_result = await db.execute(existing_stmt)

    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate a unique API key. Please try again.",
        )

    key_obj = APIKey(
        developer_id=current_user.id,
        key_hash=key_hash,
        prefix=prefix,
        tier=requested_tier,
        is_active=True,
        calls_made=0,
        rate_limit_max=rate_limit,
    )

    try:
        db.add(key_obj)

        await db.commit()
        await db.refresh(key_obj)

    except Exception as exc:
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Key creation failed: {str(exc)}",
        )

    return {
        "id": str(key_obj.id),
        "developer_id": str(key_obj.developer_id),
        "prefix": key_obj.prefix,
        "tier": requested_tier,
        "is_active": True,
        "calls_made": 0,
        "rate_limit_max": rate_limit,
        "created_at": key_obj.created_at,

        # The complete secret is returned ONLY at creation time.
        "raw_key": raw_key,
        "api_key": raw_key,
    }


@router.post("/api-keys/{key_id}/revoke")
async def revoke_my_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Toggle an API key owned by the current user.

    Users cannot revoke someone else's key.
    """

    if not can_manage_developer_keys(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account role is not permitted to manage "
                "developer API keys."
            ),
        )

    stmt = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.developer_id == current_user.id,
    )

    result = await db.execute(stmt)
    key_obj = result.scalar_one_or_none()

    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found for your account.",
        )

    try:
        key_obj.is_active = not bool(key_obj.is_active)

        await db.commit()
        await db.refresh(key_obj)

    except Exception as exc:
        await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update API key: {str(exc)}",
        )

    state = (
        "active"
        if key_obj.is_active
        else "revoked"
    )

    return {
        "status": "success",
        "message": f"API key is now {state}.",
        "key_id": str(key_obj.id),
        "is_active": bool(key_obj.is_active),
    }


# ---------------------------------------------------------
# API KEY AUTHENTICATION
# ---------------------------------------------------------

async def verify_api_key(
    x_api_key: str = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> APIKey:
    """
    Verify an X-API-KEY credential.

    The raw key is never stored in the database.
    Only its SHA-256 hash is stored.
    """

    if not x_api_key or not x_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required.",
        )

    hashed = hashlib.sha256(
        x_api_key.encode("utf-8")
    ).hexdigest()

    stmt = select(APIKey).where(
        APIKey.key_hash == hashed,
        APIKey.is_active == True,
    )

    result = await db.execute(stmt)
    key_obj = result.scalar_one_or_none()

    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Unauthorized: Invalid or deactivated API key."
            ),
        )

    # -----------------------------------------------------
    # RATE LIMIT CHECK
    # -----------------------------------------------------

    current_calls = int(
        key_obj.calls_made or 0
    )

    max_calls = int(
        key_obj.rate_limit_max or 0
    )

    if max_calls > 0 and current_calls >= max_calls:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "API rate limit reached. "
                "Please upgrade your plan or wait for the "
                "next rate-limit period."
            ),
        )

    # -----------------------------------------------------
    # USAGE TRACKING
    # -----------------------------------------------------

    try:
        key_obj.calls_made = current_calls + 1

        await db.commit()

    except Exception:
        await db.rollback()

    return key_obj


# ---------------------------------------------------------
# DEVELOPER PRODUCTS API
# ---------------------------------------------------------

@router.get("/products")
async def developer_list_products(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key),
):
    """
    Developer API:
    Retrieve approved marketplace products.

    Both buyers and vendors can access this endpoint.
    """

    stmt = (
        select(Product)
        .where(Product.approved == True)
        .limit(50)
    )

    result = await db.execute(stmt)
    products = result.scalars().all()

    return [
        {
            "id": str(product.id),
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "brand": product.brand,
            "sku": product.sku,
            "price": product.price,
            "stock_quantity": product.stock_quantity,
            "image_url": product.image_url,
        }
        for product in products
    ]


# ---------------------------------------------------------
# DEVELOPER ORDERS API
# ---------------------------------------------------------

@router.get("/orders")
async def developer_list_orders(
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key),
):
    """
    Developer order API.

    BUYER:
        Only sees orders belonging to the API key owner.

    VENDOR:
        Uses the vendor owner as the query scope.

    ADMIN:
        Can see platform orders.
    """

    owner_stmt = select(User).where(
        User.id == api_key.developer_id
    )

    owner_result = await db.execute(owner_stmt)
    owner = owner_result.scalar_one_or_none()

    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key owner no longer exists.",
        )

    if owner.role == UserRole.BUYER:
        stmt = (
            select(Order)
            .where(
                Order.buyer_id == api_key.developer_id
            )
            .order_by(Order.created_at.desc())
            .limit(50)
        )

    elif owner.role == UserRole.VENDOR:
        # Keep vendor access scoped to orders associated with
        # products owned by that vendor.
        #
        # If your Order model does not expose vendor_id directly,
        # this falls back to the existing order query below.
        if hasattr(Order, "vendor_id"):
            stmt = (
                select(Order)
                .where(
                    Order.vendor_id == api_key.developer_id
                )
                .order_by(Order.created_at.desc())
                .limit(50)
            )
        else:
            stmt = (
                select(Order)
                .order_by(Order.created_at.desc())
                .limit(50)
            )

    else:
        stmt = (
            select(Order)
            .order_by(Order.created_at.desc())
            .limit(50)
        )

    result = await db.execute(stmt)
    orders = result.scalars().all()

    return [
        {
            "id": str(order.id),
            "status": order.status,
            "total_price": float(order.total_price),
            "created_at": order.created_at,
        }
        for order in orders
    ]


# ---------------------------------------------------------
# DEVELOPER VISION API
# ---------------------------------------------------------

@router.post(
    "/vision",
    status_code=status.HTTP_202_ACCEPTED,
)
async def developer_trigger_vision(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: APIKey = Depends(verify_api_key),
):
    """
    Programmatically queue an image for AI Vision analysis.

    ONLY vendor/admin-owned API keys can use this endpoint.
    Buyers are explicitly blocked.
    """

    owner_stmt = select(User).where(
        User.id == api_key.developer_id
    )

    owner_result = await db.execute(owner_stmt)
    owner = owner_result.scalar_one_or_none()

    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key owner no longer exists.",
        )

    if not can_use_vision(owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Buyer API keys are read-only and cannot "
                "trigger AI Vision operations."
            ),
        )

    # -----------------------------------------------------
    # LOOK UP IMAGE
    # -----------------------------------------------------

    image_stmt = select(ProductImage).where(
        ProductImage.id == image_id
    )

    image_result = await db.execute(image_stmt)
    real_image = image_result.scalar_one_or_none()

    if not real_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image record not found in system.",
        )

    # -----------------------------------------------------
    # VERIFY VENDOR OWNS IMAGE
    # -----------------------------------------------------

    if (
        owner.role == UserRole.VENDOR
        and real_image.vendor_id != owner.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You can only run Vision analysis on "
                "images belonging to your vendor account."
            ),
        )

    # -----------------------------------------------------
    # CREATE ANALYSIS TRACKER
    # -----------------------------------------------------

    analysis_record = AIAnalysis(
        vendor_id=api_key.developer_id,
        image_id=real_image.id,
        image_url=real_image.storage_url,
        batch_id=None,
        provider="google",
        model_name="gemini-3.6-flash",
        status=AnalysisStatus.PROCESSING,
    )

    db.add(analysis_record)

    await db.commit()
    await db.refresh(analysis_record)

    # -----------------------------------------------------
    # BACKGROUND TASK
    # -----------------------------------------------------

    task = asyncio.create_task(
        run_background_analysis(
            image_id=str(real_image.id),
            vendor_id=str(api_key.developer_id),
            analysis_id=str(analysis_record.id),
        )
    )

    BACKGROUND_TASKS_REGISTRY.add(task)

    task.add_done_callback(
        BACKGROUND_TASKS_REGISTRY.discard
    )

    return {
        "status": "queued",
        "message": (
            "AI Vision pipeline triggered programmatically."
        ),
        "analysis_id": str(analysis_record.id),
    }