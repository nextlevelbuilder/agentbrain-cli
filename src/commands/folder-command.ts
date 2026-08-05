import { Command } from "commander";
import {
  withErrorHandler,
  fetchAndPrint,
  parseJsonOption,
  compact,
} from "../utils/command-helpers.js";

const FOLDER_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "parentId", header: "Parent ID" },
  { key: "path", header: "Path" },
  { key: "depth", header: "Depth" },
];

const TRASH_LIST_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "resourceType", header: "Type" },
  { key: "parentId", header: "Parent ID" },
  { key: "deletedAt", header: "Deleted At" },
  { key: "depth", header: "Depth" },
];

// ApiClient.delete() has no query-params parameter (unlike get()), so DELETE
// endpoints that need query args (confirm_token, resource_types) build the
// query string inline and append it to the path.
function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function registerFolderCommand(program: Command): void {
  const folder = program.command("folder").description("Manage folders");

  folder
    .command("create")
    .description("Create a new folder")
    .requiredOption("--name <name>", "Folder name")
    .option("--parent-id <id>", "Parent folder ID")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post("/cms/folders", compact({
        parentId: o.parentId,
        name: o.name,
      })));
    }));

  folder
    .command("list")
    .description("List folders (omit --parent-id for root folders)")
    .option("--parent-id <id>", "Filter by parent folder ID")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/folders", compact({
        parent_id: o.parentId,
      })), FOLDER_COLUMNS);
    }));

  folder
    .command("get <id>")
    .description("Get folder details (ancestors, subtree counts, pipeline config)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/folders/${id}`));
    }));

  folder
    .command("update <id>")
    .description("Update a folder (rename, template bindings, pipeline config)")
    .option("--name <name>", "New folder name")
    .option("--step1-template-id <id>", "Set default step-1 template ID")
    .option("--clear-step1-template", "Clear the default step-1 template binding")
    .option("--step2-template-id <id>", "Set default step-2 template ID")
    .option("--clear-step2-template", "Clear the default step-2 template binding")
    .option("--pipeline-config <json>", "Set folder pipeline config override (JSON)")
    .option("--clear-pipeline-config", "Clear pipeline config override (inherit org default)")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      const body: Record<string, unknown> = compact({ name: o.name });

      if (o.clearStep1Template) {
        body.defaultStep1TemplateId = null;
      } else if (o.step1TemplateId) {
        body.defaultStep1TemplateId = o.step1TemplateId;
      }

      if (o.clearStep2Template) {
        body.defaultStep2TemplateId = null;
      } else if (o.step2TemplateId) {
        body.defaultStep2TemplateId = o.step2TemplateId;
      }

      if (o.clearPipelineConfig) {
        body.pipelineConfig = null;
      } else if (o.pipelineConfig) {
        body.pipelineConfig = parseJsonOption(o.pipelineConfig, "--pipeline-config");
      }

      await fetchAndPrint(cmd, (c) => c.patch(`/cms/folders/${id}`, body));
    }));

  folder
    .command("move <id>")
    .description("Move a folder to a new parent (omit --parent-id to move to root)")
    .option("--parent-id <id>", "New parent folder ID")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.post(`/cms/folders/${id}/move`, {
        newParentId: o.parentId ?? null,
      }));
    }));

  folder
    .command("delete <id>")
    .description("Delete a folder and its subtree (soft delete)")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/folders/${id}`));
    }));

  // --- Trash lifecycle ---
  const trash = folder.command("trash").description("Manage folder trash / soft-deletes");

  trash
    .command("preview <id>")
    .description("Preview a folder's soft-delete impact and obtain a confirm token")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/folders/${id}/trash/preview`));
    }));

  trash
    .command("restore <id>")
    .description("Restore a soft-deleted folder and its subtree")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/folders/${id}/trash/restore`));
    }));

  trash
    .command("purge <id>")
    .description("Permanently delete a soft-deleted folder (requires confirm token from preview)")
    .requiredOption("--confirm-token <token>", "Confirm token from `folder trash preview`")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      const qs = toQueryString({ confirm_token: o.confirmToken });
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/folders/${id}/trash${qs}`));
    }));

  trash
    .command("list")
    .description("List org-level trash (default resource type: folder)")
    .option("--resource-types <types>", "Comma-separated resource types (e.g. folder,media_asset)")
    .option("--limit <n>", "Max results")
    .option("--offset <n>", "Result offset")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/trash", compact({
        resource_types: o.resourceTypes,
        limit: o.limit,
        offset: o.offset,
      })), TRASH_LIST_COLUMNS);
    }));

  trash
    .command("empty")
    .description("Permanently delete all soft-deleted root resources of one type (default: folder)")
    .option("--resource-types <type>", "Resource type to empty (single type)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const qs = toQueryString({ resource_types: o.resourceTypes });
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/trash${qs}`));
    }));

  trash
    .command("bulk-purge")
    .description("Purge up to 100 soft-deleted resources of the same type")
    .requiredOption("--resource-type <type>", "Resource type (e.g. folder, media_asset)")
    .requiredOption("--ids <ids>", "Comma-separated resource IDs")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const ids = String(o.ids).split(",").map((s: string) => s.trim()).filter(Boolean);
      await fetchAndPrint(cmd, (c) => c.post("/cms/trash/bulk-purge", {
        resourceType: o.resourceType,
        ids,
      }));
    }));

  trash
    .command("item-preview <resourceType> <id>")
    .description("Preview a soft-delete impact for any resource type and obtain a confirm token")
    .action(withErrorHandler(async (cmd, resourceType, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/trash/${resourceType}/${id}/preview`));
    }));

  trash
    .command("item-restore <resourceType> <id>")
    .description("Restore a soft-deleted resource of any type")
    .action(withErrorHandler(async (cmd, resourceType, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/trash/${resourceType}/${id}/restore`));
    }));

  trash
    .command("item-purge <resourceType> <id>")
    .description("Permanently delete a soft-deleted resource of any type (requires confirm token)")
    .requiredOption("--confirm-token <token>", "Confirm token from `folder trash item-preview`")
    .action(withErrorHandler(async (cmd, resourceType, id) => {
      const o = cmd.opts();
      const qs = toQueryString({ confirm_token: o.confirmToken });
      await fetchAndPrint(cmd, (c) => c.delete(`/cms/trash/${resourceType}/${id}${qs}`));
    }));
}
