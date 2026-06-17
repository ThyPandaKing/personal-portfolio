/**
 * Seed diverse demo data into MongoDB Atlas: profile, skills, projects (across web/
 * game/app/tool/extension/AI), blogs, and resumes — plus generated PDF documents
 * and SVG cover images stored in GridFS. Includes edge cases (drafts, archived,
 * minimal/empty fields, long content, unicode/emoji).
 *
 * Run:  npm run seed       (DESTRUCTIVE: replaces demo content + uploaded files)
 */
import PDFDocument from "pdfkit";
import slugify from "slugify";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { BlogModel } from "../src/models/Blog.js";
import { ProfileModel } from "../src/models/Profile.js";
import { ProjectModel } from "../src/models/Project.js";
import { ResumeModel } from "../src/models/Resume.js";
import { SkillModel } from "../src/models/Skill.js";
import { fileUrlFor, uploadBuffer } from "../src/services/gridfs.js";

/* ----------------------------- asset generators ----------------------------- */

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

function svgCover(title: string, subtitle: string, c1: string, c2: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450" viewBox="0 0 900 450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="900" height="450" fill="url(#g)"/>
  <text x="50" y="230" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">${esc(title)}</text>
  <text x="50" y="290" font-family="Inter, Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.85)">${esc(subtitle)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

function makePdf(
  title: string,
  paragraphs: string[],
  links: { label: string; url: string }[] = [],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).fillColor("#1e293b").text(title);
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor("#334155");
    for (const p of paragraphs) {
      doc.text(p, { align: "left" });
      doc.moveDown(0.6);
    }
    if (links.length) {
      doc.moveDown(0.5).fontSize(12).fillColor("#1e293b").text("Links");
      doc.fontSize(11);
      for (const l of links) {
        doc.fillColor("#4f46e5").text(l.label, { link: l.url, underline: true });
      }
    }
    doc.end();
  });
}

async function uploadAsset(buf: Buffer, filename: string, mime: string): Promise<string> {
  const stored = await uploadBuffer(buf, filename, mime);
  return fileUrlFor(stored.id);
}

const slug = (t: string) => slugify(t, { lower: true, strict: true });
const readingMinutes = (c: string) => Math.max(1, Math.round(c.split(/\s+/).filter(Boolean).length / 200));

/* --------------------------------- data --------------------------------- */

