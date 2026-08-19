# Re-export catalog models for structural clean architecture compatibility and duplicate mapping bypass
from app.modules.catalog.models import Product, DetectedProduct

__all__ = ["Product", "DetectedProduct"]