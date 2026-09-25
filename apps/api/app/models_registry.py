# app/models_registry.py
# This is for alembic to detect all models
from app.modules.identity.models import User, Notification
from app.modules.media.models import ProductImage
from app.modules.intelligence.models import AIAnalysis
from app.modules.catalog.models import DetectedProduct, Product, Category, Review, WishlistItem
from app.modules.orders.models import Order, OrderItem, Shipment, Payment
from app.modules.admin.models import APIKey
from app.core.audit import AuditLog