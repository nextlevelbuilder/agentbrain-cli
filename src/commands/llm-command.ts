import { Command } from "commander";
import {
  withErrorHandler,
  fetchAndPrint,
  parseJsonOption,
  compact,
} from "../utils/command-helpers.js";

// Backed by backend-go modules/aiconfig/module.go routes mounted under
// /v1/cms/llm/* (providers, models, defaults, catalog). All routes require
// org-admin auth (mw.AllowAdminsOnly) — see module.go for the exact wiring.

const PROVIDER_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "providerType", header: "Type" },
  { key: "enabled", header: "Enabled" },
  { key: "modelCount", header: "Models" },
  { key: "lastVerifyStatus", header: "Last Verify" },
];

const MODEL_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "modelId", header: "Model ID" },
  { key: "displayName", header: "Display Name" },
  { key: "source", header: "Source" },
  { key: "enabled", header: "Enabled" },
];

// Comma-separated list option -> string[]. Used for probe-model's
// capabilitiesToTest (binding restricts values to {chat, embed}).
function splitList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
}

export function registerLlmCommand(program: Command): void {
  const llm = program.command("llm").description("Manage LLM providers, models, and org defaults");

  // ── providers ──────────────────────────────────────────────────────────
  const provider = llm.command("provider").description("Manage LLM providers");

  provider
    .command("list")
    .description("List LLM providers")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/llm/providers"), PROVIDER_COLUMNS);
    }));

  provider
    .command("get <id>")
    .description("Get LLM provider details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/llm/providers/${id}`));
    }));

  provider
    .command("create")
    .description("Create a new LLM provider")
    .requiredOption("--name <name>", "Internal provider name")
    .requiredOption("--provider-type <type>", "Provider type (e.g. openai, anthropic, gemini, openrouter)")
    .option("--display-name <name>", "Display name")
    .option("--api-base <url>", "API base URL override")
    .option("--api-key <key>", "Plaintext API key (encrypted at rest)")
    .option("--enabled", "Enable the provider")
    .option("--settings <json>", "Provider settings (JSON)")
    .option("--metadata <json>", "Provider metadata (JSON)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/llm/providers", compact({
        name: o.name,
        displayName: o.displayName,
        providerType: o.providerType,
        apiBase: o.apiBase,
        apiKey: o.apiKey,
        enabled: o.enabled ? true : undefined,
        settings: parseJsonOption(o.settings, "--settings"),
        metadata: parseJsonOption(o.metadata, "--metadata"),
      })));
    }));

  provider
    .command("update <id>")
    .description("Update an LLM provider")
    .option("--display-name <name>", "New display name")
    .option("--provider-type <type>", "New provider type")
    .option("--api-base <url>", "New API base URL")
    .option("--api-key <key>", "New plaintext API key ('' or '***' leaves unchanged)")
    .option("--enabled <bool>", "Enable/disable the provider (true|false)")
    .option("--settings <json>", "Replace provider settings (JSON)")
    .option("--metadata <json>", "Replace provider metadata (JSON)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/llm/providers/${id}`, compact({
        displayName: o.displayName,
        providerType: o.providerType,
        apiBase: o.apiBase,
        apiKey: o.apiKey,
        enabled: o.enabled === undefined ? undefined : o.enabled === "true",
        settings: parseJsonOption(o.settings, "--settings"),
        metadata: parseJsonOption(o.metadata, "--metadata"),
      })));
    }));

  provider
    .command("delete <id>")
    .description("Delete an LLM provider")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/llm/providers/${id}`));
    }));

  provider
    .command("verify <id>")
    .description("Verify provider credentials against upstream (also triggers a background model sync on success)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/llm/providers/${id}/verify`));
    }));

  provider
    .command("models <id>")
    .description("List models registered for a provider")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/llm/providers/${id}/models`), MODEL_COLUMNS);
    }));

  provider
    .command("add-model <id>")
    .description("Register a custom model under a provider")
    .requiredOption("--model-id <modelId>", "Upstream model identifier")
    .option("--display-name <name>", "Display name")
    .option("--capabilities <json>", "Capabilities (JSON, e.g. '{\"chat\":true}')")
    .option("--context-window <n>", "Context window size", (v) => parseInt(v, 10))
    .option("--max-output-tokens <n>", "Max output tokens", (v) => parseInt(v, 10))
    .option("--embed-dimension <n>", "Embedding vector dimension", (v) => parseInt(v, 10))
    .option("--pricing <json>", "Pricing preset (JSON)")
    .option("--enabled", "Enable the model")
    .option("--metadata <json>", "Model metadata (JSON)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/llm/providers/${id}/models`, compact({
        modelId: o.modelId,
        displayName: o.displayName,
        capabilities: parseJsonOption(o.capabilities, "--capabilities"),
        contextWindow: o.contextWindow,
        maxOutputTokens: o.maxOutputTokens,
        embedDimension: o.embedDimension,
        pricing: parseJsonOption(o.pricing, "--pricing"),
        enabled: o.enabled ? true : undefined,
        metadata: parseJsonOption(o.metadata, "--metadata"),
      })));
    }));

  provider
    .command("sync-models <id>")
    .description("Manually refresh a provider's model catalog from upstream")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/llm/providers/${id}/sync-models`));
    }));

  provider
    .command("probe-model <id>")
    .description("Probe a candidate model's capabilities on a provider")
    .requiredOption("--model-id <modelId>", "Upstream model identifier to probe")
    .requiredOption("--capabilities-to-test <list>", "Comma-separated capabilities to probe (chat,embed)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/llm/providers/${id}/probe-model`, {
        modelId: o.modelId,
        capabilitiesToTest: splitList(o.capabilitiesToTest),
      }));
    }));

  // ── models ────────────────────────────────────────────────────────────
  const model = llm.command("model").description("Manage LLM models");

  model
    .command("system-catalog")
    .description("List the built-in system model catalog")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/llm/models/system"), MODEL_COLUMNS);
    }));

  model
    .command("update <id>")
    .description("Update a model's configuration")
    .option("--display-name <name>", "New display name")
    .option("--capabilities <json>", "Replace capabilities (JSON)")
    .option("--context-window <n>", "Context window size", (v) => parseInt(v, 10))
    .option("--max-output-tokens <n>", "Max output tokens", (v) => parseInt(v, 10))
    .option("--embed-dimension <n>", "Embedding vector dimension", (v) => parseInt(v, 10))
    .option("--pricing <json>", "Replace pricing preset (JSON)")
    .option("--enabled <bool>", "Enable/disable the model (true|false)")
    .option("--metadata <json>", "Replace model metadata (JSON)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/llm/models/${id}`, compact({
        displayName: o.displayName,
        capabilities: parseJsonOption(o.capabilities, "--capabilities"),
        contextWindow: o.contextWindow,
        maxOutputTokens: o.maxOutputTokens,
        embedDimension: o.embedDimension,
        pricing: parseJsonOption(o.pricing, "--pricing"),
        enabled: o.enabled === undefined ? undefined : o.enabled === "true",
        metadata: parseJsonOption(o.metadata, "--metadata"),
      })));
    }));

  model
    .command("delete <id>")
    .description("Delete a model")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/llm/models/${id}`));
    }));

  model
    .command("catalog")
    .description("List the preset model catalog for a provider type (prefill for add-model)")
    .requiredOption("--provider-type <type>", "Provider type slug (e.g. openai, anthropic)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/llm/catalog/models", compact({
        provider_type: o.providerType,
      })));
    }));

  // ── org defaults ──────────────────────────────────────────────────────
  const def = llm.command("default").description("Manage org default provider/model per use case");

  def
    .command("get <useCase>")
    .description("Get the org's default provider/model for a use case")
    .action(withErrorHandler(async (cmd, useCase) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/llm/defaults/${useCase}`));
    }));

  def
    .command("set <useCase>")
    .description("Set the org's default provider/model for a use case")
    .requiredOption("--provider-id <id>", "Provider ID")
    .requiredOption("--model-id <id>", "Model ID")
    .action(withErrorHandler(async (cmd, useCase) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put(`/cms/llm/defaults/${useCase}`, {
        providerId: o.providerId,
        modelId: o.modelId,
      }));
    }));
}
