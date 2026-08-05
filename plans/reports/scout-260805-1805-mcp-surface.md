# AgentBrain MCP Server — Complete Tool Surface Inventory

**Report Date:** 2026-08-05  
**Source:** AgentBrain MCP Go server @ `/internal/tools/tier1` + `/internal/resources`  
**Scope:** All MCP tools + resource templates exposed to CLI clients  

---

## 1. Session & Organization Management

### 1.1 `whoami` (Tool)
- **Type:** Read-only, idempotent
- **Input params:** None
- **Backend endpoint:** Combines multiple sources (no single API call)
- **Description:** Returns userId, selected/available orgs, session metadata
- **Output:** userId, orgId, selectedOrgId, availableOrgCount, availableOrgs[], selectedOrg?, requiresOrgSelection, orgSelectionHint, apiKeyHash, clientUA
- **Gating:** Session required; returns org selection hint if needed
- **Feature gates:** None

### 1.2 `set_org` (Tool)
- **Type:** Idempotent mutation
- **Input params:**
  - `orgId` (string, optional) — org UUID
  - `slug` (string, optional) — org slug
  - `name` (string, optional) — org name
  - (At least one required)
- **Backend endpoint:** GET `/v1/mcp/organizations/me` (org listing)
- **Description:** Switch active organization for subsequent calls
- **Output:** orgId, org (full object), ok=true on success
- **Gating:** Session required; member visibility check
- **Feature gates:** None

### 1.3 `list({resourceType: 'organization'})` (Polymorphic Tool)
- **Type:** Read-only, idempotent
- **Input params:**
  - `resourceType` = "organization"
  - `query` (map, optional) — pagination/filter (unused by org endpoint)
- **Backend endpoint:** GET `/v1/mcp/organizations/me`
- **Description:** List visible organizations with name, slug, status, role, member count
- **Output:** {success, data[{id, name, slug, logoUrl, type, employeeSize, myRole, status, isApproved, memberCount}], paging?}
- **Gating:** Session required
- **Feature gates:** None

---

## 2. AI Data Governance

### 2.1 `ai_policy` (Tool)
- **Type:** Read-only, idempotent, advisory
- **Input params:**
  - `folderId` (string, optional) — folder context
  - `dataClass` (string, optional) — "email", "secrets", etc.
  - `surface` (string, optional) — "mcp" or other surface
  - `useCase` (string, optional) — "chat", "embedding", "vision", etc.
  - `externalCloud` (bool, optional) — external cloud flag
- **Backend endpoint:** GET `/v1/mcp/ai-governance/effective-policy?folderId=...&dataClass=...&surface=...&useCase=...&externalCloud=...`
- **Description:** Check AI Data Governance decision before exposing PII/secrets (advisory; BE enforces)
- **Output:** Policy envelope with allowed/blocked actions, redaction flags, reason
- **Gating:** Session + org required
- **Feature gates:** None

---

## 3. Search & Discovery

### 3.1 `search` (Tool)
- **Type:** Read-only, idempotent
- **Input params:**
  - `query` (string, required) — free-text FTS or semantic query
  - `resourceType` (string, optional) — single type filter (alias for types=[type])
  - `types` (string[], optional) — multi-type filter (overrides resourceType)
  - `limit` (int, optional) — 1..100, default 20
  - `semantic` (bool, optional) — enable vector+FTS (per-org cost cap applies)
- **Backend endpoint:** POST `/v1/mcp/search`
- **Description:** Polymorphic search across 9 types in one round-trip
- **Supported types:** "connector", "knowledge", "workflow", "category", "tag", "vault", "kg_entity", "media", "folder"
- **Output:** Search results array with resource id, title, type, etc.
- **Gating:** Session + org required
- **Feature gates:** Org-level search + semantic features checked

### 3.2 `retrieve_context` (Tool)
- **Type:** Read-only, idempotent
- **Input params:**
  - `question` (string, required) — natural language question
  - `mode` (string, optional) — "auto|kb|kg|mixed", default "auto"
  - `limit` (int, optional) — 1..20, default 8
  - `includeGraph` (bool*, optional) — include KG relations, default true
  - `includeCitations` (bool*, optional) — include source citations, default true
- **Backend endpoint:** POST `/v1/mcp/retrieve-context`
- **Description:** KB/KG question answering with evidence, citations, entities, visible relations
- **Output:** Evidence array, citations, entities, relations, follow-up hints
- **Gating:** Session + org required
- **Feature gates:** None

---

## 4. CRUD Operations — Polymorphic Interface

All CRUD operations share the `PolymorphicArgs` input shape:
- `resourceType` (string, required) — resource type
- `id` (string, optional) — resource UUID (required for read/update/delete)
- `payload` (map, optional) — body for create/update
- `query` (map, optional) — query params for list
- `confirmToken` (string, optional) — folder delete confirmation

