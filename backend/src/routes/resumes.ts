import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { RESUME_ROLES, ResumeModel } from "../models/Resume.js";
import * as agent from "../services/agentClient.js";
import { deleteFile, fileIdFromUrl, fileUrlFor, uploadBuffer } from "../services/gridfs.js";
import { asyncHandler, badRequest, notFound } from "../utils/http.js";

export const resumesRouter = Router();

const resumeSchema = z.object({
  title: z.string().min(1),
  role: z.enum(RESUME_ROLES).default("other"),
  source: z.enum(["uploaded", "generated"]).default("uploaded"),
  content: z.string().default(""),
  fileUrl: z.string().default(""),
  isPublic: z.boolean().default(false),
});

/** GET /api/resumes — visitors see public resumes only. */
resumesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = req.user ? {} : { isPublic: true };
    const resumes = await ResumeModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json(resumes);
  }),
);

resumesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const resume = await ResumeModel.findById(req.params.id).lean();
    if (!resume || (!resume.isPublic && !req.user)) throw notFound("Resume not found");
    res.json(resume);
  }),
);

resumesRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = resumeSchema.parse(req.body);
    const resume = await ResumeModel.create(data);
    res.status(201).json(resume);
  }),
);

const generateSchema = z.object({
  title: z.string().min(1),
  role: z.enum(RESUME_ROLES).default("SDE"),
  projectIds: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  instructions: z.string().default(""),
});

/** POST /api/resumes/generate — AI-generate a resume and save it (admin only). */
resumesRouter.post(
  "/generate",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, role, projectIds, skills, instructions } = generateSchema.parse(req.body);
    const { content } = await agent.generateResume({
      role,
      project_ids: projectIds,
      skills,
      instructions,
    });
    const resume = await ResumeModel.create({
      title,
      role,
      source: "generated",
      content,
      isPublic: false,
      generationMeta: { projectIds, skills, instructions, model: "gemini" },
    });
    res.status(201).json(resume);
  }),
);

resumesRouter.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = resumeSchema.partial().parse(req.body);
    const resume = await ResumeModel.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!resume) throw notFound("Resume not found");
    res.json(resume);
  }),
);

/** POST /api/resumes/:id/file — upload/replace the resume PDF. */
resumesRouter.post(
  "/:id/file",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    if (req.file.mimetype !== "application/pdf") throw badRequest("Resume must be a PDF");
    const resume = await ResumeModel.findById(req.params.id);
    if (!resume) throw notFound("Resume not found");

    // Remove the previously stored file, if any.
    const prevId = fileIdFromUrl(resume.fileUrl);
    if (prevId) await deleteFile(prevId);

    const stored = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    resume.fileUrl = fileUrlFor(stored.id);
    resume.source = "uploaded";
    await resume.save();
    res.json(resume);
  }),
);

resumesRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const resume = await ResumeModel.findByIdAndDelete(req.params.id);
    if (!resume) throw notFound("Resume not found");
    const id = fileIdFromUrl(resume.fileUrl);
    if (id) await deleteFile(id);
    res.json({ ok: true });
  }),
);
