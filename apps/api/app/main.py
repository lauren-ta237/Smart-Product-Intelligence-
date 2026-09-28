import asyncio
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.database import init_db
from app.core.config.settings import settings
from app.core.logging import setup_logging
from app.modules.catalog.router import router as catalog_router

# Load environmental configurations explicitly 
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Skip automatic DDL / table creation on Vercel serverless environment 
    # to avoid read-only or resource busy errors.
    if not os.getenv("VERCEL"):
        await init_db()
        
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
    *extra_origins,
]

# Configure strict Cross-Origin Resource Sharing (CORS) boundaries
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app", # Automatically allows all Vercel preview and production deployment URLs
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

# BULLETPROOF FALLBACK: Also mount catalog directly at root /products 
# so requests lacking the /api/v1 prefix succeed instantly!
app.include_router(
    catalog_router,
    prefix="/products",
    tags=["Catalog Fallback"]
)

@app.get("/health")
async def health():
    return {"status": "healthy"}