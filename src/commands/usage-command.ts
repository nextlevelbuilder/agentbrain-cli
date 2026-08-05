import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact } from "../utils/command-helpers.js";

const USAGE_LOG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "callType", header: "Call Type" },
  { key: "providerName", header: "Provider" },
  { key: "modelName", header: "Model" },
  { key: "costUsd", header: "Cost USD" },
  { key: "status", header: "Status" },
  { key: "createdAt", header: "Created" },
];

const TOP_MODEL_COLUMNS = [
  { key: "rank", header: "Rank" },
  { key: "provider", header: "Provider" },
  { key: "model", header: "Model" },
  { key: "costUsd", header: "Cost USD" },
  { key: "calls", header: "Calls" },
];

const USE_CASE_COLUMNS = [
  { key: "useCase", header: "Use Case" },
  { key: "costUsd", header: "Cost USD" },
  { key: "pct", header: "Pct" },
];

// Shared query filters for every usage-metrics/usage-logs/resource-activity
// endpoint (backend-go modules/aiconfig/controller/usage_metrics.api.go bindFilter).
function addUsageFilterOptions(cmd: Command): Command {
  return cmd
    .option("--provider <name>", "Filter by provider name")
    .option("--model <name>", "Filter by model name")
    .option(
      "--use-case <csv>",
      "Filter by use case(s), comma-separated: embedding,chat,vision,transcription,transcription_refine,transcribe,tool_use,extract_kg,image_gen,video_gen,tts"
    )
    .option("--status <status>", "Filter by call status")
    .option("--source-entity-type <type>", "Filter by source entity type")
    .option("--source-entity-id <uuid>", "Filter by source entity ID")
    .option("--from <date>", "Start date (YYYY-MM-DD or RFC3339)")
    .option("--to <date>", "End date (YYYY-MM-DD or RFC3339, inclusive)");
}

// Maps the shared filter option values to backend-go's expected query param names.
function usageFilterParams(o: Record<string, string | undefined>): Record<string, string> {
  return compact({
    provider: o.provider,
    model: o.model,
    use_case: o.useCase,
    status: o.status,
    sourceEntityType: o.sourceEntityType,
    sourceEntityId: o.sourceEntityId,
    from: o.from,
    to: o.to,
  }) as Record<string, string>;
}

// Backend: backend-go modules/aiconfig — usage-metrics/usage-logs/resource-activity
// routes, all admin-only except resource-activity/usage-logs (resource-scoped read).
// Routes:
//   GET /cms/usage-metrics/{summary,trend,by-use-case,top-models}
//   GET /cms/usage-logs[?cursor&limit]   GET /cms/usage-logs/:id
//   GET /cms/resource-activity/usage-logs (same filters, resource-permission gated)
export function registerUsageCommand(program: Command): void {
  const usage = program.command("usage").description("View LLM usage metrics, call logs, and resource-scoped activity");

  const metrics = usage.command("metrics").description("Aggregated usage metrics");

  addUsageFilterOptions(metrics.command("summary").description("Get usage summary (cost, calls, tokens, latency, prev-period delta)"))
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/usage-metrics/summary", usageFilterParams(cmd.opts())));
    }));

  addUsageFilterOptions(metrics.command("trend").description("Get usage cost trend over time, broken down by call type"))
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/usage-metrics/trend", usageFilterParams(cmd.opts())));
    }));

  addUsageFilterOptions(metrics.command("by-use-case").description("Get usage cost breakdown by use case"))
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/usage-metrics/by-use-case", usageFilterParams(cmd.opts())), USE_CASE_COLUMNS);
    }));

  addUsageFilterOptions(metrics.command("top-models").description("Get top models ranked by cost"))
    .option("--limit <n>", "Max results", "10")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(
        cmd,
        (c) => c.get("/cms/usage-metrics/top-models", compact({ ...usageFilterParams(o), limit: o.limit }) as Record<string, string>),
        TOP_MODEL_COLUMNS
      );
    }));

  const logs = usage.command("logs").description("LLM call logs");

  addUsageFilterOptions(logs.command("list").description("List LLM call logs (cursor-paginated)"))
    .option("--cursor <token>", "Pagination cursor from a previous page's nextCursor")
    .option("--limit <n>", "Max results per page", "50")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(
        cmd,
        (c) => c.get("/cms/usage-logs", compact({ ...usageFilterParams(o), cursor: o.cursor, limit: o.limit }) as Record<string, string>),
        USAGE_LOG_COLUMNS
      );
    }));

  logs
    .command("get <id>")
    .description("Get a single LLM call log by ID")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/usage-logs/${id}`));
    }));

  const resourceActivity = usage.command("resource-activity").description("Resource-scoped usage activity (member-readable)");

  addUsageFilterOptions(resourceActivity.command("list").description("List usage logs scoped to a source entity (uses --source-entity-type/--source-entity-id)"))
    .option("--cursor <token>", "Pagination cursor from a previous page's nextCursor")
    .option("--limit <n>", "Max results per page", "50")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(
        cmd,
        (c) => c.get("/cms/resource-activity/usage-logs", compact({ ...usageFilterParams(o), cursor: o.cursor, limit: o.limit }) as Record<string, string>),
        USAGE_LOG_COLUMNS
      );
    }));
}
