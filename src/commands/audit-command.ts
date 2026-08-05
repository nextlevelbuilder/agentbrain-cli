import { Command } from "commander";
import { withErrorHandler, fetchAndPrint } from "../utils/command-helpers.js";

const AUDIT_LOG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "actionKey", header: "Action" },
  { key: "resourceType", header: "Resource Type" },
  { key: "resourceId", header: "Resource ID" },
  { key: "source", header: "Source" },
  { key: "createdAt", header: "Created" },
];

// ApiClient.get() only supports single-value query params (URLSearchParams.set
// semantics), but backend-go's audit FilterDTO uses bracket-notation repeated
// keys (actionKey[]=a&actionKey[]=b) for multi-value filters. Build the query
// string inline so repeated keys survive, then pass the full path to c.get().
function buildQueryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v);
    } else {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// Splits a comma-separated CLI option into a trimmed, non-empty string array.
function csv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

// Adds the org-wide audit-log filter flags shared by `audit list` (backend-go
// modules/audit/dto/filter.dto.go FilterDTO).
function addAuditFilterOptions(cmd: Command): Command {
  return cmd
    .option("--actor <userId>", "Filter by actor user ID")
    .option("--resource <type>", "Filter by resource type")
    .option("--resource-id <uuid>", "Filter by resource ID")
    .option("--action <action>", "Filter by action")
    .option("--source <source>", "Filter by source")
    .option("--from <date>", "Start date (RFC3339)")
    .option("--to <date>", "End date (RFC3339)")
    .option("--action-keys <csv>", "Filter by action keys, comma-separated, e.g. member.added,grant.created")
    .option("--sources <csv>", "Filter by sources, comma-separated")
    .option("--resource-types <csv>", "Filter by resource types, comma-separated")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .option("--order <order>", "Sort order");
}

// Backend: backend-go modules/audit (+ resourceactivity for scoped reads). Routes:
//   GET /cms/audit-log[?...]           admin-only org-wide audit list
//   GET /cms/audit-log/summary?range=  admin-only 24h|7d action-count summary
//   GET /cms/resource-activity/audit?resourceType=&resourceId=&...  resource-scoped read
export function registerAuditCommand(program: Command): void {
  const audit = program.command("audit").description("View org audit log and resource-scoped activity");

  addAuditFilterOptions(audit.command("list").description("List org-wide audit log entries (admin only)"))
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const qs = buildQueryString({
        actor: o.actor,
        resource: o.resource,
        resourceId: o.resourceId,
        action: o.action,
        source: o.source,
        from: o.from,
        to: o.to,
        "actionKey[]": csv(o.actionKeys),
        "source[]": csv(o.sources),
        "resourceType[]": csv(o.resourceTypes),
        page: o.page,
        limit: o.limit,
        order: o.order,
      });
      await fetchAndPrint(cmd, (c) => c.get(`/cms/audit-log${qs}`), AUDIT_LOG_COLUMNS);
    }));

  audit
    .command("summary")
    .description("Get audit action-count summary for a time range (admin only)")
    .requiredOption("--range <range>", "Time range: 24h|7d")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/audit-log/summary", { range: o.range }));
    }));

  const resource = audit.command("resource").description("Resource-scoped audit activity (member-readable)");

  resource
    .command("list")
    .description("List audit activity for a single resource (redacted payloads)")
    .requiredOption("--resource-type <type>", "Resource type to view activity for")
    .requiredOption("--resource-id <uuid>", "Resource ID to view activity for")
    .option("--actor <userId>", "Filter by actor user ID")
    .option("--action <action>", "Filter by action")
    .option("--source <source>", "Filter by source")
    .option("--from <date>", "Start date (RFC3339)")
    .option("--to <date>", "End date (RFC3339)")
    .option("--action-keys <csv>", "Filter by action keys, comma-separated, e.g. member.added,grant.created")
    .option("--sources <csv>", "Filter by sources, comma-separated")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .option("--order <order>", "Sort order")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const qs = buildQueryString({
        resourceType: o.resourceType,
        resourceId: o.resourceId,
        actor: o.actor,
        action: o.action,
        source: o.source,
        from: o.from,
        to: o.to,
        "actionKey[]": csv(o.actionKeys),
        "source[]": csv(o.sources),
        page: o.page,
        limit: o.limit,
        order: o.order,
      });
      await fetchAndPrint(cmd, (c) => c.get(`/cms/resource-activity/audit${qs}`), AUDIT_LOG_COLUMNS);
    }));
}
