/**
 * Seed the user's real personal projects (analyzed from their GitHub repos) into
 * MongoDB Atlas. Each project gets a generated PDF case-study attached in GridFS,
 * and every skill referenced is upserted into the skills collection.
 *
 * DESTRUCTIVE (by design, confirmed scope): clears the skills, projects, blogs,
 * and resumes collections plus the GridFS uploads bucket. It does NOT touch the
 * `users` or `profile` collections.
 *
 * Project content lives in ./projects.json (+ ./project-docs/<key>.md for the
 * long write-ups) so the source text needs no escaping.
 *
 * Run:  npm run seed:projects
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import slugify from "slugify";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { BlogModel } from "../src/models/Blog.js";
import { ProjectModel } from "../src/models/Project.js";
import { ResumeModel } from "../src/models/Resume.js";
import { SkillModel } from "../src/models/Skill.js";
import { fileUrlFor, uploadBuffer } from "../src/services/gridfs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ProjectInput {
  key: string;
  title: string;
  order: number;
  year: string;
  summary: string;
  about: string;
  impact: string;
  learning: string;
  skillsUsed: string[];
  githubLink: string;
  demoLink: string;
  type?: "enterprise" | "personal" | "archive"; // defaults to "personal"
  featured?: boolean; // featured projects lead the portfolio
  coverFile?: string; // image in ./project-covers (preferred — sourced from the repo)
  coverSubtitle?: string; // for a generated SVG cover when no repo image fits
  coverColors?: [string, string];
  coverServiceNow?: boolean; // generate a ServiceNow-branded cover (enterprise work)
}

/** category + proficiency level (0-100) for every skill the projects reference. */
const SKILL_META: Record<string, [string, number]> = {
  JavaScript: ["Languages", 88],
  TypeScript: ["Languages", 85],
  Python: ["Languages", 85],
  "C++": ["Languages", 78],
  "C#": ["Languages", 72],
  Kotlin: ["Languages", 70],
  "Node.js": ["Backend", 86],
  Express: ["Backend", 85],
  FastAPI: ["Backend", 75],
  "REST API": ["Backend", 85],
  "Socket.io": ["Backend", 74],
  "Google OAuth": ["Backend", 75],
  bcrypt: ["Backend", 70],
  Mongoose: ["Backend", 82],
  React: ["Frontend", 88],
  "React Router": ["Frontend", 80],
  Vite: ["Frontend", 78],
  "Tailwind CSS": ["Frontend", 82],
  Bootstrap: ["Frontend", 76],
  "Material-UI": ["Frontend", 75],
  Axios: ["Frontend", 80],
  "HTML/CSS": ["Frontend", 85],
  MongoDB: ["Databases", 84],
  "MongoDB Atlas": ["Databases", 80],
  Tkinter: ["Tools & Systems", 68],
  "MIPS Assembly": ["Tools & Systems", 72],
  "Computer Architecture": ["Tools & Systems", 75],
  Make: ["Tools & Systems", 65],
  "Lex/Flex": ["Tools & Systems", 72],
  "Yacc/Bison": ["Tools & Systems", 72],
  "VS Code Extension API": ["Tools & Systems", 70],
  "Text-to-Speech": ["Tools & Systems", 65],
  Unity: ["Game Dev", 72],
  WebGL: ["Game Dev", 68],
  "Game Development": ["Game Dev", 72],
  "Android SDK": ["Mobile", 72],
  OkHttp: ["Mobile", 68],
  Gson: ["Mobile", 66],
  MPAndroidChart: ["Mobile", 65],
  "Material Design": ["Mobile", 70],
  LangGraph: ["AI", 80],
  "Google Gemini": ["AI", 80],
  "RAG / Vector Search": ["AI", 80],
  "Machine Learning": ["AI", 82],
  "Reinforcement Learning": ["AI", 80],
  "Deep Q-Learning": ["AI", 78],
  "Gradient Boosting": ["AI", 75],
  NLP: ["AI", 75],
  "High Performance Computing": ["Tools & Systems", 72],
  Docker: ["DevOps", 75],
  // Enterprise / ServiceNow
  ServiceNow: ["Platforms", 90],
  Microservices: ["Backend", 85],
  "Event-Driven Architecture": ["Backend", 86],
  "Pub/Sub Messaging": ["Backend", 82],
  Dashboards: ["Frontend", 80],
  LLMs: ["AI", 84],
  "Prompt Engineering": ["AI", 80],
};

