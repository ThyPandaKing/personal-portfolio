import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env.js";

const client = axios.create({
  baseURL: env.agentServiceUrl,
  timeout: 120_000,
});

const internalHeaders = { "x-internal-key": env.internalApiKey };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function chat(message: string, history: ChatTurn[]) {
  const { data } = await client.post("/chat", { message, history });
  return data as { answer: string; sources: { title: string; type: string }[] };
}

export async function reingestPortfolio() {
  const { data } = await client.post("/ingest/portfolio", {}, { headers: internalHeaders });
  return data;
}

export async function ingestDocument(title: string, text: string) {
  const { data } = await client.post("/ingest/document", { title, text }, { headers: internalHeaders });
  return data;
}

export async function ingestPdf(buffer: Buffer, filename: string, title: string) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: "application/pdf",
  });
  form.append("title", title);
  const { data } = await client.post("/ingest/pdf", form, {
    headers: { ...internalHeaders, ...form.getHeaders() },
    maxBodyLength: Infinity,
  });
  return data;
}

export async function ragStatus() {
  const { data } = await client.get("/ingest/status", { headers: internalHeaders });
  return data;
}

export async function resetIndex() {
  const { data } = await client.post("/ingest/reset", {}, { headers: internalHeaders });
  return data;
}

export async function generateResume(payload: {
  role: string;
  project_ids: string[];
  skills: string[];
  instructions: string;
}) {
  const { data } = await client.post("/resume/generate", payload, { headers: internalHeaders });
  return data as { content: string };
}
