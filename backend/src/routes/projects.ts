import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { PROJECT_TYPES, ProjectModel } from "../models/Project.js";
import { deleteFile, fileIdFromUrl, fileUrlFor, uploadBuffer } from "../services/gridfs.js";
import { asyncHandler, badRequest, notFound } from "../utils/http.js";
import { escapeRegex } from "../utils/query.js";
import { uniqueSlug } from "../utils/slug.js";

export const projectsRouter = Router();

const projectSchema = z.object({
  title: z.string().min(1),
  type: z.enum(PROJECT_TYPES).default("personal"),
  summary: z.string().default(""),
  about: z.string().default(""),
  impact: z.string().default(""),
  learning: z.string().default(""),
  skillsUsed: z.array(z.string()).default([]),
  demoLink: z.string().default(""),
  githubLink: z.string().default(""),
  coverImage: z.string().default(""),
  featured: z.boolean().default(false),
  order: z.number().default(0),
  published: z.boolean().default(true),
});

/**
 * GET /api/projects — visitors see published only.
 * Filters: ?type=enterprise  ?skill=React (matches skills/tools used)
 *          ?q=text (content search across title/summary/about/impact/learning/skills)
 */
projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const type = req.query.type as string | undefined;
    if (type && (PROJECT_TYPES as readonly string[]).includes(type)) filter.type = type;
    if (!req.user) filter.published = true;

    // Skill / tool filter (case-insensitive exact match on a skillsUsed entry).
    const skill = (req.query.skill ?? req.query.tool) as string | undefined;
    if (skill && skill.trim()) {
      filter.skillsUsed = { $elemMatch: { $regex: `^${escapeRegex(skill.trim())}$`, $options: "i" } };
    }

    // Free-text content search.
    const q = (req.query.q as string | undefined)?.trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [
        { title: rx },
        { summary: rx },
        { about: rx },
        { impact: rx },
        { learning: rx },
        { skillsUsed: rx },
      ];
    }

    const projects = await ProjectModel.find(filter)
      .sort({ featured: -1, order: 1, createdAt: -1 })
      .lean();
    res.json(projects);
  }),
);

/** GET /api/projects/:slug */
projectsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const project = await ProjectModel.findOne({ slug: req.params.slug }).lean();
    if (!project || (!project.published && !req.user)) throw notFound("Project not found");
    res.json(project);
  }),
);

/** POST /api/projects */
projectsRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    const slug = await uniqueSlug(ProjectModel, data.title);
    const project = await ProjectModel.create({ ...data, slug });
    res.status(201).json(project);
  }),
);

/** PUT /api/projects/:id */
projectsRouter.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = projectSchema.partial().parse(req.body);
    const project = await ProjectModel.findById(req.params.id);
    if (!project) throw notFound("Project not found");

    if (data.title && data.title !== project.title) {
      project.slug = await uniqueSlug(ProjectModel, data.title, String(project._id));
    }
    project.set(data);
    await project.save();
    res.json(project);
  }),
);

/** DELETE /api/projects/:id — also removes local asset files. */
projectsRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await ProjectModel.findByIdAndDelete(req.params.id);
    if (!project) throw notFound("Project not found");
    for (const asset of project.assets) {
      const id = fileIdFromUrl(asset.url);
      if (id) await deleteFile(id);
    }
    res.json({ ok: true });
  }),
);

/** POST /api/projects/:id/assets — upload a pdf or recording. */
projectsRouter.post(
  "/:id/assets",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    const project = await ProjectModel.findById(req.params.id);
    if (!project) throw notFound("Project not found");

    const stored = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    const isPdf = req.file.mimetype === "application/pdf";
    project.assets.push({
      type: isPdf ? "pdf" : "recording",
      url: fileUrlFor(stored.id),
      name: req.body.name || req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
    await project.save();
    res.status(201).json(project);
  }),
);

/** DELETE /api/projects/:id/assets/:assetId */
projectsRouter.delete(
  "/:id/assets/:assetId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await ProjectModel.findById(req.params.id);
    if (!project) throw notFound("Project not found");
    const asset = project.assets.id(req.params.assetId);
    if (!asset) throw notFound("Asset not found");

    const id = fileIdFromUrl(asset.url);
    if (id) await deleteFile(id);
    asset.deleteOne();
    await project.save();
    res.json(project);
  }),
);
