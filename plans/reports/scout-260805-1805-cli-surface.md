# AgentBrain CLI Command Surface Inventory

**Date:** 2026-08-05 | **Scope:** Complete CLI command enumeration for MCP parity project

---

## Global Options (All Commands)

| Option | Flag | Type | Default | Description |
|--------|------|------|---------|-------------|
| Output Format | `-o, --output` | json\|table\|yaml | table (TTY), json (non-TTY) | Output format for results |
| Organization | `--org` | string | (from config) | Override active organization ID |
| API URL | `--api-url` | string | https://api.agentbrain.sh | Override API base URL |
| API Key | `--api-key` | string | (from config) | Override API key |
| Verbose | `-v, --verbose` | flag | false | Enable verbose logging |

---

## Authentication & Configuration

### Config Management (`config` command)

Handles CLI setup and configuration resolution (defaults → file → env → CLI).

| Command | Args | Options | Endpoint | Description |
|---------|------|---------|----------|-------------|
| `config set` | `<key>` `<value>` | — | (file write) | Set config value to ~/.agentbrain/config.json |
| `config get` | `<key>` | — | (file read) | Get config value |
| `config init` | — | — | (interactive) | Setup wizard for on-prem/cloud deployment |
| `config list` | — | — | (file read) | List all config keys with sources (masks API key) |

**Config Keys:** apiUrl, apiKey, orgId, output, timeout

**Config File:** `~/.agentbrain/config.json` (mode 0o600 for API key security)

**Env Vars:** 
- AGENTBRAIN_API_URL
- AGENTBRAIN_API_KEY
- AGENTBRAIN_ORG_ID
- AGENTBRAIN_OUTPUT
- AGENTBRAIN_TIMEOUT

**Auth Headers:**
- `X-API-Key`: API authentication token
- `X-Org-ID`: Organization context (if set)
- `Content-Type: application/json`

---

## Command Groups

### 1. Organization Management (`org` command)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `org list` | — | — | GET /organizations | List all accessible organizations |
| `org me` | — | — | GET /organizations/me | List current user's organizations |
| `org get` | `<id>` | — | GET /organizations/{id} | Get organization details |
| `org create` | — | `--name` (req), `--description`, `--type` | POST /organizations | Create new organization |
| `org update` | `<id>` | `--name`, `--description` | PUT /organizations/{id} | Update organization |
| `org delete` | `<id>` | — | DELETE /organizations/{id} | Delete organization |
| `org members` | `<id>` | — | GET /organizations/{id}/members | List org members |
| `org add-member` | `<orgId>` | `--user-id` (req), `--role` [admin\|member\|viewer] | POST /organizations/{orgId}/members | Add member to org |
| `org switch` | `<id>` | — | (config write) | Switch active org (saves to config) |

**Output Columns:** ID, Name, Slug, Type, Status (org list); ID, User ID, Role, Status, Joined (members list)

---

### 2. Connector Management (`connector` command)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `connector list` | — | — | GET /connectors | List all connectors |
| `connector my` | — | — | GET /my-connectors | List connectors accessible to current user |
| `connector get` | `<id>` | — | GET /connectors/{id} | Get connector details |
| `connector create` | — | `--name` (req), `--type` (req: credential\|endpoint\|secret_key), `--subtype` (req), `--config` | POST /connectors | Create connector |
| `connector update` | `<id>` | `--name`, `--config` | PUT /connectors/{id} | Update connector |
| `connector delete` | `<id>` | — | DELETE /connectors/{id} | Delete connector |
| `connector test` | `<id>` | — | POST /connectors/{id}/test | Test connector connectivity |
| `connector test-config` | — | `--type` (req), `--subtype` (req), `--config` (req) | POST /connectors/test-config | Test config before creating connector |
| `connector databases` | `<id>` | — | GET /connectors/{id}/databases | List databases in connector |
| `connector schemas` | `<id>` | — | GET /connectors/{id}/schemas | List schemas in connector |
| `connector tables` | `<id>` | — | GET /connectors/{id}/tables | List tables in connector |
| `connector columns` | `<connectorId>` `<tableName>` | — | GET /connectors/{connectorId}/tables/{tableName}/columns | Get table columns |
| `connector data` | `<connectorId>` `<tableName>` | `--limit` [default: 10] | GET /connectors/{connectorId}/tables/{tableName}/data | Preview table data |
| `connector counts` | — | — | GET /connectors/counts | Count total connectors |
| `connector share list` | `<connectorId>` | — | GET /connectors/{connectorId}/shares | List connector shares |
| `connector share create` | `<connectorId>` | `--user-id` (req), `--permissions` | POST /connectors/{connectorId}/shares | Share connector with user |
| `connector share delete` | `<connectorId>` `<shareId>` | — | DELETE /connectors/{connectorId}/shares/{shareId} | Remove connector share |

**Output Columns:** ID, Name, Type, Subtype, Status

