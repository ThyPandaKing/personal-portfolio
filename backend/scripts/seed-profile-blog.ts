/**
 * Update the singleton Profile (headline, About me, education) and upsert an
 * author blog about access governance + continuous compliance monitoring.
 *
 * Source detail is drawn from the user's resume, but the resume itself is NOT
 * added to the platform (no Resume record, no PDF upload).
 *
 * Non-destructive: only touches the profile fields below and one blog by slug.
 * Run AFTER seed-projects.ts (which clears the blogs collection).
 *
 * Run:  npm run seed:profile-blog
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import slugify from "slugify";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { BlogModel } from "../src/models/Blog.js";
import { ProfileModel } from "../src/models/Profile.js";
import { UserModel } from "../src/models/User.js";
import { fileUrlFor, uploadBuffer } from "../src/services/gridfs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const slug = (t: string) => slugify(t, { lower: true, strict: true });
const readingMinutes = (c: string) => Math.max(1, Math.round(c.split(/\s+/).filter(Boolean).length / 200));

const xmlEsc = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

function blogCover(title: string, subtitle: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e3a5f"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1060" cy="120" r="220" fill="#38bdf8" opacity="0.10"/>
  <text x="72" y="300" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${xmlEsc(title)}</text>
  <text x="74" y="356" font-family="Inter, Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.82)">${xmlEsc(subtitle)}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

const ABOUT_ME = [
  "I'm a backend software engineer focused on **distributed systems, microservices, and cloud-native platforms** — and increasingly on putting **applied AI** to work inside them.",
  "",
  "At **ServiceNow**, I design event-driven, fault-tolerant systems that run continuously and at scale. I owned the architecture of a **continuous compliance monitoring** platform that evaluates a 100% sample of changes, access, and configuration across 10+ systems with sub-second latency, and led an **event-driven access governance** platform that automated reviews and achieved zero audit failures. Under the hood that means **Node.js**, async **pub/sub** messaging, **AWS**, **Kafka**, and **Redis** — and a lot of care for the unglamorous things that make systems trustworthy: idempotency, retries, dead-letter queues, horizontal scaling, and clean CI/CD.",
  "",
  "I also like building where AI meets product: a **prompt-to-dashboard generator** that turns natural language into ServiceNow dashboards, LLM-assisted control analysis, and the **RAG chatbot** that powers this very site.",
  "",
  "Before all this I built across the stack — a **compiler** that emits MIPS, a **MIPS pipeline-and-cache simulator**, a 2D **Unity** game, an **Android** app, a **VS Code accessibility extension**, and an RL-based **HPC job scheduler** for my B.Tech thesis at **IIT Tirupati**. That range is deliberate: I like understanding systems from the language and hardware level all the way up to the product.",
  "",
  "Outside work you'll usually find me doing competitive programming (5★ on CodeChef, ICPC regionalist).",
].join("\n");

async function run() {
  await connectDb();

  /* ---- Profile: headline, About me, education (CGPA 8.8), location, contact ---- */
  await ProfileModel.updateOne(
    {},
    {
      $set: {
        fullName: "Aditya Sharma",
        headline:
          "Backend Software Engineer — distributed systems, microservices & cloud-native platforms, with applied AI",
        aboutMe: ABOUT_ME,
        location: "Hyderabad, India",
        contactEmail: "aditya9660sharma@gmail.com",
        education: [
          {
            level: "B.Tech",
            course: "Computer Science & Engineering",
            institution: "Indian Institute of Technology Tirupati",
            startYear: "2019",
            endYear: "2023",
            details:
              "CGPA: 8.8/10. ICPC Gwalior–Pune Regionalist (Rank 265 of 10,000+). 5★ on CodeChef, Specialist on Codeforces.",
          },
        ],
      },
    },
    { upsert: true },
  );
  console.log("✅ Profile updated (headline, About me, education @ 8.8 CGPA, location, contact).");

  /* ---- Blog (authored) ---- */
  const admin = await UserModel.findOne({ role: "admin" }).lean();
  const author = {
    userId: admin?._id,
    name: admin?.name || "Aditya Sharma",
    email: admin?.email || "aditya9660sharma@gmail.com",
  };

  const title =
    "From Periodic Audits to Continuous Assurance: Access Governance and Continuous Compliance Monitoring";
  const excerpt =
    "Why sample-based, point-in-time compliance is breaking down — and how event-driven access governance and continuous monitoring replace it with always-on assurance.";
  const content = readFileSync(join(__dirname, "blog-docs", "access-governance-ccm.md"), "utf8");
  const tags = ["compliance", "access governance", "continuous compliance", "event-driven", "system design"];
  const cover = await uploadBuffer(
    blogCover("Continuous Assurance", "Access governance · Continuous compliance monitoring"),
    "blog-access-governance-ccm-cover.svg",
    "image/svg+xml",
  );

  const blogSlug = slug(title);
  await BlogModel.findOneAndUpdate(
    { slug: blogSlug },
    {
      $set: {
        title,
        slug: blogSlug,
        excerpt,
        content,
        coverImage: fileUrlFor(cover.id),
        tags,
        published: true,
        publishedAt: new Date(),
        readingMinutes: readingMinutes(content),
        author,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log(`✅ Blog upserted: "${title}" (published, by ${author.name}).`);

  await disconnectDb();
}

run().catch(async (err) => {
  console.error("❌ seed-profile-blog failed:", err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
