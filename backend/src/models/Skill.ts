import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "General" }, // e.g. Languages, Frameworks, Cloud, AI
    level: { type: Number, min: 0, max: 100, default: 70 }, // proficiency for UI bars
    icon: { type: String, default: "" }, // optional icon name / url
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

skillSchema.index({ category: 1, order: 1 });

export type Skill = InferSchemaType<typeof skillSchema>;
export const SkillModel = model("Skill", skillSchema, COLLECTIONS.skills);
