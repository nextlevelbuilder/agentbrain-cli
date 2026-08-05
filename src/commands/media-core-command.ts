import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";
import { uploadMedia, MediaKind } from "../utils/media-upload.js";

const MEDIA_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "fileName", header: "File" },
  { key: "kind", header: "Kind" },
  { key: "contentType", header: "Type" },
  { key: "sizeBytes", header: "Size" },
  { key: "status", header: "Status" },
];

// Core media commands: the flagship 3-step upload plus asset CRUD and access.
export function registerMediaCore(media: Command): void {
  media
    .command("upload <file>")
    .description("Upload a document/media file (presign → PUT → commit)")
    .option("--folder-id <id>", "Destination folder ID")
    .option("--kind <kind>", "Asset kind: audio | video | image | raw_doc (auto-detected)")
    .option("--content-type <mime>", "Override content type (auto-detected from extension)")
    .option("--no-sha256", "Skip client-side sha256 (auto-skipped for very large files)")
    .action(withErrorHandler(async (cmd, file) => {
      const opts = cmd.opts();
      const { client } = createClient(cmd);
      const result = await uploadMedia(client, {
        filePath: file as string,
        folderId: opts.folderId,
        kind: opts.kind as MediaKind | undefined,
        contentType: opts.contentType,
        // commander sets `sha256` to false when --no-sha256 is passed, else undefined
        computeSha256: opts.sha256 === false ? false : undefined,
      });
      console.log(JSON.stringify(result, null, 2));
    }));

  media
    .command("list")
    .description("List media assets")
    .option("--folder-id <id>", "Filter by folder")
    .option("--kind <kind>", "Filter by kind")
    .option("--status <status>", "Filter by status")
    .option("--limit <n>", "Max results")
    .option("--offset <n>", "Result offset")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.get("/cms/media", compact({
        folder_id: o.folderId,
        kind: o.kind,
        status: o.status,
        limit: o.limit,
        offset: o.offset,
      }) as Record<string, string>), MEDIA_COLUMNS);
    }));

  media
    .command("get <id>")
    .description("Get media asset details")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/${id}`));
    }));

  media
    .command("update <id>")
    .description("Update media asset metadata")
    .option("--file-name <name>", "New file name")
    .option("--folder-id <id>", "Move to folder")
    .action(withErrorHandler(async (cmd, id) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch(`/cms/media/${id}`, compact({
        fileName: o.fileName,
        folderId: o.folderId,
      })));
    }));

  media
    .command("delete <id>")
    .description("Delete a media asset")
    .action(withErrorHandler(async (cmd, id) => {
      const { client } = createClient(cmd);
      await client.delete(`/cms/media/${id}`);
      console.log("Media asset deleted.");
    }));

  media
    .command("bulk-delete")
    .description("Delete multiple media assets")
    .requiredOption("--ids <ids>", "Comma-separated asset IDs")
    .action(withErrorHandler(async (cmd) => {
      const ids = cmd.opts().ids.split(",").map((s: string) => s.trim()).filter(Boolean);
      await fetchAndPrint(cmd, (c) => c.post("/cms/media/bulk-delete", { ids }));
    }));

  media
    .command("download-url <id>")
    .description("Get a presigned GET URL for an asset")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/${id}/presigned-get`));
    }));

  media
    .command("preview <id>")
    .description("Get the structured preview of an asset")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.get(`/cms/media/${id}/structured-preview`));
    }));

  media
    .command("transcribe <id>")
    .description("Trigger transcription for an audio/video asset")
    .action(withErrorHandler(async (cmd, id) => {
      await fetchAndPrint(cmd, (c) => c.post(`/cms/media/${id}/transcribe`));
    }));
}
