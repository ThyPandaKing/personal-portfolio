import { api } from "../lib/api";
import type { Project, ProjectType } from "../types";
import { endpoints } from "./endpoints";

export interface ProjectFilters {
  type?: ProjectType;
  skill?: string;
  q?: string;
}

export async function fetchProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  const params: Record<string, string> = {};
  if (filters.type) params.type = filters.type;
  if (filters.skill) params.skill = filters.skill;
  if (filters.q) params.q = filters.q;
  const { data } = await api.get<Project[]>(endpoints.projects.root, { params });
  return data;
}

export async function fetchProject(slug: string): Promise<Project> {
  const { data } = await api.get<Project>(endpoints.projects.bySlug(slug));
  return data;
}

export type ProjectInput = Pick<
  Project,
  | "title"
  | "type"
  | "summary"
  | "about"
  | "impact"
  | "learning"
  | "skillsUsed"
  | "demoLink"
  | "githubLink"
  | "coverImage"
  | "featured"
  | "order"
  | "published"
>;

export async function createProject(payload: Partial<ProjectInput>): Promise<Project> {
  const { data } = await api.post<Project>(endpoints.projects.root, payload);
  return data;
}

export async function updateProject(id: string, payload: Partial<ProjectInput>): Promise<Project> {
  const { data } = await api.put<Project>(endpoints.projects.byId(id), payload);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(endpoints.projects.byId(id));
}

export async function uploadProjectAsset(id: string, file: File, name?: string): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  const { data } = await api.post<Project>(endpoints.projects.assets(id), form);
  return data;
}

export async function deleteProjectAsset(id: string, assetId: string): Promise<Project> {
  const { data } = await api.delete<Project>(endpoints.projects.asset(id, assetId));
  return data;
}
