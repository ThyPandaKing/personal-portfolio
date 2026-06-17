import { api } from "../lib/api";
import type { Profile } from "../types";
import { endpoints } from "./endpoints";

export async function fetchProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>(endpoints.profile.root);
  return data;
}

export async function updateProfile(payload: Profile): Promise<Profile> {
  const { data } = await api.put<Profile>(endpoints.profile.root, payload);
  return data;
}

export async function uploadProfileImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url: string }>(endpoints.profile.image, form);
  return data.url;
}
