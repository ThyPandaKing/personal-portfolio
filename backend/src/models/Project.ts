import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

export const PROJECT_TYPES = ["enterprise", "personal", "archive"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

const assetSchema = new Schema(
  {
    type: { type: String, enum: ["pdf", "recording"], required: true },
    url: { type: String, required: true },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
  },
  { _id: true, timestamps: true },
);

const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    type: { type: String, enum: PROJECT_TYPES, default: "personal", index: true },
    summary: { type: String, default: "" }, // one-line teaser for cards
    // The fixed project format requested in the plan:
    about: { type: String, default: "" }, // markdown
    impact: { type: String, default: "" }, // markdown
    learning: { type: String, default: "" }, // markdown
    skillsUsed: { type: [String], default: [] },
    demoLink: { type: String, default: "" },
    githubLink: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    assets: { type: [assetSchema], default: [] },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

projectSchema.index({ type: 1, order: 1, createdAt: -1 });

export type Project = InferSchemaType<typeof projectSchema>;
export const ProjectModel = model("Project", projectSchema, COLLECTIONS.projects);
