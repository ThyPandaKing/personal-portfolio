"""LangGraph ReAct agent that answers questions about the portfolio.

Tools give it live DB access and RAG retrieval over projects, blogs and docs.
"""
import json
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app import db, rag
from app.llm import LLMUnavailableError, invoke_with_fallback, message_text

SYSTEM_PROMPT = (
    "You are the friendly AI assistant embedded in a personal portfolio website. "
    "You answer visitors' questions about the owner's projects, skills, experience and writing. "
    "Always ground your answers in the tools provided — call search_portfolio_docs for details "
    "about projects/blogs, list_projects to enumerate work, and get_profile_summary for bio/skills. "
    "Be concise, warm and specific. If the information isn't available, say so honestly and suggest "
    "using the contact options. Never invent projects, employers, or facts."
    ""
)


@tool
def search_portfolio_docs(query: str) -> str:
    """Search the owner's projects, blogs and documents for information relevant to the query."""
    try:
        context, sources = rag.retrieve(query, k=5)
    except Exception as exc:  # noqa: BLE001 — never crash the chat over a tool failure
        return f"(Document search is temporarily unavailable: {exc})"
    if not context:
        return "No relevant documents found."
    titles = ", ".join(s["title"] for s in sources)
    return f"Relevant context (from: {titles}):\n\n{context}"


@tool
def list_projects(project_type: str = "") -> str:
    """List the owner's projects. Optionally filter by type: enterprise, personal, or archive."""
    try:
        projects = db.get_projects(project_type=project_type or None, published_only=True)
    except Exception as exc:  # noqa: BLE001
        return f"(Could not load projects: {exc})"
    if not projects:
        return "No projects found."
    items = [
        {
            "title": p.get("title"),
            "type": p.get("type"),
            "summary": p.get("summary"),
            "skills": p.get("skillsUsed", []),
        }
        for p in projects
    ]
    return json.dumps(items, ensure_ascii=False)


@tool
def get_profile_summary() -> str:
    """Get the owner's bio, headline, location and skill list."""
    try:
        profile = db.get_profile() or {}
        skills = [s.get("name") for s in db.get_skills()]
    except Exception as exc:  # noqa: BLE001
        return f"(Could not load profile: {exc})"
    return json.dumps(
        {
            "name": profile.get("fullName"),
            "headline": profile.get("headline"),
            "location": profile.get("location"),
            "about": profile.get("aboutMe"),
            "skills": skills,
        },
        ensure_ascii=False,
    )


TOOLS = [search_portfolio_docs, list_projects, get_profile_summary]


def _run_agent_once(model, messages: list[Any]) -> Any:
    # langgraph >= 1.0 renamed `state_modifier` to `prompt`.
    agent = create_react_agent(model, TOOLS, prompt=SYSTEM_PROMPT)
    return agent.invoke({"messages": messages})


def run_agent(question: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    """Run one chat turn. Returns {answer, sources}.

    Uses the Gemini fallback chain: if a model is down it retries the next one
    (up to 3 attempts). If all fail, the reasoning is returned as the answer.
    """
    # The system prompt is injected by the agent via `prompt`, so we only
    # pass the conversation turns here.
    messages: list[Any] = []
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=question))

    try:
        result = invoke_with_fallback(lambda m: _run_agent_once(m, messages))
    except LLMUnavailableError as exc:
        return {
            "answer": (
                "Sorry — I couldn't reach the AI models right now. "
                f"Reasoning:\n{exc}"
            ),
            "sources": [],
        }

    final = result["messages"][-1]
    answer = message_text(final)

    # Surface the most relevant sources for display in the UI (best-effort).
    try:
        _, sources = rag.retrieve(question, k=4)
    except Exception:  # noqa: BLE001 — sources are optional; never fail the answer
        sources = []
    return {"answer": answer, "sources": sources}
