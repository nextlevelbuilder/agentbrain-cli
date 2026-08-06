import { describe, it, expect, vi, afterEach } from "vitest";
import { login, refresh, logout } from "./auth-client.js";
import { ApiError } from "./api-error.js";

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

const base = { authUrl: "https://auth.example.test", tenantId: "tenant-1", timeout: 5000 };

describe("auth-client login", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs email login with tenant header and returns the token", async () => {
    const fn = mockFetch({ data: { accessToken: "jwt-xyz", refreshToken: "r1", expiresIn: 900 } });
    const res = await login({ ...base, mode: "email", identifier: "a@b.co", password: "pw" });

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://auth.example.test/v1/auth/login/email");
    const i = init as RequestInit;
    expect(i.method).toBe("POST");
    expect(i.headers).toMatchObject({ "X-Tenant-ID": "tenant-1" });
    expect(JSON.parse(i.body as string)).toEqual({ email: "a@b.co", password: "pw" });
    expect(res).toEqual({ accessToken: "jwt-xyz", refreshToken: "r1", expiresIn: 900 });
  });

  it("uses the username path + body field in username mode", async () => {
    const fn = mockFetch({ data: { accessToken: "jwt-u" } });
    await login({ ...base, mode: "username", identifier: "alice", password: "pw" });

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://auth.example.test/v1/auth/login/username");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ username: "alice", password: "pw" });
  });

  it("accepts a flat (un-enveloped) token response", async () => {
    mockFetch({ accessToken: "flat-jwt" });
    const res = await login({ ...base, mode: "email", identifier: "a@b.co", password: "pw" });
    expect(res.accessToken).toBe("flat-jwt");
  });

  it("throws ApiError with the service message on non-2xx", async () => {
    mockFetch({ message: "Invalid credentials" }, false, 401);
    await expect(
      login({ ...base, mode: "email", identifier: "a@b.co", password: "bad" })
    ).rejects.toMatchObject({ statusCode: 401, apiMessage: "Invalid credentials" });
  });

  it("throws when the response carries no access token", async () => {
    mockFetch({ data: {} });
    await expect(
      login({ ...base, mode: "email", identifier: "a@b.co", password: "pw" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("strips a trailing slash from authUrl", async () => {
    const fn = mockFetch({ data: { accessToken: "t" } });
    await login({ ...base, authUrl: "https://auth.example.test/", mode: "email", identifier: "a@b.co", password: "pw" });
    expect(fn.mock.calls[0][0]).toBe("https://auth.example.test/v1/auth/login/email");
  });
});

describe("auth-client refresh", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the refreshToken and returns a rotated pair", async () => {
    const fn = mockFetch({ data: { accessToken: "new-jwt", refreshToken: "new-rt", expiresIn: 900 } });
    const res = await refresh({ ...base, refreshToken: "old-rt" });

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://auth.example.test/v1/auth/refresh");
    const i = init as RequestInit;
    expect(i.headers).toMatchObject({ "X-Tenant-ID": "tenant-1" });
    expect(JSON.parse(i.body as string)).toEqual({ refreshToken: "old-rt" });
    expect(res).toEqual({ accessToken: "new-jwt", refreshToken: "new-rt", expiresIn: 900 });
  });

  it("throws ApiError with status on non-2xx", async () => {
    mockFetch({ message: "refresh token expired" }, false, 401);
    await expect(refresh({ ...base, refreshToken: "expired" })).rejects.toMatchObject({
      statusCode: 401,
      apiMessage: "refresh token expired",
    });
  });
});

describe("auth-client logout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs with Bearer + tenant header", async () => {
    const fn = mockFetch("", true, 204);
    await logout({ ...base, accessToken: "jwt-xyz" });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://auth.example.test/v1/auth/logout");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer jwt-xyz",
      "X-Tenant-ID": "tenant-1",
    });
  });

  it("throws ApiError on non-2xx", async () => {
    mockFetch("nope", false, 500);
    await expect(logout({ ...base, accessToken: "jwt-xyz" })).rejects.toBeInstanceOf(ApiError);
  });
});
