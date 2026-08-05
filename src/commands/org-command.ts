import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact, getOutputFormat } from "../utils/command-helpers.js";
import { setConfigValue } from "../config/config-manager.js";
import { printOutput } from "../formatters/output-formatter.js";
import { ApiError } from "../client/api-error.js";
import { detectContentType } from "../utils/media-upload.js";
import { Organization, OrgMember } from "../types/api-types.js";

// Parse a tri-state CLI boolean flag ("true"/"false") into boolean | undefined.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid value for ${flagName}: expected "true" or "false", got "${value}"`);
}

// Logo content types accepted by the branding-upload backend contract.
const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

const ORG_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "slug", header: "Slug" },
  { key: "type", header: "Type" },
  { key: "status", header: "Status" },
];

const MEMBER_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "userId", header: "User ID" },
  { key: "role", header: "Role" },
  { key: "status", header: "Status" },
  { key: "createdAt", header: "Joined" },
];

export function registerOrgCommand(program: Command): void {
  const org = program.command("org").description("Manage organizations");

  org
    .command("list")
    .description("List all accessible organizations")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Organization[]>(cmd, (c) => c.get("/cms/organizations"));
    }));

  org
    .command("me")
    .description("List my organizations")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<Organization[]>(cmd, (c) => c.get("/cms/organizations/me"), ORG_COLUMNS);
    }));

  org
    .command("get <id>")
    .description("Get organization details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<Organization>(cmd, (c) => c.get(`/cms/organizations/${id}`));
    }));

  org
    .command("create")
    .description("Create a new organization")
    .requiredOption("--name <name>", "Organization name")
    .option("--description <desc>", "Organization description")
    .option("--type <type>", "Organization type")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<Organization>(cmd, (c) => c.post("/cms/organizations", {
        name: opts.name,
        description: opts.description,
        type: opts.type,
      }));
    }));

  org
    .command("update <id>")
    .description("Update an organization")
    .option("--name <name>", "Organization name")
    .option("--description <desc>", "Description")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<Organization>(cmd, (c) => c.put(`/cms/organizations/${id}`, {
        name: opts.name,
        description: opts.description,
      }));
    }));

  org
    .command("delete <id>")
    .description("Delete an organization")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/organizations/${id}`);
      console.log("Organization deleted.");
    }));

  org
    .command("members <id>")
    .description("List organization members")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<OrgMember[]>(cmd, (c) => c.get(`/cms/organizations/${id}/members`), MEMBER_COLUMNS);
    }));

  org
    .command("add-member <orgId>")
    .description("Add member to organization")
    .requiredOption("--user-id <userId>", "User ID to add")
    .option("--role <role>", "Member role (admin/member/viewer)", "member")
    .action(withErrorHandler(async (cmd, orgId) => {
      const opts = cmd.opts();
      await fetchAndPrint<OrgMember>(cmd, (c) => c.post(`/cms/organizations/${orgId}/members`, {
        userId: opts.userId,
        role: opts.role,
      }));
    }));

  org
    .command("switch <id>")
    .description("Switch active organization (saves to config)")
    .action((_id: string) => {
      setConfigValue("orgId", _id);
      console.log(`Switched to organization: ${_id}`);
    });

  org
    .command("policy")
    .description("Get the platform org policy (multi-org allowance, default org)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/organizations/policy"));
    }));

  org
    .command("invite-member <orgId>")
    .description("Invite a user to an organization by email")
    .requiredOption("--email <email>", "Invitee email address")
    .requiredOption("--role <role>", "Org role to grant (e.g. admin, member)")
    .option("--dept-id <id>", "Department (permission group) to assign on acceptance")
    .action(withErrorHandler(async (cmd, orgId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/organizations/${orgId}/members/invite`, compact({
        email: o.email,
        role: o.role,
        deptId: o.deptId,
      })));
    }));

  org
    .command("resend-invite <orgId> <memberId>")
    .description("Resend a pending member invite")
    .action(withErrorHandler(async (cmd, orgId, memberId) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/organizations/${orgId}/members/${memberId}/resend-invite`));
    }));

  org
    .command("update-member-role <orgId> <memberId>")
    .description("Change a member's role")
    .requiredOption("--role <role>", "New org role (e.g. admin, member, viewer)")
    .action(withErrorHandler(async (cmd, orgId, memberId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put(`/cms/organizations/${orgId}/members/${memberId}`, { role: o.role }));
    }));

  org
    .command("remove-member <orgId> <memberId>")
    .description("Remove a member from the organization")
    .action(withErrorHandler(async (cmd, orgId, memberId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/organizations/${orgId}/members/${memberId}`);
      console.log("Member removed.");
    }));

  // Org-scoped KG runtime settings (uses X-Org-Id header from --org/config, not a path param)
  const settings = org.command("settings").description("Manage org-scoped runtime settings");
  const kgRuntime = settings.command("kg-runtime").description("Manage knowledge-graph runtime limits");

  kgRuntime
    .command("get")
    .description("Get knowledge-graph runtime settings for the active org")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/org/settings/kg-runtime"));
    }));

  kgRuntime
    .command("set")
    .description("Update knowledge-graph runtime settings for the active org")
    .option("--full-view-cap <n>", "Max entities rendered in a full graph view")
    .option("--extraction-rate-per-hour <n>", "Max extraction jobs per hour")
    .option("--admin-replay-limit-per-hour <n>", "Max admin-triggered replays per hour")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch("/cms/org/settings/kg-runtime", compact({
        fullViewCap: o.fullViewCap !== undefined ? Number(o.fullViewCap) : undefined,
        extractionRatePerHour: o.extractionRatePerHour !== undefined ? Number(o.extractionRatePerHour) : undefined,
        adminReplayLimitPerHour: o.adminReplayLimitPerHour !== undefined ? Number(o.adminReplayLimitPerHour) : undefined,
      })));
    }));

  // Org-level permission settings (dept-inheritance toggle). :orgID is explicit in the
  // path per the backend contract; the caller's org membership is still checked via
  // the X-Org-Id header set from --org/config by the shared client.
  const permSettings = org.command("perm-settings").description("Manage org-level permission settings");

  permSettings
    .command("get <orgId>")
    .description("Get org permission settings (dept-inheritance toggle)")
    .action(withErrorHandler(async (cmd, orgId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/orgs/${orgId}/perm-settings`));
    }));

  permSettings
    .command("set <orgId>")
    .description("Set org permission settings (owner-only)")
    .requiredOption("--enable-dept-inheritance <bool>", "Enable department inheritance (true|false)")
    .action(withErrorHandler(async (cmd, orgId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put(`/orgs/${orgId}/perm-settings`, {
        enableDeptInheritance: parseBoolOption(o.enableDeptInheritance, "--enable-dept-inheritance"),
      }));
    }));

  // Org-level audit policy settings.
  const auditSettings = org.command("audit-settings").description("Manage org-level audit log policy");

  auditSettings
    .command("get <orgId>")
    .description("Get org audit-log policy settings")
    .action(withErrorHandler(async (cmd, orgId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/orgs/${orgId}/audit-settings`));
    }));

  auditSettings
    .command("set <orgId>")
    .description("Update org audit-log policy settings (partial patch)")
    .option("--enabled <bool>", "Enable/disable audit logging (true|false)")
    .option("--log-denials <bool>", "Log permission-check denials (true|false)")
    .option("--log-admin-bypass-mutating <bool>", "Log admin-bypass on mutating actions (true|false)")
    .option("--log-admin-bypass-passive <bool>", "Log admin-bypass on read/passive actions (true|false)")
    .option("--log-resource-reads <bool>", "Log resource read access (true|false)")
    .option("--retention-days <n>", "Retention window in days (30-3650)")
    .action(withErrorHandler(async (cmd, orgId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/orgs/${orgId}/audit-settings`, compact({
        enabled: parseBoolOption(o.enabled, "--enabled"),
        logDenials: parseBoolOption(o.logDenials, "--log-denials"),
        logAdminBypassMutating: parseBoolOption(o.logAdminBypassMutating, "--log-admin-bypass-mutating"),
        logAdminBypassPassive: parseBoolOption(o.logAdminBypassPassive, "--log-admin-bypass-passive"),
        logResourceReads: parseBoolOption(o.logResourceReads, "--log-resource-reads"),
        retentionDays: o.retentionDays !== undefined ? Number(o.retentionDays) : undefined,
      })));
    }));

  // Org branding logo. GET/DELETE go through the shared JSON client; PUT sends
  // raw image bytes (the backend accepts a raw binary body or multipart, never
  // JSON), so it builds the request manually with the same auth/org headers
  // ApiClient would attach, without touching the shared HTTP client.
  const branding = org.command("branding").description("Manage the organization's branding logo");

  branding
    .command("get <orgId>")
    .description("Download the organization's branding logo")
    .option("--output <path>", "Write the logo bytes to this file (otherwise prints metadata only)")
    .action(withErrorHandler(async (cmd, orgId) => {
      const { config } = createClient(cmd);
      const url = `${config.apiUrl.replace(/\/$/, "")}/v1/orgs/${orgId}/branding/logo`;
      const headers: Record<string, string> = {};
      if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
      if (config.orgId) headers["X-Org-Id"] = config.orgId;

      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg: string = res.statusText;
        try {
          const data = JSON.parse(text) as Record<string, unknown>;
          msg = String(data.error ?? data.message ?? msg);
        } catch {
          // response body was not JSON; keep statusText
        }
        throw new ApiError(res.status, msg);
      }

      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const buf = Buffer.from(await res.arrayBuffer());
      const outPath = cmd.opts().output as string | undefined;
      if (outPath) {
        await writeFile(outPath, buf);
        console.log(`Logo saved to ${outPath} (${contentType}, ${buf.length} bytes)`);
      } else {
        printOutput({ contentType, sizeBytes: buf.length }, getOutputFormat(cmd));
        console.log("Use --output <path> to save the logo bytes to a file.");
      }
    }));

  branding
    .command("set <orgId> <file>")
    .description("Upload/replace the organization's branding logo (PNG, JPEG, or WEBP)")
    .option("--content-type <mime>", "Override content type (auto-detected from file extension)")
    .action(withErrorHandler(async (cmd, orgId, file) => {
      const { config } = createClient(cmd);
      const filePath = file as string;
      const contentType = detectContentType(filePath, cmd.opts().contentType as string | undefined);
      if (!LOGO_MIME_TYPES.includes(contentType)) {
        throw new Error(
          `Unsupported logo content type "${contentType}". Must be one of: ${LOGO_MIME_TYPES.join(", ")} (use --content-type to override).`
        );
      }

      const bytes = await readFile(filePath);
      const url = `${config.apiUrl.replace(/\/$/, "")}/v1/orgs/${orgId}/branding/logo`;
      const headers: Record<string, string> = { "Content-Type": contentType, Accept: "application/json" };
      if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
      if (config.orgId) headers["X-Org-Id"] = config.orgId;

      const res = await fetch(url, { method: "PUT", headers, body: bytes as unknown as BodyInit });
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      if (!res.ok) {
        const msg = (data as Record<string, unknown>)?.error ?? (data as Record<string, unknown>)?.message ?? res.statusText;
        throw new ApiError(res.status, String(msg), data);
      }
      printOutput(data, getOutputFormat(cmd));
    }));

  branding
    .command("delete <orgId>")
    .description("Remove the organization's branding logo")
    .action(withErrorHandler(async (cmd, orgId) => {
      const { client } = createClient(cmd);
      await client.delete(`/orgs/${orgId}/branding/logo`);
      console.log("Branding logo deleted.");
    }));
}
