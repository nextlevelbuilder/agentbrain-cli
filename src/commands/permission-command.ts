import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";
import { PermissionGroup } from "../types/api-types.js";

// Parse a tri-state CLI boolean flag ("true"/"false") into boolean | undefined.
function parseBoolOption(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid value for ${flagName}: expected "true" or "false", got "${value}"`);
}

const GROUP_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "description", header: "Description" },
  { key: "status", header: "Status" },
];

export function registerPermissionCommand(program: Command): void {
  const perm = program.command("permission-group").alias("pg").description("Manage permission groups");

  perm
    .command("list")
    .description("List permission groups")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint<PermissionGroup[]>(cmd, (c) => c.get("/cms/permission-groups"), GROUP_COLUMNS);
    }));

  perm
    .command("get <id>")
    .description("Get permission group details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint<PermissionGroup>(cmd, (c) => c.get(`/cms/permission-groups/${id}`));
    }));

  perm
    .command("create")
    .description("Create a permission group")
    .requiredOption("--name <name>", "Group name")
    .option("--description <desc>", "Description")
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      await fetchAndPrint<PermissionGroup>(cmd, (c) => c.post("/cms/permission-groups", {
        name: opts.name,
        description: opts.description,
      }));
    }));

  perm
    .command("update <id>")
    .description("Update a permission group")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .action(withErrorHandler(async (cmd, id) => {
      const opts = cmd.opts();
      await fetchAndPrint<PermissionGroup>(cmd, (c) => c.put(`/cms/permission-groups/${id}`, {
        name: opts.name,
        description: opts.description,
      }));
    }));

  perm
    .command("delete <id>")
    .description("Delete a permission group")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/permission-groups/${id}`);
      console.log("Permission group deleted.");
    }));

  perm
    .command("users <id>")
    .description("List users in a permission group")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/permission-groups/${id}/users`));
    }));

  perm
    .command("subtree-user-count <groupId>")
    .description("Count distinct active users in a department's subtree (dept groups only)")
    .action(withErrorHandler(async (cmd, groupId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/permission-groups/${groupId}/subtree-user-count`));
    }));

  // Connector table-level permission rules (per permission group)
  const tablePerm = perm.command("table-perm").description("Manage connector table-level permission rules for a group");

  tablePerm
    .command("list <groupId>")
    .description("List table permission rules for a group")
    .option("--connector-id <id>", "Filter by connector ID")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Page size")
    .action(withErrorHandler(async (cmd, groupId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get(`/cms/permission-groups/${groupId}/table-permissions`, compact({
        connectorId: o.connectorId,
        page: o.page,
        limit: o.limit,
      }) as Record<string, string>));
    }));

  tablePerm
    .command("create <groupId>")
    .description("Create a table permission rule for a group")
    .requiredOption("--connector-id <id>", "Connector ID")
    .option("--database-name <name>", "Database name")
    .option("--schema-name <name>", "Schema name")
    .requiredOption("--table-pattern <pattern>", "Table name or glob pattern")
    .option("--is-denied", "Deny instead of allow (default: allow)")
    .option("--can-select", "Allow SELECT")
    .option("--can-insert", "Allow INSERT")
    .option("--can-update", "Allow UPDATE")
    .option("--can-delete", "Allow DELETE")
    .option("--can-create", "Allow CREATE")
    .option("--can-drop", "Allow DROP")
    .option("--can-alter", "Allow ALTER")
    .action(withErrorHandler(async (cmd, groupId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/permission-groups/${groupId}/table-permissions`, {
        connectorId: o.connectorId,
        databaseName: o.databaseName,
        schemaName: o.schemaName,
        tablePattern: o.tablePattern,
        isDenied: Boolean(o.isDenied),
        canSelect: Boolean(o.canSelect),
        canInsert: Boolean(o.canInsert),
        canUpdate: Boolean(o.canUpdate),
        canDelete: Boolean(o.canDelete),
        canCreate: Boolean(o.canCreate),
        canDrop: Boolean(o.canDrop),
        canAlter: Boolean(o.canAlter),
      }));
    }));

  tablePerm
    .command("update <groupId> <tableId>")
    .description("Update a table permission rule")
    .option("--database-name <name>", "Database name")
    .option("--schema-name <name>", "Schema name")
    .option("--table-pattern <pattern>", "Table name or glob pattern")
    .option("--is-denied <bool>", "Deny instead of allow (true|false)")
    .option("--can-select <bool>", "Allow SELECT (true|false)")
    .option("--can-insert <bool>", "Allow INSERT (true|false)")
    .option("--can-update <bool>", "Allow UPDATE (true|false)")
    .option("--can-delete <bool>", "Allow DELETE (true|false)")
    .option("--can-create <bool>", "Allow CREATE (true|false)")
    .option("--can-drop <bool>", "Allow DROP (true|false)")
    .option("--can-alter <bool>", "Allow ALTER (true|false)")
    .action(withErrorHandler(async (cmd, groupId, tableId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.put(`/cms/permission-groups/${groupId}/table-permissions/${tableId}`, compact({
        databaseName: o.databaseName,
        schemaName: o.schemaName,
        tablePattern: o.tablePattern,
        isDenied: parseBoolOption(o.isDenied, "--is-denied"),
        canSelect: parseBoolOption(o.canSelect, "--can-select"),
        canInsert: parseBoolOption(o.canInsert, "--can-insert"),
        canUpdate: parseBoolOption(o.canUpdate, "--can-update"),
        canDelete: parseBoolOption(o.canDelete, "--can-delete"),
        canCreate: parseBoolOption(o.canCreate, "--can-create"),
        canDrop: parseBoolOption(o.canDrop, "--can-drop"),
        canAlter: parseBoolOption(o.canAlter, "--can-alter"),
      })));
    }));

  tablePerm
    .command("delete <groupId> <tableId>")
    .description("Delete a table permission rule")
    .action(withErrorHandler(async (cmd, groupId, tableId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/permission-groups/${groupId}/table-permissions/${tableId}`);
      console.log("Table permission rule deleted.");
    }));

  // A user's permission-group assignments + primary department
  const userGroup = perm.command("user-group").description("Manage a user's permission-group assignments");

  userGroup
    .command("list <userId>")
    .description("List permission groups assigned to a user")
    .action(withErrorHandler(async (cmd, userId) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/users/${userId}/permission-groups`));
    }));

  userGroup
    .command("assign <userId>")
    .description("Assign a user to a permission group")
    .requiredOption("--group-id <id>", "Permission group ID")
    .action(withErrorHandler(async (cmd, userId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/users/${userId}/permission-groups`, {
        permissionGroupId: o.groupId,
      }));
    }));

  userGroup
    .command("remove <userId> <groupId>")
    .description("Remove a user from a permission group")
    .action(withErrorHandler(async (cmd, userId, groupId) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/users/${userId}/permission-groups/${groupId}`);
      console.log("User removed from permission group.");
    }));

  userGroup
    .command("set-primary-department <userId>")
    .description("Reassign a user's primary department")
    .requiredOption("--dept-id <id>", "Department (permission group) ID")
    .action(withErrorHandler(async (cmd, userId) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/users/${userId}/primary-department`, {
        deptId: o.deptId,
      }));
    }));

  // Polymorphic resource-level permissions (grant/revoke/list/audit/check)
  const permTop = program.command("permission").description("Manage polymorphic resource-level permissions");

  permTop
    .command("grant")
    .description("Grant one or more actions to a principal on a resource")
    .requiredOption("--resource-type <type>", "Resource type (e.g. knowledge, folder, workflow)")
    .option("--resource-id <id>", "Resource ID (single target)")
    .option("--resource-ids <ids>", "Comma-separated resource IDs (bulk target; overrides --resource-id)")
    .requiredOption("--principal-kind <kind>", "Principal kind: user|group|role")
    .option("--principal-id <id>", "Principal ID (required for principal-kind=user|group)")
    .option("--principal-role <role>", "Principal role (required for principal-kind=role)")
    .requiredOption("--actions <actions>", "Comma-separated actions to grant (e.g. read,write)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const resourceIds = o.resourceIds ? String(o.resourceIds).split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
      await fetchAndPrint(cmd, (c) => c.post("/cms/permissions/grant", compact({
        resourceType: o.resourceType,
        resourceId: resourceIds ? undefined : o.resourceId,
        resourceIds,
        principalKind: o.principalKind,
        principalId: o.principalId,
        principalRole: o.principalRole,
        actions: String(o.actions).split(",").map((s: string) => s.trim()).filter(Boolean),
      })));
    }));

  permTop
    .command("revoke")
    .description("Revoke one or more actions from a principal on a resource")
    .requiredOption("--resource-type <type>", "Resource type (e.g. knowledge, folder, workflow)")
    .option("--resource-id <id>", "Resource ID (single target)")
    .option("--resource-ids <ids>", "Comma-separated resource IDs (bulk target; overrides --resource-id)")
    .requiredOption("--principal-kind <kind>", "Principal kind: user|group|role")
    .option("--principal-id <id>", "Principal ID (required for principal-kind=user|group)")
    .option("--principal-role <role>", "Principal role (required for principal-kind=role)")
    .requiredOption("--actions <actions>", "Comma-separated actions to revoke (e.g. read,write)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const resourceIds = o.resourceIds ? String(o.resourceIds).split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
      await fetchAndPrint(cmd, (c) => c.post("/cms/permissions/revoke", compact({
        resourceType: o.resourceType,
        resourceId: resourceIds ? undefined : o.resourceId,
        resourceIds,
        principalKind: o.principalKind,
        principalId: o.principalId,
        principalRole: o.principalRole,
        actions: String(o.actions).split(",").map((s: string) => s.trim()).filter(Boolean),
      })));
    }));

  permTop
    .command("resource")
    .description("List permission grants on a resource")
    .requiredOption("--resource-type <type>", "Resource type")
    .requiredOption("--resource-id <id>", "Resource ID")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/permissions/resource", {
        resource_type: o.resourceType,
        resource_id: o.resourceId,
      }));
    }));

  permTop
    .command("audit")
    .description("List the permission grant/revoke audit trail for a resource")
    .requiredOption("--resource-type <type>", "Resource type")
    .requiredOption("--resource-id <id>", "Resource ID")
    .option("--from <iso>", "Start time (RFC3339)")
    .option("--to <iso>", "End time (RFC3339)")
    .option("--limit <n>", "Max results")
    .option("--cursor <cursor>", "Pagination cursor (from a previous page's nextCursor)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/permissions/audit", compact({
        resource_type: o.resourceType,
        resource_id: o.resourceId,
        from: o.from,
        to: o.to,
        limit: o.limit,
        cursor: o.cursor,
      }) as Record<string, string>));
    }));

  permTop
    .command("check")
    .description("Check whether the current user can perform an action on a resource")
    .requiredOption("--resource-type <type>", "Resource type")
    .requiredOption("--resource-id <id>", "Resource ID")
    .requiredOption("--action <action>", "Action to check")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/permissions/check", {
        resource_type: o.resourceType,
        resource_id: o.resourceId,
        action: o.action,
      }));
    }));

  permTop
    .command("check-default")
    .description("Check the org-level default permission for a resource type + action (no resource_id)")
    .requiredOption("--resource-type <type>", "Resource type")
    .requiredOption("--action <action>", "Action to check")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/permissions/check-default", {
        resource_type: o.resourceType,
        action: o.action,
      }));
    }));

  // Verify permission — table-ACL resolver (POST /permissions/verify).
  const validTableActions = ["can_select", "can_insert", "can_update", "can_delete", "can_create", "can_drop", "can_alter"];
  program
    .command("verify-permission")
    .description("Verify the effective table-ACL decision for a connector + table pattern + action")
    .requiredOption("--connector-id <id>", "Connector ID")
    .requiredOption("--table-pattern <pattern>", "Table name or glob pattern (e.g. \"payments.*\")")
    .requiredOption("--action <action>", `Action to check (one of: ${validTableActions.join(", ")})`)
    .action(withErrorHandler(async (cmd) => {
      const opts = cmd.opts();
      if (!validTableActions.includes(opts.action)) {
        throw new Error(`Invalid --action "${opts.action}". Must be one of: ${validTableActions.join(", ")}`);
      }
      await fetchAndPrint(cmd, (c) => c.post("/permissions/verify", {
        connectorId: opts.connectorId,
        tablePattern: opts.tablePattern,
        action: opts.action,
      }));
    }));
}
