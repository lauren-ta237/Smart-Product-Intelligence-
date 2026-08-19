# app/modules/admin/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
import uuid
import secrets
import hashlib
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.identity.models import User, UserRole, Notification
from app.modules.catalog.models import Product, Category
from app.modules.orders.models import Order, OrderStatus
from app.modules.intelligence.models import AIAnalysis, AnalysisStatus
from app.modules.admin.models import APIKey, APITier
from app.modules.admin.schemas import (
    APIKeyCreateRequest, 
    APIKeyResponse, 
    PriceSuggestionRequest, 
    PriceSuggestionResponse,
    # 🟢 New Admin Schemas
    AdminCreateRequest,
    AdminUpdateRequest,
    AdminPasswordResetRequest,
    AdminResponse
)
from app.core.security import hash_password
from app.core.audit import AuditLog, AuditLogger

router = APIRouter(
    prefix="/admin",
    tags=["Platform Administration"]
)

async def verify_admin_role(current_user: User = Depends(get_current_user)):
    """Security dependency to restrict endpoints to authorized superadmins."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin role privileges are required to access this portal."
        )
    return current_user


@router.get("/analytics", dependencies=[Depends(verify_admin_role)])
async def get_platform_analytics(db: AsyncSession = Depends(get_db)):
    """Collect high-level metrics across standard operations."""
    try:
        # Total Revenue
        rev_stmt = select(func.sum(Order.total_price)).where(Order.status != OrderStatus.CANCELLED)
        rev_res = await db.execute(rev_stmt)
        total_revenue = float(rev_res.scalar() or 0.0)

        # Active Vendors count
        vendor_stmt = select(func.count(User.id)).where(
            and_(User.role == UserRole.VENDOR, User.is_active == True)
        )
        vendor_res = await db.execute(vendor_stmt)
        active_vendors = int(vendor_res.scalar() or 0)

        # Published Products count
        product_stmt = select(func.count(Product.id)).where(Product.approved == True)
        product_res = await db.execute(product_stmt)
        published_products = int(product_res.scalar() or 0)

        # Total Buyer Orders count
        order_stmt = select(func.count(Order.id))
        order_res = await db.execute(order_stmt)
        buyer_orders = int(order_res.scalar() or 0)

        # Active Developer Keys count
        api_stmt = select(func.count(APIKey.id)).where(APIKey.is_active == True)
        api_res = await db.execute(api_stmt)
        active_subscribers = int(api_res.scalar() or 0)

        return {
            "total_revenue": total_revenue,
            "active_vendors": active_vendors,
            "total_published_products": published_products,
            "total_buyer_orders": buyer_orders,
            "active_api_subscribers": active_subscribers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load analytics metrics: {str(e)}")


@router.get("/ai-pipeline", dependencies=[Depends(verify_admin_role)])
async def get_ai_pipeline_metrics(db: AsyncSession = Depends(get_db)):
    """Retrieve execution tracking profiles from vision jobs."""
    try:
        comp_stmt = select(func.count(AIAnalysis.id)).where(AIAnalysis.status == AnalysisStatus.COMPLETED)
        fail_stmt = select(func.count(AIAnalysis.id)).where(AIAnalysis.status == AnalysisStatus.FAILED)
        time_stmt = select(func.avg(AIAnalysis.processing_time)).where(AIAnalysis.status == AnalysisStatus.COMPLETED)
        items_stmt = select(func.sum(AIAnalysis.detected_count)).where(AIAnalysis.status == AnalysisStatus.COMPLETED)

        comp_res = await db.execute(comp_stmt)
        fail_res = await db.execute(fail_stmt)
        time_res = await db.execute(time_stmt)
        items_res = await db.execute(items_stmt)

        completed_jobs = int(comp_res.scalar() or 0)
        failed_jobs = int(fail_res.scalar() or 0)
        avg_processing_time = round(float(time_res.scalar() or 0.0), 2)
        total_detected_items = int(items_res.scalar() or 0)

        return {
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "avg_processing_time_seconds": avg_processing_time,
            "total_detected_items": total_detected_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query vision metrics: {str(e)}")


@router.post("/price-suggestion", response_model=PriceSuggestionResponse, dependencies=[Depends(verify_admin_role)])
async def get_price_suggestion(payload: PriceSuggestionRequest, db: AsyncSession = Depends(get_db)):
    """Suggest price parameters using historical sales averages and quality grade multipliers."""
    name_query = payload.product_name.strip()
    grade = payload.grade

    base_min = 1.50
    base_target = 2.49
    base_max = 3.99

    try:
        stmt = select(func.avg(Product.price)).where(Product.name.ilike(f"%{name_query}%"))
        res = await db.execute(stmt)
        db_avg = res.scalar()

        if db_avg is not None and db_avg > 0:
            base_target = float(db_avg)
            base_min = round(base_target * 0.70, 2)
            base_max = round(base_target * 1.45, 2)

        grade_multiplier = 1.0
        if "premium" in grade.lower() or "grade a" in grade.lower():
            grade_multiplier = 1.25
        elif "choice" in grade.lower() or "grade b" in grade.lower():
            grade_multiplier = 1.05
        elif "standard" in grade.lower() or "grade c" in grade.lower():
            grade_multiplier = 0.85

        min_price = round(base_min * grade_multiplier, 2)
        target_price = round(base_target * grade_multiplier, 2)
        max_price = round(base_max * grade_multiplier, 2)

        return PriceSuggestionResponse(
            product_name=name_query,
            grade=grade,
            min_price=min_price,
            target_price=target_price,
            max_price=max_price,
            suggestion_reason=f"Calculated with grade '{grade}' multiplier ({grade_multiplier}x) based on database average matching '{name_query}'."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pricing calculation failed: {str(e)}")


@router.get("/moderation", dependencies=[Depends(verify_admin_role)])
async def list_moderation_products(db: AsyncSession = Depends(get_db)):
    """Retrieve product records for administrative moderation."""
    stmt = select(Product).order_by(Product.created_at.desc())
    res = await db.execute(stmt)
    products = res.scalars().all()

    response = []
    for p in products:
        response.append({
            "id": str(p.id),
            "vendor_id": str(p.vendor_id) if p.vendor_id else None,
            "name": p.name,
            "category": p.category,
            "brand": p.brand,
            "sku": p.sku,
            "price": p.price,
            "stock_quantity": p.stock_quantity,
            "image_url": p.image_url,
            "approved": p.approved
        })
    return response


@router.patch("/moderation/{product_id}", dependencies=[Depends(verify_admin_role)])
async def moderate_product(
    product_id: uuid.UUID,
    approved: bool,
    price: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    """Override moderation flags or update listing pricing bounds."""
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Catalog product not found.")

    try:
        product.approved = approved
        if price is not None:
            product.price = price

        await db.commit()
        return {
            "status": "success",
            "message": "Product listings moderated successfully.",
            "product_id": str(product.id),
            "approved": product.approved
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Moderation update failed: {str(e)}")


# 🟢 Redesigned /admin/users search endpoint for API Key Owner Selection
@router.get("/users", dependencies=[Depends(verify_admin_role)])
async def list_eligible_users(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve registered users eligible for developer key creation, with optional search."""
    stmt = select(User)
    if q:
        query_str = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.email.ilike(query_str),
                User.first_name.ilike(query_str),
                User.last_name.ilike(query_str),
                User.company_name.ilike(query_str)
            )
        )
    stmt = stmt.order_by(User.email.asc()).limit(50)
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [{
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "company_name": u.company_name,
        "role": u.role
    } for u in users]


