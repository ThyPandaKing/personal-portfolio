import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, type SessionClaims, verifySession } from "../services/auth.js";
import { unauthorized } from "../utils/http.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionClaims;
    }
  }
}

/** Reads the session cookie (if present) and attaches the user. Never throws. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      req.user = verifySession(token);
    } catch {
      // Invalid/expired token -> treat as anonymous visitor
    }
  }
  next();
}

/** Gates a route to authenticated admins only. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return next(unauthorized("Admin authentication required"));
  }
  next();
}

/** Gates a route to any authenticated user (admin or visitor). */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(unauthorized("Authentication required"));
  }
  next();
}
