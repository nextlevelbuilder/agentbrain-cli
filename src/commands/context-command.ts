import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact } from "../utils/command-helpers.js";

// Retrieval-augmented context lookup for MCP agents. Backed by
// backend-go modules/lookup — POST /v1/mcp/retrieve-context (X-API-Key auth,
// dual-mounted alongside /v1/cms/lookup/retrieve-context for CMS callers).
// Body field names mirror lookupdtos.RetrieveContextRequestDTO json tags:
// question, mode, limit, includeGraph, includeCitations.
export function registerContextCommand(program: Command): void {
  program
    .command("retrieve-context")
    .description("Retrieve knowledge-base + knowledge-graph context for a question (MCP surface)")
    .requiredOption("--question <question>", "Natural-language question to retrieve context for")
    .option("--mode <mode>", "Retrieval mode: auto | kb | kg | mixed", "auto")
    .option("--limit <n>", "Max results to return (1-100)")
    .option("--include-graph <bool>", "Include knowledge-graph context (true|false, default true)")
    .option("--include-citations <bool>", "Include source citations (true|false, default true)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/mcp/retrieve-context", compact({
        question: o.question,
        mode: o.mode,
        limit: o.limit !== undefined ? Number(o.limit) : undefined,
        includeGraph: parseBoolOption(o.includeGraph, "--include-graph"),
        includeCitations: parseBoolOption(o.includeCitations, "--include-citations"),
      })));
    }));
}

// Parses a CLI "true"/"false" string option into a boolean, leaving
// undefined untouched so compact() drops unset flags from the request body.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected "true" or "false" for ${flagName}, got: ${value}`);
}
