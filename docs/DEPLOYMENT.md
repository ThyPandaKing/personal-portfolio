# Deployment & CI/CD — Free-Tier Guide

A complete, step-by-step guide to taking this portfolio from a local checkout to a
**live, automatically-deployed** site — using only **free** services — with a
**CI/CD pipeline** (GitHub Actions for CI, git-push auto-deploy for CD) and the
security reasoning behind every step.

This guide is written to be *teachable*: each step says **what** you do, **why** it
matters, and **what it means**. If you only want the quick version, the
[README](../README.md) has a condensed deploy section; this document is the deep
reference.

---

## Table of contents

1. [What "deployment" means here](#1-what-deployment-means-here)
2. [Target topology (free tier)](#2-target-topology-free-tier)
3. [Why these services](#3-why-these-services)
4. [What CI vs CD mean — and our pipeline](#4-what-ci-vs-cd-mean--and-our-pipeline)
5. [Prerequisites & accounts](#5-prerequisites--accounts)
6. [Part A — Provision data & identity (secrets first)](#6-part-a--provision-data--identity-secrets-first)
7. [Part B — Continuous Integration (GitHub Actions)](#7-part-b--continuous-integration-github-actions)
8. [Part C — Continuous Deployment (Render + Vercel)](#8-part-c--continuous-deployment-render--vercel)
9. [Part D — Wire the origins together](#9-part-d--wire-the-origins-together)
10. [Part E — First-run & verification](#10-part-e--first-run--verification)
11. [Secrets reference — what lives where](#11-secrets-reference--what-lives-where)
12. [Security hardening checklist](#12-security-hardening-checklist)
13. [Operations: rollback, monitoring, limits](#13-operations-rollback-monitoring-limits)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What "deployment" means here

"Deploying" this project means running its **three services** somewhere public and
pointing them at a **managed database**, so anyone can visit the site and the owner
can log in to administer it. The pieces:

| Service | What it is | Where it goes |
|---------|-----------|---------------|
| **frontend** | Static React build (HTML/JS/CSS) | A CDN/static host (**Vercel**). |
| **backend** | Always-on Node API (Docker) | A container host (**Render**). |
| **agent-service** | Always-on Python AI API (Docker) | A container host (**Render**). |
| **database** | MongoDB + files (GridFS) + RAG vectors | **MongoDB Atlas** (managed cloud). |

> **What it means:** static assets are cheap and globally cached, but the API and AI
> services must be *running processes* (they hold DB connections and call Gemini), so
> they live on a container host rather than a CDN. The database is *managed* so you
> never operate a Mongo server yourself.

---

## 2. Target topology (free tier)

```
                    ┌──────────────────────────┐
   Visitor /        │   Vercel (frontend SPA)  │   static build, global CDN
   Admin browser ──►│   /api/* rewrite ─────────┼──┐  (single origin → simple cookies)
                    └──────────────────────────┘  │
                                                   ▼
                                   ┌────────────────────────────┐
                                   │  Render: portfolio-backend  │  Node + Express (Docker)
                                   │  (owns auth, writes, files) │
                                   └───────┬──────────────┬──────┘
                  Mongoose (TLS)           │              │  x-internal-key
                                           ▼              ▼
                          ┌────────────────────────┐  ┌────────────────────────────┐
                          │   MongoDB Atlas (M0)    │◄─┤ Render: portfolio-agent     │ Python + FastAPI (Docker)
                          │ docs · GridFS · vectors │  │ RAG + resume (reads DB)     │──► Gemini API (Google)
                          └────────────────────────┘  └────────────────────────────┘
```

The **browser only ever talks to one origin** (the Vercel domain). Vercel rewrites
`/api/*` to the Render backend; the backend is the only thing that talks to the
agent service and the database. This single-origin shape is what keeps authentication
cookies simple and the attack surface small (see [§12](#12-security-hardening-checklist)).

---

## 3. Why these services

| Concern | Choice | Free tier | Why this one |
|---------|--------|-----------|--------------|
| Static hosting + CI/CD for the SPA | **Vercel** | Generous hobby tier | First-class Vite support, instant git-push deploys, built-in `/api` **rewrites** (lets us keep one origin), global CDN, automatic HTTPS. |
| Container hosting for the two APIs | **Render** | Free web services | Native **Docker** + **Blueprint** (`render.yaml`) so both services deploy from one file; free TLS; git-push auto-deploy; health checks. |
| Database + files + vectors | **MongoDB Atlas M0** | 512 MB, shared | One managed DB for documents, GridFS files **and** Atlas Vector Search — no separate vector DB to run or pay for. |
| AI (LLM + embeddings) | **Google Gemini** | Free API tier | Free `gemini-*-flash` models + `gemini-embedding-001`; the agent's [fallback chain](AGENT.md#5-llm-layer--the-gemini-fallback-chain) survives free-tier quota limits. |
| Login | **Google OAuth** | Free | We verify Google ID tokens server-side; no password storage to secure. |
| CI | **GitHub Actions** | Free for public repos / generous for private | Runs typecheck/test/build on every push *before* anything deploys. |

> **The trade-off you're accepting:** Render's free web services **sleep after
> ~15 min of inactivity** and cold-start on the next request (~30–60 s). For a
> portfolio that's fine; if you need always-warm, that's the first thing to upgrade.
> Atlas M0's 512 MB also means **large video uploads will fill storage** — keep heavy
> media off GridFS (the storage layer is isolated so you can move to S3/Cloudinary
> later, see [BACKEND.md §8](BACKEND.md#8-file-storage-gridfs)).

---

## 4. What CI vs CD mean — and our pipeline

- **CI (Continuous Integration)** = on every push, automatically **build and test**
  the code so broken changes are caught *before* they ship. *Why:* a green check on
  every commit means `main` is always deployable; bugs are found in minutes, not in
  production.
- **CD (Continuous Deployment)** = automatically **release** what passed CI. *Why:*
  removes manual, error-prone deploy steps; what's on `main` is what's live.

**Our pipeline:**

```
 git push  ──►  GitHub Actions (CI)            ──►  CD (git-integrated hosts)
                ├─ backend:  typecheck + test         Render builds backend Docker image
                ├─ agent:    import/compile check      Render builds agent  Docker image
                └─ frontend: typecheck + vite build    Vercel builds + deploys the SPA
                (must pass)                            (auto on push to main)
```

> **Design choice — "CI in GitHub, CD on the host."** Render and Vercel each watch
> the repo and redeploy on push to `main`; GitHub Actions is the **quality gate** in
> front of them. We keep deploy *credentials* on the hosts (not in Actions), so the
> CI runner never holds production secrets — a smaller blast radius if a workflow is
> ever compromised. (An alternative — deploying *from* Actions via deploy hooks — is
> noted in [§8](#8-part-c--continuous-deployment-render--vercel).)

---

## 5. Prerequisites & accounts

Create free accounts (all have free tiers): **GitHub**, **MongoDB Atlas**,
**Google Cloud** (OAuth) + **Google AI Studio** (Gemini key), **Render**, **Vercel**.

Locally you need **git**, and optionally Node 24 / Python 3.14 / Docker for testing
before you push. Push this repository to a GitHub repo (it's the source of truth all
three hosts deploy from):

```bash
git init && git add . && git commit -m "initial"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> **Security note — never commit secrets.** [`.gitignore`](../.gitignore) already
> excludes every `.env` (only `*.env.example` is committed). Before the first push,
> confirm `git status` shows **no** `.env` files. Secrets live in the hosting
> dashboards, never in git (see [§11](#11-secrets-reference--what-lives-where)).

---

## 6. Part A — Provision data & identity (secrets first)

Do this **before** deploying code, because the services need these values to boot.

### 6.1 MongoDB Atlas (database, files, vectors)
1. Create a free **M0** cluster.
2. **Database Access** → add a database user with a strong password. *Why a dedicated
   user:* least privilege — this user only has access to your cluster, and you can
   rotate it without touching anything else.
3. **Network Access** → add an IP allowlist entry. For Render (whose egress IPs vary
   on the free tier) you'll typically use `0.0.0.0/0` (allow from anywhere).
   > **What this means / the risk:** `0.0.0.0/0` lets *any* IP attempt to connect —
   > but they still need the database **credentials**, which only your services have.
   > It's a pragmatic free-tier choice; the real protection is the strong password +
   > TLS. On a paid tier, lock this to Render's static egress IPs.
4. Copy the **connection string** (`mongodb+srv://…`). This becomes `MONGO_URI` for
   **both** the backend and the agent. Set `MONGO_DB=portfolio`.

### 6.2 Google OAuth (admin login)
1. Google Cloud Console → **APIs & Services → Credentials → OAuth client ID** (type:
   *Web application*).
2. Under **Authorized JavaScript origins**, add your future Vercel URL
   (`https://<your-app>.vercel.app`) and dev origins (`http://localhost:5173`,
   `http://localhost:3000`). *No redirect URIs are needed* — we use Google Identity
   Services token flow, not the redirect flow.
3. Copy the **Client ID** and **Client Secret**.

> **Why server-side token verification matters:** the browser obtains a Google
> **ID token**, but the backend re-verifies its signature, audience (`aud` must equal
> our client ID), and that the email is verified — *then* checks it against
> `ADMIN_EMAILS`. We never trust the client's claim of "I'm the admin"; identity is
> proven cryptographically and authorization is an explicit allowlist.

### 6.3 Gemini API key
Get a free key at <https://aistudio.google.com/app/apikey>. This is `GOOGLE_API_KEY`
for the agent service. *Why the agent only:* the LLM is exclusively the agent's
concern; the backend never holds the Gemini key (least privilege again).

### 6.4 Generate shared secrets
- `JWT_SECRET` — a long random string the backend uses to sign session cookies.
- `INTERNAL_API_KEY` — a long random string shared **only** between backend and
  agent so the backend can call the agent's admin endpoints.

Generate strong values: `openssl rand -base64 48`. On Render these two can be
**auto-generated by the blueprint** (`generateValue: true`), which is preferable —
the secret is created in the platform and never seen by a human or git.

> **Why two different secrets:** they protect different boundaries. `JWT_SECRET`
> proves *a session cookie was issued by us* (browser↔backend). `INTERNAL_API_KEY`
> proves *a request came from our backend* (backend↔agent). Compromising one must not
> grant the other.

---

## 7. Part B — Continuous Integration (GitHub Actions)

Add the workflow at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (it
ships with this repo). It runs three independent jobs on every push/PR:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24", cache: "npm", cache-dependency-path: backend/package-lock.json }
      - run: npm ci            # reproducible install from the lockfile
      - run: npm run typecheck # tsc --noEmit: catches type errors
      - run: npm test          # Vitest + Supertest (~30 tests, see BACKEND.md §11)

  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24", cache: "npm", cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run build     # tsc -b && vite build: typecheck + production bundle
        env: { VITE_GOOGLE_CLIENT_ID: "ci-placeholder", VITE_API_BASE: "" }

  agent:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: agent-service } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.14" }
      - run: pip install -r requirements.txt
      - run: python -c "import app.main"  # import-time smoke test: config + wiring load
```

**Why each step exists:**
- **`npm ci`** (not `npm install`) installs *exactly* what the lockfile pins —
  reproducible builds, no surprise version drift between CI and prod.
- **`typecheck` / `build`** turn type errors into a red CI run instead of a runtime
  crash in production.
- **`npm test`** enforces the [status-code/auth contract](BACKEND.md#13-error--status-code-contract)
  — the suite needs no database (in-memory Mongo or none), so it runs in seconds with
  no secrets.
- **agent import smoke test** catches broken imports / config wiring without needing
  a Gemini key or a database.

> **Security note — CI needs no production secrets.** None of these jobs talk to
> Atlas, Google, or Gemini, so the runner holds nothing sensitive. The frontend build
> uses a placeholder client ID purely to compile. This is deliberate: keep secrets out
> of CI logs and out of the runner entirely.
>
> **Branch protection (recommended):** in GitHub → Settings → Branches, require the
> CI checks to pass before merging to `main`. *What it means:* nothing reaches `main`
> (and therefore nothing auto-deploys) unless CI is green.

---

## 8. Part C — Continuous Deployment (Render + Vercel)

### 8.1 Backend + agent on Render (Blueprint)
The repo includes [`render.yaml`](../render.yaml), which declares **both** services
(Docker, free plan, health checks). To deploy:

1. Render Dashboard → **New → Blueprint** → connect your GitHub repo → it reads
   `render.yaml` and creates `portfolio-backend` and `portfolio-agent`.
2. Fill the dashboard secrets (the values marked `sync: false` are intentionally
   **not** in git):

   **`portfolio-backend`:**
   | Var | Value |
   |-----|-------|
   | `CLIENT_ORIGINS` | `https://<your-app>.vercel.app` |
   | `MONGO_URI` / `MONGO_DB` | your Atlas string / `portfolio` |
   | `ADMIN_EMAILS` | your Gmail (comma-separated for several admins) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from §6.2 |
   | `AGENT_SERVICE_URL` | `https://portfolio-agent.onrender.com` |
   | `PUBLIC_BASE_URL` | `https://portfolio-backend-7ocw.onrender.com` |
   | `COOKIE_SECURE` | `true` (HTTPS in prod) · `COOKIE_DOMAIN` empty |
   | `JWT_SECRET`, `INTERNAL_API_KEY` | **auto-generated** by the blueprint |

   **`portfolio-agent`:** `GOOGLE_API_KEY`, `MONGO_URI` (+ `MONGO_DB=portfolio`),
   `ALLOWED_ORIGINS` = the backend URL, and the **same** `INTERNAL_API_KEY` as the
   backend.

3. Deploy. Render builds each `Dockerfile`, runs the container, and polls
   `healthCheckPath: /health`. *Why a health check:* Render only routes traffic once
   the service reports healthy, and restarts it if it stops responding.

> **Why a Blueprint (infrastructure-as-code)?** `render.yaml` makes the deployment
> **reproducible and reviewable** — the service topology lives in git, so re-creating
> the environment (or spinning up a staging copy) is one click, not a checklist.

> **The `INTERNAL_API_KEY` must match** on both services or every admin RAG/resume
> call returns `401`. If the blueprint generates it on the backend, copy that exact
> value into the agent (or define it once and reference it).

### 8.2 Frontend on Vercel
1. Vercel → **Add New Project** → import the repo → set **Root Directory =
   `frontend`** (Vercel reads [`frontend/vercel.json`](../frontend/vercel.json)).
2. **Environment variables:** `VITE_GOOGLE_CLIENT_ID` = your Google client ID.
   Leave `VITE_API_BASE` **empty**.
3. **Add the `/api` rewrite** so the SPA stays a single origin. Edit
   `frontend/vercel.json` so the API rewrite comes **before** the SPA fallback:

   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://portfolio-backend-7ocw.onrender.com/api/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

> **Why the rewrite (and why `VITE_API_BASE` stays empty):** the SPA calls **relative**
> `/api/...` paths. The rewrite makes Vercel forward those to the backend, so the
> browser sees a **single origin** (your Vercel domain). That means the session cookie
> is *same-site* — no `SameSite=None` + CORS gymnastics, and relative `/api/files/...`
> media links just work. (Alternative: set `VITE_API_BASE` to the backend URL for true
> cross-origin calls — then you must also keep `COOKIE_SECURE=true`, set
> `SameSite=None`, and configure CORS. The rewrite is simpler and safer.)

### 8.3 (Optional) Deploy *from* GitHub Actions instead
If you prefer Actions to trigger deploys (e.g. to deploy only after CI passes on a
tag), add a final job that calls each host's **deploy hook**:

```yaml
  deploy:
    needs: [backend, frontend, agent]   # only after CI is green
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: curl -fsS -X POST "$RENDER_BACKEND_DEPLOY_HOOK"
      - run: curl -fsS -X POST "$RENDER_AGENT_DEPLOY_HOOK"
    env:
      RENDER_BACKEND_DEPLOY_HOOK: ${{ secrets.RENDER_BACKEND_DEPLOY_HOOK }}
      RENDER_AGENT_DEPLOY_HOOK:   ${{ secrets.RENDER_AGENT_DEPLOY_HOOK }}
```

Store the hook URLs as **GitHub repository secrets** (Settings → Secrets and
variables → Actions). *Why secrets, not plain env:* deploy hooks are capability URLs
— anyone with the URL can trigger a deploy, so they must never appear in code or logs.
*Trade-off:* this puts a deploy capability in CI; the default (host-watches-git)
keeps CI secret-free, which is why it's our recommended path.

---

## 9. Part D — Wire the origins together

The three hosts must agree on URLs. Do this once all three are deployed:

1. Note the Render URLs (`…-backend.onrender.com`, `…-agent.onrender.com`) and the
   Vercel URL.
2. Backend: `AGENT_SERVICE_URL` → agent URL; `PUBLIC_BASE_URL` → backend URL;
   `CLIENT_ORIGINS` → Vercel URL.
3. Agent: `ALLOWED_ORIGINS` → backend URL.
4. Vercel `vercel.json` rewrite → backend URL.
5. Google Cloud → OAuth client → **Authorized JavaScript origins** → add the Vercel
   URL.

> **Why this matters:** `CLIENT_ORIGINS` (backend CORS) and Google's authorized
> origins are **allowlists** — a request from an origin not on the list is rejected.
> This is what stops another website from making authenticated calls on your behalf
> or initiating a Google login under your client ID.

**Deploy order recap:** Render first (so you have the API URLs) → fill cross-references
→ Vercel with the rewrite → add the Vercel origin to `CLIENT_ORIGINS` + Google.

---

## 10. Part E — First-run & verification

1. **Health:** open `https://…-backend.onrender.com/health` and
   `https://…-agent.onrender.com/health` → both `{"status":"ok"}`. (First hit may
   cold-start; wait ~30–60 s.)
2. **Site:** open the Vercel URL → the SPA loads.
3. **Login:** click sign-in → choose your allowlisted Gmail → you should land in
   `/admin`. (If `403`, your email isn't in `ADMIN_EMAILS`; if the popup errors, the
   Vercel origin isn't in Google's authorized origins.)
4. **Seed content** via the admin UI (profile, projects, blogs), then
   **Admin → Chatbot/RAG → Re-index** to build the knowledge base. The Atlas
   `vector_index` builds in ~20 s.
5. **Smoke-test the chatbot** on the public site — confirm it answers and cites
   sources.

> **What "re-index" does:** it runs `/ingest/portfolio` (see
> [AGENT.md §6](AGENT.md#6-rag-pipeline)) — chunk, embed, and store your content as
> vectors. Until you do this, the chatbot can answer from DB tools but won't cite
> document sources.

---

## 11. Secrets reference — what lives where

| Secret | Backend (Render) | Agent (Render) | Frontend (Vercel) | GitHub Actions |
|--------|:---:|:---:|:---:|:---:|
| `MONGO_URI` / `MONGO_DB` | ✅ | ✅ | — | — |
| `GOOGLE_CLIENT_ID` | ✅ | — | ✅ (`VITE_GOOGLE_CLIENT_ID`) | — |
| `GOOGLE_CLIENT_SECRET` | ✅ | — | — | — |
| `GOOGLE_API_KEY` (Gemini) | — | ✅ | — | — |
| `JWT_SECRET` | ✅ | — | — | — |
| `INTERNAL_API_KEY` | ✅ | ✅ (same value) | — | — |
| `ADMIN_EMAILS` | ✅ | — | — | — |
| Deploy hooks (optional) | — | — | — | ✅ |

**Principles applied here:**
- **Least privilege** — each service holds only the secrets it needs. The Gemini key
  never touches the backend; the Google *secret* never reaches the browser.
- **Public vs secret** — `VITE_*` vars are **inlined into the JS bundle** and are
  therefore *public*. The Google **Client ID** is safe to expose (it's designed to be);
  the Google **Client Secret**, `JWT_SECRET`, `INTERNAL_API_KEY`, `MONGO_URI`, and
  `GOOGLE_API_KEY` must **never** be `VITE_*` or appear in frontend code.
- **Platform-managed** — let Render generate `JWT_SECRET`/`INTERNAL_API_KEY` so they're
  never typed, logged, or committed.
- **Rotation** — any secret can be rotated in its dashboard; rotating `JWT_SECRET`
  invalidates all existing sessions (everyone re-logs in), which is exactly what you
  want after a suspected leak.

---

## 12. Security hardening checklist

Each item, with the reason and what it protects against:

- [ ] **No secrets in git.** `.env` files are git-ignored; only `.env.example`
      templates are committed. *Protects against:* the #1 cause of breaches — leaked
      credentials in source history.
- [ ] **`COOKIE_SECURE=true` in production.** The session cookie is `httpOnly` +
      `Secure` + `SameSite`. *Protects against:* XSS reading the cookie (`httpOnly`),
      transmission over plain HTTP (`Secure`), and CSRF (`SameSite`).
- [ ] **Single origin via the Vercel `/api` rewrite.** *Protects against:* the
      complexity and exposure of cross-site cookies; keeps `SameSite` strict-ish.
- [ ] **CORS allowlist (`CLIENT_ORIGINS`) = exactly your Vercel URL.** *Protects
      against:* other sites making authenticated requests with the user's cookie.
- [ ] **Google authorized origins = exactly your domains.** *Protects against:* your
      OAuth client being used from an attacker's page.
- [ ] **Admin allowlist (`ADMIN_EMAILS`).** A valid Google login that isn't on the
      list gets `403`. *Protects against:* anyone-with-a-Google-account becoming admin.
- [ ] **Agent admin endpoints gated by `x-internal-key`.** Only the backend can
      re-index or generate resumes; `/chat` is the only public AI route, and it's
      read-only and prompt-grounded. *Protects against:* public tampering with the
      knowledge base.
- [ ] **Server-side input validation** (zod on the backend, Pydantic on the agent) +
      `escapeRegex` on search. *Protects against:* malformed input, injection, ReDoS.
- [ ] **Upload allowlist + size cap** (multer mimetype filter, 200 MB). *Protects
      against:* arbitrary-file uploads and storage-exhaustion DoS.
- [ ] **TLS everywhere** — Atlas (`certifi` CA bundle), Render/Vercel auto-HTTPS.
      *Protects against:* eavesdropping / MITM.
- [ ] **Strong, unique `JWT_SECRET` & `INTERNAL_API_KEY`** (`openssl rand`), never the
      placeholder. *Protects against:* forged sessions / forged internal calls.
- [ ] **CI holds no production secrets** (see [§7](#7-part-b--continuous-integration-github-actions)).
      *Protects against:* secret leakage via CI logs or a compromised workflow.
- [ ] **Atlas least-privilege DB user**; tighten `0.0.0.0/0` to fixed egress IPs if you
      upgrade off the free tier. *Protects against:* over-broad DB exposure.
- [ ] **Dependabot / `npm audit`** (optional add-on) for dependency CVEs. *Protects
      against:* known-vulnerable transitive packages.

---

## 13. Operations: rollback, monitoring, limits

- **Rollback** — Render keeps deploy history: open the service → **Deploys** →
  *Rollback* to a previous image. Vercel keeps every build: **Deployments** →
  *Promote to Production* on a prior one. *Why this is safe:* each deploy is an
  immutable build, so rolling back is instant and side-effect-free (data lives in
  Atlas, not in the container).
- **Monitoring** — Render's per-service **Logs** + the `/health` checks; Vercel's
  build & function logs. Watch for cold-start latency and Atlas connection warnings.
- **Free-tier limits to watch:**
  - Render free web services **sleep** after inactivity → first request is slow.
  - Atlas M0 = **512 MB** total (documents + GridFS files + vectors). Big videos eat
    this fast — keep heavy media in object storage.
  - Gemini free tier has **rate/quota limits** → handled by the agent's
    [fallback chain](AGENT.md#5-llm-layer--the-gemini-fallback-chain), which rotates
    models and surfaces the reasoning if all are exhausted.
- **Embedding-model changes are breaking** — changing `GEMINI_EMBED_MODEL`/`EMBED_DIMS`
  means **reset + re-ingest** (old vectors are incompatible).

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Atlas "IP not whitelisted" | Add the IP (or `0.0.0.0/0`) in Atlas → Network Access. |
| Google login `invalid_client` / "no registered origin" | Add the exact Vercel origin to the OAuth client's **Authorized JavaScript origins**. |
| Login works locally, fails in prod | `COOKIE_SECURE=true`, use the Vercel `/api` rewrite (or `SameSite=None`+CORS), and add the Vercel URL to `CLIENT_ORIGINS`. |
| `403` after Google login | Your email isn't in `ADMIN_EMAILS`. |
| `401` on Admin → Chatbot/RAG actions | `INTERNAL_API_KEY` differs between backend and agent. |
| Chat: "couldn't reach the AI models" | Missing/invalid `GOOGLE_API_KEY` or all models over quota — the message includes the per-model reasoning. |
| Chat works but never cites sources | Run **Admin → Chatbot/RAG → Re-index**; the `vector_index` builds in ~20 s. |
| Images/files 404 in prod | The Vercel `/api` rewrite isn't pointing at the backend (relative file URLs need it). |
| First request very slow | Render free service cold-start (~30–60 s) — expected after idle. |
| CI red on `npm ci` | Commit the `package-lock.json` files (CI installs from the lockfile). |

---

*Related: [README.md](../README.md) (quick start) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) · [FRONTEND.md](FRONTEND.md) · [AGENT.md](AGENT.md)*
