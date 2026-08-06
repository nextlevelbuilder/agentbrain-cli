import { Command } from "commander";
import { login, logout as authLogout, LoginMode } from "../client/auth-client.js";
import { getConfig, setConfigValue, unsetConfigValues } from "../config/config-manager.js";
import { createClient, withErrorHandler } from "../utils/command-helpers.js";
import { promptText, promptSecret } from "../utils/interactive-prompt.js";

interface LoginOptions {
  email?: string;
  username?: string;
  password?: string;
  authUrl?: string;
  tenant?: string;
}

// `agentbrain auth *` — user session lifecycle against the Builder Auth
// service (a separate service from the hub `apiUrl`). Replaces the manual
// `config set token <jwt>` step; combined with silent refresh in ApiClient
// this covers the entire JWT lifecycle without human copy-paste.
export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Manage authentication (login, logout, status)");

  auth
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
    .action(withErrorHandler(runLogin));

  auth
    .command("logout")
    .description("Revoke the current session and clear stored tokens")
    .action(withErrorHandler(runLogout));

  auth
    .command("status")
    .description("Show the currently logged-in user (verifies the stored token)")
    .action(withErrorHandler(runStatus));
}

async function runLogin(cmd: Command): Promise<void> {
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

  // Persist both tokens — the refreshToken is what enables silent refresh in
  // ApiClient on subsequent 401s. config-manager writes with mode 0600.
  setConfigValue("token", result.accessToken);
  if (result.refreshToken) setConfigValue("refreshToken", result.refreshToken);

  console.log("Login successful. Tokens saved to ~/.agentbrain/config.json");
  if (result.expiresIn) {
    console.log(
      `Access token expires in ~${Math.round(result.expiresIn / 60)} min; will refresh automatically.`
    );
  }

  // Best-effort: confirm the token works and greet the user by identity.
  // Non-fatal — the token is already stored regardless.
  try {
    const { client } = createClient(cmd);
    const me = await client.get<{ email?: string; username?: string; firstName?: string }>("/me");
    const who = me.email ?? me.username ?? me.firstName;
    if (who) console.log(`Logged in as ${who}.`);
  } catch {
    // Ignore — profile fetch is a convenience, not part of login success.
  }
}

async function runLogout(_cmd: Command): Promise<void> {
  const config = getConfig();

  // Best-effort server-side revoke. A network/HTTP failure must NOT prevent us
  // from clearing the local tokens, otherwise the user is stuck with an
  // unlogoutable stale session.
  if (config.token && config.authUrl && config.tenantId) {
    try {
      await authLogout({
        authUrl: config.authUrl,
        tenantId: config.tenantId,
        accessToken: config.token,
        timeout: config.timeout,
      });
    } catch (err) {
      console.error(`(warn) server-side logout failed: ${(err as Error).message}`);
    }
  }

  unsetConfigValues(["token", "refreshToken"]);
  console.log("Logged out. Stored tokens cleared.");
}

async function runStatus(cmd: Command): Promise<void> {
  const config = getConfig();
  if (!config.token) {
    console.log("Not logged in. Run `agentbrain auth login`.");
    process.exitCode = 1;
    return;
  }
  // Use createClient so silent refresh + config write-back are wired.
  const { client } = createClient(cmd);
  const me = await client.get<{ email?: string; username?: string; firstName?: string; lastName?: string; locale?: string }>("/me");
  const identity = me.email ?? me.username ?? "(unknown)";
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
  console.log(`Logged in as ${identity}${name ? ` (${name})` : ""}.`);
  console.log(`API: ${config.apiUrl}`);
  if (config.orgId) console.log(`Org: ${config.orgId}`);
}
