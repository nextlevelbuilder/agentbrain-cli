// AgentBrain CLI configuration schema and defaults
export interface AgentBrainConfig {
  apiUrl: string;
  apiKey: string;
  token: string;
  orgId: string;
  output: "json" | "table" | "yaml";
  timeout: number;
}

export const DEFAULT_CONFIG: AgentBrainConfig = {
  apiUrl: "https://api.agentbrain.sh",
  apiKey: "",
  token: "",
  orgId: "",
  output: "table",
  timeout: 30000,
};

// Maps config keys to env var names
export const ENV_VAR_MAP: Record<string, string> = {
  apiUrl: "AGENTBRAIN_API_URL",
  apiKey: "AGENTBRAIN_API_KEY",
  token: "AGENTBRAIN_TOKEN",
  orgId: "AGENTBRAIN_ORG_ID",
  output: "AGENTBRAIN_OUTPUT",
  timeout: "AGENTBRAIN_TIMEOUT",
};

// Valid config keys for set/get commands
export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof AgentBrainConfig)[];

// Keys whose values are secrets and must be masked in `config list`.
export const SECRET_CONFIG_KEYS: (keyof AgentBrainConfig)[] = ["apiKey", "token"];
