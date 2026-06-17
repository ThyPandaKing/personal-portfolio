import { env } from "../config/env.js";
import { schemas } from "./schemas.js";

/* ---- small helpers to keep the paths DRY ---- */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (schemaName: string, required = true) => ({
  required,
  content: { "application/json": { schema: ref(schemaName) } },
});

const multipartBody = (extra: Record<string, unknown> = {}) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: ["file"],
        properties: { file: { type: "string", format: "binary" }, ...extra },
      },
    },
  },
});

const ok = (schemaName: string, description = "Success") => ({
  description,
  content: { "application/json": { schema: ref(schemaName) } },
});

const okArray = (schemaName: string, description = "Success") => ({
  description,
  content: { "application/json": { schema: { type: "array", items: ref(schemaName) } } },
});

const errs = (...codes: Array<400 | 401 | 404>) => {
  const map: Record<number, string> = {
    400: "Validation error",
    401: "Admin authentication required",
    404: "Not found",
  };
  return Object.fromEntries(
    codes.map((c) => [
      String(c),
      { description: map[c], content: { "application/json": { schema: ref("Error") } } },
    ]),
  );
};

const adminSecurity = [{ cookieAuth: [] }];

const idParam = (name = "id", desc = "Resource id") => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" },
  description: desc,
});

