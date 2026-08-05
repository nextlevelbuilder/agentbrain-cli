import { Command } from "commander";
import { withErrorHandler, fetchAndPrint, createClient, compact } from "../utils/command-helpers.js";

export function registerMeCommand(program: Command): void {
  const me = program.command("me").description("Manage the authenticated user's own profile");

  me
    .command("get")
    .description("Get the authenticated user's profile")
    .action(withErrorHandler(async (cmd) => {
      await fetchAndPrint(cmd, (c) => c.get("/me"));
    }));

  me
    .command("update")
    .description("Update the authenticated user's profile (partial patch)")
    .option("--first-name <name>", "First name")
    .option("--last-name <name>", "Last name")
    .option("--avatar-url <url>", "Avatar URL")
    .option("--locale <locale>", "Locale (vi|en)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      await fetchAndPrint(cmd, (c) => c.patch("/me/profile", compact({
        firstName: o.firstName,
        lastName: o.lastName,
        avatarUrl: o.avatarUrl,
        locale: o.locale,
      })));
    }));

  const user = program.command("user").description("Look up users");

  user
    .command("search")
    .description("Search for users within an organization (by name/email/username)")
    .requiredOption("--q <query>", "Search text, 2-64 characters")
    .option("--org-id <id>", "Organization ID to search within (defaults to --org/config orgId)")
    .option("--limit <n>", "Max results, 1-50 (default 20)")
    .action(withErrorHandler(async (cmd) => {
      const o = cmd.opts();
      const { config } = createClient(cmd);
      const orgId = o.orgId ?? config.orgId;
      if (!orgId) {
        throw new Error(
          "org_id is required: pass --org-id, or set a default org via `agentbrain config set orgId <id>` / --org <id>."
        );
      }
      await fetchAndPrint(cmd, (c) => c.get("/users/search", compact({
        q: o.q,
        org_id: orgId,
        limit: o.limit,
      }) as Record<string, string>));
    }));
}
