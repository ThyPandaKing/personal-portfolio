# Portfolio Platform — Technical Overview

A single, self-contained technical reference for the whole project: an AI‑augmented
personal portfolio with a public site, an admin dashboard, visitor accounts, and a
RAG‑powered chatbot. This document is the "read me first" companion to the deeper
per‑area docs ([`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/FRONTEND.md`](docs/FRONTEND.md),
[`docs/BACKEND.md`](docs/BACKEND.md), [`docs/AGENT.md`](docs/AGENT.md),
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

---

## 1. Technology Used

The project is a **polyglot monorepo** of three independent services that share one
database. Each service is deployed separately.

| Layer | Tech | Runtime / Port | Hosting |
|-------|------|----------------|---------|
| **Frontend** | React 18 + TypeScript, Vite 5, React Router 6, TanStack Query 5, Tailwind CSS 3, Framer Motion, `@react-oauth/google`, axios, react-markdown, lucide-react | Static SPA, dev `:5173` | **Vercel** |
| **Backend API** | Node 24 + TypeScript, Express 4, Mongoose 8, Zod, Multer (in‑memory), `jsonwebtoken`, `google-auth-library`, GridFS, Swagger UI | Node `:4000` | **Render** (Docker, free) |
| **Agent service** | Python 3.14 + FastAPI, Uvicorn, LangGraph + LangChain, `langchain-google-genai` (Gemini), PyMongo + GridFS, pypdf, pydantic-settings | ASGI `:8001` | **Render** (Docker, free) |
| **Data store** | MongoDB **Atlas** — documents + GridFS binaries + **Atlas Vector Search** | — | **MongoDB Atlas** (free M0) |
| **LLM** | Google **Gemini** — chat (`gemini-2.5-flash` + fallbacks) and embeddings (`models/gemini-embedding-001`, 3072 dims) | — | Google AI |

**Key design choices**

- **One database for everything.** Portfolio content, uploaded files (GridFS), and the
  RAG vectors all live in the *same* MongoDB Atlas database. There is no separate vector
  DB or object store — `$vectorSearch` runs against an Atlas Vector Search index on the
  `portfolio_vectors` collection.
- **Auth is Google OAuth + JWT session cookie.** Two roles: `admin` (email allowlist) and
  `visitor` (anyone signed in). See [`docs/visitor-role`](docs/BACKEND.md).
- **Resilience by design.** The chatbot uses a Gemini *model fallback chain*; embeddings
  use *batched, rate‑limit‑aware retry*. Free‑tier cold starts are mitigated by a warmup
  endpoint plus a scheduled GitHub Action.
- **No npm workspaces** — each service has its own `package.json`/`requirements.txt` and is
  built and deployed on its own.

---

## 2. About Each Component

### 2.1 Frontend (`frontend/`) — Vercel

A Vite + React single‑page app.

- **Entry / providers:** [`src/main.tsx`](frontend/src/main.tsx) wires the provider tree;
  [`src/App.tsx`](frontend/src/App.tsx) defines routes and fires a one‑time **warmup** on
  mount to pre‑heat the backend (and through it, the agent).
- **Routing & guards** ([`src/App.tsx`](frontend/src/App.tsx)):
  - **Public:** `/`, `/projects`, `/projects/:slug`, `/blog`, `/blog/:slug`, `/resume`.
  - **Auth‑gated** (`RequireAuth`): `/account`, `/account/blog/new`.
  - **Admin‑only** (`RequireAdmin`): `/admin`, `/admin/profile`, `/admin/projects`,
    `/admin/blog`, `/admin/resumes`, `/admin/chatbot`, `/admin/visitors`.
- **Auth** ([`src/context/AuthContext.tsx`](frontend/src/context/AuthContext.tsx)): Google
  Sign‑In returns a credential → posted to the backend → backend sets an **httpOnly session
  cookie**. The frontend never stores the token in JS; `axios` sends the cookie via
  `withCredentials: true`.
- **API layer** ([`src/lib/api.ts`](frontend/src/lib/api.ts),
  [`src/api/endpoints.ts`](frontend/src/api/endpoints.ts)): one axios instance with
  `baseURL = ${VITE_API_BASE}/api`. In production, Vercel rewrites `/api/*` to the Render
  backend (see [`frontend/vercel.json`](frontend/vercel.json)); in dev, Vite proxies `/api`
  to `localhost:4000`.
- **Chatbot widget** ([`src/components/chat/ChatWidget.tsx`](frontend/src/components/chat/ChatWidget.tsx)):
  floating panel, markdown rendering, typewriter reveal, three starter modes
  (recruiter / project insights / general). Detailed in §5.

### 2.2 Backend API (`backend/`) — Render

Express + TypeScript REST API; the system's gatekeeper and data authority.

- **App setup** ([`src/app.ts`](backend/src/app.ts), [`src/index.ts`](backend/src/index.ts)):
  CORS (credentialed), `express.json` (2 MB), cookie‑parser, `attachUser` (decodes the JWT
  cookie, never throws), centralized error handler, Swagger UI at `/api/docs`.
- **Data models** ([`src/models/`](backend/src/models/), names in
  [`src/config/collections.ts`](backend/src/config/collections.ts)):
  `portfolio_users`, `portfolio_profile` (singleton Home content), `portfolio_skills`,
  `portfolio_projects` (with nested PDF/recording assets), `portfolio_blogs`,
  `portfolio_resumes`.
- **Auth & roles** ([`src/services/auth.ts`](backend/src/services/auth.ts),
  [`src/middleware/auth.ts`](backend/src/middleware/auth.ts)): verifies the Google ID token,
  upserts the user, signs a 7‑day JWT cookie. Role is `admin` if the email is in
  `ADMIN_EMAILS`, else `visitor`. Guards: `requireAuth`, `requireAdmin`.
- **File storage** ([`src/services/gridfs.ts`](backend/src/services/gridfs.ts),
  [`src/routes/files.ts`](backend/src/routes/files.ts)): uploads stream into the GridFS
  `uploads` bucket; `GET /api/files/:id` serves them with byte‑range support (video seeking)
  and immutable caching.
- **Chat/RAG proxy** ([`src/routes/chat.ts`](backend/src/routes/chat.ts),
  [`src/services/agentClient.ts`](backend/src/services/agentClient.ts)): forwards `/api/chat`
  to the agent service and exposes admin RAG controls, all authenticated to the agent with a
  shared `x-internal-key` header.
- **Config** ([`src/config/env.ts`](backend/src/config/env.ts)): `MONGO_URI`, `JWT_SECRET`,
  `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_EMAILS`, `AGENT_SERVICE_URL`, `INTERNAL_API_KEY`,
  `CLIENT_ORIGINS`, cookie flags.

### 2.3 Agent service (`agent-service/`) — Render

A FastAPI service that owns the AI: the chatbot, RAG ingestion/retrieval, and resume
generation. It is **internal** — every route except `/health` requires the shared
`x-internal-key`, so only the backend can call it.

- **App** ([`app/main.py`](agent-service/app/main.py)): mounts `/chat`, `/ingest`,
  `/resume`; `GET /health`.
- **Agent** ([`app/agent.py`](agent-service/app/agent.py)): a LangGraph **ReAct** agent with
  a system persona and three tools (§5).
- **RAG** ([`app/rag.py`](agent-service/app/rag.py)): chunking, portfolio ingestion
  (projects + attached PDFs from GridFS + blogs + profile + skills), and retrieval. The full
  re‑ingest runs as a **background job** with pollable status.
- **Vector store** ([`app/vectorstore.py`](agent-service/app/vectorstore.py)): manages the
  Atlas Vector Search index; embeds via Gemini with **batched exponential‑backoff retry on
  429s**; `$vectorSearch` queries.
- **LLM** ([`app/llm.py`](agent-service/app/llm.py)): builds Gemini chat models and the
  `invoke_with_fallback` chain; embeddings are deliberately **outside** the fallback chain
  (mixing embedding models would corrupt the vector space).
- **DB** ([`app/db.py`](agent-service/app/db.py)): read‑only access to the shared Mongo
  collections + GridFS, using the *same* collection names as the backend.

### 2.4 Data store — MongoDB Atlas

One database holds: the six content collections, the GridFS `uploads.*` collections (binary
files), and `portfolio_vectors` (embedded chunks + an Atlas Vector Search index named
`vector_index`, 3072‑dim cosine).

---

## 3. Data Flow

### 3.1 Reading the public site
```
Browser → Vercel (static SPA) → /api/* rewrite → Render backend → MongoDB Atlas
                                                              └→ GET /api/files/:id (GridFS)
```

### 3.2 Sign‑in
```
Browser ──Google Sign‑In──▶ Google → credential
   └─POST /api/auth/google─▶ backend: verify ID token → upsert user → sign JWT
                            ◀── Set‑Cookie: portfolio_session (httpOnly) ──┘
Subsequent requests carry the cookie; attachUser decodes it; role gates apply.
```

### 3.3 Admin uploads a file / publishes content
```
Admin → POST /api/projects/:id/assets (multipart)
      → backend Multer (memory) → GridFS uploads bucket → store /api/files/:id on the doc
```

### 3.4 Chat question (the hot path)
```
Browser ChatWidget
  └─POST /api/chat {message, history}──▶ backend (public)
        └─agentClient POST /chat (x-internal-key)──▶ agent service
              └─ run_agent (LangGraph ReAct):
                   1. Gemini decides which tool(s) to call
                   2. search_portfolio_docs → rag.retrieve → embed query (Gemini)
                      → $vectorSearch on portfolio_vectors → context + sources
                   3. list_projects / get_profile_summary → direct Mongo reads
                   4. Gemini composes the final answer (≤200 words)
              ◀── {answer, sources} ──┘  (Gemini fallback chain on model failure)
        ◀── {answer, sources} ──┘
  ◀── rendered as markdown, sources shown as badges
```

### 3.5 Re‑ingest (admin → RAG)
```
Admin → POST /api/chat/admin/reingest ──▶ backend ──▶ agent POST /ingest/portfolio
   agent returns 202 {status: "started"} immediately; work runs in the background:
     for each project/blog/profile/skills (+ attached PDFs from GridFS):
       chunk → embed in batches (retry on 429) → upsert into portfolio_vectors
   Admin UI polls GET /api/chat/admin/status → {ingest_state, detail, error}
```
> This async‑with‑status design is why a slow/rate‑limited re‑ingest no longer returns an
> opaque 500 — failures surface as `ingest_error` in the admin UI.

---

## 4. Deployment Instructions

Three independent deploys around one database. All tiers are free.

### 4.1 Prerequisites
- **MongoDB Atlas** free cluster (M0) with a database user and network access allowing
  Render egress (0.0.0.0/0 on free tier).
- **Google Cloud OAuth** client ID/secret (authorized origins = your Vercel + local URLs).
- **Google AI (Gemini) API key**.
- Accounts on **Vercel** and **Render**.

### 4.2 Backend + agent on Render (Blueprint)
The repo ships a [`render.yaml`](render.yaml) Blueprint defining both services (Docker, free
plan, `/health` health checks). On Render: **New → Blueprint → pick this repo**. It creates:
- `portfolio-backend` (rootDir `backend/`) — auto‑generates `JWT_SECRET` and
  `INTERNAL_API_KEY`; you enter `MONGO_URI`, `CLIENT_ORIGINS`, `ADMIN_EMAILS`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `portfolio-agent` (rootDir `agent-service/`) — receives `INTERNAL_API_KEY` from the
  backend automatically; you enter `MONGO_URI` and `GOOGLE_API_KEY`. The backend's
  `AGENT_SERVICE_URL` is wired to this service.

Current URLs:
- Backend: `https://portfolio-backend-7ocw.onrender.com`
- Agent: `https://portfolio-agent-r09k.onrender.com`

### 4.3 Frontend on Vercel
- **New Project → import repo → root directory `frontend/`** (Vite preset).
- Env vars: `VITE_GOOGLE_CLIENT_ID` (your OAuth client ID), `VITE_API_BASE` (leave empty —
  [`vercel.json`](frontend/vercel.json) rewrites `/api/*` to the Render backend).
- After the backend is live, ensure its `CLIENT_ORIGINS` includes the Vercel domain so CORS
  + cross‑site cookies work (`COOKIE_SECURE=true`, `SameSite=None`).

### 4.4 First‑run / data
Seed scripts live in `backend/` (`npm run seed*`). The Atlas Vector Search index is created
automatically by the agent on first ingest ([`vectorstore.ensure_index`](agent-service/app/vectorstore.py)).
After deploy, sign in as an admin and run **Admin → Chatbot → Re‑index portfolio** to
populate `portfolio_vectors`.

### 4.5 Local development
```
# backend
cd backend && cp .env.example .env && npm i && npm run dev          # :4000
# agent
cd agent-service && cp .env.example .env && pip install -r requirements.txt \
  && uvicorn app.main:app --reload --port 8001                      # :8001
# frontend
cd frontend && cp .env.example .env && npm i && npm run dev         # :5173
```
Or `docker compose up --build` (see [`docker-compose.yml`](docker-compose.yml)).

> **Deploy gotcha (already fixed):** committed [`.npmrc`](backend/.npmrc) files pin the public
> npm registry so a developer's private registry can't leak into `package-lock.json` and crash
> `npm ci` on Vercel/Render ("Exit handler never called!").

### 4.6 Keeping free‑tier services warm
Render free instances sleep after ~15 min idle and cold‑start (30–50 s). Two mitigations:
1. **On‑visit warmup** (already in place): the frontend calls `GET /api/chat/warmup` on load,
   which wakes the backend *and* pings the agent's `/health`.
2. **Scheduled pre‑heat:** [`.github/workflows/keep-warm.yml`](.github/workflows/keep-warm.yml)
   pings both services every 10 min **only during the India afternoon/evening window**
   (15:00–22:00 IST = 09:30–16:30 UTC). This keeps each service up ~7 h/day
   ≈ `2 × 7 × 30 ≈ 420` instance‑hours/month, safely under Render's **750 free hours/account**
   so the free tier never runs out mid‑month. A 24/7 pinger (≈1440 h) would.

---

## 5. The Chatbot (in depth)

The chatbot is the headline feature: a grounded, tool‑using assistant that answers questions
about the portfolio owner without hallucinating.

### 5.1 What it is
A **LangGraph ReAct agent** ([`agent-service/app/agent.py`](agent-service/app/agent.py))
driven by Gemini. "ReAct" = the model **reasons**, decides to **call a tool**, observes the
result, and loops until it can answer. It is *grounded*: the persona forbids inventing facts
and instructs it to answer only from its tools.

### 5.2 The three tools
| Tool | Source | Returns |
|------|--------|---------|
| `search_portfolio_docs(query)` | RAG: embed query → `$vectorSearch` over `portfolio_vectors` | Top‑5 relevant chunks + their source titles |
| `list_projects(project_type?)` | Direct Mongo read of `portfolio_projects` (published) | JSON list (title, type, summary, skills) |
| `get_profile_summary()` | Direct Mongo read of profile + skills | JSON (name, headline, location, about, skills) |

Tool failures are caught and returned as text — a tool error never crashes the chat.

### 5.3 How a turn executes ([`run_agent`](agent-service/app/agent.py))
1. The frontend sends the new `message` plus prior `history`.
2. History is replayed as `HumanMessage`/`AIMessage`; the system persona is injected as the
   agent `prompt`.
3. The agent runs under **`invoke_with_fallback`** ([`app/llm.py`](agent-service/app/llm.py)):
   it tries the primary Gemini model, and on failure (quota/outage) retries the next model in
   the chain (up to 3). If *all* fail, the user sees a friendly maintenance message — never a
   stack trace.
4. After answering, it best‑effort re‑runs retrieval to attach **sources** (title + kind) for
   the UI to show as badges.
5. The persona caps answers at **≤200 words** for snappy, focused replies.

### 5.4 Where the knowledge comes from (RAG ingestion)
[`rag.ingest_portfolio`](agent-service/app/rag.py) flattens the whole portfolio into text —
projects (including the extracted text of **attached PDFs** read from GridFS), blogs, the
profile, and skills — chunks it (~1000 chars, 150 overlap), embeds each chunk with Gemini, and
upserts into `portfolio_vectors` with `source_id` metadata. Re‑ingesting a source first deletes
its old chunks, so edits stay consistent. Admins can also ingest ad‑hoc **text** or **PDF**
documents.

### 5.5 Reliability features
- **Model fallback chain** so a single Gemini model outage doesn't take the bot down.
- **Embedding retry/backoff** ([`vectorstore._embed_documents_with_retry`](agent-service/app/vectorstore.py)):
  batches of 50, exponential backoff (2 s → … → 60 s, up to 5 tries) specifically on rate‑limit
  (429) errors — the original cause of re‑ingest 500s on the Gemini free tier.
- **Async re‑ingest with status** so long/rate‑limited runs return immediately and surface
  success/failure via `GET /ingest/status` instead of timing out.
- **Cold‑start warmup** (frontend on‑visit + the scheduled GitHub Action) so the first real
  message isn't stuck behind a Render spin‑up.

### 5.6 Frontend experience ([`ChatWidget.tsx`](frontend/src/components/chat/ChatWidget.tsx))
A floating panel with three starter modes — **recruiter** (assess fit against a JD), **project
insights**, and **general overview** — markdown rendering, a typewriter reveal, and source
badges under each answer. It calls only the public `POST /api/chat`; all secrets and the agent
live behind the backend.

---

## 6. Cross‑cutting notes

- **Security boundary:** the agent service is never exposed to browsers. The backend is the
  only caller and authenticates with `x-internal-key`; admin RAG controls additionally require
  an admin session.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): backend tests
  (Vitest + in‑memory Mongo), frontend build, and an agent import smoke test — no production
  secrets touched.
- **Cost posture:** everything runs on free tiers; the documented hour budget (§4.6) is the
  guardrail that keeps it that way.

---

*Companion docs:* [`ARCHITECTURE.md`](ARCHITECTURE.md) ·
[`docs/FRONTEND.md`](docs/FRONTEND.md) · [`docs/BACKEND.md`](docs/BACKEND.md) ·
[`docs/AGENT.md`](docs/AGENT.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
