import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, runAction, compact, parseJsonOption } from "../utils/command-helpers.js";

// Registers `kg admin graph ...`, `kg admin extraction ...`, and
// `kg admin row-filter ...`.
// Covers: POST graph/analyze, GET graph/analyzer/status, GET graph/runs,
// POST extractions/replay, POST/GET extractions/batches(/:id),
// GET/GET/POST extractions/dlq(/:id, /:id/retry), POST row-filter/preview.
export function registerKgAdminExtractionCommand(admin: Command): void {
  const graph = admin.command("graph").description("Admin: Louvain analyzer control and history");

  graph
    .command("analyze")
    .description("Force-enqueue a Louvain community-detection run for the org")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/graph/analyze"));
    }));

  graph
    .command("analyzer-status")
    .description("Get the analyzer freshness status for the org")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/graph/analyzer/status"));
    }));

  graph
    .command("runs")
    .description("List recent Louvain analyzer runs")
    .option("--limit <n>", "Max rows to return")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/graph/runs", compact({ limit: opts.limit })));
    }));

  const extraction = admin.command("extraction").description("Admin: force-replay extraction, batches, DLQ");

  extraction
    .command("replay")
    .description("Force-replay extraction for a knowledge base, bypassing rate/cost gates")
    .requiredOption("--knowledge-id <id>", "Knowledge base UUID")
    .option("--kg-profile <profile>", "Prompt/model profile override")
    .option("--prompt-template-id <id>", "Prompt template UUID override")
    .option("--model-id <id>", "Model UUID override")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/extractions/replay", compact({
        knowledgeId: opts.knowledgeId,
        kgProfile: opts.kgProfile,
        promptTemplateId: opts.promptTemplateId,
        modelId: opts.modelId,
      })));
    }));

  const batch = extraction.command("batch").description("Batch-replay extraction across multiple knowledge bases");

  batch
    .command("create")
    .description("Start a batch replay job")
    .requiredOption("--knowledge-ids <json>", "JSON array of knowledge base UUIDs")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/extractions/batches", {
        knowledgeIds: parseJsonOption(opts.knowledgeIds, "--knowledge-ids"),
      }));
    }));

  batch
    .command("get <id>")
    .description("Get batch replay progress")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/admin/extractions/batches/${id}`));
    }));

  const dlq = extraction.command("dlq").description("Manage extraction dead-letter queue rows");

  dlq
    .command("list")
    .description("List DLQ rows")
    .option("--limit <n>", "Max rows (1-100, default 25)")
    .option("--error-class <csv>", "Comma-separated error class filter")
    .option("--since <rfc3339>", "Only rows created at/after this timestamp")
    .option("--until <rfc3339>", "Only rows created at/before this timestamp")
    .option("--knowledge-id <id>", "Filter by knowledge base UUID")
    .option("--cursor <cursor>", "Opaque pagination cursor")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/extractions/dlq", compact({
        limit: opts.limit,
        error_class: opts.errorClass,
        since: opts.since,
        until: opts.until,
        knowledge_id: opts.knowledgeId,
        cursor: opts.cursor,
      })));
    }));

  dlq
    .command("get <id>")
    .description("Get full DLQ row detail (includes raw markdown; sensitive read)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/admin/extractions/dlq/${id}`));
    }));

  dlq
    .command("retry <id>")
    .description("Retry a failed extraction from its DLQ row")
    .action(withErrorHandler(async (cmd, id) => {
      await runAction(cmd, (c) => c.post(`/cms/kg/admin/extractions/dlq/${id}/retry`), "Retry enqueued.");
    }));

  const rowFilter = admin.command("row-filter").description("Admin: row-filter template dry-run preview");

  rowFilter
    .command("preview")
    .description("Preview a row-filter template's match count before saving it on a grant")
    .requiredOption("--template <expr>", "Row-filter template expression")
    .option("--resource-type <type>", "Resource type (default kg_entity)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/row-filter/preview", compact({
        template: opts.template,
        resourceType: opts.resourceType,
      })));
    }));
}