### 4.1 `read` (Tool)
- **Type:** Read-only, idempotent
- **Accepted resourceTypes:** folder, knowledge, media_asset, connector, workflow, kg_entity, checkpoint, organization, workflow_run (read-only)
- **Endpoints:**
  - folder: GET `/v1/mcp/folders/{id}`
  - knowledge: GET `/v1/mcp/knowledges/{id}`
  - media_asset: GET `/v1/mcp/media/{id}`
  - connector: GET `/v1/mcp/connectors/{id}`
  - workflow: GET `/v1/mcp/workflows/{id}`
  - kg_entity: GET `/v1/mcp/kg/entities/{id}/detail` (admin-only detail view)
  - workflow_run: GET `/v1/mcp/workflow-runs/{id}`
  - checkpoint: Routed via call(checkpoint.*) actions only
  - organization: GET `/v1/mcp/organizations/me` (filtered)
- **Output:** Full resource object
- **Feature gates:** Per-resource-type (folder, knowledge, media, etc.)

### 4.2 `list` (Tool)
- **Type:** Read-only, idempotent
- **Accepted resourceTypes:** folder, knowledge, media_asset, connector, workflow, kg_entity, category, tag, checkpoint, organization, workflow_run
- **Endpoints:**
  - folder: GET `/v1/mcp/folders`
  - knowledge: GET `/v1/mcp/knowledges`
  - media_asset: GET `/v1/mcp/media`
  - connector: GET `/v1/mcp/my-connectors`
  - workflow: GET `/v1/mcp/workflows`
  - kg_entity: GET `/v1/mcp/kg/entities` (admin-only)
  - category: GET `/v1/mcp/categories`
  - tag: GET `/v1/mcp/tags`
  - organization: GET `/v1/mcp/organizations/me` (filtered)
  - workflow_run: GET `/v1/mcp/workflows/{workflowId}/runs` (query.workflowId required)
- **Query params:** limit, page, search, sort, etc. (resource-dependent)
- **Output:** Paginated array of resource summaries
- **Feature gates:** Per-resource-type

### 4.3 `create` (Tool)
- **Type:** Write
- **Accepted resourceTypes:** folder, knowledge, media_asset, connector, workflow, kg_entity, category, tag
- **Endpoints:**
  - folder: POST `/v1/mcp/folders`
  - knowledge: POST `/v1/mcp/knowledges`
  - connector: NOT exposed via Tier-1 MCP
  - workflow: POST `/v1/mcp/workflows`
  - kg_entity: POST `/v1/mcp/kg/entities` (admin-only)
  - category: POST `/v1/mcp/categories`
  - tag: POST `/v1/mcp/tags`
- **Knowledge payload:** {title, markdownContent, htmlContent?, slug?, description?, aiContext?, categoryId?, folderId?, tagIds?}
  - Creator auto-granted admin; if folderId supplied, inherits folder ACL
  - Returns kbPagePath/url when MCP_ADMIN_BASE_URL set
- **Output:** Full created resource + id
- **Feature gates:** Per-resource-type

### 4.4 `update` (Tool)
- **Type:** Write
- **Accepted resourceTypes:** folder, knowledge, media_asset, connector, workflow, kg_entity
- **Endpoints:**
  - folder: PATCH `/v1/mcp/folders/{id}`
  - knowledge: PUT `/v1/mcp/knowledges/{id}` (normalized payload)
  - media_asset: PATCH `/v1/mcp/media/{id}`
  - connector: NOT exposed via Tier-1 MCP
  - workflow: PUT `/v1/mcp/workflows/{id}`
  - kg_entity: PATCH `/v1/mcp/kg/entities/{id}` (admin-only)
- **Output:** Updated resource
- **Feature gates:** Per-resource-type

### 4.5 `delete` (Tool)
- **Type:** Write, destructive
- **Accepted resourceTypes:** knowledge, media_asset, workflow, kg_entity, folder (special handling)
- **Endpoints:**
  - knowledge: DELETE `/v1/mcp/knowledges/{id}`
  - media_asset: DELETE `/v1/mcp/media/{id}`
  - workflow: DELETE `/v1/mcp/workflows/{id}`
  - kg_entity: DELETE `/v1/mcp/kg/entities/{id}` (admin-only)
  - folder: FolderTrashRouter (soft-delete with cascade preview + confirmToken)
- **Folder delete flow:**
  - First call: returns cascadePreview + confirmToken + status
  - Re-call with confirmToken: completes soft-delete
  - Restore via call(folder.trash_restore, {folderId})
  - Purge via call(folder.trash_purge, {folderId}) — irreversible
- **Output:** Resource or {status, hint, cascadePreview, confirmToken, payload}
- **Feature gates:** Per-resource-type

---

## 5. Self-Discovery

### 5.1 `describe` (Tool)
- **Type:** Read-only, idempotent
- **Input params:** Exactly one of:
  - `toolName` (string) — returns tool description + accepted resourceTypes + relatedPrompts
  - `resourceType` (string) — returns which tools accept this type
  - `action` (string) — returns action def (name, description, example, readinessDeps, relatedPrompts, requiredFeatures)
- **Backend endpoint:** None (local introspection)
- **Description:** Self-discovery for tools, resource types, and call actions
- **Output:** Depends on input; includes tool/action schemas, examples, prompt guidance
- **Feature gates:** None

