import { Command } from "commander";
import { withErrorHandler, fetchAndPrint } from "../utils/command-helpers.js";
import { QueryLog } from "../types/api-types.js";

const LOG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "userId", header: "User" },
  { key: "sqlQuery", header: "Query", transform: (v: unknown) => String(v).slice(0, 60) },
  { key: "executionTimeMs", header: "Time (ms)" },
  { key: "status", header: "Status" },
];

export function registerQueryLogCommand(program: Command): void {
  const ql = program.command("query-log").alias("ql").description("View query execution logs");

  ql
    .command("list")
    .description("List query logs")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<QueryLog[]>(cmd, (c) => c.get("/cms/query-logs"), LOG_COLUMNS);
    }));

  ql
    .command("get <id>")
    .description("Get query log details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<QueryLog>(cmd, (c) => c.get(`/cms/query-logs/${id}`));
    }));
}
