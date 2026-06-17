# Deploy — Step-by-Step (with fixes for the common errors)

A practical, copy-paste walkthrough to get the portfolio live on **free tiers**:
**Vercel** (frontend), **Render** (backend + agent), **MongoDB Atlas** (database),
**Gemini** (AI). This is the *hands-on* companion to [DEPLOYMENT.md](DEPLOYMENT.md)
(which explains the *why* and the security model in depth).

> **If you're here because of build errors, read [§0](#0-the-two-errors-you-hit--exactly-why--the-fix) first** — it
> covers the two specific failures (CI "implicit any", Vercel "npm install exited
> with 1") and the fixes that are already applied to this repo.

---

## 0. The two errors you hit — exactly why + the fix

### Error A — CI fails on both frontend & backend: `... implicitly has an 'any' type` (or `tsc: command not found`)

**What it means.** `tsc` (the TypeScript compiler) and all the `@types/*` packages
live in **`devDependencies`**. If the install step runs in *production mode*
(`NODE_ENV=production`, `npm install --production`, or `--omit=dev`), npm **skips
devDependencies**. With the type packages gone, TypeScript can't find type
definitions for `express`, `react`, Node, etc., so every parameter "implicitly has
an 'any' type" — and `tsc` itself may be missing entirely.

**Why it works locally but not in CI.** Locally you run `npm install` with no
`NODE_ENV`, so devDeps are present. A CI runner (or a repo/org-level
`NODE_ENV=production` variable) silently drops them.

**The fix (already applied here):**
- CI installs with **`npm ci --include=dev`** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) — forces devDependencies even under `NODE_ENV=production`.
- **Do not** set `NODE_ENV=production` as a GitHub Actions repo/org variable. The build needs devDeps; the *runtime* (Render) sets `NODE_ENV=production` itself.
- Make sure `package-lock.json` is committed (so `npm ci` works and type versions are pinned).

### Error B — Vercel: `Command "npm install" exited with 1`

**What it means.** The install crashed before the build. The *real* reason is in the
log lines **just above** that message — almost always one of:
1. **Node-version drift** — Vercel defaults to a newer Node than the lockfile was
   built with, causing a resolution/engine error. The log shows `EBADENGINE` or an
   `ERESOLVE` peer conflict.
2. **A peer-dependency conflict** under a stricter npm — log shows `ERESOLVE`.
3. **Missing/out-of-sync `package-lock.json`** — log shows `npm ci can only install
   with an existing/ in-sync package-lock.json`.

**The fix (already applied here):**
- **Pinned Node 20** via `"engines": { "node": "20.x" }` in
  [frontend/package.json](../frontend/package.json) **and** a
  [frontend/.nvmrc](../frontend/.nvmrc) (`20`). Vercel reads both — the build now
  runs on the same Node the lockfile was built with.
- Commit `frontend/package-lock.json`.
- If the log specifically shows **`ERESOLVE`**, set Vercel → Settings → **Build &
  Development → Install Command** to `npm install --legacy-peer-deps` (or add a
  `frontend/.npmrc` containing `legacy-peer-deps=true`). Only do this if you actually
  see `ERESOLVE` — it's a targeted fix, not a default.

> **After applying fixes you must push them.** Render and Vercel deploy from GitHub,
> so commit and `git push` the updated `package.json` / `.nvmrc` / `ci.yml`, then
> redeploy. The local zip copy is now stale — re-zip or push to git.

---

## 1. Prerequisites (one-time accounts)

All free: **GitHub**, **MongoDB Atlas**, **Google Cloud** (OAuth) + **Google AI
Studio** (Gemini key), **Render**, **Vercel**.

Local tools (only needed to verify before pushing): **git**, Node **20**, Python 3.14.

> **Verify locally before you deploy** — if it builds on your machine it'll build in
> CI:
> ```bash
> cd backend && npm ci --include=dev && npm run typecheck && npm test
> cd ../frontend && npm ci --include=dev && npm run build
> cd ../agent-service && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && python -c "import app.main"
> ```

---

## 2. Push the code to GitHub

