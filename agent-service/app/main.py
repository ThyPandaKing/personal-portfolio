from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import chat, ingest, resume

settings = get_settings()

app = FastAPI(title="Portfolio Agent Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agent-service"}


app.include_router(chat.router)
app.include_router(ingest.router)
app.include_router(resume.router)
