// AgentBrain CLI configuration schema and defaults
export interface AgentBrainConfig {
  apiUrl: string;
  apiKey: string;
  token: string;
  // Long-lived refresh token issued alongside `token` by `agentbrain auth
  // login`. Used to silently rotate an expired access token before commands
  // fail with 401. Rotating: each refresh call returns a new pair, so this
  // value is not safe to reuse as a static CI credential.
  refreshToken: string;
  orgId: string;
  // Builder Auth service base URL — `agentbrain auth login` exchanges
  // credentials here for the bearer JWT stored in `token`. It is a *separate*
  // service from the hub `apiUrl`; the hub only introspects the JWT it issues.
  authUrl: string;
  // Builder Auth tenant, sent as X-Tenant-ID on login. Deployment-specific
  // (a UUID); has no universal default, so it must be configured for login.
  tenantId: string;
  output: "json" | "table" | "yaml";
  timeout: number;
}

export const DEFAULT_CONFIG: AgentBrainConfig = {
  apiUrl: "https://api.agentbrain.sh",
  apiKey: "",
  token: "",
  refreshToken: "",
  orgId: "",
  authUrl: "https://auth-worker.core-f0d.workers.dev",
  tenantId: "",
  output: "table",
  timeout: 30000,
};

// Maps config keys to env var names
export const ENV_VAR_MAP: Record<string, string> = {
  apiUrl: "AGENTBRAIN_API_URL",
  apiKey: "AGENTBRAIN_API_KEY",
  token: "AGENTBRAIN_TOKEN",
  refreshToken: "AGENTBRAIN_REFRESH_TOKEN",
  orgId: "AGENTBRAIN_ORG_ID",
  authUrl: "AGENTBRAIN_AUTH_URL",
  tenantId: "AGENTBRAIN_TENANT_ID",
  output: "AGENTBRAIN_OUTPUT",
  timeout: "AGENTBRAIN_TIMEOUT",
};

// Valid config keys for set/get commands
export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof AgentBrainConfig)[];

// Keys whose values are secrets and must be masked in `config list`.
export const SECRET_CONFIG_KEYS: (keyof AgentBrainConfig)[] = ["apiKey", "token", "refreshToken"];
