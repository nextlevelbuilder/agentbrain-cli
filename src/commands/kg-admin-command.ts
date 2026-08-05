import { Command } from "commander";
import { registerKgAdminExtractionCommand } from "./kg-admin-extraction-command.js";
import { registerKgAdminQualityCommand } from "./kg-admin-quality-command.js";
import { registerKgAdminGovernanceCommand } from "./kg-admin-governance-command.js";

// Registers `kg admin ...` — the admin-only governance/ops surface under
// /cms/kg/admin. Fans out to focused sub-registrars so each file stays small.
export function registerKgAdminCommand(kg: Command): void {
  const admin = kg.command("admin").description("KG admin: analyzer, quality, extraction ops, dedup, governance");

  registerKgAdminExtractionCommand(admin);
  registerKgAdminQualityCommand(admin);
  registerKgAdminGovernanceCommand(admin);
}
