import { describe, it, expect } from "vitest";
import { buildProgram } from "./program.js";

// Guards the "CLI covers every AgentBrain domain" contract: if a command group
// is dropped from registration, this fails loudly. Update the list only when a
// group is intentionally added/removed.
const EXPECTED_GROUPS = [
  // existing
  "config", "auth", "org", "connector", "connector-subtype", "knowledge", "workflow",
  "search", "query-log", "permission-group", "permission", "verify-permission",
  "category", "tag",
  // parity additions
  "folder", "media", "kg", "checkpoint", "retrieve-context", "ai-policy",
  "governance", "readiness", "llm", "prompt", "cost", "usage", "dashboard",
  "audit", "me", "user", "system",
];

describe("CLI command registration", () => {
  const program = buildProgram();
  const names = program.commands.map((c) => c.name());

  it("registers every expected top-level command group", () => {
    for (const g of EXPECTED_GROUPS) {
      expect(names, `missing command group: ${g}`).toContain(g);
    }
  });

  it("has no duplicate command groups", () => {
    const seen = new Set<string>();
    const dupes = names.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    expect(dupes).toEqual([]);
  });
});

describe("dangerous mutations are gated", () => {
  const program = buildProgram();
  const connector = program.commands.find((c) => c.name() === "connector");

  it("connector execute requires an explicit --yes confirmation flag", () => {
    const execute = connector?.commands.find((c) => c.name() === "execute");
    expect(execute, "connector execute command should exist").toBeTruthy();
    const hasYes = execute!.options.some((o) => o.long === "--yes");
    expect(hasYes, "connector execute must expose a --yes gate").toBe(true);
  });
});
