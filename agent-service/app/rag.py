"""Retrieval-Augmented Generation: ingest portfolio content and arbitrary docs."""
import io
from typing import Any

from pypdf import PdfReader

from app import db, vectorstore


def _pdf_text(raw: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""


def _file_id_from_url(url: str) -> str:
    return url.split("/api/files/")[1].split("?")[0] if "/api/files/" in (url or "") else ""


def chunk_text(text: str, size: int = 1000, overlap: int = 150) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start = end - overlap
        if start < 0:
            start = 0
    return chunks


def _project_text(p: dict[str, Any]) -> str:
    assets = p.get("assets", []) or []
    asset_names = ", ".join(a.get("name", a.get("type", "file")) for a in assets)
    parts = [
        f"Project: {p.get('title', '')}",
        f"Type: {p.get('type', '')}",
        f"Status: {'published' if p.get('published') else 'unpublished/draft'}",
        f"Summary: {p.get('summary', '')}",
        f"About: {p.get('about', '')}",
        f"Impact: {p.get('impact', '')}",
        f"Learnings: {p.get('learning', '')}",
        f"Skills and tools used: {', '.join(p.get('skillsUsed', []))}",
        f"Demo link: {p.get('demoLink', '')}",
        f"GitHub link: {p.get('githubLink', '')}",
        f"Attached files: {asset_names}" if asset_names else "",
    ]
    return "\n".join(x for x in parts if x)


def _blog_text(b: dict[str, Any]) -> str:
    tags = ", ".join(b.get("tags", []))
    return f"Blog: {b.get('title', '')}\nTags: {tags}\n{b.get('excerpt', '')}\n{b.get('content', '')}"


def _profile_text(profile: dict[str, Any]) -> str:
    socials = "; ".join(
        f"{s.get('platform', '')}: {s.get('url', '')}" for s in profile.get("socials", [])
    )
    education = "; ".join(
        f"{e.get('level', '')} {e.get('course', '')} at {e.get('institution', '')} "
        f"({e.get('startYear', '')}-{e.get('endYear', '')})"
        for e in profile.get("education", [])
    )
    parts = [
        f"Name: {profile.get('fullName', '')}",
        f"Headline: {profile.get('headline', '')}",
        f"Location: {profile.get('location', '')}",
        f"Contact email: {profile.get('contactEmail', '')}",
        f"About: {profile.get('aboutMe', '')}",
        f"Social profiles: {socials}" if socials else "",
        f"Education: {education}" if education else "",
    ]
    return "\n".join(x for x in parts if x)


def _skills_text(skills: list[dict[str, Any]]) -> str:
    by_cat: dict[str, list[str]] = {}
    for s in skills:
        by_cat.setdefault(s.get("category", "General"), []).append(
            f"{s.get('name', '')} ({s.get('level', '')}%)"
        )
    lines = [f"{cat}: {', '.join(items)}" for cat, items in by_cat.items()]
    return "Skills and tools (with proficiency):\n" + "\n".join(lines)


def _make_docs(
    source_id: str, title: str, kind: str, text: str, id_prefix: str | None = None
) -> list[dict[str, Any]]:
    prefix = id_prefix or source_id
    return [
        {
            "id": f"{prefix}:{i}",
            "text": chunk,
            "metadata": {"source_id": source_id, "title": title, "kind": kind},
        }
        for i, chunk in enumerate(chunk_text(text))
    ]


def ingest_portfolio() -> dict[str, int]:
    """(Re)ingest the ENTIRE portfolio DB into the vector store: projects (metadata +
    attached PDF file contents), blogs, the full profile, and skills."""
    total = 0
    counts = {"projects": 0, "project_files": 0, "blogs": 0, "profile": 0, "skills": 0}

    for p in db.get_projects(published_only=False):
        vectorstore.delete_by_source(p["_id"])
        title = p.get("title", "Project")
        docs = _make_docs(p["_id"], title, "project", _project_text(p))

        # Read the text of any attached PDF files (stored in GridFS) so the bot can
        # answer from project documents too. Same source_id → cleared on re-ingest.
        for a in p.get("assets", []) or []:
            is_pdf = a.get("type") == "pdf" or a.get("mimeType") == "application/pdf"
            file_id = _file_id_from_url(a.get("url", ""))
            if is_pdf and file_id:
                raw = db.read_gridfs_file(file_id)
                text = _pdf_text(raw) if raw else ""
                if text.strip():
                    docs += _make_docs(
                        p["_id"],
                        f"{title} — {a.get('name', 'document')}",
                        "project_file",
                        text,
                        id_prefix=f"{p['_id']}:file:{file_id}",
                    )
                    counts["project_files"] += 1

        total += vectorstore.add_documents(docs)
        counts["projects"] += 1

    for b in db.get_blogs(published_only=False):
        vectorstore.delete_by_source(b["_id"])
        total += vectorstore.add_documents(
            _make_docs(b["_id"], b.get("title", "Blog"), "blog", _blog_text(b))
        )
        counts["blogs"] += 1

    profile = db.get_profile()
    if profile:
        vectorstore.delete_by_source("profile")
        total += vectorstore.add_documents(
            _make_docs("profile", "Personal information", "profile", _profile_text(profile))
        )
        counts["profile"] = 1

    skills = db.get_skills()
    if skills:
        vectorstore.delete_by_source("skills")
        total += vectorstore.add_documents(
            _make_docs("skills", "Skills", "skills", _skills_text(skills))
        )
        counts["skills"] = len(skills)

    counts["chunks"] = total
    return counts


def ingest_document(source_id: str, title: str, text: str, kind: str = "document") -> int:
    """Ingest an arbitrary document (e.g. an uploaded PDF's extracted text)."""
    vectorstore.delete_by_source(source_id)
    return vectorstore.add_documents(_make_docs(source_id, title, kind, text))


def retrieve(question: str, k: int = 5) -> tuple[str, list[dict[str, str]]]:
    """Return a context string and a list of {title, kind} sources for a question."""
    hits = vectorstore.query(question, k=k)
    if not hits:
        return "", []
    context_parts: list[str] = []
    sources: list[dict[str, str]] = []
    seen: set[str] = set()
    for h in hits:
        meta = h["metadata"]
        context_parts.append(h["text"])
        key = f"{meta.get('title')}|{meta.get('kind')}"
        if key not in seen:
            seen.add(key)
            sources.append({"title": meta.get("title", "Source"), "type": meta.get("kind", "doc")})
    return "\n\n---\n\n".join(context_parts), sources
