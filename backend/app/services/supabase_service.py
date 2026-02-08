"""
Supabase service for database operations
"""

from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from typing import Optional, Dict, List


class SupabaseService:
    """Service for interacting with Supabase database"""
    
    def __init__(self):
        """Initialize Supabase client"""
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("Supabase URL and Service Key must be set in environment variables")
        
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    def get_document_metadata(self, document_id: str) -> Optional[Dict]:
        """Get document metadata by ID"""
        try:
            response = self.client.table("document_metadata").select("*").eq("id", document_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error getting document metadata: {e}")
            return None
    
    def get_pending_documents(self, chatbot_id: str) -> List[Dict]:
        """Get all pending documents for a chatbot"""
        try:
            response = (
                self.client.table("document_metadata")
                .select("*")
                .eq("chatbot_id", chatbot_id)
                .eq("status", "pending")
                .execute()
            )
            return response.data or []
        except Exception as e:
            print(f"Error getting pending documents: {e}")
            return []
    
    def reset_documents_for_reingest(self, chatbot_id: str) -> bool:
        """
        Reset document statuses so every document for a chatbot is eligible for ingestion again.
        Sets status back to 'pending' and clears ingestion-specific fields.
        """
        try:
            update_data = {
                "status": "pending",
                "error_message": None,
                "chunk_count": None,
                "processed_at": None,
            }
            (
                self.client.table("document_metadata")
                .update(update_data)
                .eq("chatbot_id", chatbot_id)
                .neq("status", "pending")
                .execute()
            )
            return True
        except Exception as e:
            print(f"Error resetting document statuses: {e}")
            return False

    def update_document_status(
        self,
        document_id: str,
        status: str,
        chunk_count: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """Update document metadata status"""
        try:
            update_data = {"status": status}
            
            if chunk_count is not None:
                update_data["chunk_count"] = chunk_count
            
            if error_message is not None:
                update_data["error_message"] = error_message
            
            if status == "completed":
                from datetime import datetime
                update_data["processed_at"] = datetime.utcnow().isoformat()
            
            self.client.table("document_metadata").update(update_data).eq("id", document_id).execute()
            return True
        except Exception as e:
            print(f"Error updating document status: {e}")
            return False
    
    def get_chatbot(self, chatbot_id: str) -> Optional[Dict]:
        """Get chatbot by ID"""
        try:
            response = self.client.table("chatbots").select("*").eq("id", chatbot_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error getting chatbot: {e}")
            return None
    
    def get_documents_by_chatbot(self, chatbot_id: str) -> List[Dict]:
        """Get all documents for a chatbot"""
        try:
            response = (
                self.client.table("document_metadata")
                .select("*")
                .eq("chatbot_id", chatbot_id)
                .execute()
            )
            return response.data or []
        except Exception as e:
            print(f"Error getting documents by chatbot: {e}")
            return []
    
    def download_file(self, file_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            bucket_name = "chat-documents"
            response = self.client.storage.from_(bucket_name).download(file_path)
            
            if isinstance(response, bytes):
                return response
            elif hasattr(response, 'content'):
                return response.content
            elif hasattr(response, 'read'):
                return response.read()
            else:
                return bytes(response) if response else b''
        except Exception as e:
            raise Exception(f"Failed to download file from storage: {e}")