---

## 6. Action-Dispatch Interface — call()

**Whitelist:** 46 actions across workflow, checkpoint, knowledge, connector, permission, media, KG, folder, readiness domains.

### 6.1 Workflow Lifecycle

#### `workflow.run`
- **Params:** {workflowId: UUID}
- **Endpoint:** POST `/v1/mcp/workflows/{workflowId}/run`
- **Description:** Trigger a workflow run by id
- **Output:** Workflow run object with id, status, createdAt

#### `workflow.create_with_steps`
- **Params:** {workflow: {name, description?, scheduleType?, ...}, steps: [{stepOrder, stepType, stepName, stepConfig, ...}]}
- **Endpoint:** POST `/v1/mcp/workflows/with-steps`
- **Description:** Create workflow + steps atomically
- **Output:** Workflow object with id + steps

#### `workflow.replace_steps`
- **Params:** {workflowId: UUID, steps: [...]}
- **Endpoint:** PUT `/v1/mcp/workflows/{workflowId}/steps/replace`
- **Description:** Atomically replace all workflow steps
- **Output:** {steps: [...]}

#### `workflow.move_to_folder`
- **Params:** {workflowId: UUID, folderId: UUID|null}
- **Endpoint:** PATCH `/v1/mcp/workflows/{workflowId}/folder`
- **Description:** Move workflow to folder; null detaches to org root
- **Output:** Updated workflow

#### `workflow.webhook.list`
- **Params:** {workflowId: UUID}
- **Endpoint:** GET `/v1/mcp/workflows/{workflowId}/webhooks`
- **Description:** List inbound webhook triggers (publicId + secretPrefix, never raw secret)
- **Output:** Array of trigger objects

#### `workflow.webhook.create`
- **Params:** {workflowId: UUID, name: string, enabled?: bool, payloadLimitBytes?: 1024..1048576}
- **Endpoint:** POST `/v1/mcp/workflows/{workflowId}/webhooks`
- **Description:** Create inbound webhook trigger (secret returned once only)
- **Output:** Trigger with secret

#### `workflow.webhook.update`
- **Params:** {workflowId: UUID, triggerId: UUID, name?: string, enabled?: bool, payloadLimitBytes?: 1024..1048576}
- **Endpoint:** PATCH `/v1/mcp/workflows/{workflowId}/webhooks/{triggerId}`
- **Description:** Update webhook trigger name/enabled/payload limit
- **Output:** Updated trigger

#### `workflow.webhook.rotate_secret`
- **Params:** {workflowId: UUID, triggerId: UUID}
- **Endpoint:** POST `/v1/mcp/workflows/{workflowId}/webhooks/{triggerId}/rotate-secret`
- **Description:** Rotate webhook secret (returned once only)
- **Output:** Trigger with new secret

#### `workflow.webhook.delete`
- **Params:** {workflowId: UUID, triggerId: UUID}
- **Endpoint:** DELETE `/v1/mcp/workflows/{workflowId}/webhooks/{triggerId}`
- **Description:** Delete inbound webhook trigger
- **Output:** {status: "deleted"}

#### `workflow.node_types.list`
- **Params:** {}
- **Endpoint:** GET `/v1/mcp/workflows/node-types`
- **Description:** List compact workflow node catalog (for agent planning)
- **Output:** Array of node type summaries {type, label, category, configSchema, configUiSchema}
- **Related prompts:** workflow__design-overview, workflow__step-extract

#### `workflow.node_types.describe`
- **Params:** {type: string}
- **Endpoint:** GET `/v1/mcp/workflows/node-types/{type}`
- **Description:** Describe one workflow node type with compact fields and references
- **Output:** Full node type schema
- **Related prompts:** workflow__design-overview, workflow__step-extract

#### `workflow.reference_options`
- **Params:** {kind: string, action: string, q?: string, limit?: int, nodeType?: string, fieldKey?: string}
- **Endpoint:** GET `/v1/mcp/workflows/reference-options?kind=...&action=...`
- **Description:** Search workflow-safe reference options for config IDs
- **Output:** Array of reference options

#### `workflow.reference_resolve`
- **Params:** {refs: [{kind, action, ids: []}]}
- **Endpoint:** POST `/v1/mcp/workflows/reference-resolve`
- **Description:** Resolve saved workflow reference IDs into labels or unavailable states
- **Output:** Array of resolved references

### 6.2 Workflow Run Operations

#### `workflow_run.cancel`
- **Params:** {workflowRunId: UUID}
- **Endpoint:** POST `/v1/mcp/workflow-runs/{workflowRunId}/cancel`
- **Description:** Cancel in-flight workflow run
- **Output:** Updated run

#### `workflow_run.resume`
- **Params:** {workflowRunId: UUID}
- **Endpoint:** POST `/v1/mcp/workflow-runs/{workflowRunId}/resume`
- **Description:** Resume manually-paused workflow run
- **Output:** Updated run

