import asyncio
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.core.database import init_db
from app.core.logging import setup_logging

# Load environmental configurations explicitly 
load_dotenv()

# Ensure uploads directory exists BEFORE mounting StaticFiles at module load time
os.makedirs("uploads", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create local file storage folder to ensure directory exists across all platforms
    os.makedirs("uploads", exist_ok=True)
    # Automatically checks your Postgres instance and builds tables if missing
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

# Configure strict Cross-Origin Resource Sharing (CORS) boundaries
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
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

# Mount static asset disk space natively for uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

setup_logging()

# Attach versioned API sub-routers natively managed via central hub
app.include_router(
    api_router, 
    prefix="/api/v1"
)

@app.get("/health")
async def health():
    return {"status": "healthy"}