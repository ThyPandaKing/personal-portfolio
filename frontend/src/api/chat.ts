import { api } from "../lib/api";
import type { ChatMessage } from "../types";
import { endpoints } from "./endpoints";

export interface ChatReply {
  answer: string;
  sources: { title: string; type: string }[];
}

export async function sendChat(message: string, history: ChatMessage[]): Promise<ChatReply> {
  const { data } = await api.post<ChatReply>(endpoints.chat.root, {
    message,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  });
  return data;
}

/**
 * Fire-and-forget pre-heat: wakes the (free-tier) backend + agent service on
 * first page load so the chatbot responds quickly. Failures are ignored — the
 * request itself triggers the cold start even if it times out.
 */
export async function warmup(): Promise<void> {
  try {
    await api.get(endpoints.chat.warmup, { timeout: 15_000 });
  } catch {
    /* best-effort */
  }
}

/* ----- Admin RAG management ----- */

export interface RagStatus {
  indexed_chunks: number;
  collection: string;
}

export async function ragStatus(): Promise<RagStatus> {
  const { data } = await api.get<RagStatus>(endpoints.chat.admin.status);
  return data;
}

export async function reingestPortfolio() {
  const { data } = await api.post(endpoints.chat.admin.reingest);
  return data;
}

export async function ingestDocument(title: string, text: string) {
  const { data } = await api.post(endpoints.chat.admin.document, { title, text });
  return data;
}

export async function ingestPdf(file: File, title: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  const { data } = await api.post(endpoints.chat.admin.pdf, form);
  return data;
}

export async function resetIndex() {
  const { data } = await api.post(endpoints.chat.admin.reset);
  return data;
}
