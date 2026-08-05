import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact, parseJsonOption } from "../utils/command-helpers.js";

// Registers `kg admin dedup ...`, `kg admin merge-history ...`,
// `kg admin sensitive-access-log`, and `kg admin entity-permission ...`.
// Covers dedup candidates/approve/dismiss/bulk/bulk-merge-progress,
// merge-history list/rollback, sensitive-access-log list, and
// entities/:id/permissions grant/revoke + effective-grants.
export function registerKgAdminGovernanceCommand(admin: Command): void {
  const dedup = admin.command("dedup").description("Admin: entity dedup candidate review and bulk merge");

  dedup
    .command("candidates")
    .description("List dedup candidates")
    .option("--limit <n>", "Max rows (1-100, default 50)")
    .option("--cursor <cursor>", "Opaque pagination cursor")
    .option("--status <status>", "pending|dismissed|expired|all (default pending)")
    .option("--method <method>", "embedding|exact_name|fuzzy|all")
    .option("--auto-recommended <bool>", "true|false|all")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/dedup/candidates", compact({
        limit: opts.limit,
        cursor: opts.cursor,
        status: opts.status,
        method: opts.method,
        autoRecommended: opts.autoRecommended,
      })));
    }));

  dedup
    .command("approve <id>")
    .description("Approve a dedup candidate and merge the losing entity into the survivor")
    .requiredOption("--survivor-id <id>", "Entity UUID to keep")
    .option("--reason <text>", "Reviewer reason note")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/dedup/candidates/${id}/approve`, compact({
        survivorId: opts.survivorId,
        reason: opts.reason,
      })));
    }));

  dedup
    .command("dismiss <id>")
    .description("Dismiss a dedup candidate without merging")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/dedup/candidates/${id}/dismiss`));
    }));

  dedup
    .command("bulk")
    .description("Bulk approve or dismiss dedup candidates")
    .requiredOption("--action <action>", "approve|dismiss")
    .option("--items <json>", "JSON array of {candidateId, survivorId, reason?} (required for action=approve)")
    .option("--ids <json>", "JSON array of candidate UUIDs (required for action=dismiss)")
    .option("--sync", "Run synchronously and return the full result (default: async, returns a batchId)")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      const body = compact({
        action: opts.action,
        items: opts.items ? parseJsonOption(opts.items, "--items") : undefined,
        ids: opts.ids ? parseJsonOption(opts.ids, "--ids") : undefined,
      });
      const path = opts.sync
        ? "/cms/kg/admin/dedup/candidates/bulk?async=false"
        : "/cms/kg/admin/dedup/candidates/bulk";
      await fetchAndPrint(cmd, (c) => c.post(path, body));
    }));

  dedup
    .command("progress <batchId>")
    .description("Stream bulk-merge progress for a batch (SSE)")
    .action(withErrorHandler(async (cmd, batchId) => {
      const { client } = createClient(cmd);
      console.error("Streaming dedup bulk-merge progress... (Ctrl+C to stop)");
      await client.stream(`/cms/kg/admin/dedup/bulk-merge/${batchId}/progress`, (data) => {
        console.log(data);
      });
    }));

  const mergeHistory = admin.command("merge-history").description("Admin: KG entity merge history and rollback");

  mergeHistory
    .command("list")
    .description("List completed entity merges")
    .option("--limit <n>", "Max rows (1-100, default 50)")
    .option("--cursor <cursor>", "Opaque pagination cursor")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/merge-history", compact({
        limit: opts.limit,
        cursor: opts.cursor,
      })));
    }));

  mergeHistory
    .command("rollback <id>")
    .description("Roll back a merge, restoring the absorbed entity from its snapshot")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/merge-history/${id}/rollback`));
    }));

  admin
    .command("sensitive-access-log")
    .description("List the sensitive-entity access audit log")
    .option("--limit <n>", "Max rows (1-100, default 50)")
    .option("--cursor <cursor>", "Opaque pagination cursor")
    .option("--user-id <id>", "Filter by accessing user UUID")
    .option("--resource-type <type>", "Filter by resource type")
    .option("--from <rfc3339>", "Only rows at/after this timestamp")
    .option("--to <rfc3339>", "Only rows at/before this timestamp")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/kg/admin/sensitive-access-log", compact({
        limit: opts.limit,
        cursor: opts.cursor,
        user_id: opts.userId,
        resource_type: opts.resourceType,
        from: opts.from,
        to: opts.to,
      })));
    }));

  const entityPermission = admin.command("entity-permission").description("Admin: per-entity ACL grant/revoke");

  entityPermission
    .command("grant <entityId>")
    .description("Grant a principal an action on an entity")
    .requiredOption("--principal-type <type>", "user|group|role")
    .option("--principal-id <id>", "Principal UUID (omit for role-based principals)")
    .requiredOption("--action <action>", "Action to grant (e.g. read, write)")
    .option("--row-filter-template <expr>", "Row-filter template to scope the grant")
    .action(withErrorHandler(async (cmd, entityId) => {
      const opts = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/kg/admin/entities/${entityId}/permissions`, compact({
        principalType: opts.principalType,
        principalId: opts.principalId,
        action: opts.action,
        rowFilterTemplate: opts.rowFilterTemplate,
      })));
    }));

  entityPermission
    .command("revoke <entityId> <grantId>")
    .description("Revoke a permission grant on an entity")
    .action(withErrorHandler(async (cmd, entityId, grantId) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/kg/admin/entities/${entityId}/permissions/${grantId}`));
    }));

  entityPermission
    .command("effective-grants <entityId>")
    .description("List the composed effective grants explaining an entity's access")
    .action(withErrorHandler(async (cmd, entityId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/kg/admin/entities/${entityId}/effective-grants`));
    }));
}
