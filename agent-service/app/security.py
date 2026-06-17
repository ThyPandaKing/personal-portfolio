"""Shared-secret auth so only the Node backend can call admin-only endpoints."""
from fastapi import Header, HTTPException, status

from app.config import get_settings


def require_internal_key(x_internal_key: str = Header(default="")) -> None:
    settings = get_settings()
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
