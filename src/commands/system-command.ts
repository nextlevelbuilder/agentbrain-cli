import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact, getOutputFormat } from "../utils/command-helpers.js";
import { printOutput } from "../formatters/output-formatter.js";
import { ApiError } from "../client/api-error.js";

// Parse a tri-state CLI boolean flag ("true"/"false") into boolean | undefined.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid value for ${flagName}: expected "true" or "false", got "${value}"`);
}

const USER_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "email", header: "Email" },
  { key: "firstName", header: "First Name" },
  { key: "lastName", header: "Last Name" },
  { key: "status", header: "Status" },
  { key: "systemRole", header: "System Role" },
];

const ORG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "slug", header: "Slug" },
  { key: "status", header: "Status" },
];

// System-admin surface: cross-tenant platform operations under /v1/system/*.
// Requires system_role=admin (root-only endpoints noted per-command).
export function registerSystemCommand(program: Command): void {
  const sys = program.command("system").description("Platform system-admin operations (admin/root only, cross-tenant)");

  // ── Users ────────────────────────────────────────────────────────────────
  const users = sys.command("users").description("Manage platform users across all organizations");

  users
    .command("list")
    .description("List platform users")
    .option("--status <status>", "Filter by status")
    .option("--q <query>", "Search by email/name substring")
    .option("--page <n>", "Page number")
    .option("--page-size <n>", "Page size")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/system/users", compact({
        status: o.status,
        q: o.q,
        page: o.page,
        pageSize: o.pageSize,
      }) as Record<string, string>), USER_COLUMNS);
    }));

  users
    .command("approve <id>")
    .description("Approve a pending user")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/system/users/${id}/approve`));
    }));

  users
    .command("reject <id>")
    .description("Reject a pending user")
    .requiredOption("--reason <reason>", "Rejection reason")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/system/users/${id}/reject`, { reason: o.reason }));
    }));

  users
    .command("suspend <id>")
    .description("Suspend a user (cannot suspend self or root)")
    .requiredOption("--reason <reason>", "Suspension reason")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/system/users/${id}/suspend`, { reason: o.reason }));
    }));

  users
    .command("unsuspend <id>")
    .description("Unsuspend a user")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/system/users/${id}/unsuspend`));
    }));

  users
    .command("system-role <id>")
    .description("Grant or revoke a platform system role (root-only)")
    .option("--value <role>", "System role to grant: admin|root")
    .option("--clear", "Revoke the system role (mutually exclusive with --value)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      if (!o.clear && !o.value) {
        throw new Error("Provide --value <admin|root> to grant a role, or --clear to revoke it.");
      }
      await fetchAndPrint(cmd, (c) => c.patch(`/system/users/${id}/system-role`, {
        value: o.clear ? null : o.value,
      }));
    }));

  // ── Feature registry ─────────────────────────────────────────────────────
  sys
    .command("features")
    .description("List the canonical platform feature registry")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/system/features"));
    }));

  // ── Orgs ─────────────────────────────────────────────────────────────────
  const orgs = sys.command("orgs").description("Manage organizations across the platform");

  orgs
    .command("list")
    .description("List platform organizations")
    .option("--status <status>", "Filter by status")
    .option("--q <query>", "Search by name/slug substring")
    .option("--page <n>", "Page number")
    .option("--page-size <n>", "Page size")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/system/orgs", compact({
        status: o.status,
        q: o.q,
        page: o.page,
        pageSize: o.pageSize,
      }) as Record<string, string>), ORG_COLUMNS);
    }));

  orgs
    .command("get <id>")
    .description("Get organization detail (member count, creator, enabled features)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/system/orgs/${id}`));
    }));

  orgs
    .command("approve <id>")
    .description("Approve a pending organization")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/system/orgs/${id}/approve`));
    }));

  orgs
    .command("suspend <id>")
    .description("Suspend an organization")
    .requiredOption("--reason <reason>", "Suspension reason")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/system/orgs/${id}/suspend`, { reason: o.reason }));
    }));

  orgs
    .command("unsuspend <id>")
    .description("Unsuspend an organization")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/system/orgs/${id}/unsuspend`));
    }));

  const orgFeatures = orgs.command("features").description("Manage per-org feature overrides");

  orgFeatures
    .command("get <id>")
    .description("Get an org's enabled feature set")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/system/orgs/${id}/features`));
    }));

  orgFeatures
    .command("set <id>")
    .description("Replace an org's enabled feature set (source becomes 'manual')")
    .requiredOption("--enabled <codes>", "Comma-separated feature codes to enable")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      const enabled = String(o.enabled).split(",").map((s: string) => s.trim()).filter(Boolean);
      await fetchAndPrint(cmd, (c) => c.put(`/system/orgs/${id}/features`, { enabled }));
    }));

  // ── Audit / admins / health ──────────────────────────────────────────────
  sys
    .command("audit")
    .description("List the cross-tenant audit log")
    .option("--actor <userId>", "Filter by actor user ID")
    .option("--action <pattern>", "Filter by action (LIKE pattern)")
    .option("--from <iso>", "Start time (RFC3339)")
    .option("--to <iso>", "End time (RFC3339)")
    .option("--page <n>", "Page number")
    .option("--page-size <n>", "Page size")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/system/audit", compact({
        actor: o.actor,
        action: o.action,
        from: o.from,
        to: o.to,
        page: o.page,
        pageSize: o.pageSize,
      }) as Record<string, string>));
    }));

  sys
    .command("admins")
    .description("List platform admins and roots")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/system/admins"));
    }));

  sys
    .command("health")
    .description("Platform health check (admin/root counts; exits non-zero when unbootstrapped)")
    .action(withErrorHandler(async (cmd) => {
      // Bypasses ApiClient: the backend responds 503 (not 200) when root_count=0,
      // and still carries the {adminCount,rootCount,bootstrapOk} payload on that
      // 503 — ApiClient.get would throw before this command could show it. A raw
      // fetch lets a 503-with-payload print the counts and exit non-zero, while
      // any other non-2xx (auth/network) still surfaces as a normal ApiError.
      const { config } = createClient(cmd);
      const url = `${config.apiUrl.replace(/\/$/, "")}/v1/system/health`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
      if (config.orgId) headers["X-Org-Id"] = config.orgId;

      const res = await fetch(url, { method: "GET", headers });
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      const payload = data && typeof data === "object" && "data" in (data as Record<string, unknown>)
        ? (data as Record<string, unknown>).data
        : data;

      if (!res.ok && res.status !== 503) {
        const msg = (payload as Record<string, unknown>)?.error ?? (payload as Record<string, unknown>)?.message ?? res.statusText;
        throw new ApiError(res.status, String(msg), payload);
      }

      printOutput(payload, getOutputFormat(cmd));
      if (res.status === 503) process.exitCode = 1;
    }));

  // ── Platform settings (root-only) ────────────────────────────────────────
  const settings = sys.command("settings").description("Manage platform-wide settings (root-only)");

  settings
    .command("get")
    .description("Get platform-wide settings")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/system/settings"));
    }));

  settings
    .command("set")
    .description("Update platform-wide settings (partial patch)")
    .option("--require-user-approval <bool>", "Gate new signups behind admin approval (true|false)")
    .option("--allow-multi-org <bool>", "Allow users to create additional orgs (true|false)")
    .option("--default-org-id <id>", "Default org ID (effective when --allow-multi-org=false)")
    .option("--clear-default-org", "Explicitly clear the default org (sets defaultOrgId to null)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const body = compact({
        requireUserApproval: parseBoolOption(o.requireUserApproval, "--require-user-approval"),
        allowMultiOrg: parseBoolOption(o.allowMultiOrg, "--allow-multi-org"),
        defaultOrgId: o.clearDefaultOrg ? null : o.defaultOrgId,
      });
      await fetchAndPrint(cmd, (c) => c.put("/system/settings", body));
    }));
}
