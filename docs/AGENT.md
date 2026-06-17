# Agent Service — Technical Reference

The Python AI backend: a **LangGraph ReAct agent** powered by **Google Gemini**,
with **RAG** (Retrieval-Augmented Generation) over the owner's projects, blogs,
profile and uploaded documents, plus an **AI resume generator**. It reads live
data from **MongoDB Atlas** and stores embedding vectors in the **same** Atlas
database via **Atlas Vector Search**.

- **Stack:** Python 3.14 · FastAPI · uvicorn · LangGraph 1.x · LangChain 1.x ·
  `langchain-google-genai` · pymongo · pypdf · pydantic-settings.
- **Source:** [`agent-service/app`](../agent-service/app)
- **Port:** `8001` · **Health:** `GET /health` · **Swagger:** `GET /docs`.

> **Mental model — there is no fine-tuning.** "Training the chatbot" here means
> **ingestion**: chunk content → embed each chunk with Gemini → store the vectors
> in MongoDB. At chat time we embed the question, find the nearest chunks
> (`$vectorSearch`), and feed them to Gemini as context. To "retrain", re-ingest —
> Gemini's weights never change. A companion hands-on guide lives at
> [`agent-service/README.md`](../agent-service/README.md).

---

## Table of contents

1. [Why this stack](#1-why-this-stack)
2. [Service shape & bootstrap](#2-service-shape--bootstrap)
3. [Configuration](#3-configuration)
4. [The LangGraph agent](#4-the-langgraph-agent)
5. [LLM layer & the Gemini fallback chain](#5-llm-layer--the-gemini-fallback-chain)
6. [RAG pipeline](#6-rag-pipeline)
7. [Vector store (Atlas Vector Search)](#7-vector-store-atlas-vector-search)
8. [Database access](#8-database-access)
9. [Resume generation](#9-resume-generation)
10. [HTTP API (routers, schemas, security)](#10-http-api-routers-schemas-security)
11. [Request flows end-to-end](#11-request-flows-end-to-end)
12. [Operational notes & extension points](#12-operational-notes--extension-points)

---

## 1. Why this stack

| Tool | Role | Why |
|------|------|-----|
| **Python 3.14 + FastAPI** | AI HTTP service | Python has the richest LLM/RAG ecosystem; FastAPI is async, typed, and auto-generates Swagger. |
| **uvicorn** | ASGI server | Runs FastAPI. |
| **LangGraph** | Agent orchestration | Builds a tool-using **ReAct** agent (decide → call tool → observe → answer) with a prebuilt graph. |
| **langchain-google-genai** | Gemini chat + embeddings | Bridges Gemini into LangChain/LangGraph tooling. |
| **pymongo** | Mongo + vectors | Reads `portfolio_*` collections **and** runs the `$vectorSearch` aggregation on the same DB. |
| **pypdf** | PDF text extraction | Turns uploaded PDFs into ingestible text. |
| **pydantic-settings** | Typed config | Env-driven `Settings`. |
| **certifi / dnspython** | TLS + SRV | `certifi` provides the CA bundle to verify Atlas's TLS cert; `dnspython` resolves `mongodb+srv://`. |

> **Why a separate service at all?** AI work is Python-shaped and has different
> scaling/latency characteristics than the CRUD API. Isolating it keeps the Node
> backend lean, lets the two scale independently, and contains the (heavier) AI
> dependency tree.

---

## 2. Service shape & bootstrap

[`app/main.py`](../agent-service/app/main.py) creates the FastAPI app
("Portfolio Agent Service", v0.1.0), adds **CORS** (`allow_origins=settings.origins`,
`allow_credentials=True`), exposes `GET /health` → `{"status":"ok","service":"agent-service"}`,
and registers three routers: **`chat`** (`/chat`), **`ingest`** (`/ingest`),
**`resume`** (`/resume`). Swagger is auto-served at `/docs`.

```
app/
├── main.py          # FastAPI app, CORS, /health, router registration
├── config.py        # pydantic-settings Settings + model_chain
├── agent.py         # LangGraph ReAct agent + 3 tools + run_agent()
├── llm.py           # Gemini chat/embeddings + invoke_with_fallback()
├── rag.py           # chunk / ingest / retrieve
├── vectorstore.py   # Atlas Vector Search: add / query / delete / reset / index
├── db.py            # read-only pymongo access + GridFS read
├── resume.py        # AI resume generation
├── schemas.py       # pydantic request/response models
├── security.py      # x-internal-key dependency
└── routers/         # chat.py · ingest.py · resume.py
```

> **Design principle — the agent is AI-only and read-mostly.** It *reads*
> portfolio collections and *writes only* to its own `portfolio_vectors`
> collection. It never mutates portfolio content; that's the backend's job.

---

## 3. Configuration

[`app/config.py`](../agent-service/app/config.py) — a pydantic-settings `Settings`
(loaded once via `@lru_cache get_settings()`), reading `.env`:

| Field (env var) | Default | Meaning |
|-----------------|---------|---------|
| `port` (`PORT`) | `8001` | HTTP port. |
| `allowed_origins` (`ALLOWED_ORIGINS`) | localhost 3000/4000/5173 | CORS list (comma-separated). |
| `google_api_key` (`GOOGLE_API_KEY`) | `""` | Gemini API key. |
| `gemini_model` (`GEMINI_MODEL`) | `gemini-1.5-flash` | Primary chat model (see note). |
| `gemini_models` (`GEMINI_MODELS`) | `""` | Comma-separated fallback chain. |
| `gemini_embed_model` (`GEMINI_EMBED_MODEL`) | `models/gemini-embedding-001` | Embedding model. |
| `mongo_uri` / `mongo_db` | localhost / `portfolio` | Atlas connection / db name. |
| `col_profile/skills/projects/blogs` | `portfolio_*` | **Must match** the backend's `collections.ts`. |
| `vector_collection` (`VECTOR_COLLECTION`) | `portfolio_vectors` | Where vectors are stored. |
| `vector_index` (`VECTOR_INDEX`) | `vector_index` | Atlas Vector Search index name. |
| `embed_dims` (`EMBED_DIMS`) | `3072` | Embedding dimensions (must match the embed model). |
| `internal_api_key` (`INTERNAL_API_KEY`) | change-me | Shared secret with the backend. |

Two computed properties:
- `origins` → parses the CORS list.
- **`model_chain`** → the ordered list of models to try. It starts from
  `GEMINI_MODELS` (or `GEMINI_MODEL`), de-dupes, then **always appends live
  fallbacks** `gemini-2.5-flash` and `gemini-flash-latest`.

> **Important nuance about the default model.** The *code* default
> `gemini-1.5-flash` is a **retired** model — but it's never used in practice:
> production sets `GEMINI_MODEL=gemini-2.5-flash` (see
> [`render.yaml`](../render.yaml) / [`.env.example`](../agent-service/.env.example)),
> **and** `model_chain` guarantees `gemini-2.5-flash` + `gemini-flash-latest` are in
> the chain regardless. So even a stale config self-heals to a live model. This is
> resilience-by-design (§5). *(Tidy-up worth doing: bump the in-code default to a
> current model so the source isn't misleading.)*

---

## 4. The LangGraph agent

[`app/agent.py`](../agent-service/app/agent.py) — the heart of the chatbot.

### System prompt
The agent is instructed to be a friendly portfolio assistant, to **always ground
answers in tools**, to be concise/warm/specific, to admit when info is missing
(and suggest the contact options), and to **never invent projects, employers, or
facts**.

> **Why "always ground in tools" + "never invent"?** This is the cheapest, most
> effective hallucination guard: the prompt forces tool calls (real data) and
> forbids fabrication, while RAG supplies the actual context. No fine-tuning
> needed.

### Tools (the agent's only way to touch data)
Three `@tool`-decorated functions; their docstrings are what the LLM reads to
decide when to call them. Each is wrapped in `try/except` so a tool failure
returns a friendly string instead of crashing the turn:

| Tool | Signature | Returns |
|------|-----------|---------|
| `search_portfolio_docs` | `(query: str)` | RAG retrieval: `rag.retrieve(query, k=5)` → `"Relevant context (from: …): …"`, or "No relevant documents found." |
| `list_projects` | `(project_type: str = "")` | `db.get_projects(..., published_only=True)` → JSON `[{title, type, summary, skills}]`. |
| `get_profile_summary` | `()` | `db.get_profile()` + skill names → JSON `{name, headline, location, about, skills}`. |

### Building & running the agent
```python
def _run_agent_once(model, messages):
    agent = create_react_agent(model, TOOLS, prompt=SYSTEM_PROMPT)  # langgraph >= 1.0 uses `prompt`
    return agent.invoke({"messages": messages})
```

`run_agent(question, history)` is the entrypoint:
1. Convert `history` (`[{role, content}]`) into LangChain `HumanMessage` /
   `AIMessage` objects; append the new `HumanMessage(question)`. The system prompt
   is **not** in this list — it's injected via `prompt=` so it can't be displaced
   by long histories.
2. Invoke through the fallback wrapper:
   `invoke_with_fallback(lambda m: _run_agent_once(m, messages))`. If every model
   fails it raises `LLMUnavailableError`, which is caught and returned as a polite
   answer that **includes the reasoning** (each model's error) — never a 500.
3. Extract the final message text via `message_text(...)` (handles both plain
   strings and Gemini's structured content blocks).
4. **Best-effort sources:** run a second `rag.retrieve(question, k=4)` purely to
   attach `sources` for the UI; failures here are swallowed (sources are optional).

Result shape: `{ "answer": str, "sources": [{title, type}, …] }`.

> **Why retrieve sources separately from the tool call?** The agent *may or may
> not* call `search_portfolio_docs`, and even when it does, the tool returns text,
> not a clean source list. A dedicated retrieval pass guarantees the widget can
> always show *what informed the answer*, decoupled from the agent's tool choices.

---

## 5. LLM layer & the Gemini fallback chain

[`app/llm.py`](../agent-service/app/llm.py).

- `build_chat_model(model_name, temperature=0.3)` → `ChatGoogleGenerativeAI(...)`.
  Chat uses `0.3` (focused, factual); resume generation uses `0.4`.
- `get_embeddings()` (`@lru_cache`) → `GoogleGenerativeAIEmbeddings(model=gemini_embed_model)`.
- **`invoke_with_fallback(run, *, temperature=0.3, max_attempts=3)`** — the
  resilience core. It walks `settings.model_chain[:max_attempts]`, building a fresh
  model for each and calling `run(model)`; the first success returns immediately,
  and every failure is logged and accumulated. If all attempts fail it raises
  `LLMUnavailableError` with **all** the errors joined, e.g.:
  ```
  All 3 Gemini model attempt(s) failed:
  gemini-2.5-flash → ResourceExhausted: 429 …
  gemini-flash-latest → ServiceUnavailable: 503 …
  gemini-2.0-flash → ResourceExhausted: 429 …
  ```
- `message_text(msg)` — normalizes LangChain message content (str **or** list of
  `{type,text}` blocks) into plain text.

> **Why a fallback chain (and why up to 3)?** Free-tier Gemini models hit quota
> (429) or transient outages (503). Trying the next model turns a hard failure into
> a graceful degrade. Three attempts balances resilience against latency — you
> don't want a user waiting through ten dead models.
>
> **Why embeddings are deliberately *excluded* from the chain:** every stored
> vector must come from the **same** embedding model and dimensionality
> (`EMBED_DIMS = 3072`). Mixing embedding models would put incompatible vectors in
> one index and **corrupt similarity search**. So the embed model is a single fixed
> value, never a fallback.

---

## 6. RAG pipeline

[`app/rag.py`](../agent-service/app/rag.py).

- **Chunking** — `chunk_text(text, size=1000, overlap=150)`: a sliding window of
  ~1000 chars with 150-char overlap.
  > *Why overlap?* A fact that straddles a chunk boundary would be split and lost;
  > overlap keeps boundary sentences intact in at least one chunk.
- **Formatters** — `_project_text`, `_blog_text`, `_profile_text`, `_skills_text`
  flatten each domain object into a labeled text block before chunking (so the
  embedding "sees" titles, skills, impact, etc.).
- **Documents** — `_make_docs(source_id, title, kind, text, id_prefix?)` produces
  `{ id: "<prefix>:<i>", text, metadata: { source_id, title, kind } }`. **`kind`**
  ∈ `project | project_file | blog | profile | skills | document | pdf`.
- **Ingestion**
  - `ingest_portfolio()` — re-indexes everything: for each project (incl. PDF assets
    read from GridFS and extracted with `_pdf_text`), blog, the profile, and skills,
    it **deletes old chunks by `source_id` first**, then upserts fresh ones. Returns
    a per-kind breakdown `{chunks, projects, project_files, blogs, profile, skills}`.
  - `ingest_document(source_id, title, text, kind="document")` — for pasted text /
    extracted PDFs. Returns the chunk count.
- **Retrieval** — `retrieve(question, k=5)` → embed the query, `vectorstore.query`
  for the top-k, join chunk texts with `---` separators, and return
  `(context, sources)` where `sources` are de-duplicated by `(title, kind)`.

> **Why delete-by-`source_id` before re-ingesting?** It makes ingestion
> **idempotent**: editing a project and re-indexing replaces exactly that
> project's chunks instead of piling up stale duplicates that would pollute
> retrieval.

---

## 7. Vector store (Atlas Vector Search)

[`app/vectorstore.py`](../agent-service/app/vectorstore.py) — vectors live in the
**same** Atlas DB; there is no separate vector database.

- **Document shape** (collection `portfolio_vectors`):
  ```json
  { "_id": "<source>:<i>", "text": "<chunk>",
    "embedding": [/* 3072 floats */],
    "metadata": { "source_id": "...", "title": "...", "kind": "..." } }
  ```
- **`add_documents(docs)`** — batch-embeds all chunk texts
  (`embed_documents`), then bulk-`ReplaceOne(..., upsert=True)` keyed by `_id`, and
  calls `ensure_index()`.
- **`ensure_index()`** (idempotent, once per process) — creates the Atlas
  `vectorSearch` index if missing:
  ```python
  SearchIndexModel(name=settings.vector_index, type="vectorSearch", definition={
    "fields": [
      {"type": "vector", "path": "embedding",
       "numDimensions": settings.embed_dims, "similarity": "cosine"},
      {"type": "filter", "path": "metadata.source_id"},
    ]})
  ```
- **`query(text, k=5)`** — embeds the query and runs:
  ```python
  [{"$vectorSearch": {"index": vector_index, "path": "embedding",
      "queryVector": vector, "numCandidates": max(k*10, 100), "limit": k}},
   {"$project": {"_id": 0, "text": 1, "metadata": 1,
      "score": {"$meta": "vectorSearchScore"}}}]
  ```
  Returns `{text, metadata, distance: 1 - score}`. On any failure (e.g. index still
  building) it logs and returns `[]` — chat degrades, never crashes.
- **`delete_by_source(source)`**, **`reset_collection()`**, **`collection_count()`**
  round out the lifecycle (`collection_count` returns `0` on error).

> **Why cosine + `numCandidates` ≈ 10×k?** Cosine similarity is the standard metric
> for text embeddings (direction matters, not magnitude). Atlas Vector Search is an
> approximate-nearest-neighbor index; `numCandidates` is how many it inspects before
> returning the top `k` — ~10× gives good recall without scanning everything.
>
> **Why auto-create the index in code?** One less manual Atlas step; the index
> builds (PENDING→READY, ~20 s) on first ingest, and `query` tolerates the warm-up.

---

## 8. Database access

[`app/db.py`](../agent-service/app/db.py) — **read-only** pymongo access (cached
client):
```python
MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
```
`certifi.where()` supplies a CA bundle so TLS verification to Atlas works even where
the OS trust store doesn't cover it (common on macOS). Helpers: `get_profile()`,
`get_skills()` (sorted by category), `get_projects(project_type?, published_only=True, ids?)`
(sorted by `order`), `get_blogs(published_only=True)`, and `read_gridfs_file(file_id)`
(bucket `uploads`; validates the `ObjectId`, returns bytes or `None`). A `_clean()`
helper stringifies `_id`.

---

## 9. Resume generation

[`app/resume.py`](../agent-service/app/resume.py) — `generate_resume(role,
project_ids, skills, instructions)`:
1. Load profile + the selected projects (`published_only=False` — drafts allowed) +
   education.
2. Build a labeled Markdown **context block** (candidate, target role, skills to
   emphasize, selected projects, education, extra instructions).
3. Call Gemini through `invoke_with_fallback(..., temperature=0.4)` with a system
   prompt that demands an **ATS-friendly Markdown** resume, impact-focused bullets,
   and — critically — **no fabricated employers, dates, or metrics**.
4. Return the Markdown via `message_text`.

The backend saves the result as a `source="generated"` Resume (`isPublic=false`)
for the admin to review.

---

## 10. HTTP API (routers, schemas, security)

**Security** — [`app/security.py`](../agent-service/app/security.py):
`require_internal_key(x_internal_key: Header)` compares the header to
`INTERNAL_API_KEY` and raises `401` on mismatch. It's attached to the **ingest**
and **resume** routers via `dependencies=[Depends(require_internal_key)]`. `/chat`
and `/health` are public.

**Schemas** — [`app/schemas.py`](../agent-service/app/schemas.py): `ChatTurn`,
`ChatRequest {message, history[]}`, `Source {title, type}`,
`ChatResponse {answer, sources[]}`, `DocumentIngestRequest {title, text, source_id?}`,
`IngestResponse {ok, chunks, detail?}`, `StatusResponse {indexed_chunks, collection}`,
`ResumeGenerateRequest {role, project_ids[], skills[], instructions}`,
`ResumeGenerateResponse {content}`.

**Endpoints:**

| Method · Path | Auth | Body → Response | Purpose |
|---|---|---|---|
| `GET /health` | public | → `{status, service}` | Liveness. |
| `POST /chat` | public | `ChatRequest` → `ChatResponse` | One chat turn (wraps all errors as `502`). |
| `GET /ingest/status` | internal key | → `StatusResponse` | `{indexed_chunks, collection}`. |
| `POST /ingest/portfolio` | internal key | → `IngestResponse` | Re-index all projects/blogs/profile/skills. |
| `POST /ingest/document` | internal key | `DocumentIngestRequest` → `IngestResponse` | Ingest pasted text (defaults `source_id` to `doc:<title>`). |
| `POST /ingest/pdf` | internal key | multipart (`file`,`title`) → `IngestResponse` | Validates `application/pdf`, extracts text (`400` if not a PDF / empty). |
| `POST /ingest/reset` | internal key | → `IngestResponse` | Clear the whole knowledge base. |
| `POST /resume/generate` | internal key | `ResumeGenerateRequest` → `ResumeGenerateResponse` | Generate a resume (errors → `502`). |

---

## 11. Request flows end-to-end

**Chat (RAG):**
```
Browser widget → POST /api/chat (backend, public)
  → Agent POST /chat → run_agent(question, history)
     → LangGraph ReAct loop (Gemini via fallback chain):
         search_portfolio_docs → embed q → $vectorSearch top-5 → context
         list_projects / get_profile_summary → read Mongo
     → Gemini composes a grounded answer
     → second retrieve(k=4) attaches `sources`
  → { answer, sources } → backend → widget (sources rendered as badges)
```

**Ingestion ("training"):**
```
Admin UI → POST /api/chat/admin/reingest (backend, requireAdmin)
  → Agent POST /ingest/portfolio (x-internal-key)
     → read projects/blogs/profile/skills (+ project PDFs from GridFS)
     → chunk → embed (gemini-embedding-001) → upsert into portfolio_vectors
       (delete-by-source_id first → idempotent)
  → { ok, chunks, detail }
```

**Resume generation:** `Admin UI → POST /api/resumes/generate → Agent
POST /resume/generate → Gemini → Markdown → backend saves as a generated Resume.`

---

## 12. Operational notes & extension points

- **Add a tool:** write an `@tool` function (clear docstring — the LLM reads it),
  wrap it in `try/except`, append to `TOOLS`. It's available to the agent next turn.
- **Add a content kind to RAG:** add a `_*_text` formatter + an ingest branch in
  `ingest_portfolio()`; keep a stable `source_id` so re-ingest stays idempotent.
- **Changing the embedding model** is a breaking change: update
  `GEMINI_EMBED_MODEL` **and** `EMBED_DIMS`, then **reset + re-ingest** (the old
  index/vectors are incompatible).
- **Stateless by design:** no session storage — the browser replays history each
  turn, so the service scales horizontally with no shared state.
- **Common failure modes:** `indexed_chunks: 0` → run `/ingest/portfolio`;
  `401` on `/ingest/*` → `INTERNAL_API_KEY` mismatch; no sources → index still
  building (~20 s) or nothing ingested; "couldn't reach the AI models" →
  missing/invalid `GOOGLE_API_KEY` or all models over quota (the message includes
  the per-model reasoning).

*Related: [agent-service/README.md](../agent-service/README.md) (hands-on/curl) ·
[ARCHITECTURE.md](../ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) ·
[FRONTEND.md](FRONTEND.md) · [DEPLOYMENT.md](DEPLOYMENT.md)*
