import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

// Registers `kg admin quality ...` (report/issues), `kg admin quality action ...`,
// and `kg admin quality review-item ...`.
// Covers GET quality/report|issues, POST quality/actions/*, GET/POST
// quality/review-items(/:id/keep|dismiss|impact|delete-entity|reextract-sources).
export function registerKgAdminQualityCommand(admin: Command): void {
  const quality = admin.command("quality").description("Admin: KG quality report, issues, and remediation actions");

  quality
    .command("report")
    .description("Get the org-wide KG quality report")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/quality/report"));
    }));

  quality
    .command("issues")
    .description("List top KG quality issues")
    .option("--limit <n>", "Max rows (default 25)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/quality/issues", compact({ limit: opts.limit })));
    }));

  const action = quality.command("action").description("Run a quality remediation action");

  action
    .command("replay-missing-kb")
    .description("Replay extraction for knowledge bases missing KG output")
    .option("--knowledge-ids <json>", "JSON array of knowledge base UUIDs")
    .option("--all", "Target all eligible knowledge bases")
    .option("--max-items <n>", "Cap the number of knowledge bases processed", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/quality/actions/replay-missing-kb", compact({
        knowledgeIds: opts.knowledgeIds ? parseJsonOption(opts.knowledgeIds, "--knowledge-ids") : undefined,
        all: opts.all ? true : undefined,
        maxItems: opts.maxItems,
      })));
    }));

  action
    .command("generate-dedup-candidates")
    .description("Generate dedup candidates for a similarity bucket")
    .option("--bucket <bucket>", "Similarity bucket")
    .option("--limit <n>", "Max candidates to generate", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/quality/actions/generate-dedup-candidates", compact({
        bucket: opts.bucket,
        limit: opts.limit,
      })));
    }));

  action
    .command("generate-review-items")
    .description("Materialize actionable quality review-items for an issue key")
    .option("--issue-key <key>", "noise.entity_candidates | graph.isolated_entities")
    .option("--limit <n>", "Max items to generate", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/admin/quality/actions/generate-review-items", compact({
        issueKey: opts.issueKey,
        limit: opts.limit,
      })));
    }));

  const reviewItem = quality.command("review-item").description("Review and resolve quality review-items");

  reviewItem
    .command("list")
    .description("List quality review-items")
    .option("--limit <n>", "Page size (default 50)")
    .option("--offset <n>", "Page offset")
    .option("--issue-key <key>", "noise.entity_candidates | graph.isolated_entities")
    .option("--status <status>", "pending|kept|dismissed|resolved|deleted|all")
    .option("--reason-code <code>", "Filter by reason code")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/quality/review-items", compact({
        limit: opts.limit,
        offset: opts.offset,
        issueKey: opts.issueKey,
        status: opts.status,
        reasonCode: opts.reasonCode,
      })));
    }));

  reviewItem
    .command("keep <id>")
    .description("Keep a review-item (mark reviewed, no mutation)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/quality/review-items/${id}/keep`));
    }));

  reviewItem
    .command("dismiss <id>")
    .description("Dismiss a review-item (mark reviewed, no mutation)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/quality/review-items/${id}/dismiss`));
    }));

  reviewItem
    .command("impact <id>")
    .description("Preview the impact of deleting a review-item's entity")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/admin/quality/review-items/${id}/impact`));
    }));

  reviewItem
    .command("delete-entity <id>")
    .description("Delete the entity behind a review-item (requires impact delete token)")
    .requiredOption("--delete-token <token>", "Token returned by `review-item impact`")
    .requiredOption("--confirm-name <name>", "Entity name, typed to confirm destructive delete")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/quality/review-items/${id}/delete-entity`, {
        deleteToken: opts.deleteToken,
        confirmName: opts.confirmName,
      }));
    }));

  reviewItem
    .command("reextract-sources <id>")
    .description("Re-trigger extraction for the sources behind a review-item")
    .option("--max-items <n>", "Cap the number of sources re-extracted", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/quality/review-items/${id}/reextract-sources`, compact({
        maxItems: opts.maxItems,
      })));
    }));
}
