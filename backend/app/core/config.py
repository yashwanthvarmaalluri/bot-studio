import os
from dotenv import load_dotenv

load_dotenv()

# Application
APP_NAME = os.getenv("APP_NAME", "RAG Chatbot Framework")
APP_ENV = os.getenv("APP_ENV", "development")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Zilliz Cloud (Serverless)
ZILLIZ_URI = os.getenv("ZILLIZ_URI", "")
ZILLIZ_TOKEN = os.getenv("ZILLIZ_TOKEN", "")

# Embeddings (OpenAI)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1536"))  # text-embedding-3-small outputs 1536-d vectors

# Chunking
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP_PERCENT = float(os.getenv("CHUNK_OVERLAP_PERCENT", "0.2"))

# CORS
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Chat LLM configuration
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")
MAX_CONTEXT_MESSAGES = int(os.getenv("MAX_CONTEXT_MESSAGES", "10"))
# Number of document chunks to retrieve per query
CHAT_TOP_K = int(os.getenv("CHAT_TOP_K", "12"))
# For "list services / what do you offer" type questions, retrieve more chunks so we don't miss any item
CHAT_LIST_QUERY_TOP_K = int(os.getenv("CHAT_LIST_QUERY_TOP_K", "25"))
# Max tokens for each reply (enough for listing many items, e.g. all services)
CHAT_MAX_TOKENS = int(os.getenv("CHAT_MAX_TOKENS", "1200"))
# Lower = more focused and consistent with documents; 0.3 works well for RAG
CHAT_TEMPERATURE = float(os.getenv("CHAT_TEMPERATURE", "0.3"))
# L2 distance threshold for retrieval: only use chunks with score below this (lower = more similar).
RELEVANCE_THRESHOLD_L2 = float(os.getenv("RELEVANCE_THRESHOLD_L2", "1.5"))
CHAT_SYSTEM_PROMPT = os.getenv(
    "CHAT_SYSTEM_PROMPT",
    (
        "You are {chatbot_name}. Your role: {chatbot_purpose}.\n\n"
        "You receive document excerpts and conversation history. They are your only source of facts—do not invent information.\n\n"
        "1) WHEN THE USER ASKS FOR \"ALL\" OR A FULL LIST (e.g. list everything, what do you offer, what are all the X): Go through every excerpt you are given, collect every distinct item of that kind, and list every single one. Do not summarize or stop after a few—include every one that appears in the excerpts. Complete list every time.\n\n"
        "2) WHEN THE QUESTION IS ABOUT THE DOCUMENT BUT NEEDS REASONING (totals, comparisons, \"which is cheaper\", \"add the prices\", \"summarize\", \"how many\"): Use the excerpts and conversation as your data source. Use your reasoning to compute, compare, or derive the answer (e.g. add numbers, pick the best option). The facts come from the document; the reasoning is yours. If the user refers to your previous reply (e.g. \"add those up\"), use the conversation history to get the numbers, then answer.\n\n"
        "3) GREETINGS: If the message is only a greeting or small talk (hi, hello, what's up, etc.), reply with a brief friendly greeting and offer to help. Do not say you don't have that information.\n\n"
        "4) OTHERWISE: Answer from the excerpts. If the excerpts do not contain the answer (or you see 'No relevant document context was found'), say you can only answer from the uploaded documents and don't have that information.\n\n"
        "5) Do not mention 'excerpts' or 'documents' in your reply. Answer naturally."
    ),
)


