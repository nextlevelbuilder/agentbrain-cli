import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact } from "../utils/command-helpers.js";

// Backend: backend-go modules/dashboard. Routes:
//   GET /cms/dashboard/summary
//   GET /cms/dashboard/trend?range=7d|30d|90d&metric=entities|cost|runs
//   GET /cms/dashboard/media-kg-stats?days=1..30
export function registerDashboardCommand(program: Command): void {
  const dashboard = program.command("dashboard").description("View org dashboard summary, trends, and media/KG pipeline stats");

  dashboard
    .command("summary")
    .description("Get dashboard summary (entity counts, audit count 24h, cost MTD, workflow run stats)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/dashboard/summary"));
    }));

  dashboard
    .command("trend")
    .description("Get a dashboard trend series")
    .requiredOption("--range <range>", "Time range: 7d|30d|90d")
    .requiredOption("--metric <metric>", "Metric: entities|cost|runs")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/dashboard/trend", { range: o.range, metric: o.metric }));
    }));

  dashboard
    .command("media-kg-stats")
    .description("Get media + knowledge graph pipeline stats (bulk jobs, KG entities, DLQ failures, pipeline success rate)")
    .option("--days <n>", "Window size in days (1-30)", "7")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/dashboard/media-kg-stats", compact({ days: o.days }) as Record<string, string>));
    }));
}
