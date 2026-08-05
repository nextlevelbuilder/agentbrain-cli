import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

// Media processing-run jobs (single-asset transcribe/refine lifecycle) plus
// bulk-digest batch jobs. Backed by backend-go modules/media/module.go routes
// mounted under /cms/media/jobs/* and /cms/media/bulk/*.
export function registerMediaJobs(media: Command): void {
  const job = media.command("job").description("Manage media processing-run jobs");

  job
    .command("cancel <runId>")
    .description("Cancel a processing run (owner or org admin)")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/jobs/${runId}/cancel`));
    }));

  job
    .command("refine <runId>")
    .description("Enqueue a Pass-2 refine run from a completed transcription run")
    .option("--model-id <id>", "Override the refine model")
    .option("--step2-template-id <id>", "Override the Step2 (refine) prompt template")
    .action(withErrorHandler(async (cmd, runId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/jobs/${runId}/refine`, compact({
        modelId: o.modelId,
        step2TemplateId: o.step2TemplateId,
      })));
    }));

  job
    .command("ingest-kb <runId>")
    .description("On-demand ingest of a run's transcript into a knowledge base")
    .option("--target-knowledge-id <id>", "Attach to an existing knowledge base (currently unsupported by backend)")
    .action(withErrorHandler(async (cmd, runId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/jobs/${runId}/ingest-kb`, compact({
        targetKnowledgeId: o.targetKnowledgeId,
      })));
    }));

  job
    .command("asset-runs <assetId>")
    .description("List processing runs for a specific media asset")
    .option("--status <status>", "Filter by status: pending|processing|done|failed")
    .option("--limit <n>", "Max results")
    .option("--offset <n>", "Result offset")
    .action(withErrorHandler(async (cmd, assetId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/jobs/assets/${assetId}/runs`, compact({
        status: o.status,
        limit: o.limit,
        offset: o.offset,
      }) as Record<string, string>));
    }));

  job
    .command("llm-calls <runId>")
    .description("List per-call LLM cost breakdown for a processing run")
    .option("--limit <n>", "Max results (1-500, default 100)")
    .action(withErrorHandler(async (cmd, runId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/jobs/${runId}/llm-calls`, compact({
        limit: o.limit,
      }) as Record<string, string>));
    }));

  job
    .command("list")
    .description("List all processing runs org-wide (admin only)")
    .option("--status <status>", "Filter by status: pending|processing|done|failed")
    .option("--limit <n>", "Max results")
    .option("--offset <n>", "Result offset")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/media/jobs", compact({
        status: o.status,
        limit: o.limit,
        offset: o.offset,
      }) as Record<string, string>));
    }));

  job
    .command("replay <runId>")
    .description("Replay a failed (DLQ) processing run (admin only)")
    .action(withErrorHandler(async (cmd, runId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/jobs/${runId}/replay`));
    }));

  const bulk = media.command("bulk").description("Manage bulk-digest batch jobs");

  bulk
    .command("digest")
    .description("Enqueue a bulk-digest batch job for one or more media assets")
    .requiredOption("--items <json>", 'JSON array: [{"assetId":"...","options":{...},"priority":1}]')
    .option("--idempotency-key <key>", "Idempotency key (body fallback for clients that cannot set headers)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const items = parseJsonOption(o.items, "--items");
      await fetchAndPrint(cmd, (c) => c.post("/cms/media/bulk/digest", compact({
        items,
        idempotencyKey: o.idempotencyKey,
      })));
    }));

  bulk
    .command("jobs-active")
    .description("List active (queued or running) bulk-digest jobs for the org")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/media/bulk/jobs/active"));
    }));

  bulk
    .command("job <id>")
    .description("Get a bulk-digest job with its items")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/bulk/jobs/${id}`));
    }));

  bulk
    .command("item-retry <jobId> <itemId>")
    .description("Retry a failed bulk-digest job item")
    .action(withErrorHandler(async (cmd, jobId, itemId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/bulk/jobs/${jobId}/items/${itemId}/retry`));
    }));

  bulk
    .command("item-cancel <jobId> <itemId>")
    .description("Cancel a queued bulk-digest job item")
    .action(withErrorHandler(async (cmd, jobId, itemId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/bulk/jobs/${jobId}/items/${itemId}/cancel`));
    }));

  bulk
    .command("item-priority <jobId> <itemId>")
    .description("Update the queue priority of a queued bulk-digest job item")
    .requiredOption("--priority <n>", "Priority 1 (lowest) to 10000 (highest)")
    .action(withErrorHandler(async (cmd, jobId, itemId) => {
      const priority = Number(cmd.opts().priority);
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/media/bulk/jobs/${jobId}/items/${itemId}/priority`, { priority }));
    }));
}