#### `workflow_run.retry`
- **Params:** {workflowRunId: UUID}
- **Endpoint:** POST `/v1/mcp/workflow-runs/{workflowRunId}/retry`
- **Description:** Retry failed/cancelled run (clone-as-new); refuses poison-pilled runs
- **Output:** New run object

#### `workflow_run.steps`
- **Params:** {workflowRunId: UUID}
- **Endpoint:** GET `/v1/mcp/workflow-runs/{workflowRunId}/steps`
- **Description:** List step executions for a workflow run
- **Output:** Array of step objects

#### `workflow_run.events`
- **Params:** {workflowRunId: UUID, page?: int, limit?: int}
- **Endpoint:** GET `/v1/mcp/workflow-runs/{workflowRunId}/events?page=...&limit=...`
- **Description:** List workflow run events with optional pagination
- **Output:** Array of events

#### `workflow_run.event`
- **Params:** {workflowRunId: UUID, eventId: UUID}
- **Endpoint:** GET `/v1/mcp/workflow-runs/{workflowRunId}/events/{eventId}`
- **Description:** Fetch single workflow run event
- **Output:** Event object

### 6.3 Checkpoint Operations

#### `checkpoint.approve`
- **Params:** {checkpointId: UUID, formData?: map, comment?: string}
- **Endpoint:** POST `/v1/mcp/checkpoints/{checkpointId}/approve`
- **Description:** Approve workflow checkpoint (formData + comment forwarded verbatim)
- **Output:** Updated checkpoint

#### `checkpoint.reject`
- **Params:** {checkpointId: UUID, comment?: string}
- **Endpoint:** POST `/v1/mcp/checkpoints/{checkpointId}/reject`
- **Description:** Reject checkpoint (optional comment surfaced to requester)
- **Output:** Updated checkpoint

#### `checkpoint.cancel`
- **Params:** {checkpointId: UUID, reason?: string}
- **Endpoint:** POST `/v1/mcp/checkpoints/{checkpointId}/cancel`
- **Description:** Cancel pending checkpoint (requires workflow:write on parent; reason audited)
- **Output:** Updated checkpoint

### 6.4 Knowledge Operations

#### `knowledge.bulk_import`
- **Params:** {items: [{title, markdownContent, htmlContent?, slug?, description?, aiContext?, categoryId?, folderId?, tagIds?}, ...]}
  - Max 50 items per call
- **Endpoint:** POST `/v1/mcp/knowledges` (looped per item, MCP-side)
- **Description:** Batch-create knowledge docs; aggregates {createdIds, failed[], counts}
- **Output:** {createdIds: [], created: [], failed: [{index, error, issues?}], totalCreated: int, totalFailed: int}
- **Note:** This is a loop wrapper; BE has no bulk endpoint

### 6.5 Connector Schema & Discovery

#### `connector_subtype.list`
- **Params:** {type?: string}
- **Endpoint:** GET `/v1/mcp/connector-subtypes?type=...`
- **Description:** List org-visible connector subtypes with configSchema and configUiSchema
- **Output:** Array of connector subtypes {name, label, type, description, configSchema, configUiSchema}
- **Related prompts:** connector__choose-subtype, workflow__step-extract

#### `connector.db_schema`
- **Params:** {connectorId: UUID, database?: string, schema?: string, includeColumns?: bool (default false), maxTables?: int (default 100, max 300)}
- **Endpoints:**
  - GET `/v1/mcp/connectors/{connectorId}/databases`
  - GET `/v1/mcp/connectors/{connectorId}/schemas?database=...`
  - GET `/v1/mcp/connectors/{connectorId}/tables?database=...&schema=...`
  - GET `/v1/mcp/connectors/{connectorId}/tables/{tableName}/columns?database=...&schema=...` (when includeColumns=true)
- **Description:** Database schema discovery (list databases, schemas, tables with canRead/canWrite flags)
- **Output:** {connectorId, database, schema, databases: [], schemas: [], tables: [{name, schema, canRead, canWrite, columns?: [{name, type, isPrimary, isUnique, isIndexed, indexNames}]}], tableCount, truncated, queryGuidance: [], permissionFields, indexFields}
- **Related prompts:** workflow__step-extract

#### `connector.table_schema`
- **Params:** {connectorId: UUID, tableName: string (required), database?: string, schema?: string}
- **Endpoints:**
  - GET `/v1/mcp/connectors/{connectorId}/tables/{tableName}/columns?database=...&schema=...`
  - GET `/v1/mcp/connectors/{connectorId}/tables?database=...&schema=...`
- **Description:** Full column metadata for one target table (required before SQL operations)
- **Output:** {connectorId, database, schema, table: {name, schema, canRead, canWrite, columns: [...]}, queryGuidance, permissionFields, indexFields}
- **Related prompts:** workflow__step-extract

### 6.6 Permission & Share

