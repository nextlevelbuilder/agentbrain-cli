# AgentBrain CLI

TypeScript command-line tool for interacting with the AgentBrain enterprise data hub API.

Full-coverage admin CLI: manage organizations, connectors, knowledge bases, documents/media, workflows, the knowledge graph, permissions, LLM/prompt config, cost & usage, audit logs, and system settings — all from the terminal. It covers the same backend surface as the AgentBrain MCP server plus the broader CMS admin API.

## Installation

Install via npm:

```bash
npm install -g agentbrain
```

Or with pnpm:

```bash
pnpm add -g agentbrain
```

Requires Node 20+.

## Authentication model

AgentBrain uses **two credentials** depending on which surface you call:

| Surface | Commands | Credential |
| --- | --- | --- |
| Admin / CMS (default) | Almost everything | **Bearer JWT** — config key `token` |
| MCP surface | `retrieve-context`, `connector query`, `connector execute`, `governance ai-policy` | **API key** — config key `apiKey` |

Every request also sends your organization ID (`orgId`) as the `X-Org-Id` header.

> **Breaking change (upgrading from an apiKey-only setup):** admin/CMS commands now require a **bearer token** (`token`), not the API key. The API key still authenticates the MCP-surface commands listed above. If you previously configured only `apiKey`, set `token` as well.

The bearer JWT is short-lived, so instead of pasting it manually use the `auth` command group:

```bash
agentbrain auth login                        # prompts email + password (hidden)
agentbrain auth login --email you@example.com
agentbrain auth status                       # verify who you're logged in as
agentbrain auth logout                       # revoke + clear stored tokens
```

`auth login` authenticates against the **Builder Auth** service — a separate service from the hub `apiUrl` — and stores both the access token (as `token`) and the refresh token (as `refreshToken`) in `~/.agentbrain/config.json` (mode `0600`). It needs two settings, resolvable from config, env, or flags:

- `authUrl` — Builder Auth base URL (defaults to the cloud auth service; `--auth-url` / `AGENTBRAIN_AUTH_URL` to override)
- `tenantId` — your deployment's tenant ID (`--tenant` / `AGENTBRAIN_TENANT_ID`; prompted if unset)

**Silent refresh:** once you're logged in, admin commands will silently refresh the access token via `/v1/auth/refresh` when they hit a `401`, retry once, and write the rotated pair back to your config. You should not need to re-run `auth login` until the refresh token itself expires. Username-based deployments use `agentbrain auth login --username <name>`.

## Quick Start

### Option 1: Interactive Setup (Recommended)

```bash
agentbrain config init
```

The wizard prompts for API URL, a bearer token (JWT, for admin/CMS commands), an optional API key (only for MCP-surface commands), and a default organization ID. Choose cloud `https://api.agentbrain.sh` or a custom on-premise URL.

### Option 2: Manual Configuration

```bash
# Admin/CMS surface (most commands): bearer JWT
agentbrain config set token <your-jwt>
agentbrain config set apiUrl https://api.agentbrain.sh
agentbrain config set orgId org_xxxxx

# MCP surface (only for `agentbrain mcp *`): API key
agentbrain config set apiKey sk_live_xxxxx
```

### Verify Setup

```bash
agentbrain me get
```

## Uploading documents & media

Upload runs the AgentBrain 3-step flow automatically: **presign → PUT the raw bytes to storage → commit**. Kind (`raw_doc`/`image`/`audio`/`video`) and content-type are auto-detected from the file extension; a client-side `sha256` is computed for integrity (auto-skipped for very large files). Max size 500MB.

```bash
# Upload a document (auto-detects kind/content-type)
agentbrain media upload ./report.pdf

# Upload into a folder, overriding kind/content-type
agentbrain media upload ./notes.txt --folder-id fld_xxx --kind raw_doc --content-type text/plain

# Skip client-side sha256 (e.g. for large files)
agentbrain media upload ./big-video.mp4 --no-sha256

# Manage uploaded assets
agentbrain media list --folder-id fld_xxx --kind raw_doc
agentbrain media get <id>
agentbrain media update <id> --file-name "renamed.pdf" --folder-id fld_yyy
agentbrain media download-url <id>        # presigned GET URL
agentbrain media preview <id>             # structured preview
agentbrain media transcribe <id>          # audio/video transcription
agentbrain media delete <id>
agentbrain media bulk-delete --ids id1,id2,id3
```

## Usage

The CLI groups commands by domain. Run `agentbrain --help` for the full list, or `agentbrain <group> --help` for a group.

### Organizations

```bash
agentbrain org list
agentbrain org get <id>
agentbrain org create --name "Acme Corp" --type "enterprise"
agentbrain org switch org_xxxxx

# Members
agentbrain org members <id>
agentbrain org add-member <orgId> --user-id user_xxxxx --role admin
agentbrain org update-member-role <orgId> <memberId> --role admin
agentbrain org remove-member <orgId> <memberId>
```

### Connectors

```bash
agentbrain connector list
agentbrain connector get <id>
agentbrain connector create --name "PostgreSQL" --type postgres --subtype standard
agentbrain connector test <id> --config '{...}'

# Inspect data sources
agentbrain connector databases <id>
agentbrain connector schemas <id> --database mydb
agentbrain connector tables <id> --database mydb --schema public

# Sharing (share with a user, then optionally revoke)
agentbrain connector share create <id> --user-id user_xxxxx --permission read
agentbrain connector share list <id>
agentbrain connector share delete <id> <userId>
```

