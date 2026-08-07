# Admin & observability

`cost`, `usage`, `dashboard`, `audit`, `me`, `user`, `system`.

## `agentbrain cost` — budget and spend

```bash
agentbrain cost budget get                                # current period budget + used
agentbrain cost budget set --amount 500 --period monthly
agentbrain cost spend --from 2026-08-01 --to 2026-08-31   # itemized spend
agentbrain cost spend --group-by provider                 # spend by openai/anthropic/…
agentbrain cost spend --group-by model
agentbrain cost alerts list                               # threshold alerts
agentbrain cost alerts create --threshold 80 --channel email
```

Currency is USD by default; enterprise orgs can configure others via
`org settings`.

## `agentbrain usage` — LLM usage metrics

```bash
agentbrain usage metrics summary                          # tokens in/out, calls, cost, latency
agentbrain usage metrics summary --from 2026-08-01
agentbrain usage metrics daily --from 2026-08-01
agentbrain usage metrics by-user
agentbrain usage metrics by-model

agentbrain usage calls list                               # individual LLM calls
agentbrain usage calls get <callId>                       # full request/response
agentbrain usage calls list --workflow-id wf_xxx --limit 50
```

`calls get` returns the prompt + completion — treat both as sensitive; do
not paste them into logs or shared docs.

`usage` also has resource-scoped variants:

```bash
agentbrain usage by-knowledge  --knowledge-id kb_xxx
agentbrain usage by-connector  --connector-id conn_xxx
agentbrain usage by-workflow   --workflow-id wf_xxx
```

## `agentbrain dashboard` — org aggregates

```bash
agentbrain dashboard summary                              # everything on one call
agentbrain dashboard trends --from 2026-08-01             # KPI trends
agentbrain dashboard media                                # ingestion pipeline stats
agentbrain dashboard kg                                   # KG pipeline stats
```

`summary` is convenient for a "how is the org doing" one-liner. Trends are
better for charts / weekly reports.

## `agentbrain audit` — audit log

Every mutation is logged with actor, action, resource, and result.

```bash
agentbrain audit list                                     # recent, all events
agentbrain audit list --from 2026-08-01 --to 2026-08-07
agentbrain audit list --actor user_xxx
agentbrain audit list --action delete --resource-type knowledge
agentbrain audit get <auditId>

# Resource-scoped variants (faster if you know the resource)
agentbrain audit for-resource --type connector --id conn_xxx
```

Retention window is org-configurable via `agentbrain org audit-settings`.

## `agentbrain me`

Manage the currently authenticated user's own profile.

```bash
agentbrain me get
agentbrain me update --name "New Name" --avatar-url https://…
agentbrain me sessions list                               # active sessions
agentbrain me sessions revoke <sessionId>
agentbrain me tokens list                                 # own personal access tokens
agentbrain me tokens create --name "ci" --expires-in 30d
agentbrain me tokens revoke <tokenId>
```

**`me tokens create` returns a secret value once.** Never echo it back to the
user or into logs. If the user needs it, tell them to copy it from their
terminal and rotate it if it was exposed.

## `agentbrain user`

Look up other users (permission-scoped — admins see all; members see peers).

```bash
agentbrain user list
agentbrain user get <userId>
agentbrain user search --email you@x.com
```

Never dump the user list to any destination the user did not name. Emails +
IDs are PII.

## `agentbrain system` — platform admin (root only)

Cross-tenant operations. Requires a platform-root JWT; ordinary org admins
get `403`.

```bash
agentbrain system health                                  # platform-wide health
agentbrain system tenants list                            # every tenant
agentbrain system tenants get <tenantId>
agentbrain system orgs list --tenant <tenantId>           # orgs in tenant
agentbrain system flags list                              # feature flags
agentbrain system flags set --key <k> --value <v>
agentbrain system jobs list                               # platform job queues
```

**Ultra-privileged.** Do not run any `system` command without an explicit
instruction that names the exact operation and target. Do not enable feature
flags on the user's behalf without asking. Do not list tenants and paste them
into any shared surface.

## Cross-cutting: pipe to `jq`

Almost every read command supports `-o json`. Combine with `jq`:

```bash
agentbrain usage metrics daily -o json | jq '.[] | {day, tokens: .totalTokens}'
agentbrain audit list -o json | jq '.[] | select(.action == "delete")'
agentbrain cost spend --group-by model -o json | jq 'sort_by(-.cost)'
```

This is safer than parsing table output — table columns can change between
releases.
