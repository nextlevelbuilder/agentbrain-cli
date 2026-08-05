import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";
import { ConnectorSubtype } from "../types/api-types.js";

const SUBTYPE_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "type", header: "Type" },
  { key: "subtype", header: "Subtype" },
  { key: "status", header: "Status" },
];

export function registerConnectorSubtypeCommand(program: Command): void {
  const sub = program.command("connector-subtype").alias("cs").description("Manage connector subtypes");

  sub
    .command("list")
    .description("List all connector subtypes")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<ConnectorSubtype[]>(cmd, (c) => c.get("/cms/connector-subtypes"), SUBTYPE_COLUMNS);
    }));

  sub
    .command("get <id>")
    .description("Get connector subtype details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<ConnectorSubtype>(cmd, (c) => c.get(`/cms/connector-subtypes/${id}`));
    }));

  sub
    .command("create")
    .description("Create a connector subtype")
    .requiredOption("--name <name>", "Display name")
    .requiredOption("--type <type>", "Type")
    .requiredOption("--subtype <subtype>", "Subtype key")
    .option("--description <desc>", "Description")
    .option("--icon <icon>", "Icon")
    .option("--config-schema <json>", "Config JSON schema")
    .option("--config-ui-schema <json>", "Config UI JSON schema")
    .option("--sort-order <n>", "Sort order")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<ConnectorSubtype>(cmd, (c) => c.post("/cms/connector-subtypes", compact({
        name: opts.name,
        type: opts.type,
        subtype: opts.subtype,
        description: opts.description,
        icon: opts.icon,
        configSchema: opts.configSchema ? JSON.parse(opts.configSchema) : undefined,
        configUiSchema: opts.configUiSchema ? JSON.parse(opts.configUiSchema) : undefined,
        sortOrder: opts.sortOrder !== undefined ? Number(opts.sortOrder) : undefined,
      })));
    }));

  sub
    .command("update <id>")
    .description("Update a connector subtype")
    .option("--name <name>", "New display name")
    .option("--description <desc>", "New description")
    .option("--icon <icon>", "New icon")
    .option("--config-schema <json>", "New config JSON schema")
    .option("--config-ui-schema <json>", "New config UI JSON schema")
    .option("--sort-order <n>", "New sort order")
    .option("--status <status>", "New status")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<ConnectorSubtype>(cmd, (c) => c.put(`/cms/connector-subtypes/${id}`, compact({
        name: opts.name,
        description: opts.description,
        icon: opts.icon,
        configSchema: opts.configSchema ? JSON.parse(opts.configSchema) : undefined,
        configUiSchema: opts.configUiSchema ? JSON.parse(opts.configUiSchema) : undefined,
        sortOrder: opts.sortOrder !== undefined ? Number(opts.sortOrder) : undefined,
        status: opts.status,
      })));
    }));

  sub
    .command("delete <id>")
    .description("Delete a connector subtype")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/connector-subtypes/${id}`);
      console.log("Connector subtype deleted.");
    }));
}
