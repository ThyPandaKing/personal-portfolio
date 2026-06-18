# Backend — Technical Reference

The **source of truth** for the system: the REST API, authentication and
authorization, request validation, file storage, and the proxy to the AI service.
Everything that *writes* data or *checks who you are* happens here.

- **Stack:** Node 24 · Express 4 · TypeScript · Mongoose 8 · zod · multer ·
  `google-auth-library` · `jsonwebtoken` · swagger-ui-express · Vitest + Supertest.
- **Source:** [`backend/src`](../backend/src)
- **Port:** `4000` · **Health:** `GET /health` · **API docs:** `GET /api/docs`.

> **Where this sits:** the browser talks **only** to the backend; the backend owns
> all DB access and is the *only* caller of the agent service (gated by a shared
> secret). See [ARCHITECTURE.md](../ARCHITECTURE.md), [FRONTEND.md](FRONTEND.md),
> and [AGENT.md](AGENT.md).

---

## Table of contents

1. [Why this stack](#1-why-this-stack)
2. [Bootstrap & middleware chain](#2-bootstrap--middleware-chain)
3. [Data models](#3-data-models)
4. [Configuration](#4-configuration)
5. [Routes (the API surface)](#5-routes-the-api-surface)
6. [Services](#6-services)
7. [Authentication & authorization](#7-authentication--authorization)
8. [File storage (GridFS)](#8-file-storage-gridfs)
9. [Validation & error handling](#9-validation--error-handling)
10. [API documentation (Swagger)](#10-api-documentation-swagger)
11. [Testing](#11-testing)
12. [Scripts](#12-scripts)
13. [Conventions & extension points](#13-conventions--extension-points)

---

## 1. Why this stack

| Tool | Role | Why |
|------|------|-----|
| **Node 24 + Express 4** | HTTP server / routing | Minimal, ubiquitous, a tiny and predictable middleware model. |
| **TypeScript** | Typing | Safety across models, routes, services; shared shapes with the SPA. |
| **Mongoose 8** | MongoDB ODM | Schemas, validation, indexes, hooks, and GridFS access in one library. |
| **zod** | Request validation | Declarative body schemas → consistent, detailed `400`s. |
| **google-auth-library** | Verify Google ID tokens | Server-side trust: we only believe a login after Google's signature checks out. |
| **jsonwebtoken** | Session JWTs | Stateless sessions in an httpOnly cookie — no server session store to run. |
| **multer** (memory storage) | Parse multipart uploads | Gives us the file **buffer** to stream straight into GridFS (no temp files on disk). |
| **swagger-ui-express** | API docs | Interactive OpenAPI at `/api/docs`. |
| **axios + form-data** | Call the agent service | Proxy chat/RAG/resume requests, including PDF forwarding. |
| **Vitest + Supertest** | Tests | Fast TS runner + real HTTP assertions. |
| **mongodb-memory-server** | Test DB | A real, ephemeral MongoDB for CRUD tests — no external infra. |

---

## 2. Bootstrap & middleware chain

### Entry — [`src/index.ts`](../backend/src/index.ts)
1. `await connectDb()` — connect to MongoDB Atlas **first** (fail fast if the DB is
   unreachable; there's no point serving an API that can't read/write).
2. `createApp()` — build the Express app.
3. `app.listen(env.port)`.
4. **Graceful shutdown:** on `SIGINT`/`SIGTERM`, close the server, `disconnectDb()`,
   exit `0` — so a container stop or a deploy doesn't drop in-flight work or leak
   Mongo connections.

### App factory — [`src/app.ts`](../backend/src/app.ts)
The middleware order is intentional; each layer depends on the previous:

| # | Middleware | What & why |
|---|------------|------------|
| 1 | `cors({ origin: env.clientOrigins, credentials: true })` | Allow **only** the configured SPA origins, and allow cookies. `credentials: true` is required for cookie auth to work cross-origin. |
| 2 | `express.json({ limit: "2mb" })` | Parse JSON bodies; the limit blocks oversized payloads. |
| 3 | `cookieParser()` | Make `req.cookies` available (the session lives in a cookie). |
| 4 | `attachUser` | Decode the session cookie → `req.user` if valid, else anonymous. **Never throws** (visitors are normal). |
| 5 | `GET /health` | Liveness probe (`{ status: "ok" }`) for Docker/Render. |
| 6 | Swagger UI at `/api/docs` (+ raw `/api/docs.json`) | Interactive API reference. |
| 7 | `/api` router | All resource routes (see §5). |
| 8 | `notFoundHandler` | Unmatched routes → `404 { error: "Route not found" }`. |
| 9 | `errorHandler` | Central error mapping (see §9). |

> **Why a `createApp()` factory?** Tests build the app in-memory and drive it with
> Supertest *without* opening a port — the same code path as production, minus the
> network.

---

## 3. Data models

All models bind to **explicit collection names** from
[`config/collections.ts`](../backend/src/config/collections.ts) (not Mongoose's
auto-pluralization) and enable `timestamps: true`.

> **Why explicit names?** The Python agent service reads these same collections
> directly. Hardcoding the names in *one* file on each side
> (`collections.ts` ↔ `config.py`) keeps the two services in lockstep; a typo can't
> silently point them at different collections.

| Model | Collection | Key fields (abridged) | Indexes / hooks |
|-------|------------|------------------------|-----------------|
| **User** ([User.ts](../backend/src/models/User.ts)) | `portfolio_users` | `email` (unique, lowercase), `googleId` (unique), `name`, `picture`, `role: "admin"`, `lastLoginAt` | unique email/googleId |
| **Profile** ([Profile.ts](../backend/src/models/Profile.ts)) | `portfolio_profile` | **Singleton**: `fullName`, `headline`, `aboutMe`, `imageUrl`, `location`, `contactEmail`, `socials[]` `{platform,url}`, `education[]` `{level,course,institution,startYear,endYear,details}`, `resumeNote` | `getProfileSingleton()` auto-creates the one doc on first read |
| **Skill** ([Skill.ts](../backend/src/models/Skill.ts)) | `portfolio_skills` | `name`*, `category` (def. "General"), `level` (0–100, def. 70), `icon`, `order` | `{ category: 1, order: 1 }` |
| **Project** ([Project.ts](../backend/src/models/Project.ts)) | `portfolio_projects` | `title`*, `slug`* (unique), `type` ∈ enterprise\|personal\|archive, `summary`, `about`, `impact`, `learning`, `skillsUsed[]`, `demoLink`, `githubLink`, `coverImage`, **`assets[]`** `{type:"pdf"\|"recording", url, name, size, mimeType}`, `featured`, `order`, `published` | `{ type:1, order:1, createdAt:-1 }` |
| **Blog** ([Blog.ts](../backend/src/models/Blog.ts)) | `portfolio_blogs` | `title`*, `slug`* (unique), `excerpt`, `content`, `coverImage`, `tags[]`, `published`, `publishedAt?`, `readingMinutes` | `{ published:1, publishedAt:-1 }` |
| **Resume** ([Resume.ts](../backend/src/models/Resume.ts)) | `portfolio_resumes` | `title`*, `role` ∈ SDE\|AI\|other, `source` ∈ uploaded\|generated, `fileUrl`, `content` (Markdown), `isPublic`, `generationMeta {projectIds[], skills[], instructions, model}` | indexed `role`, `isPublic` |

`slug` (Project, Blog) is generated from the title and kept unique (§13);
`readingMinutes` (Blog) = `max(1, round(words / 200))`; `publishedAt` is stamped the
first time a blog flips to `published`.

---

## 4. Configuration

[`config/env.ts`](../backend/src/config/env.ts) reads and types every env var
(with safe local-dev defaults) and exposes `isAdminEmail(email)`:

| Var | Purpose | Default |
|-----|---------|---------|
| `PORT` / `NODE_ENV` | Server | `4000` / `development` |
| `CLIENT_ORIGINS` | CORS allowlist (comma-separated, exact, no trailing slash) | localhost:3000,5173 |
| `MONGO_URI` / `MONGO_DB` | Atlas connection / **explicit** db name | localhost / `portfolio` |
| `ADMIN_EMAILS` | Comma-separated login allowlist | `""` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Verify Google ID tokens | `""` |
| `JWT_SECRET` | HMAC key for session JWTs | dev-insecure (override in prod!) |
| `COOKIE_DOMAIN` / `COOKIE_SECURE` | Cookie scope / `Secure`+`SameSite` mode | empty / `false` |
| `AGENT_SERVICE_URL` | Where the agent service lives | localhost:8001 |
| `INTERNAL_API_KEY` | Shared secret for backend→agent admin calls | change-me |
| `PUBLIC_BASE_URL` | Backend's own URL (used in OpenAPI servers + file links) | localhost:4000 |

[`config/db.ts`](../backend/src/config/db.ts) connects with
`dbName: env.mongoDb` (so the db name is independent of the URI path) plus
production-grade options: `serverSelectionTimeoutMS: 10s`, `socketTimeoutMS: 45s`,
`maxPoolSize: 10`, `retryWrites`/`retryReads: true`, `appName`. It logs a
**credential-masked** URI and registers reconnect handlers.

---

## 5. Routes (the API surface)

Mounted under `/api` by [`routes/index.ts`](../backend/src/routes/index.ts). Public
GETs serve content; **all mutations are `requireAdmin`** and validated with zod.
Visitors see only `published`/`isPublic` items; admins see everything.

### Auth — [`routes/auth.ts`](../backend/src/routes/auth.ts)
| Method · Path | Auth | Notes |
|---|---|---|
| `POST /api/auth/google` | public | `{ credential }` → verify token → allowlist check → upsert user → sign JWT → `Set-Cookie`. Codes: `401` bad token, `403` not allowlisted. |
| `GET /api/auth/me` | public | `{ user | null }` — how the SPA learns its session state. |
| `POST /api/auth/logout` | public | Clears the cookie. |

### Content
| Resource | Endpoints | Highlights |
|----------|-----------|------------|
| **Profile** ([profile.ts](../backend/src/routes/profile.ts)) | `GET /profile` (public) · `PUT /profile` · `POST /profile/image` | PUT sanitizes input: drops empty socials/education, auto-prepends `https://` to scheme-less URLs. Image upload replaces (and deletes) the old GridFS file. |
| **Skills** ([skills.ts](../backend/src/routes/skills.ts)) | `GET` (public) · `POST` · `PUT/:id` · `DELETE/:id` | Sorted by category/order/name. |
| **Projects** ([projects.ts](../backend/src/routes/projects.ts)) | `GET` + `GET/:slug` (public) · `POST` · `PUT/:id` · `DELETE/:id` · `POST/:id/assets` · `DELETE/:id/assets/:assetId` | Filters: `?type`, `?skill`/`?tool`, `?q` (regex over text fields). Delete removes asset files from GridFS. |
| **Blogs** ([blogs.ts](../backend/src/routes/blogs.ts)) | `GET` + `GET/:slug` (public) · `POST` · `PUT/:id` · `DELETE/:id` | Filters: `?tag`, `?q`. Computes reading time; stamps `publishedAt`. |
| **Resumes** ([resumes.ts](../backend/src/routes/resumes.ts)) | `GET` + `GET/:id` (public) · `POST` · `POST/generate` · `PUT/:id` · `POST/:id/file` · `DELETE/:id` | `generate` proxies to the agent and saves the result as a `generated` resume; `/file` accepts a PDF only. |

### Files & uploads
| Method · Path | Auth | Notes |
|---|---|---|
| `POST /api/uploads` | admin | Generic upload → GridFS → `{ url, name, size, mimeType }`. |
| `GET /api/files/:id` | public | Streams bytes from GridFS **with HTTP Range support** (see §8). |

### Chat / RAG proxy — [`routes/chat.ts`](../backend/src/routes/chat.ts)
| Method · Path | Auth | Proxies to agent |
|---|---|---|
| `POST /api/chat` | public | `POST /chat` |
| `GET /api/chat/admin/status` | admin | `GET /ingest/status` |
| `POST /api/chat/admin/reingest` | admin | `POST /ingest/portfolio` |
| `POST /api/chat/admin/document` | admin | `POST /ingest/document` |
| `POST /api/chat/admin/pdf` | admin | `POST /ingest/pdf` (multipart) |
| `POST /api/chat/admin/reset` | admin | `POST /ingest/reset` |

> **Why proxy instead of letting the browser call the agent?** Two reasons:
> (1) the agent's admin endpoints are protected by a secret only the backend
> holds, and (2) one origin/one auth model for the browser. The agent is never
> exposed to the public internet's write paths.

---

## 6. Services

### `services/auth.ts` — identity
- `verifyGoogleIdToken(credential)` → uses `OAuth2Client.verifyIdToken({ audience: GOOGLE_CLIENT_ID })`. Throws unless the signature is valid, the audience matches our client ID, and the email is verified. Returns `{ googleId, email, name, picture }`.
- `signSession({ sub, email, role })` → 7-day JWT; `verifySession(token)` → claims or throw.
- Cookie name: `portfolio_session`. Options:
  ```ts
  {
    httpOnly: true,                                  // JS can't read it (XSS-resistant)
    secure: env.cookieSecure,                        // HTTPS-only in prod
    sameSite: env.cookieSecure ? "none" : "lax",     // "none" for cross-site prod, "lax" locally
    domain: env.cookieDomain || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,                 // 7 days
    path: "/",
  }
  ```

### `services/gridfs.ts` — file storage
Bucket `uploads`. `uploadBuffer(buffer, filename, contentType)`, `getFileInfo(id)`,
`openDownloadStream(id, start?, end?)`, `deleteFile(id)` (best-effort), plus
`fileUrlFor(id)` → **relative** `/api/files/<id>` and `fileIdFromUrl(url)`. See §8.

### `services/agentClient.ts` — AI proxy
axios client at `env.agentServiceUrl`, 120 s timeout. `chat()` is the only call
**without** the key (public); `reingestPortfolio`, `ingestDocument`,
`ingestPdf` (form-data), `ragStatus`, `resetIndex`, and `generateResume` all send
`x-internal-key: env.internalApiKey`.

---

## 7. Authentication & authorization

**Login flow** (admin only):
1. SPA renders the Google button (`VITE_GOOGLE_CLIENT_ID`).
2. Google returns a signed **ID token (JWT)**.
3. `POST /api/auth/google { credential }`.
4. Backend verifies it (`google-auth-library`), then checks the email against
   `ADMIN_EMAILS`.
5. Upsert the user, sign **our own** 7-day JWT, set it as the httpOnly cookie.

**Per request** ([`middleware/auth.ts`](../backend/src/middleware/auth.ts)):
- `attachUser` — reads + verifies the cookie, attaches `req.user`. Silent on
  failure (anonymous visitors are valid).
- `requireAdmin` — `req.user?.role === "admin"` or `next(unauthorized())` → `401`.

**Status-code contract** (enforced by tests, §11):

| Situation | Code |
|-----------|------|
| Bad/missing body | `400` |
| Invalid/expired Google credential | `401` |
| Missing/invalid session on an admin route | `401` |
| Valid Google account **not** in allowlist | `403` |
| Unsupported upload type | `400` |
| Upload too large | `413` |

**Service-to-service:** the agent's admin endpoints require `x-internal-key`
equal to `INTERNAL_API_KEY`; only the backend knows it.

> **Three independent trust layers**, so a gap in one doesn't open the system:
> Google proves *who*, the allowlist decides *whether they're the owner*, and the
> session cookie carries that decision on each call. The internal key is a fourth,
> separate boundary for backend→agent.

---

## 8. File storage (GridFS)

All uploads — profile image, project PDFs/recordings, resume PDFs — live in
**MongoDB GridFS** (bucket `uploads` → `uploads.files` + `uploads.chunks`).
**Nothing is written to local disk.**

- **Upload:** `multer.memoryStorage()` yields `file.buffer`, streamed into GridFS.
  No temp files → stateless containers, trivially horizontal-scalable.
- **Serve:** `GET /api/files/:id` sets `Accept-Ranges: bytes` and a long
  `Cache-Control: public, max-age=31536000, immutable`. If a `Range` header is
  present it returns **`206 Partial Content`** with `Content-Range` and only the
  requested byte slice; otherwise `200` with the full stream. Missing file → `404`;
  unsatisfiable range → `416`.
- **Delete:** removing a project/asset/resume (or replacing an image) deletes the
  underlying GridFS file too.

> **Why Range support matters:** browsers request byte ranges to **seek** in
> `<video>`/`<audio>`. Without `206`, scrubbing a recording wouldn't work and the
> whole file would download up front.
>
> **Trade-off:** GridFS counts against the Atlas free tier (512 MB), so large
> videos fill it fast. The storage layer is isolated in `gridfs.ts`, so swapping to
> S3/Cloudinary later is a contained change. URLs are stored **relative**
> (`/api/files/<id>`) so they work across every environment.

---

## 9. Validation & error handling

- **zod** schemas validate request bodies in each route; a failure throws a
  `ZodError`.
- **multer** ([`middleware/upload.ts`](../backend/src/middleware/upload.ts)) uses
  `memoryStorage`, a `fileSize` limit of **200 MB** (for video), and a `fileFilter`
  allowlist (png/jpeg/webp/gif/svg, pdf, mp4/webm/quicktime, mpeg/wav). Disallowed
  type → `400`; oversize → multer `LIMIT_FILE_SIZE`.
- **`utils/http.ts`** defines `HttpError` + helpers (`badRequest`, `unauthorized`,
  `forbidden`, `notFound`) and an `asyncHandler` wrapper that funnels thrown errors
  from async handlers into the error middleware.
- **`middleware/error.ts`** is the single mapper:

| Error | HTTP | Body |
|-------|------|------|
| `ZodError` | `400` | `{ error: "Validation failed", details }` |
| `HttpError` | its `status` | `{ error, details? }` |
| `MulterError` `LIMIT_FILE_SIZE` | `413` | `{ error }` |
| other `MulterError` | `400` | `{ error }` |
| anything else | `500` | `{ error: "Internal server error" }` (logged) |

> **Why one central mapper?** Routes just `throw badRequest(...)` (or let zod
> throw) and trust the mapper to produce the right status + shape. Errors are
> uniform for the SPA, and unexpected bugs degrade to a clean `500` instead of
> leaking stack traces.

---

## 10. API documentation (Swagger)

[`docs/openapi.ts`](../backend/src/docs/openapi.ts) +
[`docs/schemas.ts`](../backend/src/docs/schemas.ts) build a hand-authored OpenAPI
3.0.3 spec (servers from `PUBLIC_BASE_URL`, a `cookieAuth` security scheme, reusable
component schemas, and per-endpoint error responses). Served interactively at
**`/api/docs`**, raw JSON at `/api/docs.json`. It's the authoritative,
always-current API reference.

---

## 11. Testing

`npm test` (Vitest + Supertest). **30 test cases across 5 suites**:

- **[`test/auth.test.ts`](../backend/test/auth.test.ts) — 12 cases**, no DB needed.
  Health/404 shape, Google-login input handling, `/me` + logout, and that 8
  admin-only routes reject visitors with `401`, plus upload-validation `400`s.
  Asserts auth/validation failures are always proper 4xx — **never `500`**.
- **[`test/crud.test.ts`](../backend/test/crud.test.ts) — 18 cases** against an
  in-memory MongoDB (`mongodb-memory-server`): profile auto-create + sanitization,
  skills/projects/blogs/resumes CRUD, slug generation, visibility rules,
  reading-time. Skips gracefully if the in-memory binary can't start.
- **[`test/helpers.ts`](../backend/test/helpers.ts)** mints an admin session cookie
  so authenticated requests can be exercised.

> **Why this split?** The fast auth/validation suite needs no DB and runs in
> milliseconds — ideal as a pre-commit / CI gate. The CRUD suite uses a *real*
> Mongo (in-memory) so query/index behavior is genuinely exercised, not mocked.

---

## 12. Scripts

- **`npm run seed`** ([scripts/seed.ts](../backend/scripts/seed.ts)) — wipes and
  repopulates demo content across all collections, generating SVG covers and PDFs
  (via `pdfkit`) into GridFS. **Destructive** — dev/demo only.
- **`npm run migrate:urls`** ([scripts/migrate-file-urls.ts](../backend/scripts/migrate-file-urls.ts))
  — one-off, idempotent migration converting absolute file URLs to **relative**
  `/api/files/<id>` (so records are environment-independent). Leaves external links
  untouched.

---

## 13. Conventions & extension points

- **Add a resource:** model (explicit collection) → router (`requireAdmin` +
  zod on mutations, visibility filter on reads) → mount in `routes/index.ts` →
  OpenAPI entry. Mirror the type on the SPA.
- **Slugs:** use `uniqueSlug(Model, title, excludeId?)`
  ([utils/slug.ts](../backend/src/utils/slug.ts)) — slugify + collision suffixes
  (`-2`, `-3`…); `excludeId` lets a doc keep its slug on update.
- **User regex input** goes through `escapeRegex`
  ([utils/query.ts](../backend/src/utils/query.ts)) before hitting a Mongo
  `$regex` — never interpolate raw input into a query.
- **Files:** store the **relative** URL on the document; bytes live in GridFS.
- **Throw, don't `res.status(...).json(...)`** — `throw badRequest(...)` / let zod
  throw, and let the central mapper format it.
- **Secrets only via env** — no credentials in code; the same `INTERNAL_API_KEY`
  must be set on both backend and agent.

*Related: [ARCHITECTURE.md](../ARCHITECTURE.md) · [FRONTEND.md](FRONTEND.md) ·
[AGENT.md](AGENT.md) · [DEPLOYMENT.md](DEPLOYMENT.md)*
