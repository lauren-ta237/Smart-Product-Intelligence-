from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1 import vendors
from app.api.v1 import images
from app.api.v1 import products
from app.api.v1 import dashboard 

# Point directly to our intelligence router module
from app.modules.intelligence.router import router as intelligence_router
# Import the catalog router we created in app/modules/catalog/router.py
from app.modules.catalog.router import router as catalog_router

api_router = APIRouter()

# 🔐 Authentication Routes -> /api/v1/auth/login
api_router.include_router(auth_router, prefix="/v1")

# 👥 Vendor Management Routes -> /api/v1/vendors/...
api_router.include_router(vendors.router, prefix="/v1")

# 📦 Product Catalog Management -> /api/v1/products/...
api_router.include_router(products.router, prefix="/v1")

# 📊 Analytics Dashboards -> /api/v1/dashboard/stats
api_router.include_router(dashboard.router, prefix="/v1")

# 🧠 AI Computer Vision Pipeline Routes
api_router.include_router(intelligence_router, prefix="/v1")

# 📸 Image Upload Infrastructure Routes
api_router.include_router(images.router, prefix="/v1")

# 🟢 Catalog Inventory Routes
api_router.include_router(catalog_router)

# 🚀 PRESENTATION SAFE ALIAS: 
# This handles the frontend review layout hitting /api/products directly
# without disrupting any existing v1 mobile/desktop internal endpoints!
api_router.include_router(products.router)