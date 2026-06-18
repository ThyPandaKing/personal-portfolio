from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8001
    allowed_origins: str = "http://localhost:3000,http://localhost:4000,http://localhost:5173"

    google_api_key: str = ""
    # Primary model. For a fallback chain, set GEMINI_MODELS (comma-separated).
    gemini_model: str = "gemini-1.5-flash"
    gemini_models: str = ""
    gemini_embed_model: str = "models/gemini-embedding-001"

    mongo_uri: str = "mongodb://localhost:27017/portfolio"
    mongo_db: str = "portfolio"

    # Collection names — must match backend/src/config/collections.ts
    col_profile: str = "portfolio_profile"
    col_skills: str = "portfolio_skills"
    col_projects: str = "portfolio_projects"
    col_blogs: str = "portfolio_blogs"

    # Vector search lives in the SAME MongoDB database via Atlas Vector Search.
    vector_collection: str = "portfolio_vectors"
    vector_index: str = "vector_index"
    embed_dims: int = 3072  # Gemini models/gemini-embedding-001 → 3072 dimensions

    # Embedding is rate-limited on the Gemini free tier, so re-ingest embeds in
    # batches and retries each batch with exponential backoff on 429s.
    embed_batch_size: int = 50
    embed_max_retries: int = 5
    embed_retry_base_delay: float = 2.0  # seconds; doubles each retry, capped at 60

    internal_api_key: str = "change-me-shared-with-backend"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def model_chain(self) -> list[str]:
        """Ordered list of Gemini models to try (with fallbacks for resilience)."""
        raw = self.gemini_models.strip() or self.gemini_model
        models: list[str] = []
        for m in raw.split(","):
            m = m.strip()
            if m and m not in models:
                models.append(m)
        # Ensure a couple of currently-available free models are present as
        # last-resort fallbacks. (gemini-1.5-* has been retired; "*-latest"
        # always points at a live model.)
        for fallback in ("gemini-2.5-flash", "gemini-flash-latest"):
            if fallback not in models:
                models.append(fallback)
        return models


@lru_cache
def get_settings() -> Settings:
    return Settings()
