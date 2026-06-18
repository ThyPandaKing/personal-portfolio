/**
 * Single source of truth for backend API endpoints.
 *
 * Mirrors the routes mounted in `backend/src/routes`. Paths are relative to the
 * `/api` base configured on the axios instance in `lib/api.ts`.
 */
export const endpoints = {
  auth: {
    google: "/auth/google",
    logout: "/auth/logout",
    me: "/auth/me",
  },
  users: {
    root: "/users",
    me: "/users/me",
  },
  profile: {
    root: "/profile",
    image: "/profile/image",
  },
  skills: {
    root: "/skills",
    byId: (id: string) => `/skills/${id}`,
  },
  projects: {
    root: "/projects",
    bySlug: (slug: string) => `/projects/${slug}`,
    byId: (id: string) => `/projects/${id}`,
    assets: (id: string) => `/projects/${id}/assets`,
    asset: (id: string, assetId: string) => `/projects/${id}/assets/${assetId}`,
  },
  blogs: {
    root: "/blogs",
    bySlug: (slug: string) => `/blogs/${slug}`,
    byId: (id: string) => `/blogs/${id}`,
  },
  resumes: {
    root: "/resumes",
    generate: "/resumes/generate",
    byId: (id: string) => `/resumes/${id}`,
    file: (id: string) => `/resumes/${id}/file`,
  },
  uploads: {
    root: "/uploads",
  },
  chat: {
    root: "/chat",
    warmup: "/chat/warmup",
    admin: {
      status: "/chat/admin/status",
      reingest: "/chat/admin/reingest",
      document: "/chat/admin/document",
      pdf: "/chat/admin/pdf",
      reset: "/chat/admin/reset",
    },
  },
} as const;
