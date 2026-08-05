import { Command } from "commander";
import { registerKgEntityCommand } from "./kg-entity-command.js";
import { registerKgRelationCommand } from "./kg-relation-command.js";
import { registerKgTaxonomyCommand } from "./kg-taxonomy-command.js";
import { registerKgGraphCommand } from "./kg-graph-command.js";
import { registerKgExtractionCommand } from "./kg-extraction-command.js";
import { registerKgAdminCommand } from "./kg-admin-command.js";

// Registers the `kg` command group: knowledge graph entities, relations,
// taxonomy catalogs, canvas graph reads, extraction/row-facts, and the
// admin-only governance surface (`kg admin ...`). Each concern is fanned out
// to a focused sub-registrar file (see src/commands/kg-*.ts) so no single
// file exceeds ~250 lines.
export function registerKgCommand(program: Command): void {
  const kg = program.command("kg").description("Manage the knowledge graph (entities, relations, extraction, admin governance)");

  registerKgEntityCommand(kg);
  registerKgRelationCommand(kg);
  registerKgTaxonomyCommand(kg);
  registerKgGraphCommand(kg);
  registerKgExtractionCommand(kg);
  registerKgAdminCommand(kg);
}
