import multer from "multer";
import { badRequest } from "../utils/http.js";

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
]);

/**
 * In-memory upload — the file buffer is then streamed into MongoDB GridFS.
 * Nothing is written to local disk.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB for recordings
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    // HttpError -> handled as 400 by the error middleware (not a 500).
    cb(badRequest(`Unsupported file type: ${file.mimetype}`));
  },
});
