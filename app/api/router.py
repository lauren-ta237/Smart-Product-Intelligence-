# app/api/router.py
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1 import dashboard, user
from app.modules.intelligence.router import router as intelligence_router
from app.modules.media.router import router as media_router
from app.modules.products.router import router as products_router
from app.modules.orders.router import router as orders_router  # 🟢 IMPORT ORDERS ROUTER
from app.modules.admin.router import router as admin_router
from app.api.v1.developer import router as developer_router
from app.modules.catalog.router import router as catalog_router

api_router = APIRouter()

# TASK 4: Ensure specific routes are registered before generic ones to prevent path conflicts.
api_router.include_router(orders_router)

# 1. Auth & Users
api_router.include_router(auth_router)
api_router.include_router(user.router)

# 2. Media & AI
api_router.include_router(media_router)
api_router.include_router(intelligence_router)

# 3. Products & Catalog
api_router.include_router(products_router)
api_router.include_router(catalog_router, prefix="/inventory", tags=["Catalog"])

# 5. Dashboard & Admin
api_router.include_router(dashboard.router)
api_router.include_router(admin_router)
api_router.include_router(developer_router)