"""Chat service for handling chatbot conversations via RAG."""

from typing import List, Dict, Any, Optional, Generator
from openai import OpenAI

from app.core.config import (
    OPENAI_API_KEY,
    CHAT_MODEL,
    CHAT_SYSTEM_PROMPT,
    MAX_CONTEXT_MESSAGES,
    RELEVANCE_THRESHOLD_L2,
    CHAT_TOP_K,
    CHAT_LIST_QUERY_TOP_K,
    CHAT_MAX_TOKENS,
    CHAT_TEMPERATURE,
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

    @staticmethod
    def _is_list_query(message: str) -> bool:
        """True if the user is likely asking for a full list (e.g. services, offerings)."""
        lower = message.strip().lower()
        # Don't treat follow-up calculations as list requests (use conversation history instead)
        if any(p in lower for p in ("add up", "add them", "sum ", "total", "calculate", "multiply", "average", "how much in total")):
            return False
        list_phrases = (
            "service", "offering", "offer", "provide", "list", "all ",
            "what do you", "what do we", "what are the", "tell me about your",
            "what else", "else do you", "anything else", "other ", "options",
            "products", "menu"
        )
        return any(p in lower for p in list_phrases)

    @staticmethod
    def _is_follow_up_calculation(message: str) -> bool:
        """True if the user is asking to do something with previous content (add, sum, total, etc.)."""
        lower = message.strip().lower()
        return any(p in lower for p in (
            "add up", "add them", "add all", "sum ", "total", "calculate",
            "multiply", "average", "how much in total", "what's the total",
            "whats the total", "give me the total"
        ))

    @staticmethod
    def _is_greeting_or_small_talk(message: str) -> bool:
        """True if the message is just a greeting or casual small talk (no real question)."""
        lower = message.strip().lower().rstrip("?!.")
        # Avoid matching "what's up with your refund policy"
        if len(lower) > 45:
            return False
        greeting_phrases = (
            "hi", "hello", "hey", "hola", "yo", "sup", "what's up", "whats up",
            "how are you", "how do you do", "good morning", "good afternoon", "good evening",
            "what's good", "whats good", "how's it going", "hows it going",
            "greetings", "hi there", "hello there", "hey there", "howdy", "hiya"
        )
        return any(
            lower == p or lower == p + "!" or
            lower.startswith(p + " ") or lower.endswith(" " + p)
            for p in greeting_phrases
        )

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

        # Use more chunks for list-type questions so we don't miss any item
        effective_top_k = CHAT_LIST_QUERY_TOP_K if self._is_list_query(message) else top_k

        context_blocks: List[str] = []
        profile_lines = [f"Chatbot Name: {chatbot_name}"]
        if chatbot_purpose:
            profile_lines.append(f"Purpose: {chatbot_purpose}")
        context_blocks.append("Bot Profile:\n" + "\n".join(profile_lines))

        sources: List[Dict[str, Any]] = []

        search_results = self.zilliz_service.search(
            chatbot_id=chatbot_id,
            query_text=message,
            top_k=effective_top_k,
        )
        # L2 distance: lower is better; keep results below threshold
        relevant_results = [
            r for r in search_results
            if r.get("score") is not None and r["score"] < RELEVANCE_THRESHOLD_L2
        ]
        # For list queries, if we filtered too much, keep more results so we have full coverage
        if not relevant_results and search_results:
            relevant_results = search_results[: max(3, effective_top_k // 2)]
        elif self._is_list_query(message) and len(relevant_results) < len(search_results):
            # Include slightly weaker matches so we don't miss a service in a chunk
            threshold_loose = min(RELEVANCE_THRESHOLD_L2 + 0.3, 2.0)
            extra = [r for r in search_results if r.get("score") is not None and RELEVANCE_THRESHOLD_L2 <= r["score"] < threshold_loose]
            for r in extra:
                if r not in relevant_results:
                    relevant_results.append(r)

        for idx, result in enumerate(relevant_results, start=1):
            text = result.get("text", "")
            if text:
                fn = result.get("filename") or "document"
                context_blocks.append(f"[Excerpt {idx} from {fn}]\n{text.strip()}")

            sources.append(
                {
                    "filename": result.get("filename"),
                    "document_id": result.get("document_id"),
                    "chunk_index": result.get("chunk_index"),
                    "score": result.get("score"),
                }
            )

        if not relevant_results:
            if self._is_greeting_or_small_talk(message):
                context_blocks.append(
                    "[The user is greeting or making small talk. Reply with a brief, friendly response and offer to help. You do not need document content for this.]"
                )
            else:
                context_blocks.append(
                    "No relevant document context was found for this question."
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

        list_instruction = ""
        if self._is_list_query(message):
            list_instruction = (
                "This question asks for a full list. Go through every excerpt above, collect every distinct item of that type, and list every one. Complete list only.\n\n"
            )
        follow_up_instruction = ""
        if history and self._is_follow_up_calculation(message):
            follow_up_instruction = (
                "The user is asking a follow-up that needs reasoning on previous content (e.g. add, sum, total). "
                "Use the conversation history above (especially your last reply) as the data, then compute and give the answer. Do not repeat the full list.\n\n"
            )
        user_content = (
            "Document excerpts and conversation history (your source of facts):\n\n"
            f"{context_string}\n\n"
            "---\n\n"
            f"User question: {message.strip()}\n\n"
            f"{list_instruction}{follow_up_instruction}"
            "Answer using the excerpts and conversation. For lists, give the complete list; for reasoning (totals, comparisons), use the data above and compute; otherwise answer from the text or say you don't have that information."
        )

        messages.append({"role": "user", "content": user_content})

        return {
            "messages": messages,
            "sources": sources,
            "chunks_used": len(relevant_results),
        }

    def chat(
        self,
        chatbot_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        top_k: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate a chatbot response using retrieved context and OpenAI chat model."""
        k = top_k if top_k is not None else CHAT_TOP_K

        payload = self._build_messages(
            chatbot_id=chatbot_id,
            message=message,
            history=history,
            top_k=k,
        )

        try:
            response = self.client.chat.completions.create(
                model=CHAT_MODEL,
                messages=payload["messages"],
                temperature=CHAT_TEMPERATURE,
                max_tokens=CHAT_MAX_TOKENS,
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
        top_k: Optional[int] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream a chatbot response token-by-token."""
        k = top_k if top_k is not None else CHAT_TOP_K
        payload = self._build_messages(
            chatbot_id=chatbot_id,
            message=message,
            history=history,
            top_k=k,
        )

        try:
            stream = self.client.chat.completions.create(
                model=CHAT_MODEL,
                messages=payload["messages"],
                temperature=CHAT_TEMPERATURE,
                max_tokens=CHAT_MAX_TOKENS,
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