```bash
cd "<project root>"
git init
git add .
git status            # CONFIRM no real .env files are staged (only *.env.example)
git commit -m "portfolio: initial deploy"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> **Secrets check.** [.gitignore](../.gitignore) excludes every `.env`. `git status`
> must show **no** `backend/.env`, `agent-service/.env`, or `frontend/.env`. Real
> secrets live in the Render/Vercel dashboards, never in git.
>
> **Lockfiles must be committed** — `backend/package-lock.json` and
> `frontend/package-lock.json`. They are *not* git-ignored; confirm they're in the
> commit (`git ls-files | grep package-lock`). Missing lockfiles are the #1 cause of
> both errors in [§0](#0-the-two-errors-you-hit--exactly-why--the-fix).

Once pushed, **GitHub Actions CI runs automatically** (the workflow in
[.github/workflows/ci.yml](../.github/workflows/ci.yml)). Wait for it to go green
before deploying — that confirms the build is sound.

---

## 3. MongoDB Atlas (database, files, vectors)

1. Create a free **M0** cluster.
2. **Database Access** → add a user with a strong password (write down the password).
3. **Network Access** → **Add IP Address** → `0.0.0.0/0` (Allow from anywhere).
   *Why:* Render's free egress IPs aren't fixed, so you can't allowlist them
   individually. Connections still require the DB credentials, so the password is the
   real guard (tighten to fixed IPs if you upgrade off free tier).
4. **Connect → Drivers** → copy the connection string
   (`mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/?...`). This is `MONGO_URI`
   for **both** the backend and the agent. Set `MONGO_DB=portfolio`.

---

## 4. Google OAuth + Gemini key

**OAuth (admin login):** Google Cloud Console → **APIs & Services → Credentials →
Create OAuth client ID → Web application**. Under **Authorized JavaScript origins**
add (you'll come back to add the real Vercel URL in [§8](#8-wire-the-three-services-together)):
`http://localhost:5173`, `http://localhost:3000`. Copy the **Client ID** and **Client
Secret**. *(No redirect URIs needed — token flow, not redirect flow.)*

**Gemini key:** <https://aistudio.google.com/app/apikey> → create key. This is
`GOOGLE_API_KEY` for the **agent only**.

---

## 5. Deploy backend + agent on Render (Blueprint)

The repo ships [render.yaml](../render.yaml) describing both Docker services.

1. Render Dashboard → **New → Blueprint** → connect your GitHub repo → it detects
   `render.yaml` and proposes `portfolio-backend` + `portfolio-agent`.
2. Click **Apply**, then open each service and set the dashboard secrets:

**`portfolio-backend` → Environment:**
| Key | Value |
|-----|-------|
| `CLIENT_ORIGINS` | *(leave blank for now — set the Vercel URL in §8)* |
| `MONGO_URI` | your Atlas string |
| `MONGO_DB` | `portfolio` |
| `ADMIN_EMAILS` | your Gmail (the only account that can admin) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from §4 |
| `AGENT_SERVICE_URL` | `https://portfolio-agent.onrender.com` |
| `PUBLIC_BASE_URL` | `https://portfolio-backend.onrender.com` |
| `COOKIE_SECURE` | `true` |
| `JWT_SECRET`, `INTERNAL_API_KEY` | auto-generated by the blueprint — leave them |

**`portfolio-agent` → Environment:**
| Key | Value |
|-----|-------|
| `GOOGLE_API_KEY` | your Gemini key |
| `MONGO_URI` / `MONGO_DB` | same Atlas string / `portfolio` |
| `ALLOWED_ORIGINS` | `https://portfolio-backend.onrender.com` |
| `INTERNAL_API_KEY` | **must equal the backend's value** (copy it across) |

3. Each service builds from its `Dockerfile` and must report healthy at `/health`.
   Open `https://portfolio-backend.onrender.com/health` and
   `https://portfolio-agent.onrender.com/health` → both `{"status":"ok"}`.
   *(First request may cold-start for ~30–60 s — free services sleep when idle.)*

> **`INTERNAL_API_KEY` mismatch** = every Admin → Chatbot/RAG action returns `401`.
> If the blueprint generated it on the backend, copy that exact string into the agent.

---

## 6. Deploy the frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory = `frontend`** (critical — Vercel then reads
   [frontend/vercel.json](../frontend/vercel.json) and the `.nvmrc`).
3. **Framework Preset:** Vite (auto-detected). Leave Build Command (`npm run build`)
   and Output (`dist`) as detected.
4. **Environment Variables:**
   - `VITE_GOOGLE_CLIENT_ID` = your Google Client ID.
   - `VITE_API_BASE` = **leave empty**.
   - **Do not** add `NODE_ENV=production` here (it would drop devDeps → build fails).
