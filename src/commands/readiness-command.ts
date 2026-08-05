import { Command } from "commander";
import { withErrorHandler, fetchAndPrint } from "../utils/command-helpers.js";

// Pre-flight readiness checks so callers can confirm a prerequisite is
// configured before attempting an LLM- or storage-dependent action.
// Backed by backend-go modules/aiconfig (GET /cms/aiconfig/readiness) and
// modules/media (GET /cms/media/storage/readiness). Both are member-readable
// (bearer auth, no admin gate) — CMS surface, not MCP.
export function registerReadinessCommand(program: Command): void {
  const readiness = program.command("readiness").description("Check readiness of LLM and storage prerequisites");

  readiness
    .command("aiconfig")
    .description("Check per-use-case LLM readiness (chat, embedding, vision, transcription, extract_kg, ...)")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/aiconfig/readiness"));
    }));

  readiness
    .command("media-storage")
    .description("Check whether org BYO bucket storage is configured and ready for uploads")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/cms/media/storage/readiness"));
    }));
}