#### `permission.check`
- **Params:** {resourceType: string, id: UUID, action: string}
- **Accepted resource types:** connector, kg_entity, folder, knowledge, media_asset, workflow (NOT agent_task, workflow_run)
- **Endpoint:** POST `/v1/mcp/permission/check`
- **Description:** Check if caller has action on resource
- **Routing:** Multi-resolver (connector ACL, kg_entity direct-grant, Resolver.Can, etc.)
- **Output:** {ok: bool, action, resourceType, id, scope: "resource-acl-direct|connector-acl|...", reason?: string}

#### `resource.share`
- **Params:** 
  - `connectorId` (UUID, required)
  - `permission` (string: "read"|"write"|"admin", required)
  - **Principal selector (exactly one of):**
    - `userId` (UUID) — legacy user-only
    - `principalKind: "user"` + `principalId` (UUID)
    - `principalKind: "group"` + `principalId` (UUID, dept/access-group)
    - `principalKind: "role"` + `principalRole` (string, org-role enum)
- **Endpoint:** POST `/v1/mcp/connectors/{connectorId}/shares`
- **Description:** Grant principal access to connector
- **Output:** Share grant object

### 6.7 Media Processing

#### `media.transcribe`
- **Params:** 
  - `assetId` (UUID, required) — uploaded media asset
  - Optional pipeline overrides: {autoKbIngest?: bool, auto_kb_ingest?: bool, autoExtractKg?: bool, auto_extract_kg?: bool, aiRefineMarkdown?: bool, ai_refine_markdown?: bool, modelId?: string, model_id?: string, targetKnowledgeId?: UUID, target_knowledge_id?: UUID, step1TemplateId?: UUID, step1_template_id?: UUID, step2TemplateId?: UUID, step2_template_id?: UUID}
- **Endpoint:** POST `/v1/mcp/media/{assetId}/transcribe`
- **Description:** Run effective media pipeline for one asset; inherits folder/org defaults unless overridden
- **Readiness deps:** storage:ready
- **Output:** Media processing job object with runId, status, results
- **Related prompts:** media__transcribe-flow

#### `media.bulk_digest`
- **Params:**
  - `items` (array, max 50): [{assetId: UUID, priority?: int, options?: {add_kb?: bool, extract_kg?: bool, refine?: bool, force_replace?: bool, step1_template_id?: UUID, step2_template_id?: UUID}}]
  - `idempotencyKey` (string, optional) — 60s Redis dedup
- **Endpoint:** POST `/v1/mcp/media/bulk/digest`
- **Description:** Bulk-run media pipelines with per-item options; cap 50/call
- **Readiness deps:** storage:ready
- **Output:** Array of {assetId, status, runId?, error?}
- **Related prompts:** media__bulk-digest-flow

#### `media.ingest_to_kb`
- **Params:** {runId: UUID}
- **Endpoint:** POST `/v1/mcp/media/jobs/{runId}/ingest-kb`
- **Description:** Chain after transcribe: ingest run output into KB
- **Readiness deps:** llm:embedding
- **Output:** KB ingestion result

### 6.8 Knowledge Graph

#### `kg.graph_summary`
- **Params:** {scope?: "enterprise"|"schema"|"provenance" (default enterprise)}
- **Endpoint:** GET `/v1/mcp/kg/graph/summary?scope=...`
- **Description:** Org-wide KG meta-graph stats (NOT per-knowledge)
- **Output:** {entityCount, relationCount, communityCount, topEntities, topRelations}

#### `kg.graph_neighbors`
- **Params:** {entityId: UUID, depth?: 1..3 (default 1), scope?: "enterprise"|"schema"|"provenance"}
- **Endpoint:** GET `/v1/mcp/kg/graph/neighbors/{entityId}?depth=...&scope=...`
- **Description:** Neighbor entities for kg_entity (depth 1-3)
- **Output:** Array of neighbor entities with relation metadata

#### `kg.graph_community`
- **Params:** {entityId: UUID, scope?: "enterprise"|"schema"|"provenance"}
- **Endpoint:** GET `/v1/mcp/kg/graph/community/{entityId}?scope=...`
- **Description:** Community / Louvain bucket for kg_entity
- **Output:** Community object with memberCount, topMembers

#### `kg.graph_top`
- **Params:** {knowledgeId?: UUID, limit?: 1..100 (default: all), scope?: "enterprise"|"schema"|"provenance"}
- **Endpoint:** GET `/v1/mcp/kg/graph/top?knowledgeId=...&limit=...&scope=...`
- **Description:** Top-N entities by centrality/degree
- **Output:** Array of top entities

#### `kg.entities_by_knowledge`
- **Params:** {knowledgeId: UUID, q?: string, kind?: string, limit?: 1..100}
- **Endpoint:** GET `/v1/mcp/kg/entities/by-knowledge?knowledgeId=...&q=...&kind=...&limit=...`
- **Description:** Visible kg_entities extracted from one knowledge doc
- **Output:** Array of entities with provenance rows

#### `kg.entities_batch_read`
- **Params:** {ids: [UUID, ...] (1..100 items)}
- **Endpoint:** POST `/v1/mcp/kg/entities/batch-read`
- **Description:** Batch-read visible kg_entities; hidden/missing omitted without per-ID status
- **Output:** Array of entity objects

