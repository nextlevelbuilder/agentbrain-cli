import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact } from "../utils/command-helpers.js";

// Parses a CLI "true"/"false" string option into a boolean.
function parseBool(value: string, flagName: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected "true" or "false" for ${flagName}, got: ${value}`);
}

// Backend: backend-go modules/costbudget — admin-only, per-org config row over
// org_llm_cost_budget. Routes: GET/PUT /cms/cost/budget, GET /cms/cost/budget/spend.
export function registerCostCommand(program: Command): void {
  const cost = program.command("cost").description("Manage the org's LLM cost budget and spend");
  const budget = cost.command("budget").description("Org monthly LLM cost budget config");

  budget
    .command("get")
    .description("Get the current cost budget config")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/cost/budget"));
    }));

  budget
    .command("set")
    .description("Replace the cost budget config (full replace, not merge — all fields required)")
    .requiredOption("--monthly-cap <usd>", "Monthly spend cap in USD (0 = unlimited)")
    .requiredOption("--alert-threshold <ratio>", "Alert threshold as a fraction of the cap, e.g. 0.8")
    .requiredOption("--enabled <bool>", "Enable budget enforcement (true|false)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put("/cms/cost/budget", {
        monthlyCapUsd: Number(o.monthlyCap),
        alertThreshold: Number(o.alertThreshold),
        enabled: parseBool(o.enabled, "--enabled"),
      }));
    }));

  budget
    .command("spend")
    .description("Get current-month spend total for a scope")
    .option("--scope <scope>", "all|chat|embedding|agent|knowledge|transcription", "all")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/cost/budget/spend", compact({ scope: o.scope }) as Record<string, string>));
    }));
}
