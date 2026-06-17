import { api } from "../lib/api";
import type { Resume, ResumeRole } from "../types";
import { endpoints } from "./endpoints";

export async function fetchResumes(): Promise<Resume[]> {
  const { data } = await api.get<Resume[]>(endpoints.resumes.root);
  return data;
}

export interface ResumeInput {
  title: string;
  role: ResumeRole;
  source?: "uploaded" | "generated";
  content?: string;
  fileUrl?: string;
  isPublic?: boolean;
}

export async function createResume(payload: ResumeInput): Promise<Resume> {
  const { data } = await api.post<Resume>(endpoints.resumes.root, payload);
  return data;
}

export async function updateResume(id: string, payload: Partial<ResumeInput>): Promise<Resume> {
  const { data } = await api.put<Resume>(endpoints.resumes.byId(id), payload);
  return data;
}

export async function deleteResume(id: string): Promise<void> {
  await api.delete(endpoints.resumes.byId(id));
}

export interface GenerateResumeInput {
  title: string;
  role: ResumeRole;
  projectIds: string[];
  skills: string[];
  instructions: string;
}

export async function generateResume(payload: GenerateResumeInput): Promise<Resume> {
  const { data } = await api.post<Resume>(endpoints.resumes.generate, payload);
  return data;
}

export async function uploadResumeFile(id: string, file: File): Promise<Resume> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<Resume>(endpoints.resumes.file(id), form);
  return data;
}
