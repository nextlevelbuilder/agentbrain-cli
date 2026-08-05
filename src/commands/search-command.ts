import { Command } from "commander";
import { withErrorHandler, fetchAndPrint } from "../utils/command-helpers.js";

export function registerSearchCommand(program: Command): void {
  program
    .command("search")
    .description("Batch search across all entities")
    .requiredOption("--query <query>", "Search query string")
    .option("--types <types>", "Comma-separated entity types to search")
    .option("--limit <n>", "Max results per type", "10")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/search", {
        query: opts.query,
        types: opts.types?.split(","),
        limit: parseInt(opts.limit, 10),
      }));
    }));
}
