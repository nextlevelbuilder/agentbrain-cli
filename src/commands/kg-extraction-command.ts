import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

// Registers `kg extraction ...` (run visibility) and `kg row-facts ...`
// (structured-row extraction pipeline).
// Covers GET /cms/kg/extractions/runs/active|/:id|cost-halt-recent and the
// row-fact source/generate/run/proposals/promote surface under
// /cms/knowledges/:id/kg/row-facts and /cms/kg/row-fact-runs/:id.
export function registerKgExtractionCommand(kg: Command): void {
  const extraction = kg.command("extraction").description("View KG extraction runs");

  extraction
    .command("runs-active")
    .description("List active (unfinished) extraction runs for the org")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/extractions/runs/active"));
    }));

  extraction
    .command("run <id>")
    .description("Get a single extraction run")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/extractions/runs/${id}`));
    }));

  extraction
    .command("cost-halt")
    .description("Check for recent cost-halt DLQ rows (banner state)")
    .option("--hours <n>", "Lookback window in hours (default 24)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/extractions/cost-halt-recent", compact({ hours: opts.hours })));
    }));

  const rowFacts = kg.command("row-facts").description("Manage the row-fact structured extraction pipeline");

  rowFacts
    .command("source <knowledgeId>")
    .description("Preview the row-fact source (columns, sample rows, recommendation)")
    .action(withErrorHandler(async (cmd, knowledgeId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/knowledges/${knowledgeId}/kg/row-facts/source`));
    }));

  rowFacts
    .command("generate <knowledgeId>")
    .description("Generate row-fact proposals for a knowledge base")
    .option("--data <json>", "Full GenerateRowFactsDTO body as JSON (overrides other flags)")
    .option("--entity-type-slug <slug>", "Row entity type slug")
    .option("--stable-key-column <col>", "Column that uniquely identifies each row")
    .option("--name-column <col>", "Column used as the entity name")
    .option("--description-columns <csv>", "Comma-separated columns to fold into description")
    .option("--relation-type-slug <slug>", "Optional relation type slug to link rows to a target entity")
    .option("--target-entity-type-slug <slug>", "Target entity type slug (required with --relation-type-slug)")
    .option("--target-stable-key-column <col>", "Target stable-key column (required with --relation-type-slug)")
    .option("--llm-enabled", "Enable LLM-assisted extraction")
    .option("--limit <n>", "Max rows to process", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd, knowledgeId) => {
      const opts = cmd.opts();
      const body = opts.data ? parseJsonOption(opts.data, "--data") : {
        mapping: compact({
          entityTypeSlug: opts.entityTypeSlug,
          stableKeyColumn: opts.stableKeyColumn,
          nameColumn: opts.nameColumn,
          descriptionColumns: opts.descriptionColumns ? String(opts.descriptionColumns).split(",").map((s: string) => s.trim()) : undefined,
          relationTypeSlug: opts.relationTypeSlug,
          targetEntityTypeSlug: opts.targetEntityTypeSlug,
          targetStableKeyColumn: opts.targetStableKeyColumn,
        }),
        llmEnabled: !!opts.llmEnabled,
        limit: opts.limit,
      };
      await fetchAndPrint(cmd, (c) => c.post(`/cms/knowledges/${knowledgeId}/kg/row-facts/runs`, body));
    }));

  rowFacts
    .command("run <runId>")
    .description("Get a row-fact run and its proposals")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/row-fact-runs/${runId}`));
    }));

  rowFacts
    .command("proposals <runId>")
    .description("Accept/reject row-fact proposals")
    .option("--accept-ids <json>", "JSON array of proposal UUIDs to accept")
    .option("--reject-ids <json>", "JSON array of proposal UUIDs to reject")
    .action(withErrorHandler(async (cmd, runId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/kg/row-fact-runs/${runId}/proposals`, compact({
        acceptIds: parseJsonOption(opts.acceptIds, "--accept-ids"),
        rejectIds: parseJsonOption(opts.rejectIds, "--reject-ids"),
      })));
    }));

  rowFacts
    .command("promote <runId>")
    .description("Promote accepted row-fact proposals into entities/relations")
    .option("--proposal-ids <json>", "JSON array of proposal UUIDs (all accepted if omitted)")
    .action(withErrorHandler(async (cmd, runId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/row-fact-runs/${runId}/promote`, compact({
        proposalIds: parseJsonOption(opts.proposalIds, "--proposal-ids"),
      })));
    }));
}
