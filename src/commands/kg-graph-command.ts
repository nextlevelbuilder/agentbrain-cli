import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact } from "../utils/command-helpers.js";

// Registers `kg graph ...` read-side canvas endpoints.
// Covers GET /cms/kg/graph/summary|top|community/:id|neighbors/:entityId.
export function registerKgGraphCommand(kg: Command): void {
  const graph = kg.command("graph").description("Read the knowledge graph canvas (summary, top, community, neighbors)");

  graph
    .command("summary")
    .description("Get the org-wide meta-graph (communities as super-nodes)")
    .option("--scope <scope>", "Graph scope (enterprise default; admin-only for non-enterprise/all)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/graph/summary", compact({ scope: opts.scope })));
    }));

  graph
    .command("top")
    .description("Get the top-N-by-centrality canvas payload")
    .option("--cap <n>", "Max nodes to return (alias: --limit)")
    .option("--limit <n>", "Alias for --cap")
    .option("--knowledge-id <id>", "Scope to a single knowledge base")
    .option("--include-orphaned", "Include orphaned entities (admin-only)")
    .option("--scope <scope>", "Graph scope (enterprise default; admin-only for non-enterprise/all)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/graph/top", compact({
        cap: opts.cap,
        limit: opts.limit,
        knowledgeId: opts.knowledgeId,
        includeOrphan: opts.includeOrphaned ? "true" : undefined,
        scope: opts.scope,
      })));
    }));

  graph
    .command("community <id>")
    .description("Get the per-community drill-down subgraph")
    .option("--include-orphaned", "Include orphaned entities (admin-only)")
    .option("--scope <scope>", "Graph scope (enterprise default; admin-only for non-enterprise/all)")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/graph/community/${id}`, compact({
        includeOrphan: opts.includeOrphaned ? "true" : undefined,
        scope: opts.scope,
      })));
    }));

  graph
    .command("neighbors <entityId>")
    .description("Get the BFS ego-graph from a seed entity")
    .option("--depth <n>", "BFS depth")
    .option("--limit <n>", "Max nodes")
    .option("--include-orphaned", "Include orphaned entities (admin-only)")
    .option("--scope <scope>", "Graph scope (enterprise default; admin-only for non-enterprise/all)")
    .action(withErrorHandler(async (cmd, entityId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/graph/neighbors/${entityId}`, compact({
        depth: opts.depth,
        limit: opts.limit,
        includeOrphan: opts.includeOrphaned ? "true" : undefined,
        scope: opts.scope,
      })));
    }));
}
