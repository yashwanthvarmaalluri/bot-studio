import os
from typing import List, Dict, Optional
from pymilvus import (
    connections,
    Collection,
    FieldSchema,
    CollectionSchema,
    DataType,
    utility
)
from pymilvus.exceptions import MilvusException
from openai import OpenAI
from app.core.config import (
    ZILLIZ_URI,
    ZILLIZ_TOKEN,
    OPENAI_API_KEY,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSION
)
import math


class ZillizService:
    def __init__(self):
        """Initialize Zilliz Cloud connection and embedding model"""
        # Connect to Zilliz Cloud
        connections.connect(
            alias="default",
            uri=ZILLIZ_URI,
            token=ZILLIZ_TOKEN
        )
        
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set. Please configure it in your environment variables.")

        # Initialize OpenAI client for embeddings
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.embedding_model = EMBEDDING_MODEL
        self.dimension = EMBEDDING_DIMENSION
        self._embedding_batch_size = 100  # Safe default to avoid token limits
        
        print(f"Connected to Zilliz Cloud. Using OpenAI embedding model: {self.embedding_model}")
    
    def get_collection_name(self, chatbot_id: str) -> str:
        """
        Generate collection name for a chatbot
        Zilliz collection names can only contain numbers, letters, and underscores
        """
        # Replace hyphens and other invalid characters with underscores
        sanitized_id = chatbot_id.replace('-', '_').replace('.', '_').replace(' ', '_')
        # Remove any other non-alphanumeric characters except underscores
        import re
        sanitized_id = re.sub(r'[^a-zA-Z0-9_]', '_', sanitized_id)
        return f"chatbot_{sanitized_id}"
    
    def create_collection_if_not_exists(self, chatbot_id: str) -> Collection:
        """
        Create a collection for a chatbot if it doesn't exist.
        Returns the collection object.
        """
        collection_name = self.get_collection_name(chatbot_id)
        
        # Check if collection exists (catch exception if it doesn't)
        try:
            if utility.has_collection(collection_name):
                collection = Collection(collection_name)
                collection.load()
                return collection
        except MilvusException:
            # Collection doesn't exist, will create it below
            pass
        
        # Define schema
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=255),
            FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=255),  # document_metadata.id
            FieldSchema(name="chunk_index", dtype=DataType.INT64),  # Which chunk in the document
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),  # The actual text chunk
            FieldSchema(name="filename", dtype=DataType.VARCHAR, max_length=255),
            FieldSchema(name="chatbot_id", dtype=DataType.VARCHAR, max_length=255),
            FieldSchema(name="user_id", dtype=DataType.VARCHAR, max_length=255),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension),
        ]
        
        schema = CollectionSchema(
            fields=fields,
            description=f"Collection for chatbot {chatbot_id}"
        )
        
        # Create collection
        # pymilvus Collection.__init__ checks has_collection first, which raises if collection doesn't exist
        # We need to create it via the connection handler before instantiating Collection
        from pymilvus import connections
        
        # Get the connection handler
        conn_handler = None
        try:
            # Access the private _connected_alias to get the handler
            if hasattr(connections, '_connected_alias') and "default" in connections._connected_alias:
                conn_handler = connections._connected_alias["default"]
        except:
            pass
        
        # If we have the handler, create collection via its create_collection method
        if conn_handler and hasattr(conn_handler, 'create_collection'):
            try:
                # Create collection via connection handler
                # The create_collection method expects fields as a dict (schema dict)
                schema_dict = schema.to_dict()
                conn_handler.create_collection(
                    collection_name=collection_name,
                    fields=schema_dict,
                    timeout=None
                )
                # Now get the collection
                collection = Collection(collection_name)
            except Exception as e:
                # If creation fails, check if collection was created anyway
                try:
                    collection = Collection(collection_name)
                except:
                    raise Exception(f"Failed to create collection: {e}")
        else:
            # Fallback: try Collection with schema
            # This will fail if collection doesn't exist
            try:
                collection = Collection(name=collection_name, schema=schema)
            except MilvusException:
                raise Exception(
                    "Cannot access connection handler to create collection. "
                    "Please check your Zilliz connection."
                )
        
        # Create index on embedding field
        index_params = {
            "metric_type": "L2",  # Euclidean distance
            "index_type": "IVF_FLAT",  # Simple but effective
            "params": {"nlist": 128}
        }
        
        collection.create_index(
            field_name="embedding",
            index_params=index_params
        )
        
        # Load collection
        collection.load()
        
        print(f"Created collection: {collection_name}")
        return collection
    
    def get_collection(self, chatbot_id: str) -> Optional[Collection]:
        """Get an existing collection"""
        collection_name = self.get_collection_name(chatbot_id)
        
        try:
            if not utility.has_collection(collection_name):
                return None
        except MilvusException:
            return None
        
        collection = Collection(collection_name)
        collection.load()
        return collection
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        if not texts:
            return []

        embeddings: List[List[float]] = []

        for start in range(0, len(texts), self._embedding_batch_size):
            batch = texts[start:start + self._embedding_batch_size]
            try:
                response = self.client.embeddings.create(
                    model=self.embedding_model,
                    input=batch
                )
            except Exception as exc:
                raise Exception(f"Failed to generate embeddings via OpenAI: {exc}")

            # Ensure order is preserved using index
            batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
            for vector in batch_embeddings:
                norm = math.sqrt(sum(value * value for value in vector))
                if norm > 0:
                    normalized = [value / norm for value in vector]
                else:
                    normalized = vector
                embeddings.append(normalized)

        return embeddings
    
    def add_documents(
        self,
        chatbot_id: str,
        document_id: str,
        chunks: List[str],
        filename: str,
        user_id: str,
        metadata: Optional[Dict] = None
    ) -> int:
        """
        Add document chunks to a chatbot's collection.
        
        Args:
            chatbot_id: ID of the chatbot
            document_id: ID from document_metadata table
            chunks: List of text chunks
            filename: Name of the file
            user_id: User ID
            metadata: Optional additional metadata
            
        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0
        
        collection = self.create_collection_if_not_exists(chatbot_id)
        
        # Generate embeddings for all chunks
        embeddings = self.generate_embeddings(chunks)
        
        # Prepare data for insertion
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        document_ids = [document_id] * len(chunks)
        chunk_indices = list(range(len(chunks)))
        texts = chunks
        filenames = [filename] * len(chunks)
        chatbot_ids = [chatbot_id] * len(chunks)
        user_ids = [user_id] * len(chunks)
        
        # Insert data
        data = [
            ids,
            document_ids,
            chunk_indices,
            texts,
            filenames,
            chatbot_ids,
            user_ids,
            embeddings
        ]
        
        collection.insert(data)
        collection.flush()  # Make sure data is written
        
        print(f"Added {len(chunks)} chunks to collection for chatbot {chatbot_id}")
        return len(chunks)
    
    def search(
        self,
        chatbot_id: str,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search for similar documents in a chatbot's collection.
        
        Args:
            chatbot_id: ID of the chatbot
            query_text: Search query
            top_k: Number of results to return
            filters: Optional metadata filters (e.g., {"filename": "doc.pdf"})
            
        Returns:
            List of dictionaries with 'text', 'metadata', 'score'
        """
        collection = self.get_collection(chatbot_id)
        
        if not collection:
            return []
        
        # Generate query embedding
        query_embedding = self.generate_embeddings([query_text])[0]
        
        # Build search parameters
        search_params = {
            "metric_type": "L2",
            "params": {"nprobe": 10}
        }
        
        # Build filter expression if provided
        expr = None
        if filters:
            filter_parts = []
            for key, value in filters.items():
                filter_parts.append(f'{key} == "{value}"')
            expr = " && ".join(filter_parts)
        
        # Search
        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=["text", "document_id", "chunk_index", "filename", "chatbot_id"]
        )
        
        # Format results
        formatted_results = []
        for hits in results:
            for hit in hits:
                formatted_results.append({
                    'text': hit.entity.get('text'),
                    'document_id': hit.entity.get('document_id'),
                    'chunk_index': hit.entity.get('chunk_index'),
                    'filename': hit.entity.get('filename'),
                    'score': hit.distance,
                    'metadata': {
                        'document_id': hit.entity.get('document_id'),
                        'chunk_index': hit.entity.get('chunk_index'),
                        'filename': hit.entity.get('filename'),
                        'chatbot_id': hit.entity.get('chatbot_id'),
                    }
                })
        
        return formatted_results
    
    def delete_collection(self, chatbot_id: str):
        """Delete a chatbot's collection (when chatbot is deleted)"""
        collection_name = self.get_collection_name(chatbot_id)
        
        try:
            if utility.has_collection(collection_name):
                utility.drop_collection(collection_name)
                print(f"Deleted collection: {collection_name}")
        except MilvusException:
            # Collection doesn't exist, nothing to delete
            pass
    
    def delete_document(self, chatbot_id: str, document_id: str):
        """Delete all chunks for a specific document"""
        collection = self.get_collection(chatbot_id)
        
        if not collection:
            return
        
        # Delete by document_id
        expr = f'document_id == "{document_id}"'
        collection.delete(expr)
        collection.flush()
        
        print(f"Deleted document {document_id} from chatbot {chatbot_id}")
    
    def get_collection_stats(self, chatbot_id: str) -> Dict:
        """Get statistics about a collection"""
        collection = self.get_collection(chatbot_id)
        
        if not collection:
            return {"num_entities": 0}
        
        return {
            "num_entities": collection.num_entities,
            "collection_name": collection.name
        }


# Singleton instance
zilliz_service = ZillizService()

