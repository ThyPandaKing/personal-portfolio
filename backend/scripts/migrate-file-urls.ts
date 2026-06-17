/**
 * One-off migration: rewrite absolute file URLs (e.g. http://localhost:4000/api/files/<id>)
 * to relative URLs (/api/files/<id>) so records are environment-independent.
 *
 * Safe & idempotent: only strips the scheme+host in front of "/api/files/".
 * External links (GitHub, demo, social URLs, external images) are left untouched.
 *
 * Run:  npm run migrate:urls           (from backend/)
 */
import mongoose from "mongoose";
import { COLLECTIONS } from "../src/config/collections.js";
import { connectDb, disconnectDb } from "../src/config/db.js";

/** Strip "https://host" before "/api/files/", leave everything else as-is. */
function toRelative<T>(value: T): T {
  if (typeof value !== "string") return value;
  return value.replace(/^https?:\/\/[^/]+(\/api\/files\/)/i, "$1") as unknown as T;
}

async function migrate() {
  await connectDb();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  let total = 0;
  const log = (msg: string) => console.log(`  • ${msg}`);

  // --- profile.imageUrl ---
  {
    const col = db.collection(COLLECTIONS.profile);
    for (const doc of await col.find({}).toArray()) {
      const next = toRelative(doc.imageUrl);
      if (next !== doc.imageUrl) {
        await col.updateOne({ _id: doc._id }, { $set: { imageUrl: next } });
        log(`profile.imageUrl: ${doc.imageUrl} → ${next}`);
        total++;
      }
    }
  }

  // --- projects.coverImage + assets[].url ---
  {
    const col = db.collection(COLLECTIONS.projects);
    for (const doc of await col.find({}).toArray()) {
      const set: Record<string, unknown> = {};
      const cover = toRelative(doc.coverImage);
      if (cover !== doc.coverImage) set.coverImage = cover;

      if (Array.isArray(doc.assets)) {
        const assets = doc.assets.map((a: { url?: string }) => ({ ...a, url: toRelative(a.url) }));
        if (JSON.stringify(assets) !== JSON.stringify(doc.assets)) set.assets = assets;
      }

      if (Object.keys(set).length) {
        await col.updateOne({ _id: doc._id }, { $set: set });
        log(`project "${doc.title}": ${Object.keys(set).join(", ")} updated`);
        total++;
      }
    }
  }

  // --- blogs.coverImage ---
  {
    const col = db.collection(COLLECTIONS.blogs);
    for (const doc of await col.find({}).toArray()) {
      const next = toRelative(doc.coverImage);
      if (next !== doc.coverImage) {
        await col.updateOne({ _id: doc._id }, { $set: { coverImage: next } });
        log(`blog "${doc.title}": coverImage updated`);
        total++;
      }
    }
  }

  // --- resumes.fileUrl ---
  {
    const col = db.collection(COLLECTIONS.resumes);
    for (const doc of await col.find({}).toArray()) {
      const next = toRelative(doc.fileUrl);
      if (next !== doc.fileUrl) {
        await col.updateOne({ _id: doc._id }, { $set: { fileUrl: next } });
        log(`resume "${doc.title}": fileUrl updated`);
        total++;
      }
    }
  }

  console.log(`\n✅ Migration complete — ${total} document(s) updated.`);
  await disconnectDb();
}

migrate().catch(async (err) => {
  console.error("❌ Migration failed:", err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
