import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";
import { Knowledge, KnowledgeVersion, KnowledgeShare } from "../types/api-types.js";

const KB_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "title", header: "Title" },
  { key: "slug", header: "Slug" },
  { key: "description", header: "Description" },
  { key: "status", header: "Status" },
];

// Parse a tri-state CLI boolean flag ("true"/"false") into boolean | undefined.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid value for ${flagName}: expected "true" or "false", got "${value}"`);
}

export function registerKnowledgeCommand(program: Command): void {
  const kb = program.command("knowledge").alias("kb").description("Manage knowledge bases");

  kb
    .command("list")
    .description("List all knowledge bases")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Knowledge[]>(cmd, (c) => c.get("/cms/knowledges"), KB_COLUMNS);
    }));

  kb
    .command("get <id>")
    .description("Get knowledge base details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Knowledge>(cmd, (c) => c.get(`/cms/knowledges/${id}`));
    }));

  kb
    .command("by-slug <slug>")
    .description("Get a knowledge base by its slug")
    .action(withErrorHandler(async (cmd, slug) => {
      await fetchAndPrint<Knowledge>(cmd, (c) => c.get(`/cms/knowledges/by-slug/${slug}`));
    }));

  kb
    .command("page-by-slug <orgSlug> <slug>")
    .description("Get the authenticated public-page projection of a knowledge base by org slug + knowledge slug")
    .action(withErrorHandler(async (cmd, orgSlug, slug) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/knowledges/page-by-slug/${orgSlug}/${slug}`));
    }));

  kb
    .command("create")
    .description("Create a new knowledge base")
    .requiredOption("--title <title>", "Knowledge base title")
    .option("--slug <slug>", "Slug (auto-generated when omitted)")
    .option("--description <desc>", "Description")
    .option("--html-content <html>", "HTML content")
    .option("--markdown-content <markdown>", "Markdown content")
    .option("--ai-context <context>", "AI context notes")
    .option("--can-mcp-use <bool>", "Whether MCP tools may use this knowledge (true|false)")
    .option("--category-id <id>", "Category ID")
    .option("--folder-id <id>", "Folder ID")
    .option("--tag-ids <ids>", "Comma-separated tag IDs")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<Knowledge>(cmd, (c) => c.post("/cms/knowledges", compact({
        title: opts.title,
        slug: opts.slug,
        description: opts.description,
        htmlContent: opts.htmlContent,
        markdownContent: opts.markdownContent,
        aiContext: opts.aiContext,
        canMcpUse: parseBoolOption(opts.canMcpUse, "--can-mcp-use"),
        categoryId: opts.categoryId,
        folderId: opts.folderId,
        tagIds: opts.tagIds ? String(opts.tagIds).split(",").map((v: string) => v.trim()).filter(Boolean) : undefined,
      })));
    }));

  kb
    .command("update <id>")
    .description("Update a knowledge base")
    .option("--title <title>", "New title")
    .option("--slug <slug>", "New slug")
    .option("--description <desc>", "New description")
    .option("--html-content <html>", "New HTML content")
    .option("--markdown-content <markdown>", "New markdown content")
    .option("--ai-context <context>", "New AI context notes")
    .option("--can-mcp-use <bool>", "Whether MCP tools may use this knowledge (true|false)")
    .option("--category-id <id>", "New category ID")
    .option("--folder-id <id>", "New folder ID")
    .option("--tag-ids <ids>", "Comma-separated tag IDs (replaces existing tags)")
    .option("--change-summary <summary>", "Change summary for the new version")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<Knowledge>(cmd, (c) => c.put(`/cms/knowledges/${id}`, compact({
        title: opts.title,
        slug: opts.slug,
        description: opts.description,
        htmlContent: opts.htmlContent,
        markdownContent: opts.markdownContent,
        aiContext: opts.aiContext,
        canMcpUse: parseBoolOption(opts.canMcpUse, "--can-mcp-use"),
        categoryId: opts.categoryId,
        folderId: opts.folderId,
        tagIds: opts.tagIds ? String(opts.tagIds).split(",").map((v: string) => v.trim()).filter(Boolean) : undefined,
        changeSummary: opts.changeSummary,
      })));
    }));

  kb
    .command("delete <id>")
    .description("Delete a knowledge base")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/knowledges/${id}`);
      console.log("Knowledge base deleted.");
    }));

  kb
    .command("publish <id>")
    .description("Publish a knowledge base (makes it accessible via its public slug)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/knowledges/${id}/publication`));
    }));

  kb
    .command("unpublish <id>")
    .description("Unpublish a knowledge base")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/knowledges/${id}/publication`);
      console.log("Knowledge base unpublished.");
    }));

  kb
    .command("related <id>")
    .description("List knowledges most similar to this one (pgvector cosine similarity)")
    .option("--k <n>", "Max results (default 5)")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/knowledges/${id}/related`, compact({ k: opts.k })));
    }));

  kb
    .command("kg-entities <id>")
    .description("List KG entities sourced from this knowledge base")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--limit <n>", "Max results")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/knowledges/${id}/kg/entities`, compact({
        cursor: opts.cursor,
        limit: opts.limit,
      })));
    }));

  kb
    .command("kg-summary <id>")
    .description("Get the per-knowledge KG aggregate summary (entity count, relation count, top entities)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/knowledges/${id}/kg/summary`));
    }));

  // Version history
  kb
    .command("versions <id>")
    .description("List version history")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<KnowledgeVersion[]>(cmd, (c) => c.get(`/cms/knowledges/${id}/versions`), [
        { key: "id", header: "ID" },
        { key: "versionNumber", header: "Version" },
        { key: "changeSummary", header: "Summary" },
        { key: "createdAt", header: "Created" },
      ]);
    }));

  kb
    .command("version <knowledgeId> <versionId>")
    .description("Get a specific version")
    .action(withErrorHandler(async (cmd, knowledgeId, versionId) => {
      await fetchAndPrint<KnowledgeVersion>(cmd, (c) => c.get(`/cms/knowledges/${knowledgeId}/versions/${versionId}`));
    }));

  kb
    .command("rollback <knowledgeId> <versionId>")
    .description("Rollback to a specific version")
    .action(withErrorHandler(async (cmd, knowledgeId, versionId) => {
      await fetchAndPrint<Knowledge>(cmd, (c) => c.post(`/cms/knowledges/${knowledgeId}/rollback/${versionId}`));
    }));

  // Sharing — creates a public share link (token-based), not a per-user grant.
  const share = kb.command("share").description("Manage knowledge base public share links");

  share
    .command("list <knowledgeId>")
    .description("List share links for a knowledge base")
    .action(withErrorHandler(async (cmd, knowledgeId) => {
      await fetchAndPrint<KnowledgeShare[]>(cmd, (c) => c.get(`/cms/knowledges/${knowledgeId}/shares`));
    }));

  share
    .command("create <knowledgeId>")
    .description("Create a public share link for a knowledge base")
    .option("--expires-in <duration>", 'Expiration duration, e.g. "7d" or "24h" (omit for no expiry)')
    .option("--max-access-count <n>", "Max number of times the link may be accessed")
    .action(withErrorHandler(async (cmd, knowledgeId) => {
      const opts = cmd.opts();
      await fetchAndPrint<KnowledgeShare>(cmd, (c) => c.post(`/cms/knowledges/${knowledgeId}/shares`, compact({
        expiresIn: opts.expiresIn,
        maxAccessCount: opts.maxAccessCount !== undefined ? Number(opts.maxAccessCount) : undefined,
      })));
    }));

  share
    .command("delete <knowledgeId> <shareId>")
    .description("Remove a knowledge base share link")
    .action(withErrorHandler(async (cmd, knowledgeId, shareId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/knowledges/${knowledgeId}/shares/${shareId}`);
      console.log("Share removed.");
    }));
}
