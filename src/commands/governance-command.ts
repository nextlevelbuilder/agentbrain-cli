import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, runAction, compact, parseJsonOption } from "../utils/command-helpers.js";

// AI Governance: effective-policy resolution (MCP surface, API-key auth) plus
// the full admin surface (CMS bearer auth) for policy/assignments/provider
// privacy/audit events. Backed by backend-go modules/aigovernance — admin
// routes mounted at /cms/ai-governance/*, MCP resolver at
// /mcp/ai-governance/effective-policy. Body/query field names mirror the Go
// json tags exactly (aigovernancedto.*).
export function registerGovernanceCommand(program: Command): void {
  registerAiPolicyCommand(program);
  registerGovernanceAdminCommand(program);
}

// GET /mcp/ai-governance/effective-policy — resolves the effective governance
// action (allow/monitor/redact/block) for a folder/use-case/data-class/surface
// combination. Query params mirror aigovernanceservice.ResolveRequest.
function registerAiPolicyCommand(program: Command): void {
  program
    .command("ai-policy")
    .description("Resolve the effective AI governance policy for this org (MCP surface)")
    .option("--folder-id <id>", "Folder UUID to resolve scope for")
    .option("--role <role>", "Principal role override")
    .option("--use-case <useCase>", "Use case (default: mcp)")
    .option("--data-class <dataClass>", "Data class (default: all)")
    .option("--surface <surface>", "Surface (default: mcp)")
    .option("--external-cloud <bool>", "Whether the call targets an external cloud provider (default: true)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/mcp/ai-governance/effective-policy", compact({
        folderId: o.folderId,
        role: o.role,
        useCase: o.useCase,
        dataClass: o.dataClass,
        surface: o.surface,
        externalCloud: o.externalCloud,
      }) as Record<string, string>));
    }));
}

