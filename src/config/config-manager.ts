import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AgentBrainConfig, DEFAULT_CONFIG, ENV_VAR_MAP, VALID_CONFIG_KEYS, SECRET_CONFIG_KEYS } from "./config-schema.js";

const CONFIG_DIR = join(homedir(), ".agentbrain");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Load config from file, returns empty object if not found
function loadConfigFile(): Partial<AgentBrainConfig> {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Load config from env vars
function loadEnvConfig(): Partial<AgentBrainConfig> {
  const result: Partial<AgentBrainConfig> = {};
  for (const [key, envVar] of Object.entries(ENV_VAR_MAP)) {
    const val = process.env[envVar];
    if (val !== undefined) {
      if (key === "timeout") {
        (result as Record<string, unknown>)[key] = parseInt(val, 10);
      } else {
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }
  return result;
}

// Resolve config: defaults < file < env < CLI overrides
export function getConfig(cliOverrides: Partial<AgentBrainConfig> = {}): AgentBrainConfig {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvConfig();

  // Filter out undefined/empty values from overrides
  const cleanOverrides: Partial<AgentBrainConfig> = {};
  for (const [k, v] of Object.entries(cliOverrides)) {
    if (v !== undefined && v !== "") {
      (cleanOverrides as Record<string, unknown>)[k] = v;
    }
  }

  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig, ...cleanOverrides };
}

// Write a single config key-value to config file
export function setConfigValue(key: string, value: string): void {
  if (!VALID_CONFIG_KEYS.includes(key as keyof AgentBrainConfig)) {
    throw new Error(`Invalid config key: "${key}". Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`);
  }

  // Ensure config directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config = loadConfigFile();
  if (key === "timeout") {
    (config as Record<string, unknown>)[key] = parseInt(value, 10);
  } else {
    (config as Record<string, unknown>)[key] = value;
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
  // Restrict permissions since file contains API key
  chmodSync(CONFIG_FILE, 0o600);
}

// Get a single config value (resolved)
export function getConfigValue(key: string): string {
  if (!VALID_CONFIG_KEYS.includes(key as keyof AgentBrainConfig)) {
    throw new Error(`Invalid config key: "${key}". Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`);
  }
  const config = getConfig();
  return String(config[key as keyof AgentBrainConfig] ?? "");
}

// List all resolved config with source info
export function listConfig(): Array<{ key: string; value: string; source: string }> {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvConfig();

  return VALID_CONFIG_KEYS.map((key) => {
    let source = "default";
    let value = String(DEFAULT_CONFIG[key]);

    if (key in fileConfig) {
      source = "config file";
      value = String(fileConfig[key as keyof typeof fileConfig]);
    }
    if (key in envConfig) {
      source = "env var";
      value = String(envConfig[key as keyof typeof envConfig]);
    }

    // Mask secret values (API key, JWT token) for display
    if (SECRET_CONFIG_KEYS.includes(key) && value) {
      value = value.length > 8 ? value.slice(0, 4) + "****" + value.slice(-4) : "****";
    }

    return { key, value, source };
  });
}
