"""Chat API routes."""

import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.chat_service import chat_service


router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatHistoryItem(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryItem]] = None


class ChatResponse(BaseModel):
    response: str
    sources: List[dict]
    chunks_used: int
    chatbot_id: str


@router.post("/{chatbot_id}", response_model=ChatResponse)
async def chat(chatbot_id: str, payload: ChatRequest):
    """Handle chat requests for a chatbot."""
    try:
        result = chat_service.chat(
            chatbot_id=chatbot_id,
            message=payload.message,
            history=[item.dict() for item in (payload.history or [])],
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{chatbot_id}/health")
async def chat_health(chatbot_id: str):
    """Basic health endpoint to determine if chatbot has indexed data."""
    stats = chat_service.zilliz_service.get_collection_stats(chatbot_id)
    return {
        "chatbot_id": chatbot_id,
        "ready": stats.get("num_entities", 0) > 0,
        "chunks_indexed": stats.get("num_entities", 0),
    }


@router.post("/{chatbot_id}/stream")
async def chat_stream(chatbot_id: str, payload: ChatRequest):
    """Stream chat responses token by token."""
    try:
        stream_generator = chat_service.chat_stream(
            chatbot_id=chatbot_id,
            message=payload.message,
            history=[item.dict() for item in (payload.history or [])],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    def event_stream():
        try:
            for chunk in stream_generator:
                yield json.dumps(chunk) + "\n"
        except Exception as exc:  # pylint: disable=broad-except
            yield json.dumps({"type": "error", "message": str(exc)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

