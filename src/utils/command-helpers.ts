import { Command } from "commander";
import { getConfig, setConfigValue } from "../config/config-manager.js";
import { AgentBrainConfig } from "../config/config-schema.js";
import { ApiClient } from "../client/http-client.js";
import { ApiError, formatApiError } from "../client/api-error.js";
import { resolveOutputFormat, printOutput, TableColumnDef } from "../formatters/output-formatter.js";
import { getGlobalOptions } from "./global-options.js";

// Create ApiClient from resolved config + CLI overrides. Registers a
// persistence callback so a silent refresh writes the rotated token pair back
// to ~/.agentbrain/config.json — without it, the next command would still see
// the invalidated refreshToken and fail.
export function createClient(cmd: Command): { client: ApiClient; config: AgentBrainConfig } {
  const opts = getGlobalOptions(cmd);
  const config = getConfig({
    apiUrl: opts.apiUrl,
    apiKey: opts.apiKey,
    token: opts.token,
    orgId: opts.org,
  });
  const client = new ApiClient(config, {
    verbose: opts.verbose,
    onTokenRefreshed: ({ accessToken, refreshToken }) => {
      setConfigValue("token", accessToken);
      setConfigValue("refreshToken", refreshToken);
    },
  });
  return { client, config };
}

// Get resolved output format for a command
export function getOutputFormat(cmd: Command): string {
  const opts = getGlobalOptions(cmd);
  const config = getConfig();
  return resolveOutputFormat(opts.output ?? config.output);
}

// Wrap action handler with error handling and output formatting
export function withErrorHandler(
  fn: (cmd: Command, ...args: unknown[]) => Promise<void>
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    try {
      // Commander passes the Command as last arg for action handlers
      const cmd = args[args.length - 1] as Command;
      await fn(cmd, ...args.slice(0, -1));
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(formatApiError(err));
      } else if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error("An unexpected error occurred");
      }
      process.exit(1);
    }
  };
}

// Shorthand: fetch data, format, print
export async function fetchAndPrint<T>(
  cmd: Command,
  fetcher: (client: ApiClient) => Promise<T>,
  columns?: TableColumnDef[]
): Promise<void> {
  const { client } = createClient(cmd);
  const format = getOutputFormat(cmd);
  const data = await fetcher(client);
  printOutput(data, format, columns);
}

// Run a mutating call that returns nothing meaningful; print a confirmation line.
export async function runAction(
  cmd: Command,
  action: (client: ApiClient) => Promise<unknown>,
  successMessage: string
): Promise<void> {
  const { client } = createClient(cmd);
  await action(client);
  console.log(successMessage);
}

// Parse a JSON string CLI option into an object, with a friendly error.
export function parseJsonOption(value: string | undefined, flagName: string): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON for ${flagName}: ${value}`);
  }
}

// Drop keys whose value is undefined so PATCH/PUT bodies only carry set fields.
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
