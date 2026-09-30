import sys
import os

# Add apps/api to python path so it can correctly locate the 'app' package
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.join(current_dir, "apps", "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.main import app

# Vercel serverless function handler
handler = app