"""
Ingestion service - processes documents and stores in vector database
"""

from typing import Dict, List
from app.services.zilliz_service import zilliz_service
from app.services.supabase_service import SupabaseService
from app.utils.document_processor import DocumentProcessor


class IngestionService:
    """Service for ingesting documents into the vector database"""
    
    def __init__(self):
        self.supabase_service = SupabaseService()
        self.document_processor = DocumentProcessor()
    
    def ingest_chatbot_documents(self, chatbot_id: str) -> Dict:
        """
        Ingest all pending documents for a chatbot
        
        Workflow:
        1. Get pending documents
        2. If collection exists, empty it
        3. For each document:
           - Extract text
           - Chunk (500 chars, 20% overlap)
           - Generate embeddings
           - Store in Zilliz with text
        
        Args:
            chatbot_id: ID of the chatbot
            
        Returns:
            Dict with ingestion results
        """
        print(f"[INGESTION] Starting ingestion for chatbot {chatbot_id}")
        
        # Reset statuses so completed/failed documents are reprocessed
        print(f"[INGESTION] Resetting document statuses to pending...")
        self.supabase_service.reset_documents_for_reingest(chatbot_id)
        
        # Get pending documents
        pending_docs = self.supabase_service.get_pending_documents(chatbot_id)
        print(f"[INGESTION] Found {len(pending_docs)} pending documents")
        
        if not pending_docs:
            return {
                "success": True,
                "chatbot_id": chatbot_id,
                "total_documents": 0,
                "processed": 0,
                "failed": 0,
                "message": "No pending documents to process"
            }
        
        # Check if collection exists, if so, empty it
        collection = zilliz_service.get_collection(chatbot_id)
        if collection:
            print(f"[INGESTION] Collection exists, emptying it...")
            try:
                # Delete all entities in the collection for this chatbot
                collection.delete(expr=f'chatbot_id == "{chatbot_id}"')
                collection.flush()
                print(f"[INGESTION] Collection emptied")
            except Exception as e:
                print(f"[INGESTION] Warning: Could not empty collection: {e}, will try to create new one")
                # Try to create if deletion failed
                collection = zilliz_service.create_collection_if_not_exists(chatbot_id)
        else:
            # Create collection if it doesn't exist
            print(f"[INGESTION] Creating new collection...")
            collection = zilliz_service.create_collection_if_not_exists(chatbot_id)
        
        # Process each document
        processed = 0
        failed = 0
        errors = []
        
        for doc in pending_docs:
            document_id = doc["id"]
            filename = doc["filename"]
            file_path = doc["file_path"]
            user_id = doc["user_id"]
            
            print(f"[INGESTION] Processing document: {filename} (ID: {document_id})")
            
            # Update status to processing
            self.supabase_service.update_document_status(document_id, "processing")
            
            try:
                # Step 1: Download file from storage
                print(f"[INGESTION] Downloading file from storage...")
                file_content = self.supabase_service.download_file(file_path)
                print(f"[INGESTION] Downloaded {len(file_content)} bytes")
                
                # Step 2: Extract text (remove formatting, keep only text)
                print(f"[INGESTION] Extracting text from document...")
                text = self.document_processor.extract_text(
                    file_content,
                    mime_type=doc.get("mime_type"),
                    filename=filename
                )
                
                if not text or not text.strip():
                    raise Exception("No text extracted from document")
                
                print(f"[INGESTION] Extracted {len(text)} characters of text")
                
                # Step 3: Chunk text (500 chars, 20% overlap = 100 chars)
                print(f"[INGESTION] Chunking text...")
                chunks = self.document_processor.chunk_text(text, chunk_size=500, overlap_percent=0.2)
                print(f"[INGESTION] Created {len(chunks)} chunks")
                
                if not chunks:
                    raise Exception("No chunks created from document")
                
                # Step 4: Generate embeddings and store in Zilliz (with text)
                print(f"[INGESTION] Generating embeddings and storing in Zilliz...")
                num_chunks_added = zilliz_service.add_documents(
                    chatbot_id=chatbot_id,
                    document_id=document_id,
                    chunks=chunks,
                    filename=filename,
                    user_id=user_id
                )
                print(f"[INGESTION] Successfully added {num_chunks_added} chunks to Zilliz")
                
                # Step 5: Update status to completed
                self.supabase_service.update_document_status(
                    document_id,
                    "completed",
                    chunk_count=num_chunks_added
                )
                
                processed += 1
                print(f"[INGESTION] ✅ Document {filename} ingested successfully")
                
            except Exception as e:
                error_msg = str(e)
                print(f"[INGESTION] ❌ Error processing {filename}: {error_msg}")
                
                # Update status to failed with error message
                self.supabase_service.update_document_status(
                    document_id,
                    "failed",
                    error_message=error_msg
                )
                
                failed += 1
                errors.append({
                    "document_id": document_id,
                    "filename": filename,
                    "error": error_msg
                })
        
        result = {
            "success": failed == 0,
            "chatbot_id": chatbot_id,
            "total_documents": len(pending_docs),
            "processed": processed,
            "failed": failed,
            "errors": errors if errors else None
        }
        
        print(f"[INGESTION] Ingestion completed: {processed} processed, {failed} failed")
        return result

