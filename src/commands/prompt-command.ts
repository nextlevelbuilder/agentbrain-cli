import { Command } from "commander";
import {
  withErrorHandler,
  fetchAndPrint,
  parseJsonOption,
  compact,
} from "../utils/command-helpers.js";

// Backed by backend-go modules/promptengine/module.go routes mounted under
// /v1/cms/prompt-templates/* and /v1/cms/prompt-use-case-types/*. All routes
// require org-admin auth (mw.AllowAdminsOnly) — see module.go for wiring.

const TEMPLATE_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "slug", header: "Slug" },
  { key: "useCase", header: "Use Case" },
  { key: "isDefault", header: "Default" },
  { key: "status", header: "Status" },
  { key: "currentVersionNumber", header: "Version" },
];

const VERSION_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "versionNumber", header: "Version" },
  { key: "changeSummary", header: "Summary" },
  { key: "createdAt", header: "Created" },
];

const USE_CASE_COLUMNS = [
  { key: "useCase", header: "Use Case" },
  { key: "displayName", header: "Display Name" },
  { key: "relatedCapability", header: "Capability" },
  { key: "isSystem", header: "System" },
  { key: "isActive", header: "Active" },
];

export function registerPromptCommand(program: Command): void {
  const prompt = program.command("prompt").description("Manage prompt templates and use-case types");

  // ── templates ─────────────────────────────────────────────────────────
  const template = prompt.command("template").description("Manage prompt templates");

  template
    .command("list")
    .description("List prompt templates")
    .option("--use-case <useCase>", "Filter by use case")
    .option("--pipeline-step <step>", "Filter by pipeline step (step1|step2)")
    .option("--status <status>", "Filter by status (active|inactive)")
    .option("--q <search>", "Search by name/slug/text")
    .option("--is-default <bool>", "Filter by default flag (true|false)")
    .option("--limit <n>", "Page size (default 20, max 200)", (v) => parseInt(v, 10))
    .option("--offset <n>", "Page offset", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/prompt-templates", compact({
        use_case: o.useCase,
        pipeline_step: o.pipelineStep,
        status: o.status,
        q: o.q,
        is_default: o.isDefault,
        limit: o.limit !== undefined ? String(o.limit) : undefined,
        offset: o.offset !== undefined ? String(o.offset) : undefined,
      })), TEMPLATE_COLUMNS);
    }));

  template
    .command("resolve")
    .description("Preview the resolved template for a use case (tier chain)")
    .requiredOption("--use-case <useCase>", "Use case to resolve")
    .option("--pipeline-step <step>", "Pipeline step (step1|step2)")
    .option("--override-id <id>", "Explicit template override ID")
    .option("--asset-default-id <id>", "Asset-level default template ID")
    .option("--folder-id <id>", "Folder ID for folder-default resolution")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/prompt-templates/resolve", compact({
        use_case: o.useCase,
        pipeline_step: o.pipelineStep,
        override_id: o.overrideId,
        asset_default_id: o.assetDefaultId,
        folder_id: o.folderId,
      })));
    }));

  template
    .command("get <id>")
    .description("Get a prompt template")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/prompt-templates/${id}`));
    }));

  template
    .command("create")
    .description("Create a new prompt template")
    .requiredOption("--name <name>", "Template name (1..120 chars)")
    .requiredOption("--slug <slug>", "Slug, kebab-case (e.g. my-template)")
    .requiredOption("--use-case <useCase>", "Use case key")
    .requiredOption("--template-text <text>", "Template body (10..16000 chars)")
    .option("--description <desc>", "Description (<=500 chars)")
    .option("--pipeline-step <step>", "Pipeline step (step1|step2)")
    .option("--variables <json>", "Template variables (JSON)")
    .option("--category <category>", "Category")
    .option("--model-config <json>", "Model config override (JSON)")
    .option("--is-default", "Mark as the default template for this use case")
    .option("--is-system", "Mark as a system template (system-admin only)")
    .option("--change-summary <summary>", "Change summary for the first version")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/prompt-templates", compact({
        name: o.name,
        slug: o.slug,
        description: o.description,
        useCase: o.useCase,
        pipelineStep: o.pipelineStep,
        templateText: o.templateText,
        variables: parseJsonOption(o.variables, "--variables"),
        category: o.category,
        modelConfig: parseJsonOption(o.modelConfig, "--model-config"),
        isDefault: o.isDefault ? true : undefined,
        isSystem: o.isSystem ? true : undefined,
        changeSummary: o.changeSummary,
      })));
    }));

  template
    .command("update <id>")
    .description("Update a prompt template (creates a new version when text/config changes)")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .option("--template-text <text>", "New template body (creates a new version)")
    .option("--model-config <json>", "Replace model config (JSON)")
    .option("--category <category>", "New category")
    .option("--status <status>", "Status (active|inactive)")
    .option("--is-default <bool>", "Set default flag (true|false)")
    .option("--change-summary <summary>", "Change summary for the new version")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/prompt-templates/${id}`, compact({
        name: o.name,
        description: o.description,
        templateText: o.templateText,
        modelConfig: parseJsonOption(o.modelConfig, "--model-config"),
        category: o.category,
        status: o.status,
        isDefault: o.isDefault === undefined ? undefined : o.isDefault === "true",
        changeSummary: o.changeSummary,
      })));
    }));

  template
    .command("make-default <id>")
    .description("Mark a template as the default for its use case")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/prompt-templates/${id}/default`));
    }));

  template
    .command("delete <id>")
    .description("Delete a prompt template (system templates cannot be deleted)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/prompt-templates/${id}`));
    }));

  template
    .command("versions <id>")
    .description("List version history for a prompt template")
    .option("--limit <n>", "Page size (default 20, max 200)", (v) => parseInt(v, 10))
    .option("--offset <n>", "Page offset", (v) => parseInt(v, 10))
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/prompt-templates/${id}/versions`, compact({
        limit: o.limit !== undefined ? String(o.limit) : undefined,
        offset: o.offset !== undefined ? String(o.offset) : undefined,
      })), VERSION_COLUMNS);
    }));

  // ── use-case types ────────────────────────────────────────────────────
  const useCase = prompt.command("use-case").description("Manage prompt use-case types");

  useCase
    .command("list")
    .description("List prompt use-case types")
    .option("--all", "Include inactive use-case types (default: active only)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/prompt-use-case-types", compact({
        active: o.all ? "false" : undefined,
      })), USE_CASE_COLUMNS);
    }));

  useCase
    .command("create")
    .description("Create a custom use-case type")
    .requiredOption("--use-case <useCase>", "Use case key, kebab-case (<=40 chars)")
    .requiredOption("--display-name <name>", "Display name (1..100 chars)")
    .option("--description <desc>", "Description")
    .option("--related-capability <capability>", "Related capability")
    .option("--pipeline-steps <json>", "Pipeline steps (JSON array)")
    .option("--active", "Mark as active")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/prompt-use-case-types", compact({
        useCase: o.useCase,
        displayName: o.displayName,
        description: o.description,
        relatedCapability: o.relatedCapability,
        pipelineSteps: parseJsonOption(o.pipelineSteps, "--pipeline-steps"),
        isActive: o.active ? true : undefined,
      })));
    }));

  useCase
    .command("update <useCase>")
    .description("Update a use-case type")
    .option("--display-name <name>", "New display name")
    .option("--description <desc>", "New description")
    .option("--related-capability <capability>", "New related capability")
    .option("--pipeline-steps <json>", "Replace pipeline steps (JSON array)")
    .option("--active <bool>", "Set active flag (true|false)")
    .action(withErrorHandler(async (cmd, useCaseKey) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/prompt-use-case-types/${useCaseKey}`, compact({
        displayName: o.displayName,
        description: o.description,
        relatedCapability: o.relatedCapability,
        pipelineSteps: parseJsonOption(o.pipelineSteps, "--pipeline-steps"),
        isActive: o.active === undefined ? undefined : o.active === "true",
      })));
    }));

  useCase
    .command("set-active <useCase>")
    .description("Activate or deactivate a use-case type")
    .requiredOption("--active <bool>", "true|false")
    .action(withErrorHandler(async (cmd, useCaseKey) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/prompt-use-case-types/${useCaseKey}/active`, {
        active: o.active === "true",
      }));
    }));

  useCase
    .command("delete <useCase>")
    .description("Delete a custom use-case type (system types are deactivated instead)")
    .action(withErrorHandler(async (cmd, useCaseKey) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/prompt-use-case-types/${useCaseKey}`));
    }));
}
