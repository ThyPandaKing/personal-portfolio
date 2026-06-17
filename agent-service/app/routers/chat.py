from fastapi import APIRouter, HTTPException

from app.agent import run_agent
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        result = run_agent(
            req.message,
            [{"role": t.role, "content": t.content} for t in req.history],
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Agent error: {exc}") from exc
    return ChatResponse(answer=result["answer"], sources=result["sources"])
