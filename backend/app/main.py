"""
FastAPI application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat
from app.core.config import APP_NAME, APP_ENV, DEBUG, CORS_ORIGINS

app = FastAPI(
    title=APP_NAME,
    description="RAG Chatbot Framework API",
    version="1.0.0",
    debug=DEBUG,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "RAG Chatbot Framework API",
        "version": "1.0.0",
        "environment": APP_ENV
    }


@app.post("/api/ingest/{chatbot_id}")
async def ingest_documents(chatbot_id: str):
    """
    Ingest all pending documents for a chatbot
    
    Workflow:
    1. Extract text from documents
    2. Chunk documents (500 chars, 20% overlap)
    3. Generate embeddings
    4. Store in Zilliz with text
    
    Returns ingestion results
    """
    from app.services.ingestion_service import IngestionService
    
    ingestion_service = IngestionService()
    result = ingestion_service.ingest_chatbot_documents(chatbot_id)
    
    return result


@app.get("/api/chatbot/{chatbot_id}/documents")
async def get_chatbot_documents(chatbot_id: str):
    """Get all documents for a chatbot with their status"""
    from app.services.supabase_service import SupabaseService
    
    supabase_service = SupabaseService()
    docs = supabase_service.get_documents_by_chatbot(chatbot_id)
    
    return {
        "chatbot_id": chatbot_id,
        "documents": docs
    }

