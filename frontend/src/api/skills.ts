import { api } from "../lib/api";
import type { Skill } from "../types";
import { endpoints } from "./endpoints";

export async function fetchSkills(): Promise<Skill[]> {
  const { data } = await api.get<Skill[]>(endpoints.skills.root);
  return data;
}

export type SkillInput = Omit<Skill, "_id">;

export async function createSkill(payload: SkillInput): Promise<Skill> {
  const { data } = await api.post<Skill>(endpoints.skills.root, payload);
  return data;
}

export async function updateSkill(id: string, payload: Partial<SkillInput>): Promise<Skill> {
  const { data } = await api.put<Skill>(endpoints.skills.byId(id), payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(endpoints.skills.byId(id));
}
