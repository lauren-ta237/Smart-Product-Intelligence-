import asyncio
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.core.logging import setup_logging
from app.api.router import api_router
from app.core.database import init_db

# Load environmental configurations explicitly 
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create local file storage folder on Windows to prevent 500 FileNotFoundError crashes
    os.makedirs("uploads", exist_ok=True)
    
    # Automatically checks your Postgres instance and builds tables if missing
    # 🚀 This handles the metadata schema building safely behind the scenes
    await init_db()
    
    try:
        yield
    except asyncio.CancelledError:
        # 🟢 Catch aggressive Python 3.14/Windows context cancellation cleanly on Ctrl+C
        print("[LIFESPAN] Shutdown task cancelled during interrupt. Exiting gracefully...")
    finally:
        # 🟢 Put any database pool closing or cleanup actions here if needed down the line
        print("[LIFESPAN] Application lifecycle context closed.")

app = FastAPI(
    title="Smart Product Intelligence Platform",
    version="1.0",
    lifespan=lifespan 
)

# Configure strict Cross-Origin Resource Sharing (CORS) boundaries
# 🌟 UPDATED: Added port 8080 origins so the new frontend doesn't get blocked!
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Mount static asset disk space natively to bypass browser Opaque Response Blocking (ORB)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

setup_logging()

# Attach versioned API sub-routers natively managed via your central hub
app.include_router(
    api_router, 
    prefix="/api"
)

@app.get("/health")
async def health():
    return {"status": "healthy"}