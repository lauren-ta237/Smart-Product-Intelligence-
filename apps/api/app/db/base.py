# app/db/base.py
from app.core.base_model import BaseModel
from app.modules.identity.models import User
from app.modules.orders.models import Order, OrderItem, Shipment
# Import other module models here as you create them