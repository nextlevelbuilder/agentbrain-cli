import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { setConfigValue, getConfigValue, listConfig } from "../config/config-manager.js";
import { DEFAULT_CONFIG } from "../config/config-schema.js";
import { printOutput } from "../formatters/output-formatter.js";
import { getOutputFormat } from "../utils/command-helpers.js";

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage CLI configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value (apiUrl, token, apiKey, orgId, output, timeout)")
    .action((key: string, value: string) => {
      try {
        setConfigValue(key, value);
        console.log(`Set ${key} successfully.`);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action((key: string) => {
      try {
        const value = getConfigValue(key);
        console.log(value);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    });

  config
    .command("init")
    .description("Interactive setup wizard (ideal for on-premise / enterprise deployments)")
    .action(async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        console.log("AgentBrain CLI Setup\n");
        console.log("For on-premise deployments, enter your internal API URL.");
        console.log("For cloud, press Enter to use the default.\n");

        const apiUrl = await rl.question(`API URL [${DEFAULT_CONFIG.apiUrl}]: `);
        if (apiUrl.trim()) setConfigValue("apiUrl", apiUrl.trim());

        console.log("\nAdmin/CMS commands authenticate with a bearer token (JWT).");
        const token = await rl.question("Bearer token (JWT): ");
        if (token.trim()) setConfigValue("token", token.trim());

        console.log("\nAPI key is only needed for MCP-surface commands (retrieve-context, connector query/execute).");
        const apiKey = await rl.question("API Key (optional): ");
        if (apiKey.trim()) setConfigValue("apiKey", apiKey.trim());

        const orgId = await rl.question("Default Organization ID (optional): ");
        if (orgId.trim()) setConfigValue("orgId", orgId.trim());

        console.log("\nConfiguration saved to ~/.agentbrain/config.json");
        console.log("Run `agentbrain config list` to verify.");
      } finally {
        rl.close();
      }
    });

  config
    .command("list")
    .description("List all resolved config values with sources")
    .action(function (this: Command) {
      const format = getOutputFormat(this);
      const items = listConfig();
      printOutput(items, format, [
        { key: "key", header: "Key" },
        { key: "value", header: "Value" },
        { key: "source", header: "Source" },
      ]);
    });
}
