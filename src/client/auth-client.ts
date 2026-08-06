import { ApiError } from "./api-error.js";

// Standalone client for the Builder Auth service — the separate service that
// issues the bearer JWT the hub (`apiUrl`) later introspects. Kept out of
// ApiClient because it targets a different host and an unversioned auth path
// (`/v1/auth/login/*`) that ApiClient's prefix allowlist deliberately rejects.

export type LoginMode = "email" | "username";

export interface LoginParams {
  authUrl: string;
  tenantId: string;
  mode: LoginMode;
  identifier: string;
  password: string;
  timeout: number;
}

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface RefreshParams {
  authUrl: string;
  tenantId: string;
  refreshToken: string;
  timeout: number;
}

export interface LogoutParams {
  authUrl: string;
  tenantId: string;
  accessToken: string;
  timeout: number;
}

// Auth service envelopes the token payload as { data: { accessToken, ... } };
// tolerate a flat shape too so a future/alternate deployment still works.
interface AuthTokenBody {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    message?: string;
  };
}

// Exchange credentials for a bearer JWT. Throws ApiError on non-2xx or a
// response missing an access token.
export async function login(params: LoginParams): Promise<LoginResult> {
  const base = params.authUrl.replace(/\/$/, "");
  const url = `${base}/v1/auth/login/${params.mode}`;
  const bodyKey = params.mode === "username" ? "username" : "email";
  const body = { [bodyKey]: params.identifier, password: params.password };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Tenant-ID": params.tenantId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: AuthTokenBody | string;
    try {
      data = JSON.parse(text) as AuthTokenBody;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const msg =
        (typeof data === "object" && (data.message ?? data.data?.message)) ||
        response.statusText ||
        "Login failed";
      throw new ApiError(response.status, String(msg), data);
    }

    const payload = typeof data === "object" ? data.data ?? data : {};
    const accessToken = payload.accessToken;
    if (!accessToken) {
      throw new ApiError(500, "Auth service returned no access token", data);
    }

    return {
      accessToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, `Login request timed out after ${params.timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exchange a refresh token for a new access-token pair. Builder Auth *rotates*
// refresh tokens — every successful call invalidates the old refreshToken and
// returns a fresh one, so callers MUST persist both fields from the result.
export async function refresh(params: RefreshParams): Promise<LoginResult> {
  const base = params.authUrl.replace(/\/$/, "");
  const url = `${base}/v1/auth/refresh`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Tenant-ID": params.tenantId,
      },
      body: JSON.stringify({ refreshToken: params.refreshToken }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: AuthTokenBody | string;
    try {
      data = JSON.parse(text) as AuthTokenBody;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const msg =
        (typeof data === "object" && (data.message ?? data.data?.message)) ||
        response.statusText ||
        "Token refresh failed";
      throw new ApiError(response.status, String(msg), data);
    }

    const payload = typeof data === "object" ? data.data ?? data : {};
    const accessToken = payload.accessToken;
    if (!accessToken) {
      throw new ApiError(500, "Auth service returned no access token on refresh", data);
    }

    return {
      accessToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, `Refresh request timed out after ${params.timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Revoke the current access token server-side. Best-effort — callers should
// always clear local tokens even when this rejects, since network issues must
// not strand a user with an unlogoutable session.
export async function logout(params: LogoutParams): Promise<void> {
  const base = params.authUrl.replace(/\/$/, "");
  const url = `${base}/v1/auth/logout`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "X-Tenant-ID": params.tenantId,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(response.status, `Logout failed: ${response.statusText}`);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, `Logout request timed out after ${params.timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
