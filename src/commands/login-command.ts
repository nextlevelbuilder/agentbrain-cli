import { Command } from "commander";
import { login, LoginMode } from "../client/auth-client.js";
import { ApiClient } from "../client/http-client.js";
import { getConfig, setConfigValue } from "../config/config-manager.js";
import { withErrorHandler } from "../utils/command-helpers.js";
import { promptText, promptSecret } from "../utils/interactive-prompt.js";

interface LoginOptions {
  email?: string;
  username?: string;
  password?: string;
  authUrl?: string;
  tenant?: string;
}

// `agentbrain login` — exchange credentials with the Builder Auth service for a
// bearer JWT and persist it as config `token`. This replaces the manual
// `config set token <jwt>` step; re-run whenever the JWT expires.
export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate and store a bearer token for admin/CMS commands")
    .option("--email <email>", "Email to log in with (email identifier mode)")
    .option("--username <username>", "Username to log in with (username identifier mode)")
    .option(
      "--password <password>",
      "Password (INSECURE: visible in shell history — prefer the interactive prompt)"
    )
    .option("--auth-url <url>", "Builder Auth service base URL (overrides config authUrl)")
    .option("--tenant <id>", "Builder Auth tenant ID (overrides config tenantId)")
    .action(
      withErrorHandler(async (cmd) => {
        const opts = cmd.opts<LoginOptions>();
        const config = getConfig();

        const authUrl = (opts.authUrl ?? config.authUrl).trim();
        if (!authUrl) {
          throw new Error(
            "No Builder Auth URL configured. Pass --auth-url, set AGENTBRAIN_AUTH_URL, or run `agentbrain config set authUrl <url>`."
          );
        }

        let tenantId = (opts.tenant ?? config.tenantId).trim();
        if (!tenantId) {
          tenantId = (await promptText("Tenant ID: ")).trim();
        }
        if (!tenantId) {
          throw new Error(
            "Tenant ID is required. Pass --tenant, set AGENTBRAIN_TENANT_ID, or run `agentbrain config set tenantId <id>`."
          );
        }

        // Identifier mode follows whichever flag was supplied; default email.
        const mode: LoginMode = opts.username !== undefined ? "username" : "email";
        let identifier = (mode === "username" ? opts.username : opts.email)?.trim() ?? "";
        if (!identifier) {
          identifier = await promptText(mode === "username" ? "Username: " : "Email: ");
        }
        if (!identifier) {
          throw new Error(`${mode === "username" ? "Username" : "Email"} is required.`);
        }

        // Never accept an empty password; prompt (hidden) when not passed.
        let password = opts.password ?? "";
        if (!password) {
          password = await promptSecret("Password: ");
        }
        if (!password) {
          throw new Error("Password is required.");
        }

        const result = await login({
          authUrl,
          tenantId,
          mode,
          identifier,
          password,
          timeout: config.timeout,
        });

        // Persist the JWT (config-manager writes the file mode 0600).
        setConfigValue("token", result.accessToken);

        console.log("Login successful. Bearer token saved to ~/.agentbrain/config.json");
        if (result.expiresIn) {
          console.log(`Token expires in ~${Math.round(result.expiresIn / 60)} min. Re-run \`agentbrain login\` when it lapses.`);
        }

        // Best-effort: confirm the token works and greet the user by identity.
        // Non-fatal — the token is already stored regardless.
        try {
          const client = new ApiClient(getConfig());
          const me = await client.get<{ email?: string; username?: string; firstName?: string }>("/me");
          const who = me.email ?? me.username ?? me.firstName;
          if (who) console.log(`Logged in as ${who}.`);
        } catch {
          // Ignore — profile fetch is a convenience, not part of login success.
        }
      })
    );
}
