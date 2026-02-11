"""
FastAPI application
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.routes import chat
from app.core.auth import require_chatbot_owner
from app.core.config import APP_NAME, APP_ENV, DEBUG, CORS_ORIGINS


class DeleteDocumentBody(BaseModel):
    document_id: str

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
async def ingest_documents(chatbot_id: str, _user=Depends(require_chatbot_owner)):  
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
async def get_chatbot_documents(chatbot_id: str, _user=Depends(require_chatbot_owner)):   
    """Get all documents for a chatbot with their status"""
    from app.services.supabase_service import SupabaseService
    
    supabase_service = SupabaseService()
    docs = supabase_service.get_documents_by_chatbot(chatbot_id)
    
    return {
        "chatbot_id": chatbot_id,
        "documents": docs
    }


@app.delete("/api/chatbot/{chatbot_id}/documents")
async def delete_document_vectors(
    chatbot_id: str,
    body: DeleteDocumentBody,
    _user=Depends(require_chatbot_owner),
):
    """Remove this document's embeddings from the vector DB. Does not delete file or document_metadata."""
    from app.services.zilliz_service import ZillizService
    zilliz = ZillizService()
    try:
        zilliz.delete_document(chatbot_id, body.document_id)
        return {"ok": True, "document_id": body.document_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vector delete failed: {str(e)}")


@app.delete("/api/chatbot/{chatbot_id}")
async def delete_chatbot_vectors(
    chatbot_id: str,
    _user=Depends(require_chatbot_owner),
):
    """Delete the Zilliz collection for this chatbot (call when deleting the chatbot). Does not delete DB record, storage, or document_metadata."""
    from app.services.zilliz_service import ZillizService
    zilliz = ZillizService()
    try:
        zilliz.delete_collection(chatbot_id)
        return {"ok": True, "chatbot_id": chatbot_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Zilliz collection delete failed: {str(e)}")

