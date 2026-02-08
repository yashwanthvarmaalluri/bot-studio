"""
Entry point for running the FastAPI application
"""

import sys
import os
import uvicorn
from app.core.config import API_HOST, API_PORT
from app.main import app

# Ensure we're using the virtual environment's Python
if __name__ == "__main__":
    # Verify we can import required modules
    try:
        import supabase
        import pymilvus
        # import sentence_transformers
    except ImportError as e:
        print(f"ERROR: Missing required module: {e}")
        print(f"Python executable: {sys.executable}")
        print("Please ensure you're running this script with the virtual environment activated:")
        print("  source bot-studio/bin/activate")
        print("  python run.py")
        sys.exit(1)
    
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level="info"
    )

