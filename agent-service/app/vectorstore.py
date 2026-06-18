"""Vector store backed by MongoDB Atlas Vector Search.

Vectors live in the SAME MongoDB database as the rest of the portfolio data —
there is no separate vector database. Embeddings are produced with Gemini and
stored on documents in the `vector_collection`; similarity search uses the
`$vectorSearch` aggregation stage against an Atlas Vector Search index.
"""
import logging
import time
from typing import Any

from pymongo import ReplaceOne
from pymongo.operations import SearchIndexModel

from app.config import get_settings
from app.db import get_db
from app.llm import get_embeddings

logger = logging.getLogger("agent.vectorstore")

_index_checked = False


def _is_rate_limit_error(exc: BaseException) -> bool:
    """Detect Gemini/Google rate-limit (429 / quota) errors across wrapper layers."""
    status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if status == 429:
        return True
    text = str(exc).lower()
    return any(
        s in text
        for s in ("429", "resource_exhausted", "rate limit", "quota", "too many requests")
    )


def _retry_after_seconds(exc: BaseException, default: float) -> float:
    """Honor a server-provided retry delay if present, else use the supplied backoff."""
    retry_delay = getattr(exc, "retry_after", None)
    if isinstance(retry_delay, (int, float)) and retry_delay > 0:
        return float(retry_delay)
    return default


def _embed_documents_with_retry(texts: list[str]) -> list[list[float]]:
    """Embed texts in batches, retrying each batch with exponential backoff on 429s.

    Embeddings are deliberately not part of the chat model fallback chain, so this
    is where free-tier rate limits are absorbed instead of bubbling up as a 500.
    """
    settings = get_settings()
    embeddings = get_embeddings()
    batch_size = max(1, settings.embed_batch_size)
    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        delay = settings.embed_retry_base_delay
        for attempt in range(1, settings.embed_max_retries + 1):
            try:
                vectors.extend(embeddings.embed_documents(batch))
                break
            except Exception as exc:  # noqa: BLE001
                if not _is_rate_limit_error(exc) or attempt == settings.embed_max_retries:
                    raise
                wait = _retry_after_seconds(exc, delay)
                logger.warning(
                    "Embedding rate-limited (batch at %d, attempt %d/%d); retrying in %.1fs: %s",
                    start, attempt, settings.embed_max_retries, wait, exc,
                )
                time.sleep(wait)
                delay = min(delay * 2, 60.0)
    return vectors


def _collection():
    return get_db()[get_settings().vector_collection]


def ensure_index() -> None:
    """Create the Atlas Vector Search index if it's missing (idempotent, once per process)."""
    global _index_checked
    if _index_checked:
        return
    settings = get_settings()
    col = _collection()
    try:
        names = {ix.get("name") for ix in col.list_search_indexes()}
        if settings.vector_index not in names:
            col.create_search_index(
                model=SearchIndexModel(
                    name=settings.vector_index,
                    type="vectorSearch",
                    definition={
                        "fields": [
                            {
                                "type": "vector",
                                "path": "embedding",
                                "numDimensions": settings.embed_dims,
                                "similarity": "cosine",
                            },
                            {"type": "filter", "path": "metadata.source_id"},
                        ]
                    },
                )
            )
            logger.info("Created Atlas Vector Search index '%s'", settings.vector_index)
        _index_checked = True
    except Exception as exc:  # noqa: BLE001 — non-Atlas / perms; queries degrade gracefully
        logger.warning("Could not ensure vector index: %s", exc)


def add_documents(docs: list[dict[str, Any]]) -> int:
    """docs: list of {id, text, metadata}. Embeds with Gemini and upserts."""
    if not docs:
        return 0
    vectors = _embed_documents_with_retry([d["text"] for d in docs])
    ops = [
        ReplaceOne(
            {"_id": d["id"]},
            {
                "_id": d["id"],
                "text": d["text"],
                "embedding": vector,
                "metadata": d.get("metadata", {}),
            },
            upsert=True,
        )
        for d, vector in zip(docs, vectors)
    ]
    _collection().bulk_write(ops)
    # Create the search index after the collection exists (Atlas requires it).
    ensure_index()
    return len(docs)


def query(text: str, k: int = 5) -> list[dict[str, Any]]:
    col = _collection()
    if col.estimated_document_count() == 0:
        return []
    settings = get_settings()
    vector = get_embeddings().embed_query(text)
    pipeline = [
        {
            "$vectorSearch": {
                "index": settings.vector_index,
                "path": "embedding",
                "queryVector": vector,
                "numCandidates": max(k * 10, 100),
                "limit": k,
            }
        },
        {"$project": {"_id": 0, "text": 1, "metadata": 1, "score": {"$meta": "vectorSearchScore"}}},
    ]
    try:
        results = list(col.aggregate(pipeline))
    except Exception as exc:  # noqa: BLE001 — e.g. index still building
        logger.warning("Vector search failed (index not ready?): %s", exc)
        return []
    return [
        {
            "text": doc.get("text", ""),
            "metadata": doc.get("metadata", {}),
            "distance": 1.0 - float(doc.get("score", 0.0)),
        }
        for doc in results
    ]


def delete_by_source(source: str) -> None:
    """Remove all chunks belonging to one source (e.g. a project id) before re-ingest."""
    _collection().delete_many({"metadata.source_id": source})


def reset_collection() -> None:
    _collection().delete_many({})


def collection_count() -> int:
    try:
        return _collection().count_documents({})
    except Exception:  # noqa: BLE001
        return 0
