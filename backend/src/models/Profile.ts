import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const socialSchema = new Schema(
  {
    platform: { type: String, required: true }, // e.g. github, linkedin, x, email
    url: { type: String, required: true },
  },
  { _id: false },
);

const educationSchema = new Schema(
  {
    level: { type: String, required: true }, // e.g. "B.Tech", "M.S."
    course: { type: String, default: "" }, // e.g. "Computer Science"
    institution: { type: String, default: "" },
    startYear: { type: String, default: "" },
    endYear: { type: String, default: "" },
    details: { type: String, default: "" },
  },
  { _id: true },
);

/**
 * Profile is a singleton document holding the Home page content.
 * Use ProfileModel.getSingleton() to read/create the one document.
 */
const profileSchema = new Schema(
  {
    fullName: { type: String, default: "" },
    headline: { type: String, default: "" }, // short tagline under the name
    aboutMe: { type: String, default: "" }, // markdown
    imageUrl: { type: String, default: "" },
    location: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    socials: { type: [socialSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    resumeNote: { type: String, default: "" },
  },
  { timestamps: true },
);

export type Profile = InferSchemaType<typeof profileSchema>;
export const ProfileModel = model("Profile", profileSchema, COLLECTIONS.profile);

/** Read the singleton Profile document, creating an empty one on first access. */
export async function getProfileSingleton(): Promise<HydratedDocument<Profile>> {
  let doc = await ProfileModel.findOne();
  if (!doc) doc = await ProfileModel.create({});
  return doc;
}
