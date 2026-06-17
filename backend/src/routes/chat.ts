import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import * as agent from "../services/agentClient.js";
import { asyncHandler, badRequest } from "../utils/http.js";

export const chatRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});

/** POST /api/chat — public chatbot endpoint (proxies to the agent service). */
chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { message, history } = chatSchema.parse(req.body);
    const result = await agent.chat(message, history);
    res.json(result);
  }),
);

/* ----- Admin RAG management (proxied with the internal key) ----- */

chatRouter.get(
  "/admin/status",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await agent.ragStatus());
  }),
);

chatRouter.post(
  "/admin/reingest",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await agent.reingestPortfolio());
  }),
);

const docSchema = z.object({ title: z.string().min(1), text: z.string().min(1) });

chatRouter.post(
  "/admin/document",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, text } = docSchema.parse(req.body);
    res.json(await agent.ingestDocument(title, text));
  }),
);

chatRouter.post(
  "/admin/pdf",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    const title = req.body.title || req.file.originalname;
    // The PDF is forwarded in-memory for text extraction; it is not stored.
    const result = await agent.ingestPdf(req.file.buffer, req.file.originalname, title);
    res.json(result);
  }),
);

chatRouter.post(
  "/admin/reset",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await agent.resetIndex());
  }),
);
