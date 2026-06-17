/**
 * Auth, authorization and validation behavior — does NOT require a database
 * (every assertion here short-circuits before any DB access).
 *
 * These are the cases the brief called out: auth/validation failures must return
 * proper status codes (400/401/403/413), never a generic 500.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { adminCookie } from "./helpers.js";

const app = createApp();

describe("system", () => {
  it("GET /health → 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api → 200 service info", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("portfolio-backend");
  });

  it("unknown route → 404 JSON", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe("auth: POST /api/auth/google", () => {
  it("missing credential → 400 validation", async () => {
    const res = await request(app).post("/api/auth/google").send({});
    expect(res.status).toBe(400);
  });

  it("too-short credential → 400 validation", async () => {
    const res = await request(app).post("/api/auth/google").send({ credential: "abc" });
    expect(res.status).toBe(400);
  });

  it("invalid/garbage credential → 401 (not 500)", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ credential: "x".repeat(40) });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credential/i);
  });
});

describe("auth: session", () => {
  it("GET /api/auth/me with no cookie → 200 { user: null }", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("POST /api/auth/logout → 200", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("authorization: admin-only routes reject visitors with 401", () => {
  const cases: Array<[string, "put" | "post" | "delete", string]> = [
    ["PUT /api/profile", "put", "/api/profile"],
    ["POST /api/skills", "post", "/api/skills"],
    ["POST /api/projects", "post", "/api/projects"],
    ["DELETE /api/blogs/:id", "delete", "/api/blogs/abc123"],
    ["POST /api/resumes", "post", "/api/resumes"],
    ["GET /api/chat/admin/status", "post", "/api/chat/admin/reingest"],
  ];

  for (const [label, method, path] of cases) {
    it(`${label} with no cookie → 401`, async () => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
    });
  }

  it("admin route with an INVALID cookie → 401 (not 500)", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set("Cookie", "portfolio_session=not-a-real-jwt")
      .send({});
    expect(res.status).toBe(401);
  });
});

describe("uploads: validation errors are 4xx, not 500", () => {
  it("unsupported file type → 400", async () => {
    const res = await request(app)
      .post("/api/uploads")
      .set("Cookie", adminCookie())
      .attach("file", Buffer.from("hello"), { filename: "note.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported file type/i);
  });

  it("missing file → 400", async () => {
    const res = await request(app).post("/api/uploads").set("Cookie", adminCookie());
    expect(res.status).toBe(400);
  });
});
