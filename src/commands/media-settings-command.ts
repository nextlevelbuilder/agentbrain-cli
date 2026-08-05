import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, compact, parseJsonOption } from "../utils/command-helpers.js";

// Org-level media admin settings + BYO storage bucket lifecycle. Backed by
// backend-go modules/media/module.go routes under /cms/admin/media-settings/*
// and the member-readable /cms/media/storage/readiness endpoint.
export function registerMediaSettings(media: Command): void {
  const settings = media.command("settings").description("Manage org media admin settings");

  settings
    .command("get")
    .description("Get org media admin settings")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/admin/media-settings"));
    }));

  settings
    .command("update")
    .description("Update org media admin settings (only named fields are changed)")
    .option("--enabled <bool>", "Enable/disable the media module (true|false)")
    .option("--transcribe-enabled <bool>", "Enable/disable transcription (true|false)")
    .option("--parts-concurrency <n>", "Concurrent upload parts (1-10)")
    .option("--max-upload-bytes-mb <n>", "Max upload size in MB (1-5000)")
    .option("--extra-mime-deny-list <json>", 'JSON array of extra denied MIME types, e.g. \'["image/heic"]\'')
    .option("--max-retry-attempts <n>", "Max worker retry attempts (1-10)")
    .option("--refine-auto-fail-enabled <bool>", "Auto-fail stuck refine runs (true|false)")
    .option("--dlq-replay-daily-quota <n>", "Daily DLQ replay quota per org (0-1000)")
    .option("--default-media-pipeline <json>", "JSON pipeline config object, e.g. \'{\"_version\":1}\'")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch("/cms/admin/media-settings", compact({
        enabled: parseBoolOption(o.enabled),
        transcribeEnabled: parseBoolOption(o.transcribeEnabled),
        partsConcurrency: o.partsConcurrency !== undefined ? Number(o.partsConcurrency) : undefined,
        maxUploadBytesMb: o.maxUploadBytesMb !== undefined ? Number(o.maxUploadBytesMb) : undefined,
        extraMimeDenyList: parseJsonOption(o.extraMimeDenyList, "--extra-mime-deny-list"),
        maxRetryAttempts: o.maxRetryAttempts !== undefined ? Number(o.maxRetryAttempts) : undefined,
        refineAutoFailEnabled: parseBoolOption(o.refineAutoFailEnabled),
        dlqReplayDailyQuota: o.dlqReplayDailyQuota !== undefined ? Number(o.dlqReplayDailyQuota) : undefined,
        defaultMediaPipeline: parseJsonOption(o.defaultMediaPipeline, "--default-media-pipeline"),
      })));
    }));

  const storage = media.command("storage").description("Manage BYO bucket storage credentials and readiness");

  storage
    .command("probe")
    .description("Validate BYO bucket credentials without persisting them")
    .requiredOption("--provider <provider>", "Storage provider: r2 | s3 | gcs")
    .option("--creds <json>", "JSON credentials block matching the provider (r2/s3/gcs shape)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.post("/cms/admin/media-settings/storage/probe", buildStorageCredsBody(cmd)));
    }));

  storage
    .command("verify")
    .description("Validate and persist BYO bucket credentials")
    .requiredOption("--provider <provider>", "Storage provider: r2 | s3 | gcs")
    .option("--creds <json>", "JSON credentials block matching the provider (r2/s3/gcs shape)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.post("/cms/admin/media-settings/storage/verify", buildStorageCredsBody(cmd)));
    }));

  storage
    .command("reverify")
    .description("Re-probe the already-stored BYO bucket credentials")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.post("/cms/admin/media-settings/storage/reverify"));
    }));

  storage
    .command("clear")
    .description("Remove BYO bucket override and revert to platform-default storage")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.delete("/cms/admin/media-settings/storage"));
    }));

  storage
    .command("readiness")
    .description("Check whether org storage is configured and ready for uploads")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/media/storage/readiness"));
    }));
}

// Parses a CLI "true"/"false" string option into a boolean, leaving
// undefined untouched so compact() drops unset flags from the PATCH body.
function parseBoolOption(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected "true" or "false", got: ${value}`);
}

// Builds the discriminated StorageCredsRequest body ({ provider, r2|s3|gcs })
// shared by probe/verify. --creds carries the nested provider-shaped block
// as JSON since the fields differ per provider (account_id/access_key/... for
// r2, region/... for s3, project_id/service_account_json/... for gcs).
function buildStorageCredsBody(cmd: Command): Record<string, unknown> {
  const o = cmd.opts();
  const provider = String(o.provider);
  const creds = parseJsonOption(o.creds, "--creds") ?? {};
  const body: Record<string, unknown> = { provider };
  if (provider === "r2") body.r2 = creds;
  else if (provider === "s3") body.s3 = creds;
  else if (provider === "gcs") body.gcs = creds;
  else throw new Error(`Unknown --provider "${provider}"; expected r2, s3, or gcs`);
  return body;
}
