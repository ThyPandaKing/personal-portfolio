import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const blogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    excerpt: { type: String, default: "" },
    content: { type: String, default: "" }, // markdown
    coverImage: { type: String, default: "" },
    tags: { type: [String], default: [] },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    readingMinutes: { type: Number, default: 1 },
    // Who wrote it. Set for visitor submissions (and admin posts); legacy posts have none.
    author: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

blogSchema.index({ published: 1, publishedAt: -1 });

export type Blog = InferSchemaType<typeof blogSchema>;
export const BlogModel = model("Blog", blogSchema, COLLECTIONS.blogs);
