/**
 * Single source of truth for MongoDB collection names ("tables").
 *
 * These are passed explicitly to each Mongoose model so the names are NOT
 * derived from Mongoose's automatic pluralization. The Python agent-service
 * reads the same collections directly, so keep its config in sync
 * (agent-service/app/config.py).
 */
export const COLLECTIONS = {
  users: "portfolio_users",
  profile: "portfolio_profile",
  skills: "portfolio_skills",
  projects: "portfolio_projects",
  blogs: "portfolio_blogs",
  resumes: "portfolio_resumes",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
