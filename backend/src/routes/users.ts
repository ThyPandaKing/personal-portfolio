import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import { asyncHandler, notFound } from "../utils/http.js";
import { escapeRegex } from "../utils/query.js";

export const usersRouter = Router();

/** Shape a user document for the client (never leaks googleId or internals). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPublicUser = (u: any) => ({
  id: u._id,
  email: u.email,
  name: u.name ?? "",
  picture: u.picture ?? "",
  role: u.role,
  headline: u.headline ?? "",
  bio: u.bio ?? "",
  location: u.location ?? "",
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
});

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  headline: z.string().max(200).default(""),
  bio: z.string().max(5000).default(""),
  location: z.string().max(120).default(""),
});

/** GET /api/users/me — the signed-in user's own profile. */
usersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.user!.sub).lean();
    if (!user) throw notFound("User not found");
    res.json(toPublicUser(user));
  }),
);

/** PUT /api/users/me — update own profile (name, headline, bio, location). */
usersRouter.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = profileSchema.partial().parse(req.body);
    const user = await UserModel.findByIdAndUpdate(
      req.user!.sub,
      { $set: data },
      { new: true },
    ).lean();
    if (!user) throw notFound("User not found");
    res.json(toPublicUser(user));
  }),
);

/**
 * GET /api/users — admin: list/search users (visitors by default).
 * Filters: ?q=text (name/email/headline/location)  ?role=visitor|admin|all
 */
usersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const role = ((req.query.role as string | undefined) ?? "visitor").trim();
    const filter: Record<string, unknown> = role === "all" ? {} : { role };

    const q = (req.query.q as string | undefined)?.trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { headline: rx }, { location: rx }];
    }

    const users = await UserModel.find(filter)
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .lean();
    res.json(users.map(toPublicUser));
  }),
);