async function seed() {
  await connectDb();
  console.log("⚠️  Replacing demo content (skills, projects, blogs, resumes, profile) + GridFS files...");

  // Clear seeded collections + the GridFS uploads bucket for a clean slate.
  await Promise.all([
    SkillModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    BlogModel.deleteMany({}),
    ResumeModel.deleteMany({}),
  ]);
  const db = mongoose.connection.db!;
  await db.collection("uploads.files").deleteMany({}).catch(() => {});
  await db.collection("uploads.chunks").deleteMany({}).catch(() => {});

  /* ---- Profile ---- */
  const profileImg = await uploadAsset(
    svgCover("AS", "Software Engineer", "#6366f1", "#312e81"),
    "profile.svg",
    "image/svg+xml",
  );
  await ProfileModel.updateOne(
    {},
    {
      $set: {
        fullName: "Aditya Sharma",
        headline: "Full-Stack & AI Engineer — I build pragmatic products end-to-end",
        aboutMe:
          "I'm a software engineer who enjoys shipping across the stack — from **React** front-ends to " +
          "**Node/FastAPI** services and **AI/RAG** systems. Currently a Full-Stack Compliance Engineer at " +
          "ServiceNow, where I automate controls to hit 100% compliance and save 1000+ man-hours.\n\n" +
          "Outside work I build games, browser extensions, and developer tools. I like turning fuzzy problems " +
          "into clean, maintainable systems. 🚀",
        imageUrl: profileImg,
        location: "Bengaluru, India",
        contactEmail: "aditya9660sharma@gmail.com",
        socials: [
          { platform: "github", url: "https://github.com/aditya-sharma" },
          { platform: "linkedin", url: "https://linkedin.com/in/aditya-sharma" },
          { platform: "x", url: "https://x.com/aditya_builds" },
          { platform: "email", url: "mailto:aditya9660sharma@gmail.com" },
        ],
        education: [
          {
            level: "B.Tech",
            course: "Computer Science & Engineering",
            institution: "IIT Tirupati",
            startYear: "2019",
            endYear: "2023",
            details: "Coursework in distributed systems, ML, and compilers. Led the coding club.",
          },
        ],
        resumeNote: "Two tailored resumes below — pick SDE or AI depending on the role.",
      },
    },
    { upsert: true },
  );

  /* ---- Skills (diverse categories) ---- */
  const skills = [
    ["TypeScript", "Languages", 92], ["Python", "Languages", 90], ["C++", "Languages", 78],
    ["JavaScript", "Languages", 90], ["Go", "Languages", 70],
    ["React", "Frontend", 93], ["Tailwind CSS", "Frontend", 88], ["React Native", "Frontend", 80],
    ["Node.js / Express", "Backend", 90], ["FastAPI", "Backend", 85],
    ["MongoDB", "Databases", 86], ["PostgreSQL", "Databases", 80],
    ["Docker", "DevOps", 82], ["GitHub Actions", "DevOps", 75],
    ["LangGraph", "AI", 84], ["Gemini / LLMs", "AI", 84], ["RAG / Vector Search", "AI", 82],
    ["Unity / C#", "Game Dev", 72], ["Chrome Extensions", "Tooling", 80],
  ];
  await SkillModel.insertMany(
    skills.map(([name, category, level], i) => ({ name, category, level, order: i })),
  );

  /* ---- Projects (web / game / app / tool / extension / AI + edge cases) ---- */
  type Asset = { type: "pdf" | "recording"; url: string; name: string; size: number; mimeType: string };

  async function pdfAsset(name: string, title: string, paras: string[], links: { label: string; url: string }[] = []): Promise<Asset> {
    const buf = await makePdf(title, paras, links);
    const url = await uploadAsset(buf, `${slug(name)}.pdf`, "application/pdf");
    return { type: "pdf", url, name, size: buf.length, mimeType: "application/pdf" };
  }
  async function cover(title: string, sub: string, c1: string, c2: string): Promise<string> {
    return uploadAsset(svgCover(title, sub, c1, c2), `${slug(title)}-cover.svg`, "image/svg+xml");
  }

  const projects: any[] = [];

  // 1. Web dev (enterprise, featured) — cover + PDF case study
  projects.push({
    title: "Realtime Collaborative Whiteboard",
    type: "enterprise", featured: true, order: 0, published: true,
    summary: "A multiplayer whiteboard with live cursors, CRDT sync, and export.",
    about: "A web app letting teams sketch together in real time. Uses **WebSockets** + a CRDT layer so edits merge without conflicts, with presence (live cursors) and offline catch-up.",
    impact: "Adopted by 40+ internal teams; cut design-sync meetings by ~30%. Sub-100ms sync at 50 concurrent editors.",
    learning: "Conflict-free replicated data types (CRDTs), backpressure on WebSocket fan-out, and optimistic UI.",
    skillsUsed: ["React", "TypeScript", "Node.js / Express", "MongoDB"],
    demoLink: "https://whiteboard.demo.example.com",
    githubLink: "https://github.com/aditya-sharma/collab-whiteboard",
    coverImage: await cover("Collab Whiteboard", "Realtime · CRDT · WebSockets", "#0ea5e9", "#1e3a8a"),
    assets: [
      await pdfAsset("Whiteboard — Architecture Case Study", "Realtime Collaborative Whiteboard — Case Study", [
        "Problem: design teams lost time syncing static mockups. We needed a shared canvas with sub-second updates.",
        "Architecture: a React canvas client, a Node WebSocket gateway, and a CRDT (Yjs-style) document model persisted to MongoDB. Presence is broadcast on a separate lightweight channel.",
        "Scaling: we shard rooms across gateway instances and use a Redis-less in-memory fan-out per room, with periodic snapshots to MongoDB for durability.",
        "Results: 100ms median sync at 50 concurrent editors, 40+ teams onboarded, ~30% fewer design-sync meetings.",
      ], [{ label: "Live demo", url: "https://whiteboard.demo.example.com" }, { label: "Source", url: "https://github.com/aditya-sharma/collab-whiteboard" }]),
    ],
  });

  // 2. Game dev (personal) — cover, github
  projects.push({
    title: "Pixel Dungeon Crawler",
    type: "personal", order: 1, published: true,
    summary: "A roguelike dungeon crawler with procedural levels, built in Unity.",
    about: "A 2D roguelike with procedurally generated dungeons, turn-based combat, and a loot/skill system. Built in **Unity** with C#.",
    impact: "10k+ downloads on itch.io; featured in a 'best free roguelikes' roundup.",
    learning: "Procedural generation (BSP dungeons), ECS-style entity design, and juice/feel in game feedback.",
    skillsUsed: ["Unity / C#", "C++"],
    demoLink: "https://aditya.itch.io/pixel-dungeon",
    githubLink: "https://github.com/aditya-sharma/pixel-dungeon",
    coverImage: await cover("Pixel Dungeon", "Roguelike · Unity · Procedural", "#f59e0b", "#7c2d12"),
    assets: [],
  });

  // 3. App dev (personal) — cover, demo
  projects.push({
    title: "FitTrack — Mobile Fitness App",
    type: "personal", order: 2, published: true,
    summary: "Cross-platform workout tracker with offline sync and charts.",
    about: "A **React Native** (Expo) app to log workouts, track PRs, and visualize progress. Works offline and syncs when back online.",
    impact: "4.6★ across 1.2k ratings; 8k MAU at peak.",
    learning: "Offline-first sync, local SQLite, and chart performance on low-end devices.",
    skillsUsed: ["React Native", "TypeScript", "PostgreSQL"],
    demoLink: "https://fittrack.demo.example.com",
    githubLink: "https://github.com/aditya-sharma/fittrack",
    coverImage: await cover("FitTrack", "Mobile · React Native · Offline-first", "#10b981", "#065f46"),
    assets: [],
  });

  // 4. Tool dev (personal) — PDF docs, github
  projects.push({
    title: "DBMigrate — Zero-Downtime Migration CLI",
    type: "personal", order: 3, published: true,
    summary: "A CLI that runs reversible, zero-downtime schema migrations.",
    about: "A developer tool (written in **Go**) for expand/contract database migrations with automatic rollback and dry-run plans.",
    impact: "Used in 3 production services; eliminated migration-related downtime.",
    learning: "Expand/contract migration patterns, transactional DDL limits, and CLI ergonomics.",
    skillsUsed: ["Go", "PostgreSQL", "Docker"],
    demoLink: "",
    githubLink: "https://github.com/aditya-sharma/dbmigrate",
    coverImage: await cover("DBMigrate", "CLI · Go · Zero-downtime", "#64748b", "#0f172a"),
    assets: [
      await pdfAsset("DBMigrate — User Guide", "DBMigrate CLI — User Guide", [
        "DBMigrate applies database schema changes using the expand/contract pattern so deploys never block on migrations.",
        "Commands: 'dbmigrate plan' prints a dry-run, 'dbmigrate up' applies, 'dbmigrate down' rolls back the last step.",
        "Safety: every migration declares an inverse; the tool refuses destructive contracts until the expand phase has shipped.",
      ], [{ label: "GitHub", url: "https://github.com/aditya-sharma/dbmigrate" }]),
    ],
  });

  // 5. Browser extension (personal)
  projects.push({
    title: "TabZen — Tab Manager Extension",
    type: "personal", order: 4, published: true,
    summary: "A Chrome extension that auto-groups tabs and suspends idle ones.",
    about: "A **Chrome/Edge extension** (Manifest V3, TypeScript) that groups tabs by domain, suspends idle tabs to save memory, and offers fuzzy tab search.",
    impact: "12k weekly active users; 4.8★ on the Chrome Web Store.",
    learning: "MV3 service workers, the tabs/tabGroups APIs, and memory profiling.",
    skillsUsed: ["Chrome Extensions", "TypeScript"],
    demoLink: "https://chrome.google.com/webstore/detail/tabzen",
    githubLink: "https://github.com/aditya-sharma/tabzen",
    coverImage: await cover("TabZen", "Extension · MV3 · TypeScript", "#a855f7", "#581c87"),
    assets: [],
  });

  // 6. AI (enterprise, featured) — this very portfolio
  projects.push({
    title: "Portfolio RAG Assistant",
    type: "enterprise", featured: true, order: 5, published: true,
    summary: "The chatbot on this site — a LangGraph agent with RAG over the whole portfolio.",
    about: "A **FastAPI + LangGraph** agent powered by **Gemini**, with retrieval over projects, blogs, profile and uploaded docs using **MongoDB Atlas Vector Search**.",
    impact: "Lets visitors and recruiters ask natural questions and get grounded, cited answers.",
    learning: "Tool-using agents, multi-model fallback, and storing embeddings in the same DB as app data.",
    skillsUsed: ["Python", "LangGraph", "Gemini / LLMs", "RAG / Vector Search", "FastAPI", "MongoDB"],
    demoLink: "",
    githubLink: "https://github.com/aditya-sharma/portfolio",
    coverImage: await cover("RAG Assistant", "AI · LangGraph · Gemini", "#4f46e5", "#1e1b4b"),
    assets: [
      await pdfAsset("RAG Assistant — Design Notes", "Portfolio RAG Assistant — Design Notes", [
        "Goal: answer questions about the portfolio using only grounded data, never hallucinated facts.",
        "Pipeline: ingest projects/blogs/profile/skills + extracted PDF text, embed with Gemini, store vectors in MongoDB Atlas Vector Search, retrieve top-k at query time.",
        "Resilience: a fallback chain of Gemini models retries up to 3 times; if all fail, the reasoning is surfaced to the user.",
      ], [{ label: "Source", url: "https://github.com/aditya-sharma/portfolio" }]),
    ],
  });

  // 7. EDGE CASE: archived + unicode/emoji + very long content
  const longAbout = "This is a deliberately long write-up to test rendering and chunking. ".repeat(60);
  projects.push({
    title: "Legacy Flash Game Portal (日本語 • emoji 🎮)",
    type: "archive", order: 6, published: true,
    summary: "An archived Flash games portal — kept for posterity. Tests unicode & long text.",
    about: longAbout + "\n\nSupports **markdown**, `code`, and unicode: café, naïve, 日本語, 🚀🎮🔥.",
    impact: "Sunset after Flash EOL; migrated favorites to HTML5.",
    learning: "Graceful deprecation and content migration at scale.",
    skillsUsed: ["JavaScript"],
    demoLink: "", githubLink: "",
    coverImage: await cover("Legacy Portal", "Archived · 2014", "#9ca3af", "#374151"),
    assets: [],
  });

  // 8. EDGE CASE: unpublished draft, minimal/empty optional fields
  projects.push({
    title: "Untitled Experiment (draft)",
    type: "personal", order: 7, published: false,
    summary: "", about: "", impact: "", learning: "",
    skillsUsed: [], demoLink: "", githubLink: "", coverImage: "", assets: [],
  });

  for (const p of projects) {
    await ProjectModel.create({ ...p, slug: slug(p.title) });
  }

  /* ---- Blogs (various topics + edge cases) ---- */
  const blogs = [
    {
      title: "Building a CRDT Whiteboard Without Losing Your Mind",
      tags: ["web dev", "realtime", "crdt"],
      excerpt: "What I learned shipping a multiplayer canvas: CRDTs, presence, and backpressure.",
      content: "## Why CRDTs\n\nOperational transforms are powerful but fiddly. CRDTs trade a bit of memory for conflict-free merges...\n\n" + "More detail. ".repeat(120),
      published: true,
    },
    {
      title: "Procedural Dungeons: BSP vs. Cellular Automata",
      tags: ["game dev", "unity", "procedural"],
      excerpt: "Two approaches to generating roguelike levels, with trade-offs and screenshots.",
      content: "Procedural generation makes every run feel fresh...\n\n" + "Level theory. ".repeat(90),
      published: true,
    },
    {
      title: "Offline-First Mobile Apps with Expo",
      tags: ["app dev", "react native", "offline"],
      excerpt: "Sync strategies, conflict resolution, and SQLite on the device.",
      content: "Offline-first means the network is an enhancement, not a requirement...\n\n" + "Sync notes. ".repeat(80),
      published: true,
    },
    {
      title: "Writing Developer Tools People Actually Use",
      tags: ["tool dev", "cli", "go"],
      excerpt: "Ergonomics, good defaults, and dry-run everything.",
      content: "A CLI lives or dies by its defaults...\n\n" + "Tooling notes. ".repeat(70),
      published: true,
    },
    {
      title: "Shipping a Manifest V3 Chrome Extension in 2025",
      tags: ["extensions", "chrome", "typescript"],
      excerpt: "Service workers, the new APIs, and surviving the MV2 deprecation.",
      content: "MV3 changes the mental model from background pages to ephemeral service workers...\n\n" + "Extension notes. ".repeat(75),
      published: true,
    },
    {
      title: "RAG That Actually Grounds: Vectors in Your Main Database",
      tags: ["ai", "rag", "mongodb"],
      excerpt: "Why I moved embeddings into MongoDB Atlas Vector Search instead of a separate store.",
      content: "Keeping vectors next to your app data removes a whole class of sync problems...\n\n" + "RAG notes. ".repeat(100),
      published: true,
    },
    {
      // EDGE CASE: draft + emoji/unicode + long
      title: "Draft: Half-baked thoughts on compilers 🛠️ (日本語)",
      tags: ["draft", "compilers"],
      excerpt: "An unpublished draft to test draft handling and unicode.",
      content: "Still writing this one... " + "WIP. ".repeat(150),
      published: false,
    },
  ];
  for (const b of blogs) {
    await BlogModel.create({
      ...b,
      slug: slug(b.title),
      coverImage: await cover(b.title.slice(0, 22), b.tags.join(" · "), "#6366f1", "#0f172a"),
      readingMinutes: readingMinutes(b.content),
      publishedAt: b.published ? new Date() : undefined,
    });
  }

  /* ---- Resumes: one uploaded PDF (with links), one generated markdown (public) ---- */
  const sdePdf = await uploadAsset(
    await makePdf(
      "Aditya Sharma — Software Engineer",
      [
        "Full-Stack & AI Engineer with experience shipping web, mobile, game, and developer-tool projects end-to-end.",
        "Experience — ServiceNow (Full-Stack Compliance Engineer): automated controls to reach 100% compliance, saving 1000+ man-hours.",
        "Selected projects — Realtime Collaborative Whiteboard (React/Node/CRDT), DBMigrate CLI (Go), Portfolio RAG Assistant (FastAPI/LangGraph/Gemini).",
        "Education — B.Tech CSE, IIT Tirupati (2019–2023).",
        "Skills — TypeScript, Python, React, Node.js, FastAPI, MongoDB, Docker, LLM/RAG.",
      ],
      [
        { label: "GitHub", url: "https://github.com/aditya-sharma" },
        { label: "LinkedIn", url: "https://linkedin.com/in/aditya-sharma" },
        { label: "Email", url: "mailto:aditya9660sharma@gmail.com" },
      ],
    ),
    "aditya-sharma-sde.pdf",
    "application/pdf",
  );
  await ResumeModel.create({
    title: "Aditya Sharma — SDE", role: "SDE", source: "uploaded", fileUrl: sdePdf, isPublic: true,
  });

  await ResumeModel.create({
    title: "Aditya Sharma — AI Engineer", role: "AI", source: "generated", isPublic: true,
    content:
      "# Aditya Sharma\n**AI / Full-Stack Engineer** · Bengaluru, India\n\n" +
      "[GitHub](https://github.com/aditya-sharma) · [LinkedIn](https://linkedin.com/in/aditya-sharma) · " +
      "[aditya9660sharma@gmail.com](mailto:aditya9660sharma@gmail.com)\n\n" +
      "## Summary\nEngineer focused on applied AI — RAG systems, tool-using agents, and the product around them.\n\n" +
      "## Experience\n**ServiceNow — Full-Stack Compliance Engineer**\n- Automated controls to 100% compliance, saving 1000+ man-hours.\n\n" +
      "## Selected Projects\n- **Portfolio RAG Assistant** — LangGraph + Gemini agent with MongoDB Atlas Vector Search.\n" +
      "- **Realtime Collaborative Whiteboard** — React/Node CRDT app.\n\n" +
      "## Skills\nPython, LangGraph, Gemini/LLMs, RAG, FastAPI, React, TypeScript, MongoDB, Docker.\n\n" +
      "## Education\n**B.Tech, Computer Science** — IIT Tirupati (2019–2023)\n",
  });

  const counts = {
    skills: await SkillModel.countDocuments(),
    projects: await ProjectModel.countDocuments(),
    blogs: await BlogModel.countDocuments(),
    resumes: await ResumeModel.countDocuments(),
    files: await db.collection("uploads.files").countDocuments(),
  };
  console.log("✅ Seed complete:", counts);
  console.log("➡️  Next: log in as admin → Chatbot/RAG → Re-index to embed this into the vector store.");
  await disconnectDb();
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