const CATEGORY_ORDER = [
  "Languages",
  "Frontend",
  "Backend",
  "Platforms",
  "Databases",
  "AI",
  "Game Dev",
  "Mobile",
  "Tools & Systems",
  "DevOps",
];

const slug = (t: string) => slugify(t, { lower: true, strict: true });
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const xmlEsc = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

/** Generated gradient cover (fallback when no suitable repo image exists). */
function svgCover(title: string, subtitle: string, c1: string, c2: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="72" y="320" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${xmlEsc(title)}</text>
  <text x="74" y="384" font-family="Inter, Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.85)">${xmlEsc(subtitle)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

/** ServiceNow-branded cover for enterprise work (brand green wordmark on dark teal). */
function svgServiceNow(title: string, subtitle: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#032d42"/><stop offset="1" stop-color="#0a1a24"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1060" cy="110" r="240" fill="#62d84e" opacity="0.08"/>
  <circle cx="1060" cy="110" r="150" fill="#62d84e" opacity="0.08"/>
  <text x="72" y="250" font-family="Inter, Arial, sans-serif" font-size="80" font-weight="800" fill="#62d84e">servicenow</text>
  <rect x="76" y="286" width="170" height="6" rx="3" fill="#62d84e"/>
  <text x="74" y="376" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="#ffffff">${xmlEsc(title)}</text>
  <text x="76" y="424" font-family="Inter, Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.82)">${xmlEsc(subtitle)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

/** Resolve a project's cover image: prefer the repo image, else a generated SVG. */
async function makeCover(p: ProjectInput): Promise<string> {
  if (p.coverFile) {
    const path = join(__dirname, "project-covers", p.coverFile);
    if (existsSync(path)) {
      const buf = readFileSync(path);
      const mime = MIME[extname(p.coverFile).toLowerCase()] ?? "application/octet-stream";
      const stored = await uploadBuffer(buf, `${p.key}-cover${extname(p.coverFile)}`, mime);
      return fileUrlFor(stored.id);
    }
  }
  const svg = p.coverServiceNow
    ? svgServiceNow(p.title, p.coverSubtitle ?? "")
    : svgCover(p.title, p.coverSubtitle ?? "", ...(p.coverColors ?? ["#4f46e5", "#1e1b4b"]));
  const stored = await uploadBuffer(svg, `${p.key}-cover.svg`, "image/svg+xml");
  return fileUrlFor(stored.id);
}

/** Build a polished A4 PDF case study for a project from its fields + write-up. */
function makeProjectPdf(p: ProjectInput, docText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const typeLabel = (p.type ?? "personal").replace(/^\w/, (c) => c.toUpperCase());
    doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a").text(p.title);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#64748b").text(`${typeLabel} project · ${p.year}`);
    doc.moveDown(0.9);

    const section = (heading: string, body: string) => {
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#1e293b").text(heading);
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(11).fillColor("#334155").text(clean(body), { align: "left" });
      doc.moveDown(0.7);
    };

    section("Summary", p.summary);
    section("About", p.about);
    section("Impact", p.impact);
    section("What I learned", p.learning);

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Detailed Write-up");
    doc.moveDown(0.4);
    for (const raw of docText.split(/\n/)) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.35);
        continue;
      }
      if (line.startsWith("## ")) {
        doc.moveDown(0.2);
        doc.font("Helvetica-Bold").fontSize(12.5).fillColor("#1e293b").text(clean(line.slice(3)));
        doc.moveDown(0.15);
      } else if (line.startsWith("# ")) {
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text(clean(line.slice(2)));
        doc.moveDown(0.15);
      } else {
        doc.font("Helvetica").fontSize(11).fillColor("#334155").text(clean(line), { align: "left" });
        doc.moveDown(0.3);
      }
    }

    const links = [
      { label: "GitHub repository", url: p.githubLink },
      { label: "Live demo", url: p.demoLink },
    ].filter((l) => l.url);
    if (links.length) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f172a").text("Links");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(11);
      for (const l of links) {
        doc.fillColor("#4f46e5").text(`${l.label}: ${l.url}`, { link: l.url, underline: true });
        doc.moveDown(0.15);
      }
    }

    doc.end();
  });
}

