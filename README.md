# Personal Portfolio

A full-stack personal portfolio with a public site and an admin CMS, an AI
chatbot (RAG over your projects/docs), and an AI resume generator.

### Documentation

| Doc | What's in it |
| --- | ------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Whole-system deep-dive: components, data flow, storage, auth. |
| [docs/FRONTEND.md](docs/FRONTEND.md) | React/Vite SPA — providers, routing, state, API layer, theming. |
| [docs/BACKEND.md](docs/BACKEND.md) | Node/Express API — models, routes, services, auth, GridFS, tests. |
| [docs/AGENT.md](docs/AGENT.md) | Python/FastAPI AI service — LangGraph agent, RAG, vector store, Gemini. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | **Free-tier CI/CD guide** — step-by-step deploy, pipeline, security reasoning. |
| [agent-service/README.md](agent-service/README.md) | Hands-on RAG/agent guide with curl walkthrough. |

## Stack

| Service         | Tech                                             | Local port |
| --------------- | ------------------------------------------------ | ---------- |
| `frontend`      | React + Vite + TypeScript + Tailwind             | 5173 (dev) / 3000 (Docker) |
| `backend`       | Node + Express + TypeScript + Mongoose           | 4000 |
| `agent-service` | Python 3.14 + FastAPI + LangGraph + Gemini       | 8001 |
| database        | **MongoDB Atlas** (cloud, not containerized)     | — |

**One database for everything:** Atlas holds the documents, the uploaded files
(GridFS, served at `/api/files/:id`), **and** the RAG vectors
(**Atlas Vector Search**). There is no separate vector store and no local disk.

---

## 1. Prerequisites & secrets

- **MongoDB Atlas** connection string (free M0 cluster + a DB user + your IP in
  Network Access).
- **Google OAuth** client ID + secret (Google Cloud Console).
- **Gemini API key** (free) — https://aistudio.google.com/app/apikey.
- **Admin email(s)** — the Gmail address(es) allowed to sign in.
- Docker Desktop (for the containerized run) and/or Node 24 + Python 3.14.

Create the env files from the templates:

```bash
cp backend/.env.example       backend/.env
cp agent-service/.env.example agent-service/.env
cp frontend/.env.example      frontend/.env
```

Set the same `MONGO_URI` in `backend/.env` and `agent-service/.env`, and the same
`INTERNAL_API_KEY` in both (it gates backend → agent admin calls).

---

## 2. Run with Docker (single origin — simplest)

**Install Docker once** (Apple Silicon / Intel macOS). Pick one:

```bash
# Option A — Docker Desktop via Homebrew (recommended), then launch it:
brew install --cask docker && open -a Docker
#   (if you don't have Homebrew, install it first:)
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Option B — CLI-only, no GUI (Colima):
brew install docker docker-compose colima && colima start
```

Either way you'll be asked for your **admin password** once. Then run the whole
stack with one command (a `Makefile` wraps compose):

```bash
make env     # first time: creates the .env files (then fill in secrets)
make up      # build + start everything   (== docker compose up --build)
```

Or directly:

```bash
docker compose up --build
```

| URL | What |
| --- | ---- |
| http://localhost:3000 | The site (nginx serves the SPA, proxies `/api` → backend) |
| http://localhost:4000/health | Backend health |
| http://localhost:4000/api/docs | Backend Swagger |
| http://localhost:8001/health | Agent health |
| http://localhost:8001/docs | Agent Swagger |

Because everything is one origin (`localhost:3000`), `VITE_API_BASE` stays empty
and cookies are same-site (`COOKIE_SECURE=false`).

---

## 3. Run locally without Docker

Point Mongo at Atlas (vectors live there too — nothing else to run), then start
each service with hot-reload:

```bash
# backend  → http://localhost:4000
cd backend && npm install && npm run dev

# agent-service → http://localhost:8001
cd agent-service && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt \
  && uvicorn app.main:app --reload --port 8001

# frontend → http://localhost:5173 (Vite proxies /api → backend)
cd frontend && npm install && npm run dev
```

Local env values: `backend/.env` → `AGENT_SERVICE_URL=http://localhost:8001`,
`CLIENT_ORIGINS=http://localhost:5173`.

Run the backend test suite: `cd backend && npm test`.

---

## 4. How the services connect (URL map)

| | Frontend → API | Backend → Agent | Vectors | Cookies |
| --- | --- | --- | --- | --- |
| **Docker** | `/api` via nginx proxy | `http://agent-service:8001` | Atlas Vector Search | Lax, insecure |
| **Local dev** | `/api` via Vite proxy | `http://localhost:8001` | Atlas Vector Search | Lax, insecure |
| **Production** | Vercel `/api` rewrite → backend | `https://agent.onrender.com` | Atlas Vector Search | Secure |

The frontend always calls **relative** `/api/...` paths (see
[endpoints.ts](frontend/src/api/endpoints.ts)); whether that resolves via a dev
proxy, nginx, or a Vercel rewrite is just configuration.

---

## 5. Production deployment (Vercel + Render)

