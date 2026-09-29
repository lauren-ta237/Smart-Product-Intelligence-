import sys
import os

# Add the project root directory to Python's system path so absolute imports like 'app.main' resolve properly on Vercel
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.main import app

# Vercel serverless function entrypoint requires the ASGI app object
handler = app