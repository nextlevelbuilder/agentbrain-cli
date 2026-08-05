import { Command } from "commander";
import { registerMediaCore } from "./media-core-command.js";
import { registerMediaJobs } from "./media-jobs-command.js";
import { registerMediaSettings } from "./media-settings-command.js";

// `media` command group — document/media upload, assets, digest jobs, and
// storage settings. Split across files to keep each focused.
export function registerMediaCommand(program: Command): void {
  const media = program.command("media").description("Upload and manage media assets, digest jobs, and storage");
  registerMediaCore(media);
  registerMediaJobs(media);
  registerMediaSettings(media);
}