5. Deploy. If it fails on install, re-read [§0 Error B](#error-b--vercel-command-npm-install-exited-with-1)
   and check the log line above "exited with 1".

---

## 7. Add the `/api` rewrite (single origin)

Edit [frontend/vercel.json](../frontend/vercel.json) so `/api/*` is forwarded to the
Render backend **before** the SPA fallback, then push:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://portfolio-backend.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

*Why:* the SPA calls relative `/api/...`. This rewrite makes the browser see **one
origin** (your Vercel domain), so the session cookie is same-site and
`/api/files/...` media links work without CORS.

---

## 8. Wire the three services together

Now that you know all the URLs, fill the cross-references:

1. **Render backend** → `CLIENT_ORIGINS` = `https://<your-app>.vercel.app` (exact, no trailing slash).
2. **Render backend** → confirm `AGENT_SERVICE_URL` / `PUBLIC_BASE_URL` point at the right Render URLs.
3. **Render agent** → `ALLOWED_ORIGINS` = the backend URL.
4. **Vercel** `vercel.json` rewrite → the backend URL (§7).
5. **Google Cloud** → OAuth client → **Authorized JavaScript origins** → add
   `https://<your-app>.vercel.app`.

Redeploy any service whose env you changed (Render → *Manual Deploy → Deploy latest*).

---

## 9. First run & verify

1. Open the Vercel URL → the site loads.
2. **Sign in** with your allowlisted Gmail → you reach `/admin`.
   - `403` → your email isn't in `ADMIN_EMAILS`.
   - Login popup error → the Vercel origin isn't in Google's Authorized origins.
3. Add some content (profile, a project, a blog) in the admin UI.
4. **Admin → Chatbot / RAG → Re-index** → builds the vector knowledge base
   (~20 s for the Atlas index).
5. Open the public site, use the chat widget → it answers and cites sources.

---

## 10. Quick error → fix table

| Symptom | Fix |
|---------|-----|
| CI: `implicitly has an 'any' type` / `tsc: command not found` | devDeps were skipped — use `npm ci --include=dev`; don't set `NODE_ENV=production` in CI. (Already applied in [ci.yml](../.github/workflows/ci.yml).) |
| Render/Docker build: `sh: tsc: not found` (exit 127) | Render injects `NODE_ENV=production` into the Docker build, so `npm install` skipped devDeps. The Dockerfiles now use `npm ci --include=dev` (build) + `npm prune --omit=dev` (slim final image). (Already applied in [backend/Dockerfile](../backend/Dockerfile) / [frontend/Dockerfile](../frontend/Dockerfile).) |
| Render: `npm install` slow (minutes) then `Exit handler never called!` | `npm install` does a heavy non-deterministic resolve and can crash on small build hosts. Use `npm ci` (deterministic, from the lockfile) — already applied in the Dockerfiles. |
| Vercel: `npm install exited with 1` | Read the line above it. `EBADENGINE` → Node pin (already added). `ERESOLVE` → Install Command `npm install --legacy-peer-deps`. `package-lock` error → commit the lockfile. |
| Vercel build OK, site 404s on refresh | The SPA fallback rewrite is missing/misordered in `vercel.json` (§7). |
| Images/files 404 in prod | The `/api` rewrite isn't pointing at the backend (§7). |
| `401` on Admin → Chatbot/RAG | `INTERNAL_API_KEY` differs between backend and agent (§5). |
| Login works locally, not in prod | `COOKIE_SECURE=true`, use the `/api` rewrite, add the Vercel URL to `CLIENT_ORIGINS` + Google origins. |
| Chat: "couldn't reach the AI models" | Bad/empty `GOOGLE_API_KEY` or all Gemini models over quota (message includes the reason). |
| Atlas connection/TLS errors | Add `0.0.0.0/0` in Atlas Network Access; check `MONGO_URI`/`MONGO_DB`. |
| First request very slow | Render free service cold-start (~30–60 s after idle) — expected. |

---

*Related: [DEPLOYMENT.md](DEPLOYMENT.md) (free-tier CI/CD with full security reasoning) ·
[README.md](../README.md) · [BACKEND.md](BACKEND.md) · [AGENT.md](AGENT.md) · [FRONTEND.md](FRONTEND.md)*