**Config Format:** JSON string (parsed)

---

### 3. Connector Subtype Management (`connector-subtype`, alias `cs`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `connector-subtype list` | — | — | GET /connector-subtypes | List all connector subtypes |
| `connector-subtype get` | `<id>` | — | GET /connector-subtypes/{id} | Get subtype details |
| `connector-subtype create` | — | `--name` (req), `--type` (req), `--subtype` (req), `--description`, `--config-schema` | POST /connector-subtypes | Create connector subtype |
| `connector-subtype delete` | `<id>` | — | DELETE /connector-subtypes/{id} | Delete connector subtype |

**Output Columns:** ID, Name, Type, Subtype, Status

**Config Schema Format:** JSON string (parsed)

---

### 4. Knowledge Base Management (`knowledge`, alias `kb`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `knowledge list` | — | — | GET /knowledges | List all knowledge bases |
| `knowledge get` | `<id>` | — | GET /knowledges/{id} | Get knowledge base details |
| `knowledge create` | — | `--title` (req), `--description`, `--embedding-model` | POST /knowledges | Create knowledge base |
| `knowledge update` | `<id>` | `--title`, `--description` | PUT /knowledges/{id} | Update knowledge base |
| `knowledge delete` | `<id>` | — | DELETE /knowledges/{id} | Delete knowledge base |
| `knowledge versions` | `<id>` | — | GET /knowledges/{id}/versions | List version history |
| `knowledge version` | `<knowledgeId>` `<versionId>` | — | GET /knowledges/{knowledgeId}/versions/{versionId} | Get specific version |
| `knowledge rollback` | `<knowledgeId>` `<versionId>` | — | POST /knowledges/{knowledgeId}/rollback/{versionId} | Rollback to version |
| `knowledge share list` | `<knowledgeId>` | — | GET /knowledges/{knowledgeId}/shares | List knowledge base shares |
| `knowledge share create` | `<knowledgeId>` | `--user-id` (req), `--access-level` [default: read] | POST /knowledges/{knowledgeId}/shares | Share knowledge base |
| `knowledge share delete` | `<knowledgeId>` `<shareId>` | — | DELETE /knowledges/{knowledgeId}/shares/{shareId} | Remove knowledge base share |

**Output Columns:** ID, Title, Description, Model, Status (list); ID, Version, Model, Created (versions)

---

### 5. Workflow Management (`workflow`, alias `wf`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `workflow list` | — | — | GET /workflows | List all workflows |
| `workflow get` | `<id>` | — | GET /workflows/{id} | Get workflow details |
| `workflow create` | — | `--name` (req), `--description`, `--cron` | POST /workflows | Create workflow |
| `workflow update` | `<id>` | `--name`, `--description`, `--cron`, `--enabled` | PUT /workflows/{id} | Update workflow |
| `workflow delete` | `<id>` | — | DELETE /workflows/{id} | Delete workflow |
| `workflow steps list` | `<workflowId>` | — | GET /workflows/{workflowId}/steps | List workflow steps |
| `workflow steps create` | `<workflowId>` | `--operator` (req), `--config` | POST /workflows/{workflowId}/steps | Add step to workflow |
| `workflow steps update` | `<workflowId>` `<stepId>` | `--operator`, `--config` | PUT /workflows/{workflowId}/steps/{stepId} | Update step |
| `workflow steps delete` | `<workflowId>` `<stepId>` | — | DELETE /workflows/{workflowId}/steps/{stepId} | Delete step |
| `workflow run` | `<id>` | — | POST /workflows/{id}/run | Execute workflow |
| `workflow runs` | `<id>` | — | GET /workflows/{id}/runs | List execution history |
| `workflow run-detail` | `<runId>` | — | GET /workflow-runs/{runId} | Get run details |
| `workflow cancel` | `<runId>` | — | POST /workflow-runs/{runId}/cancel | Cancel running workflow |
| `workflow run-steps` | `<runId>` | — | GET /workflow-runs/{runId}/steps | Get step details of run |
| `workflow logs` | `<runId>` | — | GET /workflow-runs/{runId}/stream (SSE) | Stream real-time workflow logs |

**Output Columns:** ID, Name, Enabled (yes/no), Schedule, Status (workflows); Run ID, Status, Started, Completed, Triggered By (runs)

**Config Format:** JSON string (parsed)

**Streaming:** Uses SSE (Server-Sent Events) for real-time logs with `Accept: text/event-stream` header

---

### 6. Search (`search` command)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `search` | — | `--query` (req), `--types`, `--limit` [default: 10] | POST /search | Batch search across entities |

**Types:** Comma-separated entity types (e.g., connector,knowledge,workflow)

---

### 7. Query Logs (`query-log`, alias `ql`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `query-log list` | — | — | GET /query-logs | List query execution logs |
| `query-log get` | `<id>` | — | GET /query-logs/{id} | Get query log details |