#### `kg.create_relation`
- **Params:** {sourceEntityId: UUID, targetEntityId: UUID, relationType: string, confidence?: float, ...} (passthrough)
- **Endpoint:** POST `/v1/mcp/kg/relations`
- **Description:** Create relation between two kg_entities
- **Readiness deps:** llm:extract_kg
- **Output:** Relation object with id

#### `kg.delete_relation`
- **Params:** {relationId: UUID}
- **Endpoint:** DELETE `/v1/mcp/kg/relations/{relationId}`
- **Description:** Delete kg relation
- **Output:** {status: "deleted"}

#### `kg.dlq_list` (Admin)
- **Params:** {limit?: 1..100, errorClass?: string}
- **Endpoint:** GET `/v1/mcp/kg/admin/extractions/dlq?limit=...&errorClass=...`
- **Description:** Admin: list KG extraction DLQ entries
- **Admin gate:** Org owner/admin required
- **Output:** Array of DLQ entries

#### `kg.dlq_detail` (Admin)
- **Params:** {dlqId: UUID}
- **Endpoint:** GET `/v1/mcp/kg/admin/extractions/dlq/{dlqId}`
- **Description:** Admin: fetch one DLQ entry detail
- **Admin gate:** Org owner/admin required
- **Output:** DLQ entry with extraction input, error, stack

#### `kg.dlq_retry` (Admin)
- **Params:** {dlqId: UUID, idempotencyKey?: string}
- **Endpoint:** POST `/v1/mcp/kg/admin/extractions/dlq/{dlqId}/retry` (with Idempotency-Key header if idempotencyKey supplied)
- **Description:** Admin: retry DLQ entry (60s Redis dedup keyed on orgID+dlqID+key)
- **Admin gate:** Org owner/admin required
- **Output:** Retry result

### 6.9 Folder Lifecycle

#### `folder.trash_restore`
- **Params:** {folderId: UUID}
- **Endpoint:** POST `/v1/mcp/folders/{folderId}/trash/restore`
- **Description:** Restore folder previously soft-deleted via delete({folder})
- **Output:** Restored folder

#### `folder.trash_purge`
- **Params:** {folderId: UUID}
- **Endpoint:** DELETE `/v1/mcp/folders/{folderId}/trash`
- **Description:** Permanently purge folder in trash (irreversible)
- **Output:** {status: "purged"}

### 6.10 Readiness Pre-Flight

#### `aiconfig.readiness`
- **Params:** {}
- **Endpoint:** GET `/v1/mcp/aiconfig/readiness`
- **Description:** Readiness snapshot per LLM use-case (chat/embedding/vision/transcription/extract_kg)
- **Output:** {chat: {ready: bool, reason?: "no_provider"|"no_provider_credential"|"no_default"|"no_capable_model"}, embedding: {...}, ...}

#### `media.storage_readiness`
- **Params:** {}
- **Endpoint:** GET `/v1/mcp/media/storage/readiness`
- **Description:** Readiness snapshot for org BYO media storage
- **Output:** {ready: bool, reason?: "no_storage_credential"|"not_verified"|"verify_failed"}

---

## 7. Database Operations

### 7.1 `db_query` (Tool)
- **Type:** Read-only, safety-gated
- **Input params:**
  - `connectorId` (UUID, required)
  - `sql` (string, required) — SELECT/WITH only; multi-statement rejected
  - `database` (string, optional) — database/catalog name
  - `limit` (int, optional) — 1..5000; BE defaults to 1000
- **Backend endpoint:** POST `/v1/mcp/connectors/{connectorId}/query`
- **Pre-flight gates:**
  - SQL read-only guard: rejects multi-statement + non-SELECT/WITH verbs client-side
  - Connector grant verified by BE
  - AI Data Governance redaction applied by BE
- **Description:** Read-only SQL query; must call connector.db_schema + connector.table_schema first
- **Output:** {rows: [...], columns: [...], truncated: bool, rowCount: int}
- **Feature gates:** None

### 7.2 `db_execute` (Tool)
- **Type:** Write, destructive
- **Input params:**
  - `connectorId` (UUID, required)
  - `sql` (string, required) — UPDATE/DELETE/DDL allowed
- **Backend endpoint:** POST `/v1/mcp/connectors/{connectorId}/execute`
- **Pre-flight gates:**
  - Connector grant + write permission verified by BE
  - Audit logging enabled
- **Description:** Run UPDATE/DELETE/DDL; recommend using db_query with COUNT(*) first to scope changes
- **Output:** {rowsAffected: int, executionTime: float}
- **Feature gates:** featureMCPRawSQLExecute

---

## 8. Resource Templates (MCP Resources, not Tools)

### 8.1 `org://{orgId}/current`
- **Resource name:** org_current
- **Description:** Active org snapshot
- **Endpoint:** GET `/v1/mcp/organizations/{orgId}`
- **MIME type:** application/json
- **Output:** Org object with name, plan, status, memberCount

