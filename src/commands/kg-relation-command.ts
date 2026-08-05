import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

// Registers `kg relation ...`. Covers POST /cms/kg/relations, DELETE /cms/kg/relations/:id.
export function registerKgRelationCommand(kg: Command): void {
  const relation = kg.command("relation").description("Manage knowledge graph relations (edges)");

  relation
    .command("create")
    .description("Create a KG relation between two entities")
    .requiredOption("--head-entity-id <id>", "Head entity UUID")
    .requiredOption("--tail-entity-id <id>", "Tail entity UUID")
    .requiredOption("--relation-kind <kind>", "Relation kind slug (max 100 chars)")
    .option("--weight <n>", "Relation weight (default 1.0)", (v) => parseFloat(v))
    .option("--confidence <n>", "Confidence 0..1", (v) => parseFloat(v))
    .option("--metadata <json>", "Free-form JSON metadata")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/kg/relations", compact({
        headEntityId: opts.headEntityId,
        tailEntityId: opts.tailEntityId,
        relationKind: opts.relationKind,
        weight: opts.weight,
        confidence: opts.confidence,
        metadata: parseJsonOption(opts.metadata, "--metadata"),
      })));
    }));

  relation
    .command("delete <id>")
    .description("Delete a KG relation")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/kg/relations/${id}`));
    }));
}
