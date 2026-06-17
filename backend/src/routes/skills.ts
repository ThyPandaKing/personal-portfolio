import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { SkillModel } from "../models/Skill.js";
import { asyncHandler, notFound } from "../utils/http.js";

export const skillsRouter = Router();

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("General"),
  level: z.number().min(0).max(100).default(70),
  icon: z.string().default(""),
  order: z.number().default(0),
});

/** GET /api/skills — public, grouped-friendly list sorted by category/order. */
skillsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const skills = await SkillModel.find().sort({ category: 1, order: 1, name: 1 }).lean();
    res.json(skills);
  }),
);

skillsRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = skillSchema.parse(req.body);
    const skill = await SkillModel.create(data);
    res.status(201).json(skill);
  }),
);

skillsRouter.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = skillSchema.partial().parse(req.body);
    const skill = await SkillModel.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!skill) throw notFound("Skill not found");
    res.json(skill);
  }),
);

skillsRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const skill = await SkillModel.findByIdAndDelete(req.params.id);
    if (!skill) throw notFound("Skill not found");
    res.json({ ok: true });
  }),
);
