import { stat, access } from "node:fs/promises";
import { createReadStream, openAsBlob } from "node:fs";
import { basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { ApiClient } from "../client/http-client.js";
import { ApiError } from "../client/api-error.js";

// Backend cap: PresignUploadRequestDTO enforces sizeBytes <= 500_000_000.
export const MAX_UPLOAD_BYTES = 500_000_000;

// Above this size, skip sha256 by default: hashing a huge file just to help the
// backend (which HEAD-validates size authoritatively) is rarely worth the I/O.
export const SHA256_DEFAULT_MAX_BYTES = 100_000_000;

// Media asset kind accepted by the presign endpoint.
export type MediaKind = "audio" | "video" | "image" | "raw_doc";

interface PresignResponse {
  assetId: string;
  putUrl: string;
  expiresAt: string;
  fields: Record<string, string>;
}

export interface CommitResponse {
  assetId: string;
  status: string;
  objectKey: string;
}

// Minimal extension → MIME map covering the document/media types users upload.
// Anything unknown falls back to application/octet-stream (kind=raw_doc).
const MIME_BY_EXT: Record<string, string> = {
  // documents
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".rtf": "application/rtf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  // audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  // video
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

// Detect content type from a filename extension.
export function detectContentType(filePath: string, override?: string): string {
  if (override) return override;
  const ext = extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

// Map a content type to the presign `kind` enum. Documents → raw_doc.
export function detectKind(contentType: string, override?: MediaKind): MediaKind {
  if (override) return override;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("video/")) return "video";
  return "raw_doc";
}

// Stream the file through sha256 so we never buffer the whole thing in memory.
async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

export interface UploadOptions {
  filePath: string;
  folderId?: string;
  kind?: MediaKind;
  contentType?: string;
  computeSha256?: boolean; // default: true for files <= SHA256_DEFAULT_MAX_BYTES
}

export interface UploadResult extends CommitResponse {
  fileName: string;
  sizeBytes: number;
  contentType: string;
  kind: MediaKind;
}

// Orchestrate the three-step upload: presign → PUT bytes → commit.
// Kept transport-agnostic (takes an ApiClient) so it is unit-testable with a
// mocked client.
export async function uploadMedia(client: ApiClient, opts: UploadOptions): Promise<UploadResult> {
  await access(opts.filePath).catch(() => {
    throw new Error(`File not found: ${opts.filePath}`);
  });
  const info = await stat(opts.filePath);
  if (!info.isFile()) throw new Error(`Not a file: ${opts.filePath}`);
  const sizeBytes = info.size;
  if (sizeBytes <= 0) throw new Error(`File is empty: ${opts.filePath}`);
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES} byte limit (${sizeBytes} bytes): ${opts.filePath}`);
  }

  const fileName = basename(opts.filePath);
  const contentType = detectContentType(opts.filePath, opts.contentType);
  const kind = detectKind(contentType, opts.kind);

  // 1) presign
  const presign = await client.post<PresignResponse>("/cms/media/uploads/presign", {
    fileName,
    sizeBytes,
    contentType,
    kind,
    folderId: opts.folderId,
  });

  // 2) PUT bytes to the signed URL (no auth headers). openAsBlob streams the
  //    file body rather than loading it all into memory.
  const blob = await openAsBlob(opts.filePath, { type: contentType });
  await client.putAbsoluteBytes(presign.putUrl, blob, contentType);

  // 3) commit (sha256 optional; backend HEADs the object for authoritative size)
  const computeSha = opts.computeSha256 ?? sizeBytes <= SHA256_DEFAULT_MAX_BYTES;
  const sha256 = computeSha ? await sha256File(opts.filePath) : undefined;

  let commit: CommitResponse;
  try {
    commit = await client.post<CommitResponse>("/cms/media/uploads/commit", {
      assetId: presign.assetId,
      sha256,
      contentType,
    });
  } catch (err) {
    // 409 = asset already committed (e.g. a retried commit). Treat as success.
    if (err instanceof ApiError && err.statusCode === 409) {
      commit = { assetId: presign.assetId, status: "ready", objectKey: "" };
    } else {
      throw err;
    }
  }

  return { ...commit, fileName, sizeBytes, contentType, kind };
}