# 🟢 ADMIN MANAGEMENT CRUD ENDPOINTS
@router.get("/admins", response_model=List[AdminResponse], dependencies=[Depends(verify_admin_role)])
async def list_admins(db: AsyncSession = Depends(get_db)):
    """Retrieve all administrative Superadmin users in the system."""
    stmt = select(User).where(User.role == UserRole.ADMIN).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/admins", response_model=AdminResponse, dependencies=[Depends(verify_admin_role)])
async def create_new_admin(payload: AdminCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new administrative user with a securely hashed password."""
    email_clean = payload.email.lower().strip()
    dup_stmt = select(User).where(User.email == email_clean)
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    try:
        new_admin = User(
            id=uuid.uuid4(),
            email=email_clean,
            password_hash=hash_password(payload.password),
            provider="local",
            role=UserRole.ADMIN,
            first_name=payload.first_name,
            last_name=payload.last_name,
            country=payload.country,
            city=payload.city,
            language=payload.language or "en",
            is_active=True,
            is_verified=True
        )
        db.add(new_admin)
        await db.commit()
        await db.refresh(new_admin)
        return new_admin
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create admin user: {str(e)}")


@router.patch("/admins/{admin_id}", response_model=AdminResponse, dependencies=[Depends(verify_admin_role)])
async def update_admin_user(
    admin_id: uuid.UUID,
    payload: AdminUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Modify details or toggle active status of an administrator account."""
    stmt = select(User).where(User.id == admin_id, User.role == UserRole.ADMIN)
    res = await db.execute(stmt)
    admin = res.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=404, detail="Administrator account not found.")

    if payload.email is not None:
        email_clean = payload.email.lower().strip()
        if email_clean != admin.email:
            dup_stmt = select(User).where(User.email == email_clean)
            dup_res = await db.execute(dup_stmt)
            if dup_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email address already exists."
                )
            admin.email = email_clean

    if payload.first_name is not None:
        admin.first_name = payload.first_name
    if payload.last_name is not None:
        admin.last_name = payload.last_name
    if payload.country is not None:
        admin.country = payload.country
    if payload.city is not None:
        admin.city = payload.city
    if payload.language is not None:
        admin.language = payload.language
    if payload.is_active is not None:
        admin.is_active = payload.is_active

    try:
        await db.commit()
        await db.refresh(admin)
        return admin
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update admin account: {str(e)}")


