import { Router } from "express";
import { getFileInfo, openDownloadStream } from "../services/gridfs.js";
import { asyncHandler, notFound } from "../utils/http.js";

export const filesRouter = Router();

/** GET /api/files/:id — stream a file from GridFS (public). Supports range requests. */
filesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const info = await getFileInfo(req.params.id);
    if (!info) throw notFound("File not found");

    res.setHeader("Content-Type", info.contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : info.length - 1;

      if (start >= info.length || end >= info.length || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${info.length}`);
        return res.end();
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${info.length}`);
      res.setHeader("Content-Length", end - start + 1);
      return openDownloadStream(info.id, start, end)
        .on("error", () => res.destroy())
        .pipe(res);
    }

    res.setHeader("Content-Length", info.length);
    return openDownloadStream(info.id)
      .on("error", () => res.destroy())
      .pipe(res);
  }),
);
