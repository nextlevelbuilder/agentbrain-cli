# Setup, auth, and configuration

Everything before you can run a real command.

## `agentbrain config`

Config lives at `~/.agentbrain/config.json` (mode `0600`). Precedence:
**flags > env > file > defaults**.

```bash
agentbrain config init                # interactive wizard
agentbrain config list                # show all, sources; secrets masked
agentbrain config get apiUrl
agentbrain config set apiUrl https://api.agentbrain.sh
agentbrain config set orgId org_xxx
agentbrain config set output json
agentbrain config set timeout 60000
```

### Config keys

| Key | Purpose | Default |
|---|---|---|
| `apiUrl` | Hub API base URL | `https://api.agentbrain.sh` |
| `authUrl` | Builder Auth base URL (separate service) | cloud auth service |
| `tenantId` | Builder Auth tenant ID | (prompted) |
| `token` | Bearer JWT (admin/CMS) — masked in `list` | — |
| `refreshToken` | For silent token rotation — masked | — |
| `apiKey` | X-API-Key for MCP surface — masked | — |
| `orgId` | Default org ID (sent as `X-Org-Id`) | — |
| `output` | `json` / `table` / `yaml` | `table` on TTY, `json` on pipe |
| `timeout` | Request timeout in ms | `30000` |

**Never** read `token`, `refreshToken`, or `apiKey` back to the user or write
them to logs. `config list` masks these — do not bypass with `config get`.

## `agentbrain auth`

The bearer JWT is short-lived. Use `auth login` instead of pasting `token`.

```bash
agentbrain auth login                       # prompts email + password
agentbrain auth login --email you@x.com
agentbrain auth login --username <name>     # username-based deployments
agentbrain auth status                      # verify who you are
agentbrain auth logout                      # revoke + clear stored tokens
```

`auth login` requires `authUrl` and `tenantId`. Provide via config, env, or
flags:

```bash
--auth-url https://auth.agentbrain.sh   |   AGENTBRAIN_AUTH_URL
--tenant  <id>                          |   AGENTBRAIN_TENANT_ID
```

On success `auth login` stores `token` and `refreshToken` in the config file
(mode `0600`).

### Silent refresh

Admin commands transparently refresh the access token via `/v1/auth/refresh`
when they hit a `401`, retry once, and write the rotated pair back to the
config. You should not need to re-run `auth login` until the refresh token
itself expires (typically weeks).

Signs the refresh token has expired: `auth status` returns 401, or admin
commands 401 twice in a row. In that case run `auth login` again.

## The two-credential model

| Surface | Header | Config key | Applies to |
|---|---|---|---|
| Admin / CMS | `Authorization: Bearer <jwt>` | `token` | ~90% of commands |
| MCP | `X-API-Key: <key>` | `apiKey` | `retrieve-context`, `ai-policy`, `connector query`, `connector execute`, `governance ai-policy` |

`X-Org-Id: <orgId>` is sent on every request.

## Environment variables

All flags have env equivalents. Precedence: flag > env > file.

| Env var | Overrides |
|---|---|
| `AGENTBRAIN_TOKEN` | `--token` |
| `AGENTBRAIN_API_KEY` | `--api-key` |
| `AGENTBRAIN_API_URL` | `--api-url` |
| `AGENTBRAIN_ORG_ID` | `--org` |
| `AGENTBRAIN_AUTH_URL` | `--auth-url` |
| `AGENTBRAIN_TENANT_ID` | `--tenant` |

Useful in CI: export the token/apiKey as secrets, skip `config` entirely.

## `agentbrain me` and `agentbrain user`

- `agentbrain me get` — current user profile (verifies the JWT).
- `agentbrain me update --name "…"` — update your own profile.
- `agentbrain user get <id>` — look up another user by ID.
- `agentbrain user list` — list users (permission-scoped).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` on admin cmd | JWT expired, refresh missing/expired | `agentbrain auth login` |
| `401` on `retrieve-context` / `connector query` | wrong or missing `apiKey` | `agentbrain config set apiKey …` |
| `403 Missing X-Org-Id` | no `orgId` in config | `agentbrain org switch <id>` |
| `403 Forbidden` when member | RBAC — user not in the group | `agentbrain permission-group users <groupId>` then add |
| `ECONNREFUSED` | wrong `apiUrl` (self-hosted) | `agentbrain config set apiUrl <url>` |
| `Timeout after 30000ms` on upload | slow link or big file | `agentbrain config set timeout 120000` or use `--no-sha256` |
| Silent-refresh loop, then 401 | refresh token expired | `agentbrain auth login` again |
| `X-API-Key required` on write SQL | needs `apiKey` (MCP surface) | `agentbrain config set apiKey …` |
| `Package name mismatch` at install | old package name `agentbrain` still on machine | `npm uninstall -g agentbrain && npm i -g agentbrain-cli` |

Run any command with `--verbose` to see the outgoing request line, chosen
resolution source for each option, and the response status. Presigned-URL
signatures are redacted in verbose logs.

## Multi-org workflow

```bash
agentbrain org me                          # list orgs I'm in
agentbrain org switch org_A                # sets orgId in config
agentbrain … --org org_B                   # one-off override for a single call
AGENTBRAIN_ORG_ID=org_B agentbrain …       # one-shell override
```

## Multi-tenant / on-premise

If the platform is deployed on-premise or with a private auth service:

```bash
agentbrain config set apiUrl  https://hub.internal.example.com
agentbrain config set authUrl https://auth.internal.example.com
agentbrain config set tenantId <tenant>
```

Then log in. `config init` walks the same fields interactively.
