# Agent Service — Working Guide

The Python AI backend for the portfolio: a **LangGraph** agent powered by **Gemini**,
with **RAG** (Retrieval-Augmented Generation) over your projects, blogs and uploaded
documents. It also generates resumes. It reads live data from **MongoDB Atlas**
and stores vector embeddings in the **same** Atlas database (**Atlas Vector Search**).

> **Mental model — there is no fine-tuning.** "Training the model" here means
> **ingestion**: we chunk your content, turn each chunk into an embedding vector
> with Gemini, and store it in MongoDB. At chat time we embed the question, find the
> most similar chunks (via `$vectorSearch`), and feed them to Gemini as context.
> To "retrain" you simply re-ingest — nothing about Gemini's weights changes.

---

## 1. Architecture

```
Browser ──► Backend (/api/chat)  ──►  Agent service (/chat)
                                          │
                 ┌────────────────────────┴───────────────┐
                 ▼                                          ▼
        Gemini (LLM + embeddings)        MongoDB Atlas (docs + vectors)
```

- **`app/agent.py`** — LangGraph ReAct agent with 3 tools: `search_portfolio_docs`
  (RAG), `list_projects` (DB), `get_profile_summary` (DB).
- **`app/rag.py`** — chunking + ingestion + retrieval.
- **`app/vectorstore.py`** — Atlas Vector Search store (add / query / delete / reset).
- **`app/llm.py`** — Gemini chat model + embeddings.
- **`app/db.py`** — read-only Mongo access (collections `portfolio_*`).
- **`app/resume.py`** — AI resume generation.
- **`app/routers/`** — `chat`, `ingest`, `resume` HTTP endpoints.

---

## 2. How RAG "training" (ingestion) works

1. **Collect** content — projects, blogs, profile (from Mongo), plus any pasted
   text or uploaded PDFs.
2. **Chunk** each document into ~1000-char overlapping pieces (`rag.chunk_text`).
3. **Embed** each chunk with Gemini `gemini-embedding-001` (`llm.get_embeddings`).
4. **Store** vectors + metadata in the MongoDB collection `portfolio_vectors`,
   keyed by `source_id` so a source can be replaced cleanly on re-ingest. An Atlas
   Vector Search index (`vector_index`) is created automatically on first ingest.
5. **Retrieve** at query time: embed the question, fetch the top-k nearest chunks,
   pass them to Gemini as grounding context, and return the answer + sources.

Re-run ingestion whenever your content changes (new project, edited blog, new PDF).

---

## 3. Endpoints

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET  | `/health` | — | Liveness |
| POST | `/chat` | public | Ask a question → `{ answer, sources }` |
| GET  | `/ingest/status` | internal key | `{ indexed_chunks, collection }` |
| POST | `/ingest/portfolio` | internal key | Re-index all projects/blogs/profile |
| POST | `/ingest/document` | internal key | Ingest pasted text `{ title, text }` |
| POST | `/ingest/pdf` | internal key | Ingest a PDF (multipart `file`, `title`) |
| POST | `/ingest/reset` | internal key | Clear the whole knowledge base |
| POST | `/resume/generate` | internal key | Generate a resume from projects/skills |

**Internal auth:** admin endpoints require the header `x-internal-key:
<INTERNAL_API_KEY>`. The Node backend sends this automatically when you use the
admin UI; you only need it for direct curl calls. `/chat` is public.

---

## 4. Environment variables (`agent-service/.env`)

| Var | Meaning |
| --- | ------- |
| `GOOGLE_API_KEY` | Gemini key — https://aistudio.google.com/app/apikey |
| `GEMINI_MODEL` | Primary chat model (default `gemini-2.5-flash`) |
| `GEMINI_MODELS` | Comma-separated fallback chain (optional) |
| `GEMINI_EMBED_MODEL` | Embedding model (default `models/gemini-embedding-001`) |
| `MONGO_URI` / `MONGO_DB` | Atlas connection (same as backend) |
| `VECTOR_COLLECTION` | Vector collection name (`portfolio_vectors`) |
| `VECTOR_INDEX` / `EMBED_DIMS` | Atlas Vector Search index name / dimensions (`3072`) |
| `INTERNAL_API_KEY` | Shared secret — **must match the backend's** |
| `ALLOWED_ORIGINS` | CORS origins |

---

## 5. Run it

### Option A — Docker (with the whole stack)
```bash
docker compose up --build agent-service
# agent → http://localhost:8001/health
```

### Option B — Locally
```bash
cd agent-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Prereqs: `GOOGLE_API_KEY` set and Atlas reachable (IP allow-listed). Vectors live
in Atlas — there's nothing else to run.

---

## 6. Test it (end-to-end RAG check)

```bash
KEY=$(grep INTERNAL_API_KEY .env | cut -d= -f2)
BASE=http://localhost:8001

# 1. Service is up
curl $BASE/health

# 2. Index your portfolio data from Mongo
curl -X POST $BASE/ingest/portfolio -H "x-internal-key: $KEY"

# 3. Confirm chunks were stored
curl $BASE/ingest/status -H "x-internal-key: $KEY"
#   -> {"indexed_chunks": 42, "collection": "portfolio_vectors"}

# 4. Add an extra document (optional)
curl -X POST $BASE/ingest/document -H "x-internal-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Notes","text":"I led the payments migration in 2024..."}'

# 5. Ingest a PDF (optional)
curl -X POST $BASE/ingest/pdf -H "x-internal-key: $KEY" \
  -F "file=@/path/to/doc.pdf" -F "title=Case study"

# 6. Ask a question (public endpoint)
curl -X POST $BASE/chat -H "Content-Type: application/json" \
  -d '{"message":"What enterprise projects has the owner worked on?","history":[]}'
#   -> {"answer":"...","sources":[{"title":"...","type":"project"}]}

# 7. Generate a resume
curl -X POST $BASE/resume/generate -H "x-internal-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"SDE","project_ids":[],"skills":["TypeScript"],"instructions":"One page."}'
```

**Via the app instead of curl:** log in as admin → **Admin → Chatbot / RAG** →
"Re-index portfolio" / upload docs, then use the floating chat widget on the site.

`/docs` (FastAPI Swagger) is also available at `http://localhost:8001/docs`.

---

## 7. Recommended workflow

1. Ensure Atlas is reachable (IP allow-listed) and set `GOOGLE_API_KEY`.
2. Start the agent service.
3. Add real content via the admin UI (projects, blogs).
4. **Re-index** (Admin → Chatbot/RAG, or `/ingest/portfolio`).
5. Chat and sanity-check the answers + cited sources.
6. Re-index whenever content changes; upload PDFs/notes for anything not in the DB.

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| `indexed_chunks: 0` after chat | You haven't ingested yet — run `/ingest/portfolio`. |
| Chat returns "assistant unavailable" / 502 | `GOOGLE_API_KEY` missing/invalid, or Gemini quota. |
| Connection errors / TLS to Mongo | Atlas IP allowlist (Network Access) + `MONGO_URI`/`MONGO_DB`. `mongodb+srv://` needs `dnspython`; TLS verify uses `certifi` (both in requirements). |
| No sources / vector search returns nothing | The `vector_index` may still be building (PENDING→READY, ~20s) or no docs ingested — run `/ingest/portfolio`. |
| `EMBED_DIMS` mismatch errors | `EMBED_DIMS` must equal the embedding model's output (gemini-embedding-001 = 3072); changing the embed model means recreating the index. |
| 401 on `/ingest/*` | `INTERNAL_API_KEY` mismatch between backend and agent service. |
| Empty / irrelevant answers | Re-ingest after content changes; check the collection has chunks. |
