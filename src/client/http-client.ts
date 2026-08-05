import { AgentBrainConfig } from "../config/config-schema.js";
import { ApiError } from "./api-error.js";

// Path prefixes the CLI is allowed to call. Everything routes under /v1/<prefix>.
const KNOWN_PREFIXES = ["/cms", "/mcp", "/system", "/orgs", "/permissions", "/me", "/users"] as const;

// Admin/CMS surface authenticates with a bearer JWT (mw.Auth()); only /mcp
// accepts an X-API-Key (mw.APIKeyWithOrg). This split decides which credential
// each request carries.
function isMcpPath(path: string): boolean {
  return path === "/mcp" || path.startsWith("/mcp/");
}

// HTTP client for AgentBrain API with auth, error handling, and SSE streaming
export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private token: string;
  private orgId: string;
  private timeout: number;
  private verbose: boolean;

  constructor(config: AgentBrainConfig, verbose = false) {
    // Base is the API version root. Commands pass the full sub-path, e.g.
    // "/cms/folders", "/mcp/retrieve-context", "/system/users", "/permissions/verify".
    this.baseUrl = `${config.apiUrl.replace(/\/$/, "")}/v1`;
    this.apiKey = config.apiKey;
    this.token = config.token;
    this.orgId = config.orgId;
    this.timeout = config.timeout;
    this.verbose = verbose;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }

  // PUT raw bytes to an absolute (presigned) URL — no auth headers, no JSON.
  // Used for the media upload flow: presign() returns a signed PUT URL that the
  // storage provider (R2/S3/GCS) validates on its own; sending X-API-Key or a
  // JSON content-type would break the V4 signature match. Content-Type MUST be
  // exactly what was sent to presign.
  async putAbsoluteBytes(url: string, body: Uint8Array | Blob, contentType: string): Promise<void> {
    const size = body instanceof Blob ? body.size : body.byteLength;
    if (this.verbose) {
      // Redact the query string — a presigned URL carries its signature there.
      const safeUrl = url.split("?")[0];
      console.error(`PUT (presigned) ${safeUrl} [${size} bytes, ${contentType}]`);
    }

    const controller = new AbortController();
    // Uploads can be large (up to 500MB); scale the abort window with size but
    // keep a sane floor so tiny files still honour the configured timeout.
    const uploadTimeout = Math.max(this.timeout, Math.ceil(size / 1024) * 20);
    const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        // undici accepts a Uint8Array/Buffer/Blob body; the DOM BodyInit typing
        // is narrower than the runtime, so widen it here.
        body: body as unknown as BodyInit,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ApiError(response.status, `Presigned upload failed: ${response.statusText}${text ? ` — ${text.slice(0, 300)}` : ""}`);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new ApiError(408, `Upload timed out after ${uploadTimeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // SSE streaming for workflow run logs
  async stream(path: string, onEvent: (data: string) => void): Promise<void> {
    const url = this.buildUrl(path);
    const controller = new AbortController();

    if (this.verbose) {
      console.error(`SSE ${url}`);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { ...this.baseHeaders(), ...this.authHeaders(path), Accept: "text/event-stream" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `SSE connection failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body for SSE stream");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            onEvent(line.slice(6));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private baseHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // Pick the credential for a path. /mcp authenticates with X-API-Key only:
  // the backend's APIKeyWithOrg middleware treats an `Authorization: Bearer <x>`
  // value as an API-key *string* (not a JWT), so a config.token there would be
  // rejected as an invalid key — fail fast with a clear message instead. Every
  // other surface requires a bearer JWT. X-Org-Id is always sent when set.
  private authHeaders(path: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.orgId) headers["X-Org-Id"] = this.orgId;

    if (isMcpPath(path)) {
      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
      } else {
        throw new Error(
          "Missing API key for /mcp endpoint. Provide an API key via `agentbrain config set apiKey <key>`, AGENTBRAIN_API_KEY, or --api-key."
        );
      }
    } else {
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      } else {
        throw new Error(
          "Missing bearer token for admin endpoint. Provide a token via `agentbrain config set token <jwt>`, AGENTBRAIN_TOKEN, or --token."
        );
      }
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    if (!KNOWN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      throw new Error(
        `Invalid API path "${path}". Must start with one of: ${KNOWN_PREFIXES.join(", ")}.`
      );
    }
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    const headers = { ...this.baseHeaders(), ...this.authHeaders(path) };
    const start = Date.now();

    if (this.verbose) {
      console.error(`${method} ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const duration = Date.now() - start;

      if (this.verbose) {
        console.error(`${response.status} ${response.statusText} (${duration}ms)`);
      }

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!response.ok) {
        const msg = (data as Record<string, unknown>)?.error ??
          (data as Record<string, unknown>)?.message ??
          response.statusText;
        throw new ApiError(response.status, String(msg), data);
      }

      // Unwrap envelope if present: { data: T } -> T
      if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
        return (data as Record<string, unknown>).data as T;
      }
      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new ApiError(408, `Request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
