# Connectors and workflows

`connector`, `connector-subtype`, `workflow` (`wf`), `checkpoint` (`cpt`).

## `agentbrain connector`

Data-source connectors: databases, APIs, sheets, Redis, etc.

```bash
agentbrain connector list                      # all in org
agentbrain connector my                        # accessible to me only
agentbrain connector get <id>
agentbrain connector counts                    # total connectors
agentbrain connector create --name "prod-pg" --type postgres --subtype standard
agentbrain connector update <id> --name "…"
agentbrain connector delete <id>
```

### Test connectivity

```bash
agentbrain connector test <id>                 # test a saved connector
agentbrain connector test-config \
  --type postgres --config '{"host":"…","port":5432,"user":"…","password":"…"}'
```

`test-config` validates a config JSON **before** creating the connector — good
for dry-run in scripts.

### Browse structure

```bash
agentbrain connector databases <id>
agentbrain connector schemas   <id> --database mydb
agentbrain connector tables    <id> --database mydb --schema public
agentbrain connector columns   <id> <tableName>
agentbrain connector data      <id> <tableName> --limit 20   # preview rows
```

### Run SQL (MCP surface — needs `apiKey`)

```bash
agentbrain connector query   <id> --sql "SELECT * FROM t LIMIT 10"    # read-only
agentbrain connector execute <id> --sql "UPDATE …" --yes              # write / DDL
```

`connector execute` is **destructive**. It refuses to run without `--yes`.
Never bypass the guard: if the user asks you to, decline and explain the risk.
Wrap-around scripts should surface the SQL to the user for review before
adding `--yes`.

### Sharing

```bash
agentbrain connector share list <id>
agentbrain connector share create <id> --user-id user_xxx --permission read
agentbrain connector share delete <id> <userId>
```

### Provider-specific subcommands

```bash
agentbrain connector sheets <id> …             # Google Sheets OAuth + browsing
agentbrain connector redis  <id> …             # browse Redis keys and values
```

Run `--help` for each — options depend on provider.

## `agentbrain connector-subtype` (alias `cs`)

Catalog of supported types & subtypes (postgres/standard, mysql/rds,
bigquery/*, etc.).

```bash
agentbrain cs list                             # everything the platform supports
agentbrain cs get <type> <subtype>             # config schema + capabilities
```

Useful before `connector create` to pick the right `--type`/`--subtype` pair.

## `agentbrain workflow` (alias `wf`)

ETL workflows are ordered steps executed by the workflow engine.

```bash
agentbrain wf list
agentbrain wf get <id>
agentbrain wf create --name "ETL" --cron "0 0 * * *"
agentbrain wf update <id> --name "…"
agentbrain wf delete <id>
agentbrain wf stats <id>                       # 24h runs, avg cost, p95 duration
```

### Steps

```bash
agentbrain wf steps list <workflowId>
agentbrain wf steps get  <workflowId> <stepId>
agentbrain wf steps create <workflowId> \
  --step-type transform --step-name "clean" --step-order 1
agentbrain wf steps update <workflowId> <stepId> --step-order 2
agentbrain wf steps delete <workflowId> <stepId>

# Bulk-safe: create the workflow together with all its steps in one call
agentbrain wf create-with-steps --file wf.json
```

### Runs

```bash
agentbrain wf run       <workflowId>                     # trigger now
agentbrain wf runs      <workflowId>                     # execution history
agentbrain wf run-detail <runId>
agentbrain wf run-steps  <runId>                         # per-step outcomes
agentbrain wf logs       <runId>                         # event log stream
agentbrain wf cancel     <runId>                         # abort a running run
```

`logs` can be piped: `agentbrain wf logs <runId> -o json | jq …`.

### Reference catalogs (for building steps)

```bash
agentbrain wf mcp-tools                        # MCP tools you can call from a step
agentbrain wf node-types                       # workflow node type catalog
agentbrain wf references                       # resolve reference fields (connectors, prompts, …)
```

### Grouping

```bash
agentbrain wf move-to-folder <id> --folder-id fld_xxx
agentbrain wf move-to-folder <id>                        # omit --folder-id to ungroup
agentbrain wf bulk-move --ids id1,id2 --folder-id fld_xxx
```

### Sharing

```bash
agentbrain wf share       <id> --principal user_xxx --action run
agentbrain wf revoke-share <id> --principal user_xxx --action run
```

### Webhooks

```bash
agentbrain wf webhook list <workflowId>
agentbrain wf webhook create <workflowId> --url https://… --event completed
agentbrain wf webhook delete <workflowId> <hookId>
```

## `agentbrain checkpoint` (alias `cpt`)

Approval gates inside a workflow run. When a step is configured as a
checkpoint, the run pauses until it is approved / rejected.

```bash
agentbrain cpt list                            # all pending checkpoints in org
agentbrain cpt get <checkpointId>
agentbrain cpt approve <checkpointId> --note "LGTM"
agentbrain cpt reject  <checkpointId> --note "Reject: reason"
agentbrain wf run-checkpoints <workflowId> <runId>       # checkpoints for one run
```

Approving a checkpoint resumes the run. Rejecting cancels it.

Never approve a checkpoint on behalf of the user without an explicit
instruction naming the checkpoint ID and the approval decision in the current
turn.
