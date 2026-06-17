import axios from "axios";

/**
 * Base origin of the backend.
 * - Empty (default): same origin — the Vite dev server and the nginx prod image
 *   both proxy `/api` and `/uploads` to the backend.
 * - Set `VITE_API_BASE` (e.g. http://localhost:4000) when the frontend is served
 *   from a different origin than the backend.
 */
const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/** Shared axios instance — sends the session cookie on every request. */
export const api = axios.create({
  baseURL: `${apiBase}/api`,
  withCredentials: true,
});

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/** Turn an axios error into a readable message. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string })?.error || err.message || fallback;
  }
  return fallback;
}
