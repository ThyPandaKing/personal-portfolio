"""Gemini chat model and embeddings, with multi-model fallback.

If the primary model is down/over quota, we retry the next model in the chain
(up to 3 attempts total). If every attempt fails, LLMUnavailableError is raised
with the reasoning from each attempt so the caller can surface it.
"""
import logging
from functools import lru_cache
from typing import Callable, TypeVar

from langchain_google_genai import (
    ChatGoogleGenerativeAI,
    GoogleGenerativeAIEmbeddings,
)

from app.config import get_settings

logger = logging.getLogger("agent.llm")

T = TypeVar("T")


class LLMUnavailableError(RuntimeError):
    """Raised when every Gemini model in the fallback chain fails."""


def message_text(msg: object) -> str:
    """Extract plain text from a LangChain message or raw content.

    langchain-core 1.x / Gemini 2.5+ return `content` as a list of content
    blocks (e.g. [{'type': 'text', 'text': '...'}, {'extras': {...}}]) instead
    of a plain string, so concatenate the text blocks into a string.
    """
    content = getattr(msg, "content", msg)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        text = "\n".join(p for p in parts if p).strip()
        if text:
            return text
    return str(content)


def build_chat_model(model_name: str, temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.google_api_key,
        temperature=temperature,
    )


def get_chat_model(temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    """The primary model (first in the chain). Kept for direct, single-model use."""
    return build_chat_model(get_settings().model_chain[0], temperature)


def invoke_with_fallback(
    run: Callable[[ChatGoogleGenerativeAI], T],
    *,
    temperature: float = 0.3,
    max_attempts: int = 3,
) -> T:
    """Run `run(model)` against each model in the chain until one succeeds.

    Tries up to `max_attempts` different models. On total failure raises
    LLMUnavailableError aggregating the reason each model failed.
    """
    chain = get_settings().model_chain[:max_attempts]
    errors: list[str] = []
    for model_name in chain:
        try:
            result = run(build_chat_model(model_name, temperature))
            if errors:
                logger.info("Recovered using fallback model '%s'", model_name)
            return result
        except Exception as exc:  # noqa: BLE001 — we record and try the next model
            logger.warning("Gemini model '%s' failed: %s", model_name, exc)
            errors.append(f"{model_name} → {type(exc).__name__}: {exc}")

    raise LLMUnavailableError(
        f"All {len(errors)} Gemini model attempt(s) failed:\n" + "\n".join(errors)
    )


@lru_cache
def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    # Embeddings are NOT part of the fallback chain on purpose: mixing embedding
    # models would corrupt the vector space stored in MongoDB.
    settings = get_settings()
    return GoogleGenerativeAIEmbeddings(
        model=settings.gemini_embed_model,
        google_api_key=settings.google_api_key,
    )
