import mongoose from "mongoose";

const BUCKET = "uploads";

/** GridFS bucket on the active Mongoose connection (created lazily). */
function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export interface StoredFile {
  id: string;
  filename: string;
  length: number;
  contentType: string;
}

/** Store a buffer in GridFS and resolve with its id + metadata. */
export function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<StoredFile> {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(filename, { contentType });
    stream.on("error", reject);
    stream.on("finish", () =>
      resolve({ id: String(stream.id), filename, length: buffer.length, contentType }),
    );
    stream.end(buffer);
  });
}

export interface FileInfo {
  id: string;
  filename: string;
  length: number;
  contentType: string;
}

export async function getFileInfo(id: string): Promise<FileInfo | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const _id = new mongoose.Types.ObjectId(id);
  const [doc] = await getBucket().find({ _id }).toArray();
  if (!doc) return null;
  return {
    id: String(doc._id),
    filename: doc.filename,
    length: doc.length,
    contentType: doc.contentType || "application/octet-stream",
  };
}

/** Open a readable stream for a file, optionally a byte range (for video seeking). */
export function openDownloadStream(id: string, start?: number, end?: number) {
  const _id = new mongoose.Types.ObjectId(id);
  if (start !== undefined && end !== undefined) {
    // GridFS `end` is exclusive.
    return getBucket().openDownloadStream(_id, { start, end: end + 1 });
  }
  return getBucket().openDownloadStream(_id);
}

/** Best-effort delete; ignores files that don't exist. */
export async function deleteFile(id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) return;
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(id));
  } catch {
    /* already gone */
  }
}

/**
 * Relative URL the frontend uses to fetch a stored file. Kept relative (no host)
 * so records are environment-independent — the browser resolves it against the
 * current origin, which proxies /api to the backend in both dev and prod.
 */
export const fileUrlFor = (id: string): string => `/api/files/${id}`;

/** Extract a GridFS id from a URL produced by fileUrlFor (or "" if not one). */
export const fileIdFromUrl = (url: string): string => url.split("/api/files/")[1]?.split(/[/?#]/)[0] ?? "";
