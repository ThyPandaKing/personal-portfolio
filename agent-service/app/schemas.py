from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)


class Source(BaseModel):
    title: str
    type: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source] = Field(default_factory=list)


class DocumentIngestRequest(BaseModel):
    title: str = Field(min_length=1)
    text: str = Field(min_length=1)
    source_id: str | None = None


class IngestResponse(BaseModel):
    ok: bool = True
    chunks: int = 0
    detail: dict | None = None


class StatusResponse(BaseModel):
    indexed_chunks: int
    collection: str


class ResumeGenerateRequest(BaseModel):
    role: str = "SDE"
    project_ids: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    instructions: str = ""


class ResumeGenerateResponse(BaseModel):
    content: str