async function run() {
  const projects: ProjectInput[] = JSON.parse(
    readFileSync(join(__dirname, "projects.json"), "utf8"),
  );

  await connectDb();
  console.log("⚠️  Clearing skills, projects, blogs, resumes + GridFS files (keeping users & profile)...");

  await Promise.all([
    SkillModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    BlogModel.deleteMany({}),
    ResumeModel.deleteMany({}),
  ]);
  const db = mongoose.connection.db!;
  await db.collection("uploads.files").deleteMany({}).catch(() => {});
  await db.collection("uploads.chunks").deleteMany({}).catch(() => {});

  /* ---- Skills: the de-duplicated union of every project's skillsUsed ---- */
  const skillNames = Array.from(new Set(projects.flatMap((p) => p.skillsUsed)));
  skillNames.sort((a, b) => {
    const [ca, la] = SKILL_META[a] ?? ["Tools & Systems", 70];
    const [cb, lb] = SKILL_META[b] ?? ["Tools & Systems", 70];
    const oa = CATEGORY_ORDER.indexOf(ca);
    const ob = CATEGORY_ORDER.indexOf(cb);
    if (oa !== ob) return oa - ob;
    if (lb !== la) return (lb as number) - (la as number);
    return a.localeCompare(b);
  });
  await SkillModel.insertMany(
    skillNames.map((name, i) => {
      const [category, level] = SKILL_META[name] ?? ["Tools & Systems", 70];
      return { name, category, level, order: i };
    }),
  );
  console.log(`✅ Inserted ${skillNames.length} skills.`);

  /* ---- Projects: each with a generated PDF case study attached ---- */
  for (const p of projects) {
    const docText = readFileSync(join(__dirname, "project-docs", `${p.key}.md`), "utf8");
    const pdf = await makeProjectPdf(p, docText);
    const stored = await uploadBuffer(pdf, `${p.key}-case-study.pdf`, "application/pdf");
    const coverImage = await makeCover(p);

    await ProjectModel.create({
      title: p.title,
      slug: slug(p.title),
      type: p.type ?? "personal",
      featured: p.featured ?? false,
      summary: p.summary,
      about: p.about,
      impact: p.impact,
      learning: p.learning,
      skillsUsed: p.skillsUsed,
      demoLink: p.demoLink,
      githubLink: p.githubLink,
      coverImage,
      order: p.order,
      published: true,
      assets: [
        {
          type: "pdf",
          url: fileUrlFor(stored.id),
          name: `${p.title} — Case Study`,
          size: pdf.length,
          mimeType: "application/pdf",
        },
      ],
    });
    const coverKind = p.coverFile ? `repo:${p.coverFile}` : p.coverServiceNow ? "servicenow-svg" : "generated-svg";
    const tag = `${p.type ?? "personal"}${p.featured ? ",featured" : ""}`;
    console.log(`  • ${p.title} [${tag}] (order ${p.order}, ${p.skillsUsed.length} skills, cover ${coverKind})`);
  }

  const counts = {
    skills: await SkillModel.countDocuments(),
    projects: await ProjectModel.countDocuments(),
    files: await db.collection("uploads.files").countDocuments(),
  };
  console.log("✅ Done:", counts);
  console.log("➡️  Next: log in as admin → Chatbot/RAG → Re-index to embed these into the vector store.");
  await disconnectDb();
}

run().catch(async (err) => {
  console.error("❌ seed-projects failed:", err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
