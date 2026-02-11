"""
Authentication helpers for FastAPI endpoints.

We validate Supabase access tokens sent via:
  Authorization: Bearer <access_token>
"""

from __future__ import annotations

from typing import Any, Dict, Optional, TYPE_CHECKING

from fastapi import Depends, Header, HTTPException, status
try:
    # Some editor environments may not have backend deps installed.
    # Keep runtime behavior the same while avoiding hard import failures in tooling.
    from supabase import Client, create_client  # type: ignore[import-not-found]
except Exception:  # pylint: disable=broad-except
    if TYPE_CHECKING:
        from supabase import Client, create_client  # type: ignore[import-not-found]
    else:
        Client = Any  # type: ignore[misc,assignment]

        def create_client(*_args: Any, **_kwargs: Any) -> Any:  # type: ignore[override]
            raise RuntimeError(
                "supabase package is not available. Install backend dependencies before running the API."
            )

from app.core.config import SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL
from app.services.supabase_service import SupabaseService


def _get_auth_client() -> Client:
    """
    Create a Supabase client capable of calling GoTrue endpoints.

    For /auth/v1/user we need a Supabase API key in the apikey header.
    The anon key is preferred; we fall back to service key if needed.
    """

    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL must be set in environment variables")

    api_key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY
    if not api_key:
        raise ValueError("SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY must be set in environment variables")

    return create_client(SUPABASE_URL, api_key)


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header (expected: Bearer <token>)",
        )
    return parts[1].strip()


def require_supabase_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """
    Validate the Supabase access token and return the user object (dict-like).
    """

    token = _extract_bearer_token(authorization)
    client = _get_auth_client()

    try:
        # supabase-py returns an AuthResponse-like object with .user
        auth_resp = client.auth.get_user(token)
        user = getattr(auth_resp, "user", None)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # Normalize to plain dict for easier downstream use
    if hasattr(user, "model_dump"):
        return user.model_dump()
    if hasattr(user, "dict"):
        return user.dict()
    return user  # type: ignore[return-value]


def require_chatbot_owner(
    chatbot_id: str,
    user: Dict[str, Any] = Depends(require_supabase_user),
) -> Dict[str, Any]:
    """
    Ensure the authenticated user owns the chatbot_id.
    Returns the user dict if authorized.
    """

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    supabase_service = SupabaseService()
    chatbot = supabase_service.get_chatbot_for_user(chatbot_id=chatbot_id, user_id=user_id)
    if not chatbot:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this chatbot")

    return user
