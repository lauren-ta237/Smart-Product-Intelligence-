# app/main.py
import asyncio
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.database import init_db, engine, Base
from app.core.config.settings import settings
from app.core.logging import setup_logging
from app.modules.admin.router import router as admin_router
from app.modules.catalog.router import router as catalog_router

# Load environmental configurations explicitly 
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run the migration-safe database bootstrap used by the app instead of only create_all.
    try:
        await init_db()
        print("[LIFESPAN] Database initialization checked successfully.")
    except Exception as e:
        print(f"[LIFESPAN] Database initialization note: {e}")
        
    try:
        yield
    except asyncio.CancelledError:
        print("[LIFESPAN] Shutdown task cancelled during interrupt. Exiting gracefully...")
    finally:
        print("[LIFESPAN] Application lifecycle context closed.")

app = FastAPI(
    title="Smart Product Intelligence Platform",
    version="1.0",
    lifespan=lifespan 
)

# os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
# app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).resolve().parents[1] / "static", check_dir=False),
    name="static",
)

# Safely parse allowed frontend origins from settings or environment
frontend_urls = getattr(settings, "FRONTEND_URL", "") or os.getenv("FRONTEND_URL", "")
extra_origins = [origin.strip() for origin in frontend_urls.split(",") if origin.strip()]

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://smart-product-intelligence-rho.vercel.app",
    *extra_origins,
]

# Configure strict Cross-Origin Resource Sharing (CORS) boundaries with wildcard matching support for Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if os.getenv("ENVIRONMENT") == "development" else allowed_origins,
    allow_origin_regex=r"https://([a-zA-Z0-9-_]+\.)*vercel\.app", # Safely catches all custom Vercel subdomains and production deployment URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )

setup_logging()

# Attach versioned API sub-routers natively managed via central hub
app.include_router(
    api_router, 
    prefix="/api/v1"
)

# Also expose the catalog's own /products routes without the /api/v1 prefix.
app.include_router(
    catalog_router,
    tags=["Catalog Fallback"]
)

# Expose admin routes directly at the root level so /admin/... paths work instantly
app.include_router(
    admin_router,
    tags=["Admin Root Fallback"]
)

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Temporary utility route to initialize tables on Supabase with error visibility
@app.post("/init-db", tags=["Setup"])
async def initialize_database():
    try:
        await init_db()
        return {"status": "success", "message": "Database schema verified and repaired successfully on Supabase!"}
    except Exception as e:
        import traceback
        error_detail = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": str(e), "traceback": error_detail}
        )