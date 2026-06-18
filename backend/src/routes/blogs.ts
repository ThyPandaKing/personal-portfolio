import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { BlogModel } from "../models/Blog.js";
import { UserModel } from "../models/User.js";
import { asyncHandler, notFound } from "../utils/http.js";
import { escapeRegex } from "../utils/query.js";
import { uniqueSlug } from "../utils/slug.js";

export const blogsRouter = Router();

const blogSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().default(""),
  content: z.string().default(""),
  coverImage: z.string().default(""),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

const readingMinutes = (content: string) =>
  Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));

/**
 * GET /api/blogs — only admins see drafts; everyone else (visitors + anon) sees published.
 * Filters: ?tag=react   ?q=text (content search across title/excerpt/content/tags)
 */
blogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> =
      req.user?.role === "admin" ? {} : { published: true };

    const tag = (req.query.tag as string | undefined)?.trim();
    if (tag) {
      filter.tags = { $elemMatch: { $regex: `^${escapeRegex(tag)}$`, $options: "i" } };
    }

    const q = (req.query.q as string | undefined)?.trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ title: rx }, { excerpt: rx }, { content: rx }, { tags: rx }];
    }

    const blogs = await BlogModel.find(filter).sort({ publishedAt: -1, createdAt: -1 }).lean();
    res.json(blogs);
  }),
);

/** GET /api/blogs/:slug */
blogsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const blog = await BlogModel.findOne({ slug: req.params.slug }).lean();
    if (!blog || (!blog.published && req.user?.role !== "admin"))
      throw notFound("Article not found");
    res.json(blog);
  }),
);

// Admins and visitors can both create articles. Visitor submissions are always
// saved as drafts (published=false) — an admin reviews and publishes them.
blogsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = blogSchema.parse(req.body);
    const isAdmin = req.user!.role === "admin";
    const published = isAdmin ? data.published : false;

    const author = await UserModel.findById(req.user!.sub).lean();
    const slug = await uniqueSlug(BlogModel, data.title);
    const blog = await BlogModel.create({
      ...data,
      published,
      slug,
      readingMinutes: readingMinutes(data.content),
      publishedAt: published ? new Date() : undefined,
      author: {
        userId: req.user!.sub,
        name: author?.name ?? "",
        email: req.user!.email,
      },
    });
    res.status(201).json(blog);
  }),
);

blogsRouter.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = blogSchema.partial().parse(req.body);
    const blog = await BlogModel.findById(req.params.id);
    if (!blog) throw notFound("Article not found");

    if (data.title && data.title !== blog.title) {
      blog.slug = await uniqueSlug(BlogModel, data.title, String(blog._id));
    }
    if (data.content !== undefined) blog.readingMinutes = readingMinutes(data.content);
    // Stamp publishedAt the first time it goes public.
    if (data.published && !blog.published) blog.publishedAt = new Date();
    blog.set(data);
    await blog.save();
    res.json(blog);
  }),
);

blogsRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const blog = await BlogModel.findByIdAndDelete(req.params.id);
    if (!blog) throw notFound("Article not found");
    res.json({ ok: true });
  }),
);
