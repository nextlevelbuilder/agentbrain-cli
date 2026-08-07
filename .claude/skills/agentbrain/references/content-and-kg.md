# Content and knowledge graph

`knowledge` (`kb`), `category` (`cat`), `tag`, `folder`, `kg`, `search`,
`query-log` (`ql`).

## `agentbrain knowledge` (alias `kb`)

Knowledge bases hold structured/unstructured content that becomes searchable
and retrievable via MCP.

```bash
agentbrain kb list
agentbrain kb get <id>
agentbrain kb by-slug <slug>                              # in current org
agentbrain kb page-by-slug <orgSlug> <slug>               # public projection
agentbrain kb create --title "Product Docs"
agentbrain kb update <id> --title "…"
agentbrain kb delete <id>
```

### Publish + share

```bash
agentbrain kb publish   <id>                              # exposes public slug
agentbrain kb unpublish <id>
agentbrain kb share <id> --expires-in 86400 --max-access-count 50
```

`share` returns a public URL with a scoped token. Do not print the token back
into shared channels.

### Versions

Every save creates a version. You can inspect and roll back.

```bash
agentbrain kb versions <id>
agentbrain kb version <knowledgeId> <versionId>
agentbrain kb rollback <knowledgeId> <versionId>
```

### Related & KG projections

```bash
agentbrain kb related <id> --limit 10                     # pgvector cosine similarity
agentbrain kb kg-entities <id>                            # KG entities extracted from this KB
agentbrain kb kg-summary  <id>                            # entity/relation counts, top entities
```

## `agentbrain category` (alias `cat`)

Two-level taxonomy for knowledges and workflows.

```bash
agentbrain cat list
agentbrain cat tree                                       # hierarchical view
agentbrain cat get <id>
agentbrain cat create --name "Legal" --parent-id <id>
agentbrain cat update <id> --name "…"
agentbrain cat delete <id>
```

## `agentbrain tag`

Free-form labels.

```bash
agentbrain tag list
agentbrain tag get <id>
agentbrain tag create --name "priority"
agentbrain tag update <id> --name "…"
agentbrain tag delete <id>
```

## `agentbrain folder`

Physical grouping for media + workflows in the UI.

```bash
agentbrain folder list                                    # top level
agentbrain folder tree                                    # full tree
agentbrain folder get <id>
agentbrain folder create --name "Q4-reports" --parent-id <id>
agentbrain folder update <id> --name "…"
agentbrain folder delete <id>
```

## `agentbrain search`

Batch full-text + vector search across all indexed entities.

```bash
agentbrain search --query "my-connector"
agentbrain search --query "…" --types knowledge,connector,workflow
agentbrain search --query "…" --limit 25 -o json
```

## `agentbrain query-log` (alias `ql`)

Every SQL query run through `connector query`/`execute` is logged.

```bash
agentbrain ql list
agentbrain ql list --connector-id conn_xxx --limit 50
agentbrain ql get <queryId>
```

## `agentbrain kg` — the knowledge graph

Entities (nodes) + relations (edges) auto-extracted from KB content and
manually curated.

### Entities

```bash
agentbrain kg entity list
agentbrain kg entity get <entityId>
agentbrain kg entity create --type Person --label "Ada Lovelace"
agentbrain kg entity update <entityId> --label "…"
agentbrain kg entity delete <entityId>

agentbrain kg entities-by-knowledge --knowledge-id kb_xxx
agentbrain kg entities-batch-read --ids id1,id2,id3
```

### Relations

```bash
agentbrain kg relation list
agentbrain kg relation get <relationId>
agentbrain kg relation create \
  --source-id ent_a --target-id ent_b --type "WORKS_AT"
agentbrain kg relation delete <relationId>
```

### Type catalogs

```bash
agentbrain kg entity-type   list        # entity type catalog
agentbrain kg entity-type   create --name Person
agentbrain kg relation-type list
agentbrain kg relation-type create --name WORKS_AT
```

### Graph canvas (read-only aggregations)

```bash
agentbrain kg graph summary                               # global stats
agentbrain kg graph summary --include-orphaned
agentbrain kg graph top                                   # top entities by centrality
agentbrain kg graph community <communityId>               # dive into one community
agentbrain kg graph neighbors <entityId> --hops 2         # local neighborhood
```

### Extraction pipeline

```bash
agentbrain kg extraction status                           # global pipeline status
agentbrain kg extraction runs                             # recent runs
agentbrain kg extraction run --knowledge-id kb_xxx        # trigger re-extraction
```

### Row-facts (structured extraction from tabular data)

```bash
agentbrain kg row-facts list
agentbrain kg row-facts trigger --connector-id conn_xxx --table t --schema public
```

### KG admin (maintainer-level)

```bash
agentbrain kg taxonomy list                               # active taxonomies
agentbrain kg admin analyzer …                            # analyzer config
agentbrain kg admin quality …                             # entity/relation quality metrics
agentbrain kg admin extraction …                          # ops on extraction runs
agentbrain kg admin governance …                          # policy for what KG can ingest
```

Run `agentbrain kg admin --help` for the current subtree — the admin surface
evolves faster than the core.
