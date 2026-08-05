import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, getOutputFormat, compact } from "../utils/command-helpers.js";
import { printOutput } from "../formatters/output-formatter.js";
import { Connector, ConnectorShare } from "../types/api-types.js";

const CONNECTOR_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "type", header: "Type" },
  { key: "subtype", header: "Subtype" },
  { key: "status", header: "Status" },
];

export function registerConnectorCommand(program: Command): void {
  const conn = program.command("connector").description("Manage data source connectors");

  conn
    .command("list")
    .description("List all connectors")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Connector[]>(cmd, (c) => c.get("/cms/connectors"), CONNECTOR_COLUMNS);
    }));

  conn
    .command("my")
    .description("List connectors accessible to me")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Connector[]>(cmd, (c) => c.get("/cms/my-connectors"), CONNECTOR_COLUMNS);
    }));

  conn
    .command("get <id>")
    .description("Get connector details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Connector>(cmd, (c) => c.get(`/cms/connectors/${id}`));
    }));

  conn
    .command("create")
    .description("Create a new connector")
    .requiredOption("--name <name>", "Connector name")
    .requiredOption("--type <type>", "Connector type (credential|endpoint|secret_key)")
    .requiredOption("--subtype <subtype>", "Connector subtype (postgresql|mysql|mongodb|etc.)")
    .option("--config <json>", "Connector config as JSON string")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const config = opts.config ? JSON.parse(opts.config) : {};
      await fetchAndPrint<Connector>(cmd, (c) => c.post("/cms/connectors", {
        name: opts.name,
        type: opts.type,
        subtype: opts.subtype,
        config,
      }));
    }));

  conn
    .command("update <id>")
    .description("Update a connector")
    .option("--name <name>", "New name")
    .option("--config <json>", "Updated config as JSON string")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      const body: Record<string, unknown> = {};
      if (opts.name) body.name = opts.name;
      if (opts.config) body.config = JSON.parse(opts.config);
      await fetchAndPrint<Connector>(cmd, (c) => c.put(`/cms/connectors/${id}`, body));
    }));

  conn
    .command("delete <id>")
    .description("Delete a connector")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/connectors/${id}`);
      console.log("Connector deleted.");
    }));

  conn
    .command("test <id>")
    .description("Test connector connectivity")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/connectors/${id}/test`));
    }));

  conn
    .command("test-config")
    .description("Test config before creating connector")
    .requiredOption("--type <type>", "Connector type")
    .requiredOption("--subtype <subtype>", "Connector subtype")
    .requiredOption("--config <json>", "Config as JSON string")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/connectors/test-config", {
        type: opts.type,
        subtype: opts.subtype,
        config: JSON.parse(opts.config),
      }));
    }));

  conn
    .command("databases <id>")
    .description("List databases in a connector")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/databases`));
    }));

  conn
    .command("schemas <id>")
    .description("List schemas in a connector")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/schemas`));
    }));

  conn
    .command("tables <id>")
    .description("List tables in a connector")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/tables`));
    }));

  conn
    .command("columns <connectorId> <tableName>")
    .description("Get columns for a table")
    .action(withErrorHandler(async (cmd, connectorId, tableName) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${connectorId}/tables/${tableName}/columns`), [
        { key: "name", header: "Column" },
        { key: "type", header: "Type" },
        { key: "nullable", header: "Nullable" },
      ]);
    }));

  conn
    .command("data <connectorId> <tableName>")
    .description("Preview data from a table")
    .option("--limit <n>", "Row limit", "10")
    .action(withErrorHandler(async (cmd, connectorId, tableName) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${connectorId}/tables/${tableName}/data`, {
        limit: opts.limit,
      }));
    }));

  conn
    .command("counts")
    .description("Count total connectors")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/connectors/counts"));
    }));

  // Sharing subcommands
  const share = conn.command("share").description("Manage connector sharing");

  share
    .command("list <connectorId>")
    .description("List shares for a connector")
    .action(withErrorHandler(async (cmd, connectorId) => {
      await fetchAndPrint<ConnectorShare[]>(cmd, (c) => c.get(`/cms/connectors/${connectorId}/shares`));
    }));

  share
    .command("create <connectorId>")
    .description("Share connector with a user")
    .requiredOption("--user-id <userId>", "User to share with")
    .requiredOption("--permission <permission>", "Permission level (read|write|admin)")
    .action(withErrorHandler(async (cmd, connectorId) => {
      const opts = cmd.opts();
      await fetchAndPrint<ConnectorShare>(cmd, (c) => c.post(`/cms/connectors/${connectorId}/shares`, {
        userId: opts.userId,
        permission: opts.permission,
      }));
    }));

  share
    .command("delete <connectorId> <userId>")
    .description("Remove a connector share (userId is the shared-with user's ID)")
    .action(withErrorHandler(async (cmd, connectorId, userId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/connectors/${connectorId}/shares/${userId}`);
      console.log("Share removed.");
    }));

  share
    .command("update <connectorId> <userId>")
    .description("Update a connector share's permission")
    .requiredOption("--permission <permission>", "Permission level")
    .action(withErrorHandler(async (cmd, connectorId, userId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put(`/cms/connectors/${connectorId}/shares/${userId}`, {
        permission: opts.permission,
      }));
    }));

  // Google Sheets OAuth + browsing subcommands
  // Note: the OAuth callback (GET /cms/connectors/google-sheets/oauth/callback) is a
  // browser redirect target hit by Google after user consent — it is not a meaningful
  // CLI command and is intentionally not implemented here.
  const sheets = conn.command("sheets").description("Manage Google Sheets connector OAuth and browsing");

  sheets
    .command("oauth-start <id>")
    .description("Start Google Sheets OAuth flow for a connector (open the returned URL in a browser)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/connectors/google-sheets/oauth/start", { connectorId: String(id) }));
    }));

  sheets
    .command("oauth-revoke <id>")
    .description("Revoke Google Sheets OAuth tokens for a connector")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/connectors/${id}/google-sheets/oauth/revoke`));
    }));

  sheets
    .command("tabs <id> <spreadsheetId>")
    .description("List tabs in a Google Sheets spreadsheet")
    .action(withErrorHandler(async (cmd, id, spreadsheetId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/sheets/spreadsheets/${spreadsheetId}/tabs`));
    }));

  sheets
    .command("values <id> <spreadsheetId>")
    .description("Preview values from a Google Sheets range")
    .option("--sheet <sheet>", "Sheet/tab name")
    .option("--range <range>", "Cell range (e.g. A1:C10)")
    .action(withErrorHandler(async (cmd, id, spreadsheetId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/sheets/spreadsheets/${spreadsheetId}/values`, compact({
        sheet: opts.sheet,
        range: opts.range,
      })));
    }));

  // Redis browsing subcommands
  const redis = conn.command("redis").description("Browse Redis connector keys and values");

  redis
    .command("keys <id>")
    .description("Scan Redis keys")
    .option("--pattern <pattern>", "Key match pattern")
    .option("--cursor <cursor>", "Scan cursor")
    .option("--count <n>", "Scan count hint")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/redis/keys`, compact({
        pattern: opts.pattern,
        cursor: opts.cursor,
        count: opts.count,
      })));
    }));

  redis
    .command("value <id>")
    .description("Preview a Redis key's value")
    .requiredOption("--key <key>", "Redis key")
    .option("--byte-limit <n>", "Max bytes to preview")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/connectors/${id}/redis/value`, compact({
        key: opts.key,
        byteLimit: opts.byteLimit,
      })));
    }));

  // DB query/execute — MCP surface (X-API-Key credential, auto-selected for /mcp paths)
  conn
    .command("query <id>")
    .description("Run a read-only SQL query against a connector (MCP surface)")
    .requiredOption("--sql <sql>", "SQL SELECT statement")
    .option("--database <database>", "Target database name")
    .option("--limit <n>", "Row limit (max 5000, default 1000)")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/mcp/connectors/${id}/query`, compact({
        sql: opts.sql,
        database: opts.database,
        limit: opts.limit ? Number(opts.limit) : undefined,
      })));
    }));

  conn
    .command("execute <id>")
    .description("Execute a write SQL statement against a connector (MCP surface) — DESTRUCTIVE, requires --yes")
    .requiredOption("--sql <sql>", "SQL statement to execute")
    .option("--database <database>", "Target database name")
    .option("--yes", "Confirm you intend to run this write/mutating statement", false)
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      if (!opts.yes) {
        console.error(
          "Refusing to run a write SQL statement without confirmation.\n" +
          "This mutates data. Re-run with --yes to proceed."
        );
        process.exit(1);
      }
      await fetchAndPrint(cmd, (c) => c.post(`/mcp/connectors/${id}/execute`, compact({
        sql: opts.sql,
        database: opts.database,
      })));
    }));
}