### 8.2 `org-budget://{orgId}/current`
- **Resource name:** org_budget
- **Description:** Active org LLM-cost budget snapshot (monthly cap, usage, % consumed)
- **Endpoint:** GET `/v1/mcp/organizations/{orgId}/budget/current`
- **Cache:** 30s in-process cache keyed by orgId
- **MIME type:** application/json
- **Output:** Budget object {cap, period, usage, percentConsumed}

### 8.3 `folder-tree://{orgId}/current`
- **Resource name:** folder_tree
- **Description:** Org folder hierarchy (ACL-filtered)
- **Endpoint:** GET `/v1/mcp/folders/tree?depth={N}`
- **Query params:** depth (default 3, min 1, max 6; clamped not rejected)
- **MIME type:** application/json
- **Output:** Folder tree with nested children array

---

## 9. Upload & Media Pipeline

### 9.1 Upload Flow (NOT exposed via Tier-1 MCP)
- **media.upload_presign** — NOT whitelisted (verified by test)
- **media.upload_commit** — NOT whitelisted (verified by test)
- **Notes:**
  - Media upload is intentionally NOT exposed through the Tier-1 MCP interface
  - Agents cannot directly create/upload media assets via call()
  - Media must be pre-uploaded via web or proprietary upload paths
  - Once uploaded, agents use media.transcribe and media.bulk_digest to trigger processing

### 9.2 Media Asset Lifecycle
- **Create (media_asset):** NOT exposed via Tier-1 create()
- **Read/List/Update/Delete:** Exposed via polymorphic read/list/update/delete tools
- **Transcribe/Digest:** Exposed via call() actions
- **Ingest to KB:** Exposed via call(media.ingest_to_kb) chaining

---

## 10. Error Handling & Status Codes

### Error Envelopes
All errors conform to F20 structured error forwarding:
- **4xx errors:** HTTP status + BE `id` slug (or status-map fallback)
- **5xx errors:** HTTP status + scrubbed message (no stack traces)
- **Transport errors:** `transport_error` code with error string
- **MCP-side validation:** `invalid_arguments` with per-field issues array

### Common Error Codes
- `org_selection_required` — session lacks selected org
- `permission_denied` — insufficient ACL
- `admin_role_required` — admin gate failed
- `action_not_whitelisted` — unknown call() action
- `invalid_arguments` — field validation failed
- `boundary_error` — resource type not valid for tool
- `not_supported_yet` — feature roadmap gate (e.g., agentic-a1)
- `precondition_check_failed` — readiness dep, user status, org status, or account preflight failed

---

## 11. Authentication & Authorization

### Session State
- **Session ID:** Derived by auth middleware; stamped in X-MCP-Session-Id header
- **API Key:** X-API-Key header (no S2S Bearer)
- **Org ID:** X-Org-Id header (must match selected org)
- **User Agent:** X-MCP-Client-UA (agent-brain-mcp-go/<sha> + IDE UA)

### Pre-flight Checks
1. **User account status:** active|suspended|pending_approval (fail-closed if check unavailable)
2. **Org account status:** active|suspended|etc. (fail-closed if check unavailable)
3. **Admin role check:** Org owner/admin for admin-gated actions (3-min cached, fallthrough to BE 403 on cache miss)
4. **Feature gates:** Per-org feature flags (embedding, transcription, extract_kg, raw_sql_execute, etc.)
5. **Readiness deps:** Storage + LLM use-case availability pre-checked for media/KG operations

### Permissions
- **Folder:** Cascading ACL; soft-delete + trash restore
- **Knowledge:** Creator = admin; ACL inherited from folder if created with folderId
- **Media:** Member-open read/list/update/delete (not create via MCP)
- **Connector:** Connector-level ACL grant + schema read protected by write permission
- **Workflow:** Step-based execution control; checkpoint approval gated by workflow:write
- **KG Entity:** Admin-gated list/create/update/delete; member-open read with tier filter
- **kg_entity:** Direct-grant raw query on resource_permissions (scope: "resource-acl-direct")

---

## 12. Feature Gates

### Feature Gate Categories
1. **Knowledge graph:** kg_entity CRUD, kg relations, graph operations
2. **Embeddings:** retrieve_context semantic mode, media.ingest_to_kb, kg.create_relation
3. **Transcription:** media.transcribe, media.bulk_digest
4. **Search:** search, retrieve_context
5. **Connectors:** connector schema discovery, db_query, db_execute
6. **Workflows:** workflow CRUD, webhook management
7. **Media:** media operations
8. **Raw SQL:** db_execute (separate gate: featureMCPRawSQLExecute)

---

## Summary Table by Domain