// Admin surface: /cms/ai-governance/* (bearer auth, admin-only on backend).
function registerGovernanceAdminCommand(program: Command): void {
  const governance = program.command("governance").description("Manage AI governance policy, assignments, provider privacy, and audit events (admin)");

  governance
    .command("overview")
    .description("Get the org's AI governance overview (policy, assignments, provider-privacy profiles, 24h summary)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/ai-governance/overview"));
    }));

  governance
    .command("policy")
    .description("Update the org's AI data policy (only named fields are changed)")
    .option("--default-mode <mode>", "Default action mode")
    .option("--external-cloud-mode <mode>", "External-cloud action mode")
    .option("--embedding-mode <mode>", "Embedding action mode")
    .option("--secrets-action <action>", "Action for detected secrets")
    .option("--strict-classes <json>", 'JSON array of strict data classes, e.g. \'["payment_card","government_id"]\'')
    .option("--audit-level <level>", "Audit level")
    .option("--enabled <bool>", "Enable/disable AI governance (true|false)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch("/cms/ai-governance/policy", compact({
        defaultMode: o.defaultMode,
        externalCloudMode: o.externalCloudMode,
        embeddingMode: o.embeddingMode,
        secretsAction: o.secretsAction,
        strictClasses: parseJsonOption(o.strictClasses, "--strict-classes"),
        auditLevel: o.auditLevel,
        enabled: parseBoolOption(o.enabled, "--enabled"),
      })));
    }));

  const assignment = governance.command("assignment").description("Manage AI governance policy assignments");

  assignment
    .command("add")
    .description("Create a policy assignment (scope + principal + data-class override)")
    .requiredOption("--scope-kind <kind>", "Scope kind: org | folder")
    .requiredOption("--principal-kind <kind>", "Principal kind")
    .requiredOption("--data-class <dataClass>", "Data class this assignment governs")
    .requiredOption("--action <action>", "Governance action to apply")
    .option("--scope-id <id>", "Scope UUID (required when --scope-kind=folder)")
    .option("--principal-id <id>", "Principal UUID")
    .option("--principal-role <role>", "Principal role")
    .option("--use-case <useCase>", "Restrict this assignment to a use case")
    .option("--priority <n>", "Match priority (higher wins)", "0")
    .option("--inherits <bool>", "Whether child scopes inherit this assignment (true|false)")
    .option("--reason <reason>", "Human-readable justification")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/ai-governance/assignments", compact({
        scopeKind: o.scopeKind,
        scopeId: o.scopeId,
        principalKind: o.principalKind,
        principalId: o.principalId,
        principalRole: o.principalRole,
        useCase: o.useCase,
        dataClass: o.dataClass,
        action: o.action,
        priority: o.priority !== undefined ? Number(o.priority) : undefined,
        inherits: parseBoolOption(o.inherits, "--inherits"),
        reason: o.reason,
      })));
    }));

  assignment
    .command("remove <id>")
    .description("Delete a policy assignment")
    .action(withErrorHandler(async (cmd, id) => {
      await runAction(cmd, (c) => c.delete(`/cms/ai-governance/assignments/${id}`), "Assignment deleted.");
    }));

  const providerPrivacy = governance.command("provider-privacy").description("Manage provider privacy profiles");

  providerPrivacy
    .command("add")
    .description("Create or update a provider privacy profile")
    .requiredOption("--provider-type <type>", "Provider type (e.g. openai, anthropic)")
    .option("--id <id>", "Existing profile UUID (omit to create a new profile)")
    .option("--provider-id <id>", "Specific provider instance UUID (omit for provider-type-wide profile)")
    .option("--data-region <region>", "Data residency region")
    .option("--training-opt-out <bool>", "Whether training opt-out is confirmed (true|false)", "false")
    .option("--retention-days <n>", "Data retention period in days")
    .option("--subprocessors <json>", 'JSON string array of subprocessor names, e.g. \'["aws","gcp"]\'')
    .option("--notes <notes>", "Free-text notes")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/ai-governance/provider-privacy", compact({
        id: o.id,
        providerType: o.providerType,
        providerId: o.providerId,
        dataRegion: o.dataRegion,
        trainingOptOut: parseBoolOption(o.trainingOptOut, "--training-opt-out"),
        retentionDays: o.retentionDays !== undefined ? Number(o.retentionDays) : undefined,
        subprocessors: parseJsonOption(o.subprocessors, "--subprocessors"),
        notes: o.notes,
      })));
    }));

  providerPrivacy
    .command("remove <id>")
    .description("Delete a provider privacy profile")
    .action(withErrorHandler(async (cmd, id) => {
      await runAction(cmd, (c) => c.delete(`/cms/ai-governance/provider-privacy/${id}`), "Provider privacy profile deleted.");
    }));

  governance
    .command("events")
    .description("List AI governance audit events")
    .option("--decision <decision>", "Filter by decision")
    .option("--surface <surface>", "Filter by surface")
    .option("--use-case <useCase>", "Filter by use case")
    .option("--source-entity-type <type>", "Filter by source entity type")
    .option("--source-entity-id <id>", "Filter by source entity UUID")
    .option("--provider-type <type>", "Filter by provider type")
    .option("--folder-id <id>", "Filter by folder UUID")
    .option("--since <timestamp>", "Only events at/after this RFC3339 timestamp")
    .option("--before <timestamp>", "Only events before this RFC3339 timestamp")
    .option("--limit <n>", "Max results (default 50)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/ai-governance/events", compact({
        decision: o.decision,
        surface: o.surface,
        useCase: o.useCase,
        sourceEntityType: o.sourceEntityType,
        sourceEntityId: o.sourceEntityId,
        providerType: o.providerType,
        folderId: o.folderId,
        since: o.since,
        before: o.before,
        limit: o.limit,
      }) as Record<string, string>));
    }));

  governance
    .command("preview")
    .description("Preview the effective governance action for a hypothetical scope/principal/data-class combination")
    .requiredOption("--data-class <dataClass>", "Data class to evaluate")
    .requiredOption("--surface <surface>", "Surface to evaluate")
    .requiredOption("--use-case <useCase>", "Use case to evaluate")
    .option("--folder-id <id>", "Folder UUID scope")
    .option("--user-id <id>", "Principal user UUID")
    .option("--role <role>", "Principal role")
    .option("--external-cloud <bool>", "Whether the call targets an external cloud provider (true|false, default true)", "true")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/ai-governance/effective-preview", compact({
        folderId: o.folderId,
        userId: o.userId,
        role: o.role,
        useCase: o.useCase,
        dataClass: o.dataClass,
        surface: o.surface,
        externalCloud: parseBoolOption(o.externalCloud, "--external-cloud"),
      })));
    }));
}

// Parses a CLI "true"/"false" string option into a boolean, leaving
// undefined untouched so compact() drops unset flags from request bodies.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected "true" or "false" for ${flagName}, got: ${value}`);
}
