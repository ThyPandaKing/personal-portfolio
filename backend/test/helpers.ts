import { SESSION_COOKIE, signSession } from "../src/services/auth.js";

/** A signed admin session cookie for authenticated test requests. */
export function adminCookie(): string {
  const token = signSession({
    sub: "0123456789abcdef01234567",
    email: "admin@test.local",
    role: "admin",
  });
  return `${SESSION_COOKIE}=${token}`;
}
