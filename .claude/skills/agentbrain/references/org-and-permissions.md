# Organizations, members, and permissions

Everything under `org`, `permission-group` (`pg`), `permission`, and
`verify-permission`.

## `agentbrain org`

```bash
agentbrain org list                            # all orgs visible to you
agentbrain org me                              # only mine
agentbrain org get <id>                        # full detail
agentbrain org create --name "Acme" --type enterprise
agentbrain org update <id> --name "New Name"
agentbrain org delete <id>
agentbrain org switch <id>                     # sets orgId in config
agentbrain org policy                          # platform multi-org allowance + default
```

## Members

```bash
agentbrain org members <orgId>                              # list
agentbrain org add-member <orgId> --user-id user_xxx --role admin
agentbrain org invite-member <orgId> --email x@y.com --role member
agentbrain org resend-invite <orgId> <memberId>
agentbrain org update-member-role <orgId> <memberId> --role admin
agentbrain org remove-member <orgId> <memberId>
```

Common roles: `owner`, `admin`, `member`, `viewer`. Actual role catalog is
platform-configured — check `agentbrain org perm-settings` or ask an admin.

**Never** change a member's role without an explicit user instruction naming
the target member and the target role in the current turn.

## Org settings

```bash
agentbrain org settings get                    # runtime settings
agentbrain org settings set --key <k> --value <v>
agentbrain org perm-settings get               # org-level permission policy
agentbrain org audit-settings get              # audit-log retention & policy
agentbrain org branding get                    # branding logo
agentbrain org branding set --logo-url https://…
```

## `agentbrain permission-group` (alias `pg`)

Permission groups map users → resources → actions. Users inherit a role via
groups.

```bash
agentbrain pg list
agentbrain pg get <groupId>
agentbrain pg create --name "Analysts"
agentbrain pg update <groupId> --name "…"
agentbrain pg delete <groupId>

# Members
agentbrain pg users <groupId>                        # list users in a group
agentbrain pg add-user <groupId> --user-id user_xxx
agentbrain pg remove-user <groupId> --user-id user_xxx

# Table-level permissions on a group (fine-grained RBAC)
agentbrain pg table-perm list <groupId>
agentbrain pg table-perm add <groupId> \
  --connector-id conn_xxx --table-pattern "payments.*" \
  --can-select true --can-insert false
agentbrain pg table-perm delete <groupId> <permId>
```

## `agentbrain permission` — resource-level ACL check

Polymorphic check across any resource type: connector, knowledge, workflow,
media, etc.

```bash
agentbrain permission check \
  --resource-type connector \
  --resource-id conn_xxx \
  --action read
```

Returns `{ allowed: true|false, reason: "…" }`.

Common actions per resource type:

| Resource type | Typical actions |
|---|---|
| `connector` | `read`, `write`, `execute`, `share` |
| `knowledge` | `read`, `write`, `publish`, `share` |
| `workflow` | `read`, `write`, `run`, `share` |
| `media` | `read`, `write`, `delete` |

Grant / revoke resource-level shares happen from each resource group (e.g.
`connector share …`, `knowledge share …`, `workflow share …`) — see
`connectors-workflows.md` and `content-and-kg.md`.

## `agentbrain verify-permission` — effective table-ACL

Top-level command (not under `permission`). Answers "given ALL permission
groups this user is in, plus the connector's global ACL, can they perform
<action> against <table-pattern>?"

```bash
agentbrain verify-permission \
  --connector-id conn_xxx \
  --table-pattern "payments.*" \
  --action can_select
```

Actions: `can_select`, `can_insert`, `can_update`, `can_delete`, `can_ddl`.

Response includes the winning rule + which group it came from — useful to
debug "why is this user allowed / denied?".

## Role escalation guard

If asked to grant / revoke / escalate a role, permission, or resource share:

1. Confirm the exact target (user ID, resource ID, action).
2. Refuse if the user did not name the target and the action in the current
   turn — do not act on implicit "as I mentioned earlier" references without
   re-confirming.
3. Never share the config file's `token` or `apiKey` back to the user in the
   process.