| Domain | Tool/Action | Type | Read/Write | Endpoint | Feature Gate |
|--------|-------------|------|-----------|----------|--------------|
| Session | whoami | Read | Read | N/A (local) | None |
| Session | set_org | Idempotent | Mutation | GET /v1/mcp/organizations/me | None |
| Session | list(organization) | Read | Read | GET /v1/mcp/organizations/me | None |
| Governance | ai_policy | Read | Read | GET /v1/mcp/ai-governance/effective-policy | None |
| Search | search | Read | Read | POST /v1/mcp/search | search, semantic |
| Search | retrieve_context | Read | Read | POST /v1/mcp/retrieve-context | retrieve_context |
| CRUD | read | Read | Read | GET /v1/mcp/{resource}/{id} | Per-resource |
| CRUD | list | Read | Read | GET /v1/mcp/{resource} | Per-resource |
| CRUD | create | Write | Write | POST /v1/mcp/{resource} | Per-resource |
| CRUD | update | Write | Write | PUT/PATCH /v1/mcp/{resource}/{id} | Per-resource |
| CRUD | delete | Write | Destructive | DELETE /v1/mcp/{resource}/{id} | Per-resource |
| Discovery | describe | Read | Read | N/A (local) | None |
| Workflows | workflow.* (13 actions) | Mixed | Write | POST/PUT/PATCH/DELETE /v1/mcp/workflows/* | workflow |
| Workflow Runs | workflow_run.* (6 actions) | Mixed | Write | POST/GET /v1/mcp/workflow-runs/* | workflow |
| Checkpoints | checkpoint.* (3 actions) | Mixed | Write | POST /v1/mcp/checkpoints/* | None |
| Knowledge | knowledge.bulk_import | Write | Write | POST /v1/mcp/knowledges | knowledge |
| Connectors | connector.db_schema | Read | Read | GET /v1/mcp/connectors/*/databases|schemas|tables | connector |
| Connectors | connector.table_schema | Read | Read | GET /v1/mcp/connectors/*/tables/*/columns | connector |
| Connectors | connector_subtype.list | Read | Read | GET /v1/mcp/connector-subtypes | None |
| Permissions | permission.check | Read | Read | POST /v1/mcp/permission/check | None |
| Permissions | resource.share | Write | Write | POST /v1/mcp/connectors/{id}/shares | None |
| Media | media.transcribe | Write | Write | POST /v1/mcp/media/{id}/transcribe | media, storage |
| Media | media.bulk_digest | Write | Write | POST /v1/mcp/media/bulk/digest | media, storage |
| Media | media.ingest_to_kb | Write | Write | POST /v1/mcp/media/jobs/{id}/ingest-kb | media, llm:embedding |
| KG | kg.graph_summary | Read | Read | GET /v1/mcp/kg/graph/summary | kg_entity |
| KG | kg.graph_neighbors | Read | Read | GET /v1/mcp/kg/graph/neighbors/{id} | kg_entity |
| KG | kg.graph_community | Read | Read | GET /v1/mcp/kg/graph/community/{id} | kg_entity |
| KG | kg.graph_top | Read | Read | GET /v1/mcp/kg/graph/top | kg_entity |
| KG | kg.entities_by_knowledge | Read | Read | GET /v1/mcp/kg/entities/by-knowledge | kg_entity |
| KG | kg.entities_batch_read | Read | Read | POST /v1/mcp/kg/entities/batch-read | kg_entity |
| KG | kg.create_relation | Write | Write | POST /v1/mcp/kg/relations | kg_entity, llm:extract_kg |
| KG | kg.delete_relation | Write | Write | DELETE /v1/mcp/kg/relations/{id} | kg_entity |
| KG Admin | kg.dlq_list | Read | Read | GET /v1/mcp/kg/admin/extractions/dlq | kg_entity, admin |
| KG Admin | kg.dlq_detail | Read | Read | GET /v1/mcp/kg/admin/extractions/dlq/{id} | kg_entity, admin |
| KG Admin | kg.dlq_retry | Write | Write | POST /v1/mcp/kg/admin/extractions/dlq/{id}/retry | kg_entity, admin |
| Folder | folder.trash_restore | Write | Write | POST /v1/mcp/folders/{id}/trash/restore | None |
| Folder | folder.trash_purge | Write | Write | DELETE /v1/mcp/folders/{id}/trash | None |
| Readiness | aiconfig.readiness | Read | Read | GET /v1/mcp/aiconfig/readiness | None |
| Readiness | media.storage_readiness | Read | Read | GET /v1/mcp/media/storage/readiness | None |
| DB | db_query | Read | Read | POST /v1/mcp/connectors/{id}/query | db_query |
| DB | db_execute | Write | Destructive | POST /v1/mcp/connectors/{id}/execute | raw_sql_execute |

---

## Unresolved Questions

1. **Media upload entry point:** Confirm if presigned URL flow or base64 upload is expected for CLI parity; currently intentionally not exposed via MCP Tier-1.
2. **Suggested prompts indexing:** Does CLI need to replicate the Prompt-slug lookup table (SuggestedIndex) or can it be stub-optional?
3. **Resource template cache:** Org-budget resource uses 30s in-process cache; verify if CLI should replicate or depend on BE refresh.

---

**Status:** DONE  
**Summary:** Complete MCP surface enumerated. 14 tools (whoami, set_org, ai_policy, search, retrieve_context, read, list, create, update, delete, describe, call, db_query, db_execute) + 46 call() actions + 3 resource templates.  
**Key gap:** Media upload NOT exposed via MCP Tier-1 (intentional design decision).
