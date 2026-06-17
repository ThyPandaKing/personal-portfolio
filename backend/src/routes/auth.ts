import { Router } from "express";
import { z } from "zod";
import { env, isAdminEmail } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { SESSION_COOKIE, signSession, verifyGoogleIdToken } from "../services/auth.js";
import { asyncHandler, forbidden, unauthorized } from "../utils/http.js";

export const authRouter = Router();

// Cross-site (Vercel frontend ↔ Render backend) requires SameSite=None + Secure.
// Same-origin local dev (Vite/nginx proxy) uses Lax + insecure. Driven by COOKIE_SECURE.
const cookieOptions = {
  httpOnly: true,
  sameSite: (env.cookieSecure ? "none" : "lax") as "none" | "lax",
  secure: env.cookieSecure,
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const googleSchema = z.object({ credential: z.string().min(10) });

/** POST /api/auth/google  — exchange a Google ID token for a session cookie. */
authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const { credential } = googleSchema.parse(req.body);

    // An invalid/expired/malformed Google token is an auth failure (401),
    // not an internal server error.
    let profile;
    try {
      profile = await verifyGoogleIdToken(credential);
    } catch {
      throw unauthorized("Invalid or expired Google credential.");
    }

    if (!isAdminEmail(profile.email)) {
      throw forbidden("This account is not authorized as admin.");
    }

    const user = await UserModel.findOneAndUpdate(
      { email: profile.email },
      {
        $set: {
          googleId: profile.googleId,
          name: profile.name,
          picture: profile.picture,
          role: "admin",
          lastLoginAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const token = signSession({ sub: String(user._id), email: user.email, role: "admin" });
    res.cookie(SESSION_COOKIE, token, cookieOptions);
    res.json({ user: { id: user._id, email: user.email, name: user.name, picture: user.picture } });
  }),
);

/** POST /api/auth/logout */
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

/** GET /api/auth/me — current session (null if visitor). */
authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const user = await UserModel.findById(req.user.sub).lean();
    if (!user) return res.json({ user: null });
    res.json({
      user: { id: user._id, email: user.email, name: user.name, picture: user.picture },
    });
  }),
);
