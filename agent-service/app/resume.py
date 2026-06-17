"""AI resume generation from selected projects, skills and instructions."""
from langchain_core.messages import HumanMessage, SystemMessage

from app import db
from app.llm import invoke_with_fallback, message_text

SYSTEM_PROMPT = (
    "You are an expert technical resume writer. Produce a clean, ATS-friendly resume in Markdown. "
    "Use clear section headings (Summary, Skills, Experience / Projects, Education). "
    "Write impact-focused bullet points with strong action verbs and quantified results where the "
    "source material provides them. Never fabricate employers, dates, or metrics that are not given. "
    "Tailor the emphasis to the target role."
)


def _format_project(p: dict) -> str:
    return (
        f"### {p.get('title', '')} ({p.get('type', '')})\n"
        f"- Summary: {p.get('summary', '')}\n"
        f"- About: {p.get('about', '')}\n"
        f"- Impact: {p.get('impact', '')}\n"
        f"- Learnings: {p.get('learning', '')}\n"
        f"- Skills: {', '.join(p.get('skillsUsed', []))}\n"
    )


def generate_resume(
    role: str,
    project_ids: list[str],
    skills: list[str],
    instructions: str,
) -> str:
    profile = db.get_profile() or {}
    projects = db.get_projects(ids=project_ids, published_only=False) if project_ids else []

    education_lines = []
    for e in profile.get("education", []):
        education_lines.append(
            f"- {e.get('level', '')} {e.get('course', '')}, {e.get('institution', '')} "
            f"({e.get('startYear', '')}–{e.get('endYear', '')})"
        )

    context = [
        f"# Candidate\nName: {profile.get('fullName', '')}",
        f"Headline: {profile.get('headline', '')}",
        f"Location: {profile.get('location', '')}",
        f"Contact: {profile.get('contactEmail', '')}",
        f"About: {profile.get('aboutMe', '')}",
        "",
        f"# Target role\n{role}",
        "",
        "# Skills to emphasize",
        ", ".join(skills) if skills else "(use judgement based on projects)",
        "",
        "# Selected projects",
        "\n".join(_format_project(p) for p in projects) or "(none selected)",
        "",
        "# Education",
        "\n".join(education_lines) or "(none provided)",
        "",
        "# Additional instructions from the candidate",
        instructions or "(none)",
    ]

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(
            content="Write the resume now using only the information below.\n\n" + "\n".join(context)
        ),
    ]

    # Uses the Gemini fallback chain; raises LLMUnavailableError if all models
    # fail, which the router surfaces as the reason.
    response = invoke_with_fallback(lambda m: m.invoke(messages), temperature=0.4)
    return message_text(response)