> **Full step-by-step CI/CD walkthrough — including the GitHub Actions pipeline,
> secrets handling, and a security checklist with the reasoning behind each step —
> is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).** The summary below is the quick
> version.

**Frontend → Vercel, backend + agent → Render.** A [render.yaml](render.yaml)
blueprint and [frontend/vercel.json](frontend/vercel.json) are included. Vectors
live in MongoDB Atlas (Atlas Vector Search), so there's no vector-store service.
Continuous integration runs via [.github/workflows/ci.yml](.github/workflows/ci.yml)
(typecheck + tests + build on every push).

### 5a. Backend + agent on Render
Render Dashboard → **New → Blueprint** → pick this repo (uses `render.yaml`). Set the
dashboard secrets:

**Backend** (`portfolio-backend`):
| Var | Value |
| --- | ----- |
| `CLIENT_ORIGINS` | `https://your-app.vercel.app` |
| `MONGO_URI` / `MONGO_DB` | your Atlas string / `portfolio` |
| `ADMIN_EMAILS` | your Gmail |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud |
| `AGENT_SERVICE_URL` | `https://portfolio-agent.onrender.com` |
| `PUBLIC_BASE_URL` | `https://portfolio-backend-7ocw.onrender.com` |
| `COOKIE_SECURE` | `true` · `COOKIE_DOMAIN` empty |
| `JWT_SECRET`, `INTERNAL_API_KEY` | auto-generated by the blueprint |

**Agent** (`portfolio-agent`): `GOOGLE_API_KEY`, `MONGO_URI`, `ALLOWED_ORIGINS`
= the backend URL, and the **same** `INTERNAL_API_KEY` as the backend.

> **Vectors:** RAG embeddings are stored in MongoDB Atlas via Atlas Vector Search;
> the `vector_index` is created automatically on first ingest. Atlas Vector Search
> is available on the free M0 tier — no extra service or paid plan needed.

### 5b. Frontend on Vercel
Import the repo, set **Root Directory = `frontend`** (Vercel reads `vercel.json`).
Env vars:

| Var | Value |
| --- | ----- |
| `VITE_GOOGLE_CLIENT_ID` | your Google client ID |
| `VITE_API_BASE` | leave **empty** (see proxy below) |

**Recommended: proxy `/api` through Vercel** so the site stays a single origin —
this keeps cookies same-site and the relative `/api/files/...` links working.
Add an `/api` rewrite to [frontend/vercel.json](frontend/vercel.json) (before the
SPA fallback), pointing at your backend:

```json
"rewrites": [
  { "source": "/api/(.*)", "destination": "https://portfolio-backend-7ocw.onrender.com/api/$1" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

(Alternative: set `VITE_API_BASE` to the backend URL for true cross-origin calls —
then you must also serve file URLs from the backend origin and keep
`COOKIE_SECURE=true` with SameSite=None + CORS. The rewrite approach is simpler.)

### 5c. Google OAuth for production
In Google Cloud Console → Credentials → your OAuth client → **Authorized
JavaScript origins**, add `https://your-app.vercel.app` (and keep
`http://localhost:5173` / `:3000` for dev). No redirect URIs are needed.

### 5d. Deploy order
1. Deploy Render services; note the backend & agent URLs.
2. Fill backend/agent env vars (cross-reference the URLs + shared `INTERNAL_API_KEY`).
3. Deploy the frontend on Vercel with the `/api` rewrite → backend URL.
4. Add the Vercel origin to `CLIENT_ORIGINS` and to Google's authorized origins.
5. Log in, then **Admin → Chatbot/RAG → Re-index** to populate the knowledge base.

---

## 6. AI models & resilience

Gemini is configured with a **fallback chain**. Set `GEMINI_MODELS` (comma-separated,
all free-tier) in `agent-service/.env`:

```
GEMINI_MODELS=gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-flash-8b
```

If a model is down or over quota, the agent automatically retries the next model
(up to **3 attempts**). If all fail, the **reasoning** (each model's error) is
returned to the caller instead of a generic crash. Embeddings use a single fixed
model on purpose (mixing embedding models would corrupt the vector store).

---

## 7. Roles

- **Visitor** — no login; views everything, chats, sends contact email.
- **Admin** — Google login restricted to `ADMIN_EMAILS`; full CRUD + AI tools.

## 8. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Atlas "IP not whitelisted" | Add your IP (or `0.0.0.0/0`) in Atlas → Network Access. |
| Google login `invalid_client` / "no registered origin" | Add the exact origin to the OAuth client's Authorized JavaScript origins. |
| Admin login works locally but not in prod | `COOKIE_SECURE=true`, use the Vercel `/api` rewrite (or SameSite=None + CORS), and add the Vercel URL to `CLIENT_ORIGINS`. |
| Chat returns a "couldn't reach the AI models" message | Invalid/empty `GOOGLE_API_KEY` or all models over quota — the message includes the reason. |
| Chat works but never cites sources | The vector index isn't ready/populated — run **Admin → Chatbot/RAG → Re-index**; the `vector_index` builds on Atlas in ~20s. |
| Images/files 404 in prod | Ensure the Vercel `/api` rewrite points at the backend (relative file URLs need it). |
