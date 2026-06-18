import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const googleClient = new OAuth2Client(env.googleClientId);

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

/** Verify a Google ID token (credential from Google Identity Services). */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile> {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error("Invalid Google token");
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? "",
    picture: payload.picture ?? "",
  };
}

export type Role = "admin" | "visitor";

export interface SessionClaims {
  sub: string; // user id
  email: string;
  role: Role;
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionClaims {
  return jwt.verify(token, env.jwtSecret) as SessionClaims;
}

export const SESSION_COOKIE = "portfolio_session";
