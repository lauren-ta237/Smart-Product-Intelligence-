import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_vendor
from app.modules.dashboard.service import DashboardService

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get("/stats")
async def stats(
    vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns high-level retail metrics and analysis aggregations.
    Consumed by the React dashboard layout components.
    """
    try:
        # Safely resolve the vendor identifier from the injected credentials context
        vendor_id = vendor.id if hasattr(vendor, "id") else vendor.get("id")
        
        if not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not resolve a valid vendor identity profile."
            )
            
        service = DashboardService(db)
        return await service.get_stats(vendor_id)
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate analytics dashboard overview statistics."
        )