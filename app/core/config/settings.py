# app/core/config/settings.py
from pathlib import Path
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dynamically calculate the project root path
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):
    """
    Global application configuration.
    Keeps secrets outside code.
    """
    DATABASE_URL: str
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"

    # AI provider selection
    AI_PROVIDER: str = "google"

    # --- GOOGLE CLIENT IDENTITY ---
    GOOGLE_CLIENT_ID: str | None = None

    # --- CLOUD STORAGE PARAMETERS ---
    STORAGE_TYPE: str = "local"  # "local" or "s3"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_BUCKET_NAME: str | None = None
    AWS_REGION: str = "us-east-1"

    # --- FACTORY REQUISITES ---
    GOOGLE_AI_KEY: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GOOGLE_AI_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY")
    )
    GOOGLE_API_KEY: str | None = Field(
        default=None, 
        validation_alias=AliasChoices("GOOGLE_API_KEY", "GOOGLE_AI_KEY", "GEMINI_API_KEY")
    )
    GEMINI_API_KEY: str | None = Field(
        default=None, 
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_AI_KEY", "GOOGLE_API_KEY")
    )

    # Added Anthropic to clear the second factory exception
    ANTHROPIC_API_KEY: str | None = None

    # --- FIELDS MAP TO UPPERCASE IN .ENV ---
    REDIS_URL: str = "redis://localhost:6379/0"
    APP_NAME: str = "Smart Product Intelligence Platform"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    MAX_UPLOAD_SIZE: int = 10
    UPLOADS_DIR: Path = BASE_DIR / "uploads"

    # --- CONFIGURATION MODEL ---
    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,   # Absolute path guarantees discovery
        extra="ignore",           # Ignores extraneous variables gracefully
        case_sensitive=True,      # Kept True alongside matching UPPERCASE fields above
        env_file_encoding="utf-8"
    )

# Instantiate the settings object cleanly at the global module scope
settings = Settings()