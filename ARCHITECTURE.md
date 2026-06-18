# Personal Portfolio — Technical Architecture

A deep technical reference for the whole system: what it is made of, how the
pieces fit together, where data lives, how each kind of request flows through the
stack, and **why** each framework/tool was chosen.

> **This document is the system-level view.** For component-level deep-dives (every
> file, function, and design decision) see the per-service references:
> [FRONTEND.md](docs/FRONTEND.md) · [BACKEND.md](docs/BACKEND.md) ·
> [AGENT.md](docs/AGENT.md). For shipping it live (free-tier CI/CD, step-by-step,
> security): [DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Table of contents

1. [What this project is](#1-what-this-project-is)
2. [High-level architecture](#2-high-level-architecture)
3. [Technology stack — what & why](#3-technology-stack--what--why)
4. [Execution environment](#4-execution-environment)
5. [Storage model](#5-storage-model)
6. [Authentication & authorization](#6-authentication--authorization)
7. [Request flows (every kind of request)](#7-request-flows-every-kind-of-request)
8. [Component internals](#8-component-internals)
9. [Cross-cutting concerns](#9-cross-cutting-concerns)
10. [API surface](#10-api-surface)

---

## 1. What this project is

A personal portfolio website with two audiences:

- **Visitors** (no login) — browse the home page, projects, blog and resumes,
  and chat with an AI assistant.
- **Admin** (the owner, Google login) — full CRUD over all content, file uploads,
  an AI resume generator, and management of the chatbot's knowledge base.

It is built as a **polyglot monorepo of three services** plus two data stores,
orchestrated with Docker Compose.

---

## 2. High-level architecture

```
                          ┌──────────────────────────────────────────────┐
                          │                  Browser (SPA)                 │
                          │   React + Vite + Tailwind  (visitor + admin)   │
                          └───────────────┬───────────────┬───────────────┘
                                          │ /api/*         │ Google Identity
                                          │ (cookies)      │ Services (login)
                                          ▼                ▼
                          ┌──────────────────────────────────────────────┐
                          │              BACKEND  (Node + Express)         │
                          │  REST API · auth · validation · file storage   │
                          │  proxies AI calls to the agent service         │
                          └───┬───────────────┬───────────────────┬───────┘
            Mongoose          │               │ x-internal-key     │ Mongoose + GridFS
                              ▼               ▼                    ▼
                  ┌───────────────────────┐  ┌──────────────────┐  (files stored in
                  │     MongoDB Atlas     │  │  AGENT SERVICE    │   the same Atlas DB)
                  │  documents · GridFS   │◄─┤ Python · FastAPI  │
                  │  files · RAG vectors  │  │ LangGraph · RAG   │──► Gemini API
                  │  (Atlas Vector Search)│  └──────────────────┘    (Google)
                  └───────────────────────┘
```

**Four moving parts:**

| # | Component | Role |
|---|-----------|------|
| 1 | **Frontend** | Single-page app for visitors and admin. |
| 2 | **Backend** | Source of truth for the API, auth, validation, file storage. |
| 3 | **Agent service** | All AI: chatbot (RAG) + resume generation. |
| 4 | **MongoDB Atlas** | One DB for everything: documents, files (GridFS), **and** RAG vectors (Atlas Vector Search). |

> Design principle: the **backend owns all writes and auth**; the **agent service
> is AI-only** and reads the DB read-only. The browser never talks to the agent
> service or the databases directly.

---

## 3. Technology stack — what & why

### Frontend

| Tool | What it does | Why |
|------|--------------|-----|
| **React 18** | UI component model | Industry standard, huge ecosystem. |
| **Vite** | Dev server + bundler | Fast HMR, simple config, first-class TS. |
| **TypeScript** | Static typing | Catches errors at compile time; shared types with API responses. |
| **Tailwind CSS** | Utility-first styling | Fast, consistent design; built-in dark mode via `class`. |
| **React Router** | Client-side routing | Standard SPA routing incl. nested admin routes + guards. |
| **TanStack Query** | Server-state cache | Caching, refetch, loading/error states without boilerplate. |
| **axios** | HTTP client | Interceptable instance, `withCredentials` for cookie auth. |
| **@react-oauth/google** | Google sign-in button | Produces the Google ID token used for admin login. |
| **framer-motion** | Animations | Smooth, declarative transitions. |
| **react-markdown** | Render markdown | About/blog/project/resume content is authored in markdown. |
| **lucide-react** | Icons | Lightweight, consistent icon set. |
| **nginx** (prod) | Static file server + reverse proxy | Serves the built SPA and proxies `/api`. |

### Backend

| Tool | What it does | Why |
|------|--------------|-----|
| **Node 24 + Express 4** | HTTP server / routing | Minimal, ubiquitous, easy middleware model. |
| **TypeScript** | Typing | Safety across models, routes, services. |
| **Mongoose 8** | MongoDB ODM | Schemas, validation, indexes, GridFS access. |
| **google-auth-library** | Verify Google ID tokens | Server-side verification of the login credential. |
| **jsonwebtoken** | Sign/verify session JWT | Stateless sessions stored in an httpOnly cookie. |
| **multer** (memory storage) | Parse multipart uploads | Gives us the file buffer to stream into GridFS. |
| **zod** | Request validation | Declarative body schemas → clean 400s. |
| **slugify** | URL slugs | Human-readable, unique slugs for projects/blogs. |
| **swagger-ui-express** | API docs | Interactive OpenAPI docs at `/api/docs`. |
| **axios + form-data** | Call the agent service | Proxy chat/RAG/resume requests (incl. PDF forwarding). |
| **cookie-parser / cors** | Cookies + CORS | Read the session cookie; allow the SPA origin. |
| **Vitest + Supertest** | Tests | Fast TS test runner + HTTP assertions. |
| **mongodb-memory-server** | Test DB | Real MongoDB in-memory for CRUD tests, no external infra. |

### Agent service

| Tool | What it does | Why |
|------|--------------|-----|
| **Python 3.14 + FastAPI** | AI HTTP service | Best ecosystem for LLM/RAG tooling; async, typed, auto Swagger. |
| **uvicorn** | ASGI server | Runs FastAPI. |
| **LangGraph** | Agent orchestration | Builds a tool-using ReAct agent (decide → call tool → answer). |
| **langchain-google-genai** | Gemini LLM + embeddings | Bridges Gemini into LangChain/LangGraph tooling. |
| **pymongo** | Mongo access + vectors | Reads projects/blogs/profile AND stores/queries RAG vectors via Atlas Vector Search (`$vectorSearch`). |
| **pypdf** | Extract PDF text | Turn uploaded PDFs into ingestible text. |
| **pydantic-settings** | Typed config | Env-driven settings. |
| **dnspython** | Resolve `mongodb+srv://` | Required for Atlas SRV connection strings. |

### Data stores

| Store | What it does | Why |
|-------|--------------|-----|
| **MongoDB Atlas** | Documents + files (GridFS) + RAG vectors | One cloud DB for everything; flexible schema. |
| **Atlas Vector Search** | Vector similarity search | Native `$vectorSearch` on the same DB (available on the free M0 tier) — no separate vector store. |

---

## 4. Execution environment

Everything runs as containers via **`docker-compose.yml`**:

| Service | Image / build | Port (host:container) | Notes |
|---------|---------------|-----------------------|-------|
| `frontend` | built → nginx | `3000:80` | Serves the SPA, proxies `/api` to backend. |
| `backend` | Node 24 alpine | `4000:4000` | REST API. |
| `agent-service` | Python 3.14 slim | `8001:8001` | AI service. |
| *MongoDB* | **Atlas (cloud)** | — | Documents, GridFS files, and RAG vectors. Not containerized. |

- **Networking:** Compose puts services on one network; they reach each other by
  service name (`backend`, `agent-service`). The browser only ever hits
  `localhost:3000` (and `localhost:4000` for file URLs).
- **Persistence:** no Docker volumes — all app data (documents, files, vectors)
  lives in Atlas.
- **Config:** each service reads a `.env` file (`backend/.env`,
  `agent-service/.env`, `frontend/.env`). Secrets: Atlas URI, Google OAuth
  client, Gemini key, `INTERNAL_API_KEY` (shared backend↔agent).

**Two run modes:**

- **Production-like:** `docker compose up --build` → SPA at `:3000`, nginx proxies
  `/api` to the backend.
- **Local dev:** point Mongo at Atlas, then `npm run dev` (backend `:4000`,
  frontend Vite `:5173` which proxies `/api`) and `uvicorn` for the agent.
  HMR + reload on all three.

---

## 5. Storage model

### 5.1 MongoDB Atlas (documents)

Database: **`portfolio`** (set explicitly via `MONGO_DB`, independent of the URI
path). Collection names are explicit (not Mongoose's auto-pluralization),
centralized in `backend/src/config/collections.ts`:

| Collection | Holds |
|------------|-------|
| `portfolio_users` | Admin user record (email, googleId, name). |
| `portfolio_profile` | **Singleton** home-page content (about, socials, education). |
| `portfolio_skills` | Skills (name, category, level). |
| `portfolio_projects` | Projects (about/impact/learning, type, assets[], links). |
| `portfolio_blogs` | Blog articles (markdown, tags, published). |
| `portfolio_resumes` | Resumes (uploaded PDF or AI-generated markdown). |

The agent service reads the same collections via matching names in
`agent-service/app/config.py`.

### 5.2 MongoDB GridFS (files)

All uploaded media — profile image, project PDFs/recordings, resume PDFs — is
stored **in MongoDB via GridFS** (bucket `uploads` → collections `uploads.files`
and `uploads.chunks`). **Nothing is written to local disk.**

- Upload: `multer.memoryStorage()` gives the backend the file buffer, which is
  streamed into GridFS (`backend/src/services/gridfs.ts`).
- Serve: `GET /api/files/:id` streams the bytes back, with **HTTP range support**
  so videos/audio can seek. Documents store the URL `…/api/files/<id>`.
- Delete: removing a project/asset/resume (or replacing an image) deletes the
  GridFS file too.

> Trade-off: GridFS counts against Atlas storage (free tier = 512 MB), so large
> video uploads will fill it quickly. Object storage (S3/Cloudinary) is the usual
> alternative for heavy media; the storage layer is isolated in `gridfs.ts` so it
> can be swapped.

### 5.3 RAG vectors (Atlas Vector Search)

Collection **`portfolio_vectors`** (same DB) holds one document per chunk:
`{ _id, text, embedding, metadata: { source_id, title, kind } }`. Embeddings come
from Gemini `gemini-embedding-001` (**3072 dims**). An Atlas Vector Search index
(`vector_index`, cosine) is created automatically on first ingest; retrieval uses
the `$vectorSearch` aggregation stage. No separate vector database.

---

## 6. Authentication & authorization

**Login (admin only):**

1. Browser renders the Google sign-in button (`@react-oauth/google`) configured
   with `VITE_GOOGLE_CLIENT_ID`.
2. On success Google returns a **credential** = a signed **ID token (JWT)**.
3. Frontend `POST /api/auth/google { credential }`.
4. Backend verifies the token with `google-auth-library` (signature + `aud` ==
   `GOOGLE_CLIENT_ID` + email verified), then checks the email against
   **`ADMIN_EMAILS`** (allowlist).
5. Backend upserts the user and issues its **own JWT** (7-day), set as an
   **httpOnly cookie** `portfolio_session`.

**Per-request:**

- `attachUser` middleware reads the cookie, verifies the JWT, and attaches
  `req.user` (never throws — visitors are just anonymous).
- `requireAdmin` middleware gates all mutations; missing/invalid session → **401**.

**Status-code contract (enforced + tested):**

| Situation | Code |
|-----------|------|
| Bad/missing request body | `400` |
| Invalid/expired Google credential | `401` |
| Missing/invalid session on admin route | `401` |
| Valid Google account **not** in allowlist | `403` |
| Unsupported upload type | `400` |
| Upload too large | `413` |

**Service-to-service:** the agent service's admin endpoints (`/ingest/*`,
`/resume/generate`) require an `x-internal-key` header equal to
`INTERNAL_API_KEY`; only the backend knows it. The public `/chat` endpoint needs
no key. The browser never calls the agent service directly.

---

## 7. Request flows (every kind of request)

### 7.1 Visitor reads content (public GET)
```
Browser → GET /api/projects → (nginx/Vite proxy) → Backend
  attachUser (no cookie → anonymous)
  → Mongoose query (published only for visitors)
  → JSON array → cached by TanStack Query
```

### 7.2 Admin login
```
Browser (Google button) → ID token
  → POST /api/auth/google {credential}
  → Backend verify (google-auth-library) → allowlist check
  → upsert user → sign JWT → Set-Cookie portfolio_session (httpOnly)
  → { user }
```

### 7.3 Admin write (create/update/delete)
```
Browser (axios, withCredentials) → PUT /api/projects/:id
  → attachUser → requireAdmin (401 if not admin)
  → zod validates body (400 if invalid)
  → Mongoose update (slug regenerated if title changed)
  → JSON → TanStack Query invalidates & refetches
```

### 7.4 File upload (→ GridFS)
```
Browser (FormData) → POST /api/uploads (or /profile/image, /projects/:id/assets, /resumes/:id/file)
  → requireAdmin
  → multer memoryStorage → file.buffer (fileFilter: 400 if wrong type; 413 if too large)
  → gridfs.uploadBuffer() → bytes streamed into Atlas GridFS
  → returns { url: PUBLIC_BASE_URL/api/files/<id> }
```

### 7.5 File download / media streaming
```
<img>/<video> src = /api/files/<id> → Backend
  → gridfs.getFileInfo (404 if missing)
  → if Range header: 206 partial + Content-Range (seek support)
    else: 200 full
  → openDownloadStream piped to response
```

### 7.6 Chatbot (RAG) — the most involved flow
```
Browser (chat widget) → POST /api/chat { message, history }   (public)
  → Backend proxies → Agent POST /chat
     → LangGraph ReAct agent (Gemini) decides which tools to call:
         • search_portfolio_docs(q):
             embed q (Gemini) → Atlas $vectorSearch top-k → context chunks
         • list_projects / get_profile_summary: read MongoDB (pymongo)
     → Gemini composes a grounded answer from tool outputs
     → also runs a retrieval pass to attach `sources`
  → { answer, sources } → back through Backend → rendered in the widget
```

### 7.7 RAG ingestion ("training")
```
Admin UI (Chatbot/RAG) → POST /api/chat/admin/reingest  (requireAdmin)
  → Backend proxies with x-internal-key → Agent POST /ingest/portfolio
     → read projects/blogs/profile from Mongo
     → chunk text (~1000 chars, overlap)
     → embed each chunk (Gemini gemini-embedding-001)
     → upsert vectors into MongoDB portfolio_vectors (keyed by source_id)
  → { chunks: N }
```
PDF/pasted-doc ingestion is the same, via `/ingest/pdf` (pypdf extracts text,
forwarded in-memory — not stored) and `/ingest/document`. This is **retrieval
augmentation, not fine-tuning** — Gemini's weights never change.

### 7.8 AI resume generation
```
Admin UI → POST /api/resumes/generate { role, projectIds, skills, instructions }
  → requireAdmin → Backend proxies (x-internal-key) → Agent POST /resume/generate
     → read selected projects + profile from Mongo
     → build a prompt → Gemini → markdown resume
  → Backend saves it as a Resume doc (source="generated", isPublic=false)
  → admin reviews, can mark public
```

---

## 8. Component internals

> A high-level map follows. Each component has a dedicated file-by-file reference:
> [FRONTEND.md](docs/FRONTEND.md), [BACKEND.md](docs/BACKEND.md), [AGENT.md](docs/AGENT.md).

### 8.1 Frontend (`frontend/src`)
- `main.tsx` — providers: GoogleOAuth, TanStack Query, Theme, Auth, Router.
- `App.tsx` — routes; public pages + guarded `admin/*` (lazy-loaded for a small
  initial bundle).
- `api/` — one module per resource; **all paths centralized in `api/endpoints.ts`**.
- `lib/api.ts` — axios instance (`baseURL` from `VITE_API_BASE`, `withCredentials`).
- `context/` — `AuthContext` (session) and `ThemeContext` (dark/light).
- `components/` — layout, UI primitives, chat widget, admin editors.

### 8.2 Backend (`backend/src`)
- `index.ts` — connect to Atlas → start Express.
- `app.ts` — middleware chain: CORS → JSON → cookies → `attachUser` → Swagger →
  `/api` router → 404 → error handler.
- `config/` — `env` (typed env), `db` (Mongoose connect w/ explicit `dbName`),
  `collections` (collection names).
- `models/` — Mongoose schemas bound to explicit collections.
- `routes/` — one router per resource; `requireAdmin` on mutations; zod on bodies.
- `services/` — `auth` (Google verify + JWT), `gridfs` (file storage),
  `agentClient` (calls the AI service).
- `middleware/` — `auth`, `upload` (multer), `error` (maps Zod/HttpError/Multer).
- `docs/` — OpenAPI spec served via Swagger UI.

### 8.3 Agent service (`agent-service/app`)
- `main.py` — FastAPI app + routers (`chat`, `ingest`, `resume`).
- `agent.py` — LangGraph ReAct agent + tool definitions.
- `rag.py` — chunk / ingest / retrieve.
- `vectorstore.py` — MongoDB Atlas Vector Search (`$vectorSearch`).
- `llm.py` — Gemini chat + embeddings.
- `db.py` — read-only Mongo access.
- `resume.py` — resume prompt + generation.
- `security.py` — `x-internal-key` dependency.

---

## 9. Cross-cutting concerns

- **Validation:** zod on the backend, Pydantic on the agent service → consistent
  `400`s with details.
- **Error handling:** a single backend error middleware maps `ZodError` → 400,
  `HttpError` → its status, `MulterError` → 400/413, everything else → 500.
- **Configuration:** all secrets/hosts via env; no hardcoded credentials.
- **Separation of concerns:** browser → backend only; AI isolated behind the
  internal key; databases never exposed publicly.
- **Testing:** `npm test` (Vitest + Supertest) covers auth/authorization/validation
  (no DB) and full CRUD (in-memory MongoDB). ~30 tests.
- **API docs:** backend Swagger at `/api/docs`; agent service Swagger at `/docs`.

---

## 10. API surface

**Backend (`/api`)** — `auth/*`, `profile`, `skills`, `projects`, `blogs`,
`resumes` (+ `resumes/generate`), `uploads`, `files/:id`, `chat`
(+ `chat/admin/*` for RAG management). Public GETs for content; admin-gated
mutations; full reference at **`/api/docs`**.

**Agent service** — `POST /chat` (public); `POST /ingest/portfolio|document|pdf`,
`POST /ingest/reset`, `GET /ingest/status`, `POST /resume/generate`
(all `x-internal-key`). See **`agent-service/README.md`** for a hands-on guide and
curl walkthrough.

---

*Related docs: [`README.md`](README.md) (quick start), [`agent-service/README.md`](agent-service/README.md) (RAG/agent guide).*
