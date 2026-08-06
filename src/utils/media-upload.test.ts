import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectContentType, detectKind, uploadMedia, MAX_UPLOAD_BYTES, commitTimeoutMs } from "./media-upload.js";
import type { ApiClient } from "../client/http-client.js";
import { ApiError } from "../client/api-error.js";

describe("detectContentType", () => {
  it("maps known extensions", () => {
    expect(detectContentType("a/b/report.pdf")).toBe("application/pdf");
    expect(detectContentType("notes.md")).toBe("text/markdown");
    expect(detectContentType("pic.PNG")).toBe("image/png");
  });
  it("falls back to octet-stream", () => {
    expect(detectContentType("weird.xyz")).toBe("application/octet-stream");
  });
  it("honours override", () => {
    expect(detectContentType("x.pdf", "text/plain")).toBe("text/plain");
  });
});

describe("detectKind", () => {
  it("infers from content type", () => {
    expect(detectKind("image/png")).toBe("image");
    expect(detectKind("audio/mpeg")).toBe("audio");
    expect(detectKind("video/mp4")).toBe("video");
    expect(detectKind("application/pdf")).toBe("raw_doc");
    expect(detectKind("application/octet-stream")).toBe("raw_doc");
  });
  it("honours override", () => {
    expect(detectKind("application/pdf", "image")).toBe("image");
  });
});

describe("uploadMedia orchestration", () => {
  const filePath = join(tmpdir(), `ab-cli-upload-${Date.now()}.pdf`);
  const fileBody = "%PDF-1.4 hello world";

  beforeAll(async () => {
    await writeFile(filePath, fileBody);
  });
  afterAll(async () => {
    await rm(filePath, { force: true });
  });

  it("runs presign → PUT → commit with detected metadata + sha256", async () => {
    const calls: { path: string; body: unknown }[] = [];
    let putUrlUsed = "";
    let putContentType = "";

    const fakeClient = {
      post: async (path: string, body: unknown) => {
        calls.push({ path, body });
        if (path.endsWith("/presign")) {
          return { assetId: "asset-1", putUrl: "https://storage.example/put?sig=x", expiresAt: "", fields: {} };
        }
        return { assetId: "asset-1", status: "ready", objectKey: "org/asset-1.pdf" };
      },
      putAbsoluteBytes: async (url: string, _bytes: Uint8Array, ct: string) => {
        putUrlUsed = url;
        putContentType = ct;
      },
    } as unknown as ApiClient;

    const result = await uploadMedia(fakeClient, { filePath });

    // presign body carries detected metadata
    const presignBody = calls[0].body as Record<string, unknown>;
    expect(calls[0].path).toBe("/cms/media/uploads/presign");
    expect(presignBody.contentType).toBe("application/pdf");
    expect(presignBody.kind).toBe("raw_doc");
    expect(presignBody.sizeBytes).toBe(Buffer.byteLength(fileBody));
    expect(presignBody.fileName).toMatch(/\.pdf$/);

    // PUT went to the signed URL with matching content type
    expect(putUrlUsed).toBe("https://storage.example/put?sig=x");
    expect(putContentType).toBe("application/pdf");

    // commit carries assetId + a 64-hex sha256 by default
    const commitBody = calls[1].body as Record<string, unknown>;
    expect(calls[1].path).toBe("/cms/media/uploads/commit");
    expect(commitBody.assetId).toBe("asset-1");
    expect(String(commitBody.sha256)).toMatch(/^[0-9a-f]{64}$/);

    expect(result.assetId).toBe("asset-1");
    expect(result.kind).toBe("raw_doc");
  });

  it("skips sha256 when computeSha256=false", async () => {
    let commitBody: Record<string, unknown> = {};
    const fakeClient = {
      post: async (path: string, body: unknown) => {
        if (path.endsWith("/presign")) {
          return { assetId: "a", putUrl: "https://x/y", expiresAt: "", fields: {} };
        }
        commitBody = body as Record<string, unknown>;
        return { assetId: "a", status: "ready", objectKey: "k" };
      },
      putAbsoluteBytes: async () => {},
    } as unknown as ApiClient;

    await uploadMedia(fakeClient, { filePath, computeSha256: false });
    expect(commitBody.sha256).toBeUndefined();
  });

  it("rejects a missing file", async () => {
    const fakeClient = { post: async () => ({}), putAbsoluteBytes: async () => {} } as unknown as ApiClient;
    await expect(uploadMedia(fakeClient, { filePath: "/no/such/file.pdf" })).rejects.toThrow(/File not found/);
  });

  it("passes a size-scaled timeout to the commit request", async () => {
    let commitOpts: { timeoutMs?: number } | undefined;
    const fakeClient = {
      post: async (path: string, _body: unknown, opts?: { timeoutMs?: number }) => {
        if (path.endsWith("/presign")) {
          return { assetId: "a", putUrl: "https://x/y", expiresAt: "", fields: {} };
        }
        commitOpts = opts;
        return { assetId: "a", status: "ready", objectKey: "k" };
      },
      putAbsoluteBytes: async () => {},
    } as unknown as ApiClient;

    await uploadMedia(fakeClient, { filePath, computeSha256: false });
    // Small fixture → floor applies; must be well above the default 30s request timeout.
    expect(commitOpts?.timeoutMs).toBe(commitTimeoutMs(Buffer.byteLength(fileBody)));
    expect(commitOpts?.timeoutMs).toBeGreaterThanOrEqual(60_000);
  });

  it("treats a 409 commit as success, reusing the echoed asset payload", async () => {
    const fakeClient = {
      post: async (path: string) => {
        if (path.endsWith("/presign")) {
          return { assetId: "dup", putUrl: "https://x/y", expiresAt: "", fields: {} };
        }
        throw new ApiError(409, "already committed", {
          data: { assetId: "dup", status: "ready", objectKey: "org/dup.pdf" },
        });
      },
      putAbsoluteBytes: async () => {},
    } as unknown as ApiClient;

    const result = await uploadMedia(fakeClient, { filePath, computeSha256: false });
    expect(result.status).toBe("ready");
    expect(result.objectKey).toBe("org/dup.pdf");
  });
});

describe("commitTimeoutMs", () => {
  it("applies a floor for small files", () => {
    expect(commitTimeoutMs(1_000)).toBe(60_000);
  });
  it("scales with size for large media", () => {
    // 300MB → 300 * 1000ms = 300s, comfortably above the observed ~50s probe time.
    expect(commitTimeoutMs(300_000_000)).toBe(300_000);
  });
});

describe("limits", () => {
  it("exposes the backend 500MB cap", () => {
    expect(MAX_UPLOAD_BYTES).toBe(500_000_000);
  });
});