/* ---- the spec ---- */

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Portfolio Backend API",
    version: "0.1.0",
    description:
      "REST API for the personal portfolio. Public endpoints are open to visitors; " +
      "admin endpoints require a session cookie obtained via `POST /api/auth/google` " +
      "(restricted to the configured admin email allowlist).",
  },
  servers: [
    { url: env.publicBaseUrl, description: "Configured base URL" },
    { url: "/", description: "Same origin" },
  ],
  tags: [
    { name: "Auth", description: "Google login and session" },
    { name: "Profile", description: "Home page content (singleton)" },
    { name: "Skills" },
    { name: "Projects" },
    { name: "Blogs" },
    { name: "Resumes" },
    { name: "Uploads" },
    { name: "Files", description: "Stream files stored in MongoDB GridFS" },
    { name: "Chat", description: "AI chatbot and RAG knowledge base (proxied to the agent service)" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "portfolio_session",
        description: "Session JWT set as an httpOnly cookie after Google login.",
      },
    },
    schemas,
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string" }, service: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },

    /* ---- Auth ---- */
    "/api/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a Google ID token for a session cookie",
        requestBody: jsonBody("GoogleLoginRequest"),
        responses: {
          "200": {
            description: "Logged in; sets the session cookie",
            content: {
              "application/json": {
                schema: { type: "object", properties: { user: ref("AdminUser") } },
              },
            },
            headers: {
              "Set-Cookie": {
                schema: { type: "string" },
                description: "portfolio_session=<jwt>; HttpOnly",
              },
            },
          },
          "400": errs(400)["400"],
          "403": {
            description: "Email not in the admin allowlist",
            content: { "application/json": { schema: ref("Error") } },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Clear the session cookie",
        responses: { "200": ok("OkResponse") },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current session (null if visitor)",
        responses: { "200": ok("AuthMeResponse") },
      },
    },

    /* ---- Profile ---- */
    "/api/profile": {
      get: {
        tags: ["Profile"],
        summary: "Get the Home page profile",
        responses: { "200": ok("Profile") },
      },
      put: {
        tags: ["Profile"],
        summary: "Update the Home page profile",
        security: adminSecurity,
        requestBody: jsonBody("Profile"),
        responses: { "200": ok("Profile"), ...errs(400, 401) },
      },
    },
    "/api/profile/image": {
      post: {
        tags: ["Profile"],
        summary: "Upload the profile image",
        security: adminSecurity,
        requestBody: multipartBody(),
        responses: { "200": ok("UrlResponse"), ...errs(400, 401) },
      },
    },

    /* ---- Skills ---- */
    "/api/skills": {
      get: { tags: ["Skills"], summary: "List skills", responses: { "200": okArray("Skill") } },
      post: {
        tags: ["Skills"],
        summary: "Create a skill",
        security: adminSecurity,
        requestBody: jsonBody("SkillInput"),
        responses: { "201": ok("Skill", "Created"), ...errs(400, 401) },
      },
    },
    "/api/skills/{id}": {
      put: {
        tags: ["Skills"],
        summary: "Update a skill",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody("SkillInput"),
        responses: { "200": ok("Skill"), ...errs(400, 401, 404) },
      },
      delete: {
        tags: ["Skills"],
        summary: "Delete a skill",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { "200": ok("OkResponse"), ...errs(401, 404) },
      },
    },

    /* ---- Projects ---- */
    "/api/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects (visitors see published only)",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["enterprise", "personal", "archive"] },
          },
        ],
        responses: { "200": okArray("Project") },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        security: adminSecurity,
        requestBody: jsonBody("ProjectInput"),
        responses: { "201": ok("Project", "Created"), ...errs(400, 401) },
      },
    },
    "/api/projects/{slug}": {
      get: {
        tags: ["Projects"],
        summary: "Get a project by slug",
        parameters: [idParam("slug", "Project slug")],
        responses: { "200": ok("Project"), ...errs(404) },
      },
    },
    "/api/projects/{id}": {
      put: {
        tags: ["Projects"],
        summary: "Update a project",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody("ProjectInput"),
        responses: { "200": ok("Project"), ...errs(400, 401, 404) },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project (and its local asset files)",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { "200": ok("OkResponse"), ...errs(401, 404) },
      },
    },
    "/api/projects/{id}/assets": {
      post: {
        tags: ["Projects"],
        summary: "Upload a project asset (PDF or recording)",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: multipartBody({ name: { type: "string" } }),
        responses: { "201": ok("Project", "Asset added"), ...errs(400, 401, 404) },
      },
    },
    "/api/projects/{id}/assets/{assetId}": {
      delete: {
        tags: ["Projects"],
        summary: "Delete a project asset",
        security: adminSecurity,
        parameters: [idParam(), idParam("assetId", "Asset id")],
        responses: { "200": ok("Project"), ...errs(401, 404) },
      },
    },

    /* ---- Blogs ---- */
    "/api/blogs": {
      get: {
        tags: ["Blogs"],
        summary: "List blog articles (visitors see published only)",
        responses: { "200": okArray("Blog") },
      },
      post: {
        tags: ["Blogs"],
        summary: "Create an article",
        security: adminSecurity,
        requestBody: jsonBody("BlogInput"),
        responses: { "201": ok("Blog", "Created"), ...errs(400, 401) },
      },
    },
    "/api/blogs/{slug}": {
      get: {
        tags: ["Blogs"],
        summary: "Get an article by slug",
        parameters: [idParam("slug", "Article slug")],
        responses: { "200": ok("Blog"), ...errs(404) },
      },
    },
    "/api/blogs/{id}": {
      put: {
        tags: ["Blogs"],
        summary: "Update an article",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody("BlogInput"),
        responses: { "200": ok("Blog"), ...errs(400, 401, 404) },
      },
      delete: {
        tags: ["Blogs"],
        summary: "Delete an article",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { "200": ok("OkResponse"), ...errs(401, 404) },
      },
    },

    /* ---- Resumes ---- */
    "/api/resumes": {
      get: {
        tags: ["Resumes"],
        summary: "List resumes (visitors see public only)",
        responses: { "200": okArray("Resume") },
      },
      post: {
        tags: ["Resumes"],
        summary: "Create a resume entry",
        security: adminSecurity,
        requestBody: jsonBody("ResumeInput"),
        responses: { "201": ok("Resume", "Created"), ...errs(400, 401) },
      },
    },
    "/api/resumes/generate": {
      post: {
        tags: ["Resumes"],
        summary: "AI-generate a resume from selected projects/skills and save it as a draft",
        security: adminSecurity,
        requestBody: jsonBody("ResumeGenerateRequest"),
        responses: { "201": ok("Resume", "Generated"), ...errs(400, 401) },
      },
    },
    "/api/resumes/{id}": {
      get: {
        tags: ["Resumes"],
        summary: "Get a resume",
        parameters: [idParam()],
        responses: { "200": ok("Resume"), ...errs(404) },
      },
      put: {
        tags: ["Resumes"],
        summary: "Update a resume",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody("ResumeInput"),
        responses: { "200": ok("Resume"), ...errs(400, 401, 404) },
      },
      delete: {
        tags: ["Resumes"],
        summary: "Delete a resume (and its local file)",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { "200": ok("OkResponse"), ...errs(401, 404) },
      },
    },
    "/api/resumes/{id}/file": {
      post: {
        tags: ["Resumes"],
        summary: "Upload/replace the resume PDF",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: multipartBody(),
        responses: { "200": ok("Resume"), ...errs(400, 401, 404) },
      },
    },

    /* ---- Uploads ---- */
    "/api/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Upload any supported file, returns its public URL",
        security: adminSecurity,
        requestBody: multipartBody(),
        responses: { "201": ok("UploadResult", "Uploaded"), ...errs(400, 401) },
      },
    },

    /* ---- Files ---- */
    "/api/files/{id}": {
      get: {
        tags: ["Files"],
        summary: "Stream a file stored in GridFS (public; supports range requests)",
        parameters: [idParam("id", "GridFS file id")],
        responses: {
          "200": { description: "File stream", content: { "*/*": { schema: { type: "string", format: "binary" } } } },
          "206": { description: "Partial content (range request)" },
          "404": errs(404)["404"],
        },
      },
    },

    /* ---- Chat ---- */
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Ask the AI assistant a question (public)",
        requestBody: jsonBody("ChatRequest"),
        responses: { "200": ok("ChatReply"), ...errs(400) },
      },
    },
    "/api/chat/admin/status": {
      get: {
        tags: ["Chat"],
        summary: "Knowledge-base status",
        security: adminSecurity,
        responses: { "200": ok("RagStatus"), ...errs(401) },
      },
    },
    "/api/chat/admin/reingest": {
      post: {
        tags: ["Chat"],
        summary: "Re-index all portfolio content into the knowledge base",
        security: adminSecurity,
        responses: { "200": ok("IngestResponse"), ...errs(401) },
      },
    },
    "/api/chat/admin/document": {
      post: {
        tags: ["Chat"],
        summary: "Add a pasted document to the knowledge base",
        security: adminSecurity,
        requestBody: jsonBody("DocumentIngestRequest"),
        responses: { "200": ok("IngestResponse"), ...errs(400, 401) },
      },
    },
    "/api/chat/admin/pdf": {
      post: {
        tags: ["Chat"],
        summary: "Upload a PDF and index its extracted text",
        security: adminSecurity,
        requestBody: multipartBody({ title: { type: "string" } }),
        responses: { "200": ok("IngestResponse"), ...errs(400, 401) },
      },
    },
    "/api/chat/admin/reset": {
      post: {
        tags: ["Chat"],
        summary: "Clear the entire knowledge base",
        security: adminSecurity,
        responses: { "200": ok("IngestResponse"), ...errs(401) },
      },
    },
  },
} as const;
