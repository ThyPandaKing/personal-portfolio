import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

export const RESUME_ROLES = ["SDE", "AI", "other"] as const;
export type ResumeRole = (typeof RESUME_ROLES)[number];

const resumeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    role: { type: String, enum: RESUME_ROLES, default: "other", index: true },
    // "uploaded" => a PDF the admin uploaded; "generated" => AI-generated markdown
    source: { type: String, enum: ["uploaded", "generated"], default: "uploaded" },
    fileUrl: { type: String, default: "" }, // for uploaded PDFs
    content: { type: String, default: "" }, // markdown for generated resumes
    isPublic: { type: Boolean, default: false, index: true }, // shown to visitors
    // Snapshot of what the AI generator used, for reproducibility:
    generationMeta: {
      projectIds: { type: [Schema.Types.ObjectId], default: [] },
      skills: { type: [String], default: [] },
      instructions: { type: String, default: "" },
      model: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export type Resume = InferSchemaType<typeof resumeSchema>;
export const ResumeModel = model("Resume", resumeSchema, COLLECTIONS.resumes);
