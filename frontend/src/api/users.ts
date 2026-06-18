import { api } from "../lib/api";
import type { AuthUser, VisitorUser } from "../types";
import { endpoints } from "./endpoints";

export interface ProfileInput {
  name: string;
  headline: string;
  bio: string;
  location: string;
}

/** Fetch the signed-in user's own profile. */
export async function fetchMyProfile(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>(endpoints.users.me);
  return data;
}

/** Update the signed-in user's own profile. */
export async function updateMyProfile(payload: Partial<ProfileInput>): Promise<AuthUser> {
  const { data } = await api.put<AuthUser>(endpoints.users.me, payload);
  return data;
}

/** Admin: list/search visitor accounts. */
export async function fetchVisitors(q?: string): Promise<VisitorUser[]> {
  const params: Record<string, string> = {};
  if (q) params.q = q;
  const { data } = await api.get<VisitorUser[]>(endpoints.users.root, { params });
  return data;
}
