from fastapi import APIRouter, Depends
from app.core.auth import get_current_vendor

router = APIRouter(
    prefix="/vendors",
    tags=["Vendors"]
)
@router.get("/me")
async def current_vendor(

    vendor = Depends(
        get_current_vendor
    )
):
    """
    Returns logged-in vendor profile.
    """
    return vendor