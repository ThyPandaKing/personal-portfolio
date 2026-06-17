/**
 * Full CRUD coverage against a real in-memory MongoDB (mongodb-memory-server).
 *
 * If the in-memory Mongo binary can't be provisioned (e.g. offline CI), the
 * whole suite is skipped rather than failing — the auth.test.ts suite still runs.
 */
import type { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { adminCookie } from "./helpers.js";

const app = createApp();
const cookie = adminCookie();

let mongod: MongoMemoryServer | undefined;
let dbReady = false;

// Try to start an in-memory Mongo; if it fails, mark the suite to skip.
try {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "test" });
  dbReady = true;
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("[crud.test] skipping — in-memory Mongo unavailable:", (e as Error).message);
}

const suite = dbReady ? describe : describe.skip;

afterAll(async () => {
  if (dbReady) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongod?.stop();
  }
});

suite("Profile", () => {
  it("GET /api/profile auto-creates and returns the singleton", async () => {
    const res = await request(app).get("/api/profile");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("socials");
  });

  it("PUT /api/profile updates fields (admin)", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set("Cookie", cookie)
      .send({ fullName: "Test User", headline: "Builder", socials: [], education: [] });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Test User");
  });

  it("drops empty rows and normalizes scheme-less social URLs (no 400)", async () => {
    const res = await request(app)
      .put("/api/profile")
      .set("Cookie", cookie)
      .send({
        fullName: "Test User",
        socials: [
          { platform: "", url: "" }, // empty placeholder → dropped
          { platform: "github", url: "github.com/me" }, // scheme auto-added
        ],
        education: [
          { level: "" }, // empty → dropped
          { level: "B.Tech", course: "CS" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.socials).toHaveLength(1);
    expect(res.body.socials[0].url).toBe("https://github.com/me");
    expect(res.body.education).toHaveLength(1);
  });
});

suite("Skills", () => {
  let id = "";
  it("creates a skill", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Cookie", cookie)
      .send({ name: "TypeScript", category: "Languages", level: 90 });
    expect(res.status).toBe(201);
    id = res.body._id;
  });

  it("lists skills", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body.some((s: { name: string }) => s.name === "TypeScript")).toBe(true);
  });

  it("updates a skill", async () => {
    const res = await request(app).put(`/api/skills/${id}`).set("Cookie", cookie).send({ level: 95 });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(95);
  });

  it("update of unknown id → 404", async () => {
    const res = await request(app)
      .put("/api/skills/0123456789abcdef01234567")
      .set("Cookie", cookie)
      .send({ level: 1 });
    expect(res.status).toBe(404);
  });

  it("deletes a skill", async () => {
    const res = await request(app).delete(`/api/skills/${id}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
  });
});

suite("Projects", () => {
  let slug = "";
  let id = "";

  it("creates a project and generates a slug", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({ title: "My Cool Project", type: "personal", summary: "x", published: true });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("my-cool-project");
    slug = res.body.slug;
    id = res.body._id;
  });

  it("fetches the project by slug", async () => {
    const res = await request(app).get(`/api/projects/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("My Cool Project");
  });

  it("hides unpublished projects from visitors but shows them to admin", async () => {
    await request(app)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({ title: "Draft Project", type: "personal", published: false });

    const visitor = await request(app).get("/api/projects");
    expect(visitor.body.some((p: { title: string }) => p.title === "Draft Project")).toBe(false);

    const admin = await request(app).get("/api/projects").set("Cookie", cookie);
    expect(admin.body.some((p: { title: string }) => p.title === "Draft Project")).toBe(true);
  });

  it("filters by type", async () => {
    const res = await request(app).get("/api/projects").query({ type: "personal" });
    expect(res.status).toBe(200);
    expect(res.body.every((p: { type: string }) => p.type === "personal")).toBe(true);
  });

  it("updates and deletes the project", async () => {
    const upd = await request(app)
      .put(`/api/projects/${id}`)
      .set("Cookie", cookie)
      .send({ type: "archive" });
    expect(upd.status).toBe(200);
    expect(upd.body.type).toBe("archive");

    const del = await request(app).delete(`/api/projects/${id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
  });
});

suite("Blogs", () => {
  let id = "";
  it("creates a blog and computes reading time", async () => {
    const res = await request(app)
      .post("/api/blogs")
      .set("Cookie", cookie)
      .send({ title: "Hello World", content: "word ".repeat(400), published: true });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("hello-world");
    expect(res.body.readingMinutes).toBeGreaterThanOrEqual(2);
    id = res.body._id;
  });

  it("lists and deletes", async () => {
    const list = await request(app).get("/api/blogs");
    expect(list.body.length).toBeGreaterThan(0);
    const del = await request(app).delete(`/api/blogs/${id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
  });
});

suite("Resumes", () => {
  let id = "";
  it("creates a resume", async () => {
    const res = await request(app)
      .post("/api/resumes")
      .set("Cookie", cookie)
      .send({ title: "SDE Resume", role: "SDE" });
    expect(res.status).toBe(201);
    id = res.body._id;
  });

  it("toggles public and hides drafts from visitors", async () => {
    const visitorBefore = await request(app).get("/api/resumes");
    expect(visitorBefore.body.length).toBe(0);

    await request(app).put(`/api/resumes/${id}`).set("Cookie", cookie).send({ isPublic: true });

    const visitorAfter = await request(app).get("/api/resumes");
    expect(visitorAfter.body.length).toBe(1);
  });

  it("deletes the resume", async () => {
    const del = await request(app).delete(`/api/resumes/${id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
  });
});
