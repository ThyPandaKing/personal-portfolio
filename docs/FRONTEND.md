# Frontend — Technical Reference

The browser-facing single-page application (SPA). It serves **two audiences from
one bundle**: anonymous visitors (browse, read, chat) and the admin/owner (full
CRUD + AI tools, unlocked by Google login).

- **Stack:** React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · React Router 6 ·
  TanStack Query 5 · axios · `@react-oauth/google` · framer-motion · react-markdown.
- **Source:** [`frontend/src`](../frontend/src)
- **Local port:** `5173` (Vite dev) · **Docker:** `3000` (nginx serving the build).

> **Where this sits in the system:** the SPA talks to **only one thing** — the
> backend, via relative `/api/...` calls. It never touches the database or the
> agent service directly. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the
> whole-system picture and [BACKEND.md](BACKEND.md) for the API it consumes.

---

## Table of contents

1. [Why this stack](#1-why-this-stack)
2. [Project layout](#2-project-layout)
3. [Bootstrap & provider tree](#3-bootstrap--provider-tree)
4. [Routing & guards](#4-routing--guards)
5. [State management](#5-state-management)
6. [The API layer](#6-the-api-layer)
7. [Pages](#7-pages)
8. [Key components](#8-key-components)
9. [Domain types](#9-domain-types)
10. [Styling & theming](#10-styling--theming)
11. [Build, dev proxy & deployment shapes](#11-build-dev-proxy--deployment-shapes)
12. [Conventions & extension points](#12-conventions--extension-points)

---

## 1. Why this stack

| Tool | What it does | Why it was chosen |
|------|--------------|-------------------|
| **React 18** | Component UI model | Ubiquitous, huge ecosystem, the team-standard mental model. |
| **Vite** | Dev server + bundler | Near-instant HMR, zero-config TypeScript, fast production builds. |
| **TypeScript** | Static typing | Catches shape mismatches at compile time; the domain types in `types.ts` mirror the API responses so a backend change surfaces as a type error. |
| **Tailwind CSS** | Utility-first styling | Consistent design without a separate CSS file per component; **`darkMode: "class"`** gives us instant theme switching (see §10). |
| **React Router 6** | Client-side routing | Standard SPA routing, including nested admin routes and route guards. |
| **TanStack Query** | Server-state cache | Caching, background refetch, and loading/error state *without* hand-rolled `useEffect` data fetching. Mutations + cache invalidation keep the UI consistent after edits. |
| **axios** | HTTP client | A single configurable instance: `withCredentials` for cookie auth and one place to read the API base URL. |
| **@react-oauth/google** | Google sign-in | Produces the Google **ID token** the backend verifies for admin login. |
| **framer-motion** | Animations | Declarative entrance/transition animations (cards, splash, background). |
| **react-markdown** | Markdown rendering | Project/blog/resume bodies are authored in Markdown. |
| **lucide-react** | Icons | Lightweight, tree-shakeable, consistent icon set. |

> **Design principle — "dumb client, smart server."** All authorization,
> validation, and persistence live in the backend. The SPA is presentation +
> caching only; it *assumes* it might be tampered with (the admin routes are a
> convenience gate, not a security boundary — see §4).

---

## 2. Project layout

```
frontend/src/
├── main.tsx              # Entry: mounts the provider tree
├── App.tsx               # Route table (public + guarded admin)
├── types.ts              # All domain types (Project, Blog, Resume, …)
├── index.css             # Tailwind layers + CSS theme variables + component classes
├── vite-env.d.ts         # Vite/TS ambient types
├── api/                  # One module per resource + endpoints.ts (single source of paths)
│   ├── endpoints.ts      #   ← all API paths live here
│   ├── blogs.ts  chat.ts  profile.ts  projects.ts  resumes.ts  skills.ts  uploads.ts
├── lib/
│   ├── api.ts            # axios instance + error helper + GOOGLE_CLIENT_ID
│   └── print.ts          # "Save as PDF" via a print window
├── context/
│   ├── AuthContext.tsx   # Session bootstrap, login/logout, isAdmin
│   └── ThemeContext.tsx  # Dark/light, persisted, toggles the `.dark` class
├── components/
│   ├── layout/           # Layout, Navbar, Footer
│   ├── ui/               # Modal, Markdown, Spinner, PageHeader, StatusNote
│   ├── chat/ChatWidget.tsx
│   ├── admin/            # BlogEditor, ProjectEditor, ResumeGenerator, SkillsManager, ImageUploadField
│   └── Background, ProjectCard, SocialLinks, ThemeToggle, LoginButton, RequireAdmin, SplashLoader
└── pages/
    ├── Home, Projects, ProjectDetail, Resume, Blog, BlogDetail, NotFound
    └── admin/            # AdminLayout, AdminHome, ProfileEditor, ProjectsAdmin, BlogAdmin, ResumesAdmin, ChatbotAdmin
```

---

## 3. Bootstrap & provider tree

[`main.tsx`](../frontend/src/main.tsx) mounts a **deliberately ordered** stack of
providers. Order matters — an inner provider can consume anything an outer one
supplies:

```tsx
<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>   // 1 outermost
  <QueryClientProvider client={queryClient}>        // 2
    <ThemeProvider>                                  // 3
      <AuthProvider>                                 // 4
        <BrowserRouter>                              // 5
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
</GoogleOAuthProvider>
```

| # | Provider | Why it's at this level |
|---|----------|------------------------|
| 1 | `GoogleOAuthProvider` | A `<GoogleLogin>` button can appear anywhere (navbar), so the Google context must wrap everything. |
| 2 | `QueryClientProvider` | The query cache must be available to auth *and* every page. Configured with `defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }` — data is considered fresh for 30 s (fewer refetches) and a failed request retries once. |
| 3 | `ThemeProvider` | Establishes light/dark before anything renders, avoiding a flash of the wrong theme. |
| 4 | `AuthProvider` | Needs the query client; supplies `isAdmin` to the router guard below it. |
| 5 | `BrowserRouter` | Routing is the innermost concern; everything above is cross-cutting. |

---

## 4. Routing & guards

[`App.tsx`](../frontend/src/App.tsx) defines the route table. **All page
components are lazy-loaded** with `React.lazy` + `<Suspense fallback={<Spinner/>}>`
so the initial bundle stays small — the admin editors (the heaviest code) are
only downloaded once an admin actually navigates to them.

**Public routes** (rendered inside `<Layout>`):

| Path | Page | Purpose |
|------|------|---------|
| `/` | `Home` | Hero, profile, skills grouped by category, education. First load plays `SplashLoader`. |
| `/projects` | `Projects` | Filterable grid (type · skill · text search). |
| `/projects/:slug` | `ProjectDetail` | About / impact / learning + assets (video/PDF). |
| `/resume` | `Resume` | Public resumes; preview/download. |
| `/blog` | `Blog` | Filterable article grid. |
| `/blog/:slug` | `BlogDetail` | Full Markdown article. |
| `*` | `NotFound` | 404. |

**Admin routes** (wrapped in `<RequireAdmin>`, nested under `<AdminLayout>`):

| Path | Page | Purpose |
|------|------|---------|
| `/admin` | `AdminHome` | Dashboard / links. |
| `/admin/profile` | `ProfileEditor` | Profile fields + image + embedded `SkillsManager`. |
| `/admin/projects` | `ProjectsAdmin` | List (incl. drafts/archived) → `ProjectEditor` modal. |
| `/admin/blog` | `BlogAdmin` | List (incl. drafts) → `BlogEditor` modal. |
| `/admin/resumes` | `ResumesAdmin` | Upload/manage resumes + `ResumeGenerator`. |
| `/admin/chatbot` | `ChatbotAdmin` | RAG knowledge-base management. |

[`RequireAdmin.tsx`](../frontend/src/components/RequireAdmin.tsx) reads
`useAuth()`; while `loading` it shows "Checking access…", and if `!isAdmin` it
`<Navigate to="/" replace />`.

> **Security note — the guard is UX, not enforcement.** A determined user can
> render any admin component in their browser; that buys them *nothing*, because
> every write goes through the backend, which independently re-checks the session
> cookie and the admin allowlist on every request (`requireAdmin`, see
> [BACKEND.md §Auth](BACKEND.md#6-authentication--authorization)). The frontend
> guard just avoids showing a broken UI to non-admins.

---

## 5. State management

Two concerns are split cleanly: **server state** (TanStack Query) and **client
state** (React context).

### 5.1 AuthContext — [`context/AuthContext.tsx`](../frontend/src/context/AuthContext.tsx)

Exposes `{ user, loading, isAdmin, loginWithGoogle(credential), logout() }`.

- **Bootstrap:** on mount it calls `GET /api/auth/me`. Because the session is an
  **httpOnly cookie**, the SPA cannot read it directly — `/auth/me` is how the app
  asks the server "am I logged in?" Success → `user` set, `isAdmin = !!user`;
  failure (no/expired cookie) → anonymous. Either way `loading` flips to `false`.
- **Login:** the Google button yields a one-time **credential (ID token)**;
  `loginWithGoogle` POSTs it to `/api/auth/google`. The backend verifies it, checks
  the allowlist, and responds with `Set-Cookie`. The browser stores the cookie;
  the SPA never sees the token after this.
- **Logout:** POSTs `/api/auth/logout` (server clears the cookie), then resets local state.

### 5.2 ThemeContext — [`context/ThemeContext.tsx`](../frontend/src/context/ThemeContext.tsx)

Exposes `{ theme, toggle(), setTheme() }`.

- **Initial value:** `localStorage["theme"]` if present, else the OS preference
  (`prefers-color-scheme`).
- **Application:** a `useEffect` toggles `document.documentElement.classList`
  `.dark` and writes back to `localStorage`. Tailwind's `darkMode: "class"`
  strategy keys every `dark:` utility off that one root class — so flipping it
  re-themes the entire app in a single DOM mutation (§10).

### 5.3 TanStack Query — the data layer

Every server read is a `useQuery`; every write is a `useMutation` that invalidates
the relevant query so the UI reflects the new state without a manual refetch.

Representative query keys:

| Data | Query key | Notes |
|------|-----------|-------|
| Profile | `["profile"]` | |
| Skills | `["skills"]` | |
| Projects (public, filtered) | `["projects", type, skill, q]` | Key includes filters → each filter combo is cached separately. |
| Project detail | `["project", slug]` | |
| Blogs / blog detail | `["blogs", …]` / `["blog", slug]` | |
| Resumes | `["resumes"]` | |
| RAG status | `["rag-status"]` | ChatbotAdmin. |

> **Why query keys matter:** the key *is* the cache identity. Putting filter
> values in the key (`["projects", type, skill, q]`) means switching a filter is a
> cache lookup, not necessarily a network call — and `invalidateQueries(["projects"])`
> after an edit refetches *all* filter variants at once.

---

## 6. The API layer

### 6.1 axios instance — [`lib/api.ts`](../frontend/src/lib/api.ts)

```ts
const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
export const api = axios.create({
  baseURL: `${apiBase}/api`,   // "" → "/api" (same origin); else "<host>/api"
  withCredentials: true,        // send the httpOnly session cookie on every call
});
```

- **`withCredentials: true`** is the linchpin of cookie auth — without it the
  browser would not attach `portfolio_session` to API requests.
- **`baseURL` is relative by default.** Leaving `VITE_API_BASE` empty makes every
  call go to `/api/...` on the *current* origin, which a proxy then forwards to the
  backend. This single decision is what lets the exact same build run behind a Vite
  dev proxy, an nginx proxy, or a Vercel rewrite (see §11).
- `apiErrorMessage(err, fallback)` extracts the backend's `{ error }` message for
  display; `GOOGLE_CLIENT_ID` is also re-exported here from the env.

### 6.2 endpoints.ts — one source of truth

[`api/endpoints.ts`](../frontend/src/api/endpoints.ts) centralizes **every** path
as constants/builders (e.g. `projects.bySlug(slug)`, `projects.assets(id)`,
`chat.admin.reingest`). No path strings are hardcoded in components — so a route
rename is a one-line change. The groups are: `auth`, `profile`, `skills`,
`projects`, `blogs`, `resumes`, `uploads`, `chat` (+ `chat.admin.*`).

### 6.3 Resource modules

Each `api/*.ts` is a thin typed wrapper returning domain types from §9:

| Module | Notable functions |
|--------|-------------------|
| `profile.ts` | `fetchProfile`, `updateProfile`, `uploadProfileImage(file)` (returns the URL). |
| `skills.ts` | `fetchSkills`, `createSkill`, `updateSkill`, `deleteSkill`. |
| `projects.ts` | CRUD + `uploadProjectAsset(id, file, name?)`, `deleteProjectAsset(id, assetId)` (multipart). |
| `blogs.ts` | `fetchBlogs(filters)`, `fetchBlog(slug)`, CRUD. |
| `resumes.ts` | CRUD + `generateResume(input)` (AI) + `uploadResumeFile(id, file)`. |
| `uploads.ts` | `uploadFile(file)` → `{ url, name, size, mimeType }`. |
| `chat.ts` | `sendChat(message, history)` → `{ answer, sources }`; admin: `ragStatus`, `reingestPortfolio`, `ingestDocument`, `ingestPdf`, `resetIndex`. |

File uploads build a `FormData` and let the browser set the multipart boundary
(no manual `Content-Type`).

---

## 7. Pages

- **Home** — fetches `["profile"]` + `["skills"]`; renders hero, `SocialLinks`,
  skills grouped by `category`, and education. On the very first visit it overlays
  `SplashLoader` until both the animation finishes *and* data is ready.
- **Projects / Blog** — list pages with client-driven filters that flow into the
  query key; render `ProjectCard`s / blog cards.
- **ProjectDetail / BlogDetail** — fetch by `:slug`; render Markdown sections and
  (projects) the asset list with inline video/audio players and PDF links served
  from `/api/files/:id`.
- **Resume** — lists public resumes; uploaded PDFs preview/download via their
  `fileUrl`, generated resumes render Markdown and offer "Save as PDF" via
  [`lib/print.ts`](../frontend/src/lib/print.ts).
- **admin/** — `AdminLayout` is a two-column shell (sticky sidebar + `<Outlet/>`);
  the sub-pages are CRUD dashboards backed by mutations (see §8).

---

## 8. Key components

### ChatWidget — [`components/chat/ChatWidget.tsx`](../frontend/src/components/chat/ChatWidget.tsx)
Floating assistant on every page. Holds `messages: ChatMessage[]` locally
(conversation is **client-side**, never persisted server-side). Offers guided
modes ("I'm a recruiter", "Insights on a project") that wrap the user's text in a
tailored prompt before calling `sendChat(message, history)`. Renders the
assistant's `sources` as small badges beneath each answer. The history sent
upstream excludes the canned greeting.

> **Why send history from the client?** The agent service is **stateless** (see
> [AGENT.md](AGENT.md)) — it keeps no session. The browser owns the transcript and
> replays it each turn, which keeps the backend horizontally scalable and avoids
> any server-side chat storage.

### Admin editors — [`components/admin/`](../frontend/src/components/admin/)
- **ProjectEditor** — create/edit a project; the "Recordings & PDFs" asset uploader
  is enabled *only after* the project exists (you need an ID to attach assets to).
  Accepts `.pdf, video/*, audio/*`.
- **BlogEditor** — title, excerpt, cover image, Markdown body, tags, published flag.
- **ResumeGenerator** — pick role + projects + skills + free-text instructions →
  `POST /api/resumes/generate`; previews the returned Markdown.
- **SkillsManager** — inline CRUD for skills, embedded in `ProfileEditor`.
- **ImageUploadField** — reusable single-image uploader (`POST /api/uploads` →
  stores the returned URL on the parent form).

All editors are `useMutation` + `invalidateQueries` on success, with inline error
display via `StatusNote`.

### Supporting pieces
`LoginButton` (3 states: logged-in avatar+logout / Google button / "set
VITE_GOOGLE_CLIENT_ID" notice), `ProjectCard`, `SocialLinks` (platform→icon map),
`ThemeToggle`, `Background` (pure-SVG animated night-sky/day-sky keyed to theme),
`SplashLoader`, and UI primitives `Modal`, `Markdown`, `Spinner`, `PageHeader`,
`StatusNote`.

---

## 9. Domain types

[`types.ts`](../frontend/src/types.ts) is the contract with the API. Core shapes
(abridged):

- **`AdminUser`** `{ id, email, name, picture }`
- **`Profile`** `{ fullName, headline, aboutMe, imageUrl, location, contactEmail, socials[], education[], resumeNote }`
- **`Skill`** `{ _id, name, category, level (0–100), icon, order }`
- **`Project`** `{ _id, title, slug, type: "enterprise"|"personal"|"archive", summary, about, impact, learning, skillsUsed[], demoLink, githubLink, coverImage, assets: ProjectAsset[], featured, order, published, timestamps }`
- **`ProjectAsset`** `{ _id, type: "pdf"|"recording", url, name, size, mimeType }`
- **`Resume`** `{ _id, title, role: "SDE"|"AI"|"other", source: "uploaded"|"generated", fileUrl, content, isPublic, timestamps }`
- **`Blog`** `{ _id, title, slug, excerpt, content, coverImage, tags[], published, publishedAt?, readingMinutes, timestamps }`
- **`ChatMessage`** `{ role: "user"|"assistant", content, sources?: { title, type }[] }`

These mirror the backend's Mongoose models field-for-field (see
[BACKEND.md §Models](BACKEND.md#3-data-models)).

---

## 10. Styling & theming

- **Tailwind** with `darkMode: "class"` ([`tailwind.config.js`](../frontend/tailwind.config.js)).
- **CSS variables** in [`index.css`](../frontend/src/index.css) define a theme-aware
  `--accent` and a `--brand-50…900` ramp. `:root` holds the light palette
  (amber/yellow); `.dark` overrides them (white→slate). Tailwind consumes them via
  `rgb(var(--brand-500) / <alpha-value>)`, so utilities like `bg-brand-500` resolve
  to *different* colors per theme **without conditional class names**.
- **Reusable component classes** (`@apply`): `.card`, `.btn`/`.btn-primary`/`.btn-ghost`,
  `.input`, `.label`, `.container-page`, plus a `glow` shadow scale.
- **Animations** (keyframes): `twinkle`, `shoot`, `sun-pulse`, `drift`, `fly`,
  `flap`, `fade-in-up`, `splash-progress` — all gated by
  `@media (prefers-reduced-motion: reduce)` for accessibility.

> **Why variables instead of `dark:` everywhere?** Theme-aware variables mean a
> component author writes `bg-brand-500` once and it's correct in both themes. It
> keeps markup clean and makes a palette change a single edit in `index.css`.

---

## 11. Build, dev proxy & deployment shapes

The SPA always calls **relative `/api`**; the environment decides how that
resolves:

| Environment | How `/api` reaches the backend | Cookies |
|-------------|--------------------------------|---------|
| **Local dev** (`npm run dev`, :5173) | Vite `server.proxy` forwards `/api` → `http://localhost:4000` ([`vite.config.ts`](../frontend/vite.config.ts)) | Same-origin, `Lax`, insecure. |
| **Docker** (:3000) | nginx `location /api/ { proxy_pass http://backend:4000; }` ([`nginx.conf`](../frontend/nginx.conf)) + SPA fallback to `index.html` | Same-origin, `Lax`, insecure. |
| **Production** (Vercel) | A `/api` **rewrite** in [`vercel.json`](../frontend/vercel.json) → the Render backend URL (keeps one origin) | Same-site; `COOKIE_SECURE=true`. |

Build config:
- `npm run build` = `tsc -b && vite build` → static assets in `frontend/dist/`.
- Two env vars (`VITE_*` are inlined at build time): `VITE_GOOGLE_CLIENT_ID` and
  `VITE_API_BASE` (leave empty for the single-origin proxy approach).
- The Docker image is multi-stage: Node builds, then the static `dist/` is copied
  into `nginx:alpine`.

> **Single-origin by design.** Keeping the SPA and `/api` on one origin avoids
> cross-site cookie complexity (SameSite=None + CORS). The relative-path +
> proxy/rewrite pattern is the simplest way to achieve that across all three
> environments. See [DEPLOYMENT.md](DEPLOYMENT.md) for the production wiring.

---

## 12. Conventions & extension points

- **Add a new content type** (e.g. "Talks"): add the type to `types.ts`, an
  `api/talks.ts` module + paths in `endpoints.ts`, a public page + an admin editor,
  and routes in `App.tsx`. Backend gets a matching model/router.
- **All paths through `endpoints.ts`** — never inline a URL string in a component.
- **All server reads through TanStack Query** — don't fetch in `useEffect`; you'd
  lose caching, dedup, and invalidation.
- **Uploads return a URL**, which you then save on the parent document — the file
  bytes live in GridFS behind `/api/files/:id`, decoupled from the document.
- **Theme-aware styling** — prefer `brand`/`accent` utilities over hardcoded colors
  so new UI works in both themes for free.

*Related: [ARCHITECTURE.md](../ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) ·
[AGENT.md](AGENT.md) · [DEPLOYMENT.md](DEPLOYMENT.md)*