### Knowledge Bases

```bash
agentbrain knowledge list
agentbrain knowledge get <id>
agentbrain knowledge by-slug <slug>
agentbrain knowledge create --title "Product Docs"

# Publishing & relationships
agentbrain knowledge publish <id>
agentbrain knowledge unpublish <id>
agentbrain knowledge related <id>

# Versions
agentbrain knowledge versions <id>
agentbrain knowledge version <id> <versionId>
agentbrain knowledge rollback <id> <versionId>

# Public share link
agentbrain knowledge share <id> --expires-in 86400 --max-access-count 50
```

### Documents & Media

See [Uploading documents & media](#uploading-documents--media) above, plus background jobs and org media settings:

```bash
agentbrain media job list
agentbrain media settings get
```

### Workflows

```bash
agentbrain workflow list
agentbrain workflow create --name "ETL Job" --cron "0 0 * * *"

# Steps
agentbrain workflow steps list <id>
agentbrain workflow steps create <id> --step-type transform --step-name "clean" --step-order 1

# Execute and monitor
agentbrain workflow run <id>
agentbrain workflow runs <id>
agentbrain workflow logs <id> <runId>
agentbrain workflow cancel <id> <runId>
```

### Knowledge Graph

```bash
agentbrain kg entity list
agentbrain kg relation list
agentbrain kg graph summary --include-orphaned     # also: top | community <id> | neighbors <entityId>
agentbrain kg extraction status
agentbrain kg taxonomy list
```

### Permissions

```bash
agentbrain permission-group list                 # alias: pg
agentbrain permission-group create --name "Analysts"
agentbrain permission-group users <groupId>
agentbrain permission-group table-perm list <groupId>

# Resource-level checks (current user)
agentbrain permission check --resource-type connector --resource-id conn_xxx --action read

# Verify the effective table-ACL decision (top-level command)
agentbrain verify-permission \
  --connector-id conn_xxx --table-pattern "payments.*" --action can_select
```

### Other Command Groups

```bash
agentbrain category list                 # + category tree
agentbrain folder list
agentbrain tag list
agentbrain search --query "my-connector"
agentbrain query-log list
agentbrain llm provider list             # LLM provider config
agentbrain prompt template list          # prompt templates
agentbrain cost budget get               # cost budget & spend
agentbrain usage metrics summary         # usage metrics
agentbrain dashboard summary             # dashboard aggregates
agentbrain audit list                    # audit logs
agentbrain system health                 # platform system status
agentbrain retrieve-context --question "..."   # MCP context retrieval (uses apiKey)
```

## Configuration

Config stored at `~/.agentbrain/config.json` (mode 0600 for security).

Resolution order (highest to lowest priority):

1. CLI flags (`--token`, `--api-key`, `--api-url`, `--org`, `--output`)
2. Environment variables (`AGENTBRAIN_TOKEN`, `AGENTBRAIN_API_KEY`, `AGENTBRAIN_API_URL`, …)
3. Config file (`~/.agentbrain/config.json`)
4. Defaults

View / edit config:

```bash
agentbrain config list          # secrets (token, apiKey) are masked
agentbrain config get token
agentbrain config set timeout 60000
```

Supported config keys:

- `apiUrl` — API endpoint (default: https://api.agentbrain.sh)
- `token` — bearer JWT for admin/CMS commands (set automatically by `agentbrain auth login`; masked in `config list`)
- `refreshToken` — refresh token for silent access-token rotation (set automatically by `auth login`; masked in `config list`)
- `apiKey` — API key for MCP-surface commands (`retrieve-context`, `connector query`/`execute`, `governance ai-policy`)
- `orgId` — default organization ID
- `authUrl` — Builder Auth service base URL used by `auth login` and silent refresh (default: cloud auth service)
- `tenantId` — Builder Auth tenant ID used by `auth login` and silent refresh
- `output` — output format: json, table, yaml (default: table for TTY, json for pipes)
- `timeout` — request timeout in ms (default: 30000)

## Output Formats

Default behavior:

- **TTY (interactive terminal)** → table format (colored, human-readable)
- **Pipe/redirect** → json format (machine-readable)

Override with `--output`:

```bash
agentbrain org list --output json
agentbrain org list --output yaml
agentbrain org list --output table
```

## Global Options

All commands support:

```bash
--api-url <url>      Override API endpoint
--token <jwt>        Override bearer token (admin/CMS)
--api-key <key>      Override API key (mcp)
--org <id>           Override organization ID
--output <fmt>       Output format: json, table, yaml
--verbose            Enable request logging (presigned URL signatures are redacted)
```

## Error Handling

Errors include the HTTP status code, the API error message, and full response data in verbose mode (`--verbose`).

```bash
agentbrain org get invalid-id 2>&1
# Error 404: Organization not found
```

## Development

```bash
git clone https://github.com/nextlevelbuilder/agentbrain-cli
cd agentbrain-cli
pnpm install
pnpm build
pnpm test
```

Dev mode with watch:

```bash
pnpm dev
```

## License

MIT
