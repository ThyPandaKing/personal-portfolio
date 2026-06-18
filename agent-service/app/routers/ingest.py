import io

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader

from app import rag, vectorstore
from app.schemas import DocumentIngestRequest, IngestResponse, StatusResponse
from app.security import require_internal_key

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_internal_key)])


@router.get("/status", response_model=StatusResponse)
def status() -> StatusResponse:
    from app.config import get_settings

    job = rag.ingest_status
    return StatusResponse(
        indexed_chunks=vectorstore.collection_count(),
        collection=get_settings().vector_collection,
        ingest_state=job.get("state", "idle"),
        ingest_detail=job.get("detail"),
        ingest_error=job.get("error"),
    )


@router.post("/portfolio", response_model=IngestResponse)
def ingest_portfolio(background_tasks: BackgroundTasks) -> IngestResponse:
    """Kick off a full re-ingest in the background and return immediately.

    The work (and any rate-limit retries) runs after the response is sent; poll
    GET /ingest/status for progress and the final chunk counts.
    """
    background_tasks.add_task(rag.run_portfolio_ingest_job)
    return IngestResponse(ok=True, chunks=0, detail={"status": "started"})


@router.post("/document", response_model=IngestResponse)
def ingest_document(req: DocumentIngestRequest) -> IngestResponse:
    source_id = req.source_id or f"doc:{req.title}"
    n = rag.ingest_document(source_id, req.title, req.text, kind="document")
    return IngestResponse(ok=True, chunks=n)


@router.post("/pdf", response_model=IngestResponse)
async def ingest_pdf(
    file: UploadFile = File(...),
    title: str = Form(""),
) -> IngestResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    raw = await file.read()
    try:
        reader = PdfReader(io.BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}") from exc
    if not text.strip():
        raise HTTPException(status_code=400, detail="No extractable text in PDF")

    doc_title = title or file.filename or "Document"
    n = rag.ingest_document(f"pdf:{doc_title}", doc_title, text, kind="pdf")
    return IngestResponse(ok=True, chunks=n)


@router.post("/reset", response_model=IngestResponse)
def reset() -> IngestResponse:
    vectorstore.reset_collection()
    return IngestResponse(ok=True, chunks=0)
