from fastapi import APIRouter, Depends, HTTPException

from app.resume import generate_resume
from app.schemas import ResumeGenerateRequest, ResumeGenerateResponse
from app.security import require_internal_key

router = APIRouter(prefix="/resume", tags=["resume"], dependencies=[Depends(require_internal_key)])


@router.post("/generate", response_model=ResumeGenerateResponse)
def generate(req: ResumeGenerateRequest) -> ResumeGenerateResponse:
    try:
        content = generate_resume(
            role=req.role,
            project_ids=req.project_ids,
            skills=req.skills,
            instructions=req.instructions,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Resume generation failed: {exc}") from exc
    return ResumeGenerateResponse(content=content)
