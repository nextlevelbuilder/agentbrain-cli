import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

const ENTITY_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "kind", header: "Kind" },
  { key: "name", header: "Name" },
];

// Registers `kg entity ...`, `kg entities-by-knowledge`, and `kg entities-batch-read`.
// Covers: POST/GET /cms/kg/entities, GET/PATCH/DELETE /cms/kg/entities/:id,
// GET .../detail|provenance|audit-history, GET /cms/kg/entities/by-knowledge,
// POST /cms/kg/entities/batch-read.
export function registerKgEntityCommand(kg: Command): void {
  const entity = kg.command("entity").description("Manage knowledge graph entities");

  entity
    .command("create")
    .description("Create a KG entity")
    .requiredOption("--kind <kind>", "Entity kind (max 50 chars)")
    .requiredOption("--name <name>", "Entity name (max 500 chars)")
    .option("--description <text>", "Entity description (max 5000 chars)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/entities", compact({
        kind: opts.kind,
        name: opts.name,
        description: opts.description,
      })));
    }));

  entity
    .command("list")
    .description("List KG entities")
    .option("--kind <kind>", "Filter by kind")
    .option("--include-orphan", "Include orphaned entities (default excluded)")
    .option("--q <query>", "ILIKE name search")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .option("--order <order>", "Sort order")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/entities", compact({
        kind: opts.kind,
        includeOrphan: opts.includeOrphan ? "true" : undefined,
        q: opts.q,
        page: opts.page,
        limit: opts.limit,
        order: opts.order,
        cursor: opts.cursor,
      })), ENTITY_COLUMNS);
    }));

  entity
    .command("get <id>")
    .description("Get a KG entity")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/entities/${id}`));
    }));

  entity
    .command("update <id>")
    .description("Update a KG entity")
    .option("--kind <kind>", "New kind")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/kg/entities/${id}`, compact({
        kind: opts.kind,
        name: opts.name,
        description: opts.description,
      })));
    }));

  entity
    .command("delete <id>")
    .description("Delete a KG entity")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/kg/entities/${id}`));
    }));

  entity
    .command("detail <id>")
    .description("Get canvas drill-down detail for an entity (member-accessible)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/entities/${id}/detail`));
    }));

  entity
    .command("provenance <id>")
    .description("Get entity provenance (created-by, extraction method, source count)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/entities/${id}/provenance`));
    }));

  entity
    .command("audit-history <id>")
    .description("Get per-field audit history for an entity")
    .option("--field <field>", "Filter to a single entity field")
    .option("--limit <n>", "Max audit_log rows (default 20, max 100)")
    .option("--cursor <cursor>", "Opaque offset cursor")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/entities/${id}/audit-history`, compact({
        field: opts.field,
        limit: opts.limit,
        cursor: opts.cursor,
      })));
    }));

  kg
    .command("entities-by-knowledge")
    .description("List source entities for a knowledge base")
    .requiredOption("--knowledge-id <id>", "Knowledge base ID")
    .option("--q <query>", "Name search")
    .option("--kind <kind>", "Filter by kind")
    .option("--limit <n>", "Max results")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/entities/by-knowledge", compact({
        knowledgeId: opts.knowledgeId,
        q: opts.q,
        kind: opts.kind,
        limit: opts.limit,
      })));
    }));

  kg
    .command("entities-batch-read")
    .description("Batch-read entities by ID")
    .requiredOption("--ids <json>", "JSON array of entity UUIDs, e.g. '[\"id1\",\"id2\"]'")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const ids = parseJsonOption(opts.ids, "--ids");
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/entities/batch-read", { ids }));
    }));
}
