from celery import Celery
from app.core.config.settings import settings



# Celery manages background jobs.
# Redis acts as the message broker.
# API sends jobs.
# Workers execute jobs.

celery_app = Celery(
    "product_ai_worker",
    broker=(
        f"redis://"
        f"{settings.REDIS_HOST}:"
        f"{settings.REDIS_PORT}"
    ),
    backend=(
        f"redis://"
        f"{settings.REDIS_HOST}:"
        f"{settings.REDIS_PORT}"
    )
)