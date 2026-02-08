"""Chat service for handling chatbot conversations via RAG."""

from typing import List, Dict, Any, Optional, Generator
from openai import OpenAI

from app.core.config import (
    OPENAI_API_KEY,
    CHAT_MODEL,
    CHAT_SYSTEM_PROMPT,
    MAX_CONTEXT_MESSAGES,
)
from app.services.zilliz_service import zilliz_service
from app.services.supabase_service import SupabaseService


class ChatService:
    """Service orchestrating retrieval and generation for chatbot conversations."""

    def __init__(self):
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set. Please configure it in your environment.")

        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.zilliz_service = zilliz_service
        self.supabase_service = SupabaseService()

    def _build_messages(
        self,
        *,
        chatbot_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]],
        top_k: int,
    ) -> Dict[str, Any]:
        if not message or not message.strip():
            raise ValueError("Message cannot be empty")

        chatbot = self.supabase_service.get_chatbot(chatbot_id)
        if not chatbot:
            raise ValueError("Chatbot not found")

        chatbot_name = chatbot.get("name", "your assistant")
        chatbot_purpose = chatbot.get("purpose")

        context_blocks: List[str] = []
        profile_lines = [f"Chatbot Name: {chatbot_name}"]
        if chatbot_purpose:
            profile_lines.append(f"Purpose: {chatbot_purpose}")
        context_blocks.append("Bot Profile:\n" + "\n".join(profile_lines))

        sources: List[Dict[str, Any]] = []

        search_results = self.zilliz_service.search(
            chatbot_id=chatbot_id,
            query_text=message,
            top_k=top_k,
        )

        for idx, result in enumerate(search_results, start=1):
            text = result.get("text", "")
            if text:
                context_blocks.append(f"Source {idx}://\n{text}")

            sources.append(
                {
                    "filename": result.get("filename"),
                    "document_id": result.get("document_id"),
                    "chunk_index": result.get("chunk_index"),
                    "score": result.get("score"),
                }
            )

        context_string = "\n\n".join(context_blocks)

        system_prompt = CHAT_SYSTEM_PROMPT.format(
            chatbot_name=chatbot_name,
            chatbot_purpose=chatbot_purpose or "helping with the chatbot's knowledge base",
        )

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt},
        ]

        if history:
            trimmed_history = history[-MAX_CONTEXT_MESSAGES:]
            for entry in trimmed_history:
                role = entry.get("role")
                content = entry.get("content")
                if role in {"user", "assistant"} and content:
                    messages.append({"role": role, "content": content})

        user_content = (
            "Here is additional context about the chatbot and its knowledge base. "
            "Use it together with our conversation so far to answer the user's question as accurately and helpfully as possible.\n\n"
            f"Context:\n{context_string}\n\n"
            f"User question: {message.strip()}"
        )

        messages.append({"role": "user", "content": user_content})

        return {
            "messages": messages,
            "sources": sources,
            "chunks_used": len(search_results),
        }

    def chat(
        self,
        chatbot_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """Generate a chatbot response using retrieved context and OpenAI chat model."""

        payload = self._build_messages(
            chatbot_id=chatbot_id,
            message=message,
            history=history,
            top_k=top_k,
        )

        try:
            response = self.client.chat.completions.create(
                model=CHAT_MODEL,
                messages=payload["messages"],
                temperature=0.7,
                max_tokens=600,
            )
        except Exception as exc:
            raise Exception(f"OpenAI chat completion failed: {exc}")

        reply = response.choices[0].message.content.strip()

        return {
            "response": reply,
            "sources": payload["sources"],
            "chunks_used": payload["chunks_used"],
            "chatbot_id": chatbot_id,
        }

    def chat_stream(
        self,
        chatbot_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 5,
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream a chatbot response token-by-token."""

        payload = self._build_messages(
            chatbot_id=chatbot_id,
            message=message,
            history=history,
            top_k=top_k,
        )

        try:
            stream = self.client.chat.completions.create(
                model=CHAT_MODEL,
                messages=payload["messages"],
                temperature=0.7,
                max_tokens=600,
                stream=True,
            )
        except Exception as exc:
            raise Exception(f"OpenAI chat completion failed: {exc}")

        accumulated_chunks: List[str] = []

        for event in stream:
            if not event.choices:
                continue

            delta = event.choices[0].delta.content or ""
            if delta:
                accumulated_chunks.append(delta)
                yield {
                    "type": "delta",
                    "data": delta,
                }

        full_response = "".join(accumulated_chunks).strip()

        yield {
            "type": "final",
            "data": {
                "response": full_response,
                "sources": payload["sources"],
                "chunks_used": payload["chunks_used"],
                "chatbot_id": chatbot_id,
            },
        }


# Singleton instance for reuse
chat_service = ChatService()


