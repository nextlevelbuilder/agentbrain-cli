import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "./http-client.js";
import { ApiError } from "./api-error.js";
import { AgentBrainConfig } from "../config/config-schema.js";

function cfg(over: Partial<AgentBrainConfig> = {}): AgentBrainConfig {
  return {
    apiUrl: "https://api.example.test",
    apiKey: "",
    token: "",
    orgId: "",
    output: "json",
    timeout: 5000,
    ...over,
  };
}

// Capture the last fetch call so we can assert URL + headers per request.
function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok,
    status,
    statusText: ok ? "OK" : "ERR",
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("ApiClient auth header selection (per prefix)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Bearer token for /cms and always sends X-Org-Id", async () => {
    const fn = mockFetch({ data: { ok: true } });
    const c = new ApiClient(cfg({ token: "jwt-abc", orgId: "org1", apiKey: "key-should-not-be-used" }));
    await c.get("/cms/folders");
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/cms/folders");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer jwt-abc",
      "X-Org-Id": "org1",
    });
    expect((init as RequestInit).headers).not.toHaveProperty("X-API-Key");
  });

  it("uses X-API-Key for /mcp paths", async () => {
    const fn = mockFetch({ data: {} });
    const c = new ApiClient(cfg({ token: "jwt-abc", orgId: "org1", apiKey: "mcp-key" }));
    await c.post("/mcp/retrieve-context", { question: "q" });
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-API-Key": "mcp-key", "X-Org-Id": "org1" });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("does NOT fall back to Bearer for /mcp (a JWT is rejected as an API key upstream)", async () => {
    mockFetch({ data: {} });
    // token set but no apiKey → /mcp must refuse client-side, not send a JWT.
    const c = new ApiClient(cfg({ token: "jwt-abc", orgId: "org1" }));
    await expect(c.get("/mcp/ai-governance/effective-policy")).rejects.toThrow(/Missing API key/);
  });

  it("throws a clear error when the bearer token is missing for admin paths", async () => {
    mockFetch({});
    const c = new ApiClient(cfg({ orgId: "org1" }));
    await expect(c.get("/cms/folders")).rejects.toThrow(/Missing bearer token/);
  });

  it("throws a clear error when no credential is available for /mcp", async () => {
    mockFetch({});
    const c = new ApiClient(cfg({ orgId: "org1" }));
    await expect(c.get("/mcp/retrieve-context")).rejects.toThrow(/Missing API key/);
  });
});

describe("ApiClient path guard + envelope unwrap", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects paths outside the known prefixes", async () => {
    mockFetch({});
    const c = new ApiClient(cfg({ token: "t" }));
    await expect(c.get("/nope/x")).rejects.toThrow(/Invalid API path/);
  });

  it("unwraps the { data } envelope", async () => {
    mockFetch({ data: { id: "42" } });
    const c = new ApiClient(cfg({ token: "t" }));
    const res = await c.get<{ id: string }>("/cms/folders/42");
    expect(res).toEqual({ id: "42" });
  });

  it("surfaces API errors with status + message", async () => {
    mockFetch({ error: "boom" }, false, 422);
    const c = new ApiClient(cfg({ token: "t" }));
    await expect(c.get("/cms/x")).rejects.toMatchObject({ statusCode: 422, apiMessage: "boom" });
  });
});

describe("putAbsoluteBytes", () => {
  beforeEach(() => {});
  afterEach(() => vi.unstubAllGlobals());

  it("PUTs raw bytes with the exact content type and no auth headers", async () => {
    const fn = mockFetch("", true, 200);
    const c = new ApiClient(cfg({ token: "t", apiKey: "k", orgId: "o" }));
    const bytes = new Uint8Array([1, 2, 3]);
    await c.putAbsoluteBytes("https://storage.example/put?sig=x", bytes, "application/pdf");
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://storage.example/put?sig=x");
    const i = init as RequestInit;
    expect(i.method).toBe("PUT");
    expect(i.headers).toEqual({ "Content-Type": "application/pdf" });
  });

  it("throws ApiError on a non-2xx storage response", async () => {
    mockFetch("denied", false, 403);
    const c = new ApiClient(cfg({ token: "t" }));
    await expect(
      c.putAbsoluteBytes("https://storage.example/put", new Uint8Array([1]), "application/pdf")
    ).rejects.toBeInstanceOf(ApiError);
  });
});