@router.post("/admins/{admin_id}/reset-password", dependencies=[Depends(verify_admin_role)])
async def reset_admin_password(
    admin_id: uuid.UUID,
    payload: AdminPasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """Force reset password of an administrator account with secure hash."""
    stmt = select(User).where(User.id == admin_id, User.role == UserRole.ADMIN)
    res = await db.execute(stmt)
    admin = res.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=404, detail="Administrator account not found.")

    try:
        admin.password_hash = hash_password(payload.new_password)
        await db.commit()
        return {"status": "success", "message": "Administrator password reset completed successfully."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")


@router.get("/api-keys", response_model=List[APIKeyResponse], dependencies=[Depends(verify_admin_role)])
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    """Retrieve registered developer api keys with their owner email."""
    stmt = select(APIKey, User.email).outerjoin(User, APIKey.developer_id == User.id).order_by(APIKey.created_at.desc())
    res = await db.execute(stmt)
    results = res.all()
    
    output = []
    for key_obj, email in results:
        key_obj.developer_email = email
        output.append(key_obj)
    return output


@router.post("/api-keys", response_model=APIKeyResponse, dependencies=[Depends(verify_admin_role)])
async def create_api_key(payload: APIKeyCreateRequest, db: AsyncSession = Depends(get_db)):
    """Generate, hash, and register a new developer API Key prefix."""
    raw_key = f"sp_live_{secrets.token_hex(24)}"
    hashed = hashlib.sha256(raw_key.encode()).hexdigest()
    prefix = raw_key[:10]

    try:
        key_obj = APIKey(
            developer_id=payload.developer_id,
            key_hash=hashed,
            prefix=prefix,
            tier=payload.tier.value,
            is_active=True,
            calls_made=0,
            rate_limit_max=payload.rate_limit_max
        )
        db.add(key_obj)
        await db.commit()
        await db.refresh(key_obj)

        # Get developer email
        user_stmt = select(User.email).where(User.id == payload.developer_id)
        user_res = await db.execute(user_stmt)
        email = user_res.scalar_one_or_none()

        resp = APIKeyResponse.from_orm(key_obj)
        resp.raw_key = raw_key # Returned to the admin once during creation
        resp.developer_email = email
        return resp
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Key creation failed: {str(e)}")


@router.post("/api-keys/{key_id}/revoke", dependencies=[Depends(verify_admin_role)])
async def revoke_api_key(key_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Deactivate or revoke access permissions for a specific key."""
    stmt = select(APIKey).where(APIKey.id == key_id)
    res = await db.execute(stmt)
    key_obj = res.scalar_one_or_none()

    if not key_obj:
        raise HTTPException(status_code=404, detail="API Key record not found.")

    try:
        key_obj.is_active = not key_obj.is_active # Toggles active state
        await db.commit()
        return {
            "status": "success",
            "message": f"API Key state toggled to active={key_obj.is_active}.",
            "key_id": str(key_obj.id),
            "is_active": key_obj.is_active
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Key deactivation failed: {str(e)}")


@router.get("/vendors", dependencies=[Depends(verify_admin_role)])
async def list_registered_vendors(db: AsyncSession = Depends(get_db)):
    """Retrieve platform vendors along with profile metadata."""
    stmt = select(User).where(User.role == UserRole.VENDOR).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    vendors = res.scalars().all()

    response = []
    for v in vendors:
        response.append({
            "id": str(v.id),
            "email": v.email,
            "company_name": v.company_name,
            "country": v.country,
            "city": v.city,
            "is_active": v.is_active,
            "is_verified": v.is_verified
        })
    return response


@router.patch("/vendors/{vendor_id}/status", dependencies=[Depends(verify_admin_role)])
async def toggle_vendor_status(
    vendor_id: uuid.UUID,
    is_active: bool,
    is_verified: bool,
    db: AsyncSession = Depends(get_db)
):
    """Suspend, activate, or verify registered vendor profiles."""
    stmt = select(User).where(User.id == vendor_id, User.role == UserRole.VENDOR)
    res = await db.execute(stmt)
    vendor = res.scalar_one_or_none()

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor user profile not found.")

    try:
        old_verified = vendor.is_verified
        vendor.is_active = is_active
        vendor.is_verified = is_verified

        # Send alert notification to the vendor
        if is_verified and not old_verified:
            notif = Notification(
                user_id=vendor.id,
                title="Account Approved",
                message="Your vendor registration has been approved by the admin. You can now access your dashboard and publish catalogs."
            )
            db.add(notif)

        await db.commit()
        return {
            "status": "success",
            "message": "Vendor profile updated successfully.",
            "vendor_id": str(vendor.id),
            "is_active": vendor.is_active,
            "is_verified": vendor.is_verified
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Vendor status override failed: {str(e)}")


# --- 🟢 GLOBAL AUDIT LOGS ENDPOINT ---

@router.get("/audit-logs", dependencies=[Depends(verify_admin_role)])
async def list_audit_logs(db: AsyncSession = Depends(get_db)):
    """Retrieve system security and administrative activity logs."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [{
        "id": str(log.id),
        "user_id": str(log.user_id) if log.user_id else None,
        "action": log.action,
        "resource": log.resource,
        "created_at": log.created_at
    } for log in logs]


# --- 🟢 SYSTEM USER CONTROL ENDPOINTS ---

@router.post("/users/{user_id}/promote", dependencies=[Depends(verify_admin_role)])
async def promote_user_to_admin(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Promote a standard buyer/vendor user to administrative Superadmin role."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User record not found.")

    try:
        user.role = UserRole.ADMIN
        await db.commit()
        return {"status": "success", "message": f"User {user.email} successfully promoted to ADMIN."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}", dependencies=[Depends(verify_admin_role)])
async def delete_admin_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Remove administrative roles or delete user accounts cleanly."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User record not found.")

    try:
        await db.delete(user)
        await db.commit()
        return {"status": "success", "message": "User account permanently removed from system."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))