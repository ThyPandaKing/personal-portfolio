import { api } from "../lib/api";
import { endpoints } from "./endpoints";

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResult>(endpoints.uploads.root, form);
  return data;
}