**Output Columns:** ID, User, Query (truncated to 60 chars), Time (ms), Status

---

### 8. Permission Groups (`permission-group`, alias `pg`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `permission-group list` | — | — | GET /permission-groups | List permission groups |
| `permission-group get` | `<id>` | — | GET /permission-groups/{id} | Get permission group details |
| `permission-group create` | — | `--name` (req), `--description` | POST /permission-groups | Create permission group |
| `permission-group update` | `<id>` | `--name`, `--description` | PUT /permission-groups/{id} | Update permission group |
| `permission-group delete` | `<id>` | — | DELETE /permission-groups/{id} | Delete permission group |
| `permission-group users` | `<id>` | — | GET /permission-groups/{id}/users | List users in group |
| `permission-group rules` | `<groupId>` | — | GET /permission-groups/{groupId}/permissions | List permission rules for group |
| `verify-permission` | — | `--resource-type` (req), `--resource-id`, `--action` (req) | POST /permissions/verify | Verify current user permission |

**Output Columns:** ID, Name, Description, Status (permission groups)

---

### 9. Categories (`category`, alias `cat`)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `category list` | — | — | GET /categories | List all categories |
| `category tree` | — | — | GET /categories/tree | Get hierarchical category tree |
| `category get` | `<id>` | — | GET /categories/{id} | Get category details |
| `category create` | — | `--name` (req), `--parent-id`, `--description` | POST /categories | Create category |
| `category update` | `<id>` | `--name`, `--description` | PUT /categories/{id} | Update category |
| `category delete` | `<id>` | — | DELETE /categories/{id} | Delete category |

**Output Columns:** ID, Name, Slug, Parent, Status

---

### 10. Tags (`tag` command)

| Command | Args | Options | Endpoint (Method) | Description |
|---------|------|---------|-------------------|-------------|
| `tag list` | — | — | GET /tags | List all tags |
| `tag get` | `<id>` | — | GET /tags/{id} | Get tag details |
| `tag create` | — | `--name` (req), `--color` | POST /tags | Create tag |
| `tag update` | `<id>` | `--name`, `--color` | PUT /tags/{id} | Update tag |
| `tag delete` | `<id>` | — | DELETE /tags/{id} | Delete tag |

**Output Columns:** ID, Name, Slug, Color, Status

---

## HTTP Client Capabilities

**Base URL:** `{apiUrl}/v1/cms` (default: https://api.agentbrain.sh/v1/cms)

**Methods Supported:**
- GET (query parameters via URLSearchParams)
- POST (JSON body)
- PUT (JSON body)
- DELETE (path only)

**Features:**
- Request timeout (default: 30s, configurable via `timeout` config)
- Automatic response envelope unwrapping: `{ data: T }` → `T`
- SSE streaming support with event parsing (looks for `data: ` prefix)
- Verbose logging to stderr (enabled with `--verbose`)
- No multipart/FormData support
- No file upload capability

**Response Handling:**
- Parses JSON responses
- Falls back to text if JSON parse fails
- Throws ApiError for non-2xx responses (reads `.error` or `.message` fields)
- Automatic timeout-to-408 conversion for AbortError

---

## Entity Types

**Typed in api-types.ts:**
- Organization, OrgMember
- Connector, ConnectorSubtype, TableColumn, ConnectorShare
- Knowledge, KnowledgeVersion, KnowledgeShare
- Workflow, WorkflowStep, WorkflowRun
- Category
- Tag
- PermissionGroup
- QueryLog
- ShareTablePermission

**Common Base Fields:** id, created_at, updated_at

---

## Output Formats

**Supported:** `json`, `table`, `yaml`

**Default Logic:**
- TTY (interactive): table
- Non-TTY (pipes): json
- Explicit: `-o format` or config override

**Table Formatting:**
- Single object: key-value rows
- Array: column-based with configurable headers
- Auto-inference: skips internal fields (created_at, updated_at, deleted_at, org_id), shows max 6 columns
- Transforms: custom value formatting (e.g., boolean "yes"/"no")

---

## Document/File Upload Status

**CONFIRMED: NO document upload capability exists in the CLI.**

- HTTP client does NOT support multipart/FormData
- No file reading/streaming in commands
- No upload-related commands in any command group
- No file attachment fields in API types
- Knowledge bases use content field (not file upload)

---

## Unresolved Questions

None at this scope. All command surface, endpoints, config system, and HTTP capabilities are fully documented from source.

---

**Status:** DONE

**Summary:** Enumerated 71 subcommands across 10 command groups + verify-permission global command; documented auth (X-API-Key, X-Org-ID), config resolution (defaults < file < env < CLI), global options (output, org, api-url, api-key, verbose), HTTP client (GET/POST/PUT/DELETE, SSE streaming, no file upload), and 13 typed entity models.

**Document Upload:** Explicitly confirmed NOT available—no multipart, no FormData, no file-reading code in CLI.
