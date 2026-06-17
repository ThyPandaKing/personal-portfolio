import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { getProfileSingleton, ProfileModel } from "../models/Profile.js";
import { deleteFile, fileIdFromUrl, fileUrlFor, uploadBuffer } from "../services/gridfs.js";
import { asyncHandler, badRequest } from "../utils/http.js";

export const profileRouter = Router();

/** Prepend https:// to a scheme-less URL so visitors enter "github.com/me". */
function normalizeUrl(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Drop incomplete rows (empty placeholders from the "Add" button) and normalize
 * URLs *before* validation, so adding a social/education row never fails the save.
 */
function sanitizeProfileBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (Array.isArray(out.socials)) {
    out.socials = out.socials
      .map((s: { platform?: string; url?: string }) => ({
        platform: (s?.platform ?? "").trim(),
        url: normalizeUrl(s?.url ?? ""),
      }))
      .filter((s) => s.platform && s.url);
  }
  if (Array.isArray(out.education)) {
    out.education = out.education.filter(
      (e: { level?: string }) => (e?.level ?? "").trim().length > 0,
    );
  }
  return out;
}

const socialSchema = z.object({ platform: z.string().min(1), url: z.string().url() });
const educationSchema = z.object({
  level: z.string().min(1),
  course: z.string().default(""),
  institution: z.string().default(""),
  startYear: z.string().default(""),
  endYear: z.string().default(""),
  details: z.string().default(""),
});

const profileUpdateSchema = z.object({
  fullName: z.string().default(""),
  headline: z.string().default(""),
  aboutMe: z.string().default(""),
  imageUrl: z.string().default(""),
  location: z.string().default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  socials: z.array(socialSchema).default([]),
  education: z.array(educationSchema).default([]),
  resumeNote: z.string().default(""),
});

/** GET /api/profile — public Home content. */
profileRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const profile = await getProfileSingleton();
    res.json(profile);
  }),
);

/** PUT /api/profile — admin updates Home content. */
profileRouter.put(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = profileUpdateSchema.parse(sanitizeProfileBody(req.body ?? {}));
    const profile = await getProfileSingleton();
    profile.set(data);
    await profile.save();
    res.json(profile);
  }),
);

/** POST /api/profile/image — admin uploads a profile image, returns its URL. */
profileRouter.post(
  "/image",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    const stored = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    const url = fileUrlFor(stored.id);

    // Remove the previous image from GridFS if there was one.
    const profile = await getProfileSingleton();
    const prevId = fileIdFromUrl(profile.imageUrl);
    if (prevId) await deleteFile(prevId);

    // Persist immediately so the image survives even before a full profile save.
    await ProfileModel.updateOne({}, { $set: { imageUrl: url } }, { upsert: true });
    res.json({ url });
  }),
);
