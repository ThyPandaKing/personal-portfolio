import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { fileUrlFor, uploadBuffer } from "../services/gridfs.js";
import { asyncHandler, badRequest } from "../utils/http.js";

export const uploadsRouter = Router();

/** POST /api/uploads — admin uploads any supported file to GridFS, returns its public URL. */
uploadsRouter.post(
  "/",
  requireAdmin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    const stored = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({
      url: fileUrlFor(stored.id),
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }),
);
