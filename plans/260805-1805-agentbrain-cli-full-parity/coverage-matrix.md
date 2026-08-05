# Coverage Matrix — Backend endpoint ↔ CLI command

Base path = `{apiUrl}/v1`. Legend: ☐ todo, ☑ done. Existing = đã có trong CLI.

## Trạng thái (2026-08-05): ĐÃ TRIỂN KHAI ✅
Toàn bộ phase dưới đây đã map thành lệnh CLI và tích hợp trong `src/program.ts` (30 nhóm lệnh). Đã qua 2 vòng review (kongming route-diff 446 route + code-reviewer body-field), remediation xong, `lint`/`build`/`test` (22/22) xanh, và kongming go/no-go trả **GO**. Xác minh parity: route-diff cho thấy **0 gap không giải thích được** — 120 route "chưa map" đều nằm trong "Loại trừ có chủ đích" (107 `/mcp` mirror + `/public` + workflow-webhook + oauth callback) hoặc false-positive (path dựng bằng template/ternary, raw-fetch `system/health` + branding logo). Bản ghi sống về danh sách nhóm: `src/cli-parity.test.ts`.

## Loại trừ có chủ đích (intentional exclusions)
Các route sau **cố ý không** map thành lệnh CLI. Chúng không phải "thiếu" — có lý do rõ ràng:
- **~100 route `/mcp/*` mirror** của `/cms/*`: backend dual-mount **cùng handler**, chỉ khác auth (`/mcp` dùng `X-API-Key`, `/cms` dùng JWT admin). CLI phủ nhánh `/cms` (JWT) làm bề mặt admin đầy đủ ⇒ **không nhân đôi** (quyết định của user, 2026-08-05). Các thao tác giống hệt về chức năng. Ngoại lệ: `POST /mcp/retrieve-context` và `GET /mcp/ai-governance/effective-policy` **có** map (lệnh `retrieve-context`, `ai-policy`) vì đó là bề mặt tự nhiên cho client API-key. Follow-up khả dĩ: cờ `--auth api-key` rewrite `/cms→/mcp` cho route dual-mount.
- `GET /cms/connectors/google-sheets/oauth/callback`: đích redirect trình duyệt sau consent Google (nhận `state`+`code`), không phải hành động CLI có nghĩa.
- Các route `/public/*` (knowledge công khai) và `POST /workflow-webhooks/:id` (trigger ngoài, không auth người dùng): ngoài phạm vi CLI admin.
- Chưa có lệnh `agentbrain login`: user tự dán JWT (`config set token`) — ghi nhận follow-up.

## Existing (keep; đổi path sang /cms; extend nơi ghi chú)
- org: list/me/get/create/update/delete/members/add-member/switch (existing) — extend: invite, resend-invite, policy, settings kg-runtime, perm-settings, audit-settings
- connector: list/my/get/create/update/delete/test/test-config/databases/schemas/tables/columns/data/counts/share(list/create/delete) — extend below (Phase 6)
- connector-subtype: list/get/create/delete (existing)
- knowledge: list/get/create/update/delete/versions/version/rollback/share — extend: by-slug, publication (publish/unpublish), related, kg entities/summary, bulk-import
- workflow: list/get/create/update/delete/steps(list/create/update/delete)/run/runs/run-detail/cancel/run-steps/logs — extend (Phase 5)
- search (existing, POST /cms/search)
- query-log: list/get (existing)
- permission-group: list/get/create/update/delete/users/subtree-user-count/table-perm + verify-permission (top-level) — lưu ý: endpoint `rules` KHÔNG tồn tại ở backend (đã bỏ khỏi CLI); dùng `table-perm` cho table-ACL
- category: list/tree/get/create/update/delete (existing)
- tag: list/get/create/update/delete (existing)

## Phase 1 — folder (`folder`)
- POST /cms/folders → `folder create`
- GET /cms/folders → `folder list`
- GET /cms/folders/:id → `folder get`
- PATCH /cms/folders/:id → `folder update`
- POST /cms/folders/:id/move → `folder move`
- DELETE /cms/folders/:id → `folder delete`
- GET /cms/folders/:id/trash/preview → `folder trash preview`
- POST /cms/folders/:id/trash/restore → `folder trash restore`
- DELETE /cms/folders/:id/trash → `folder trash purge`
- GET /cms/trash → `folder trash list`
- DELETE /cms/trash → `folder trash empty`
- POST /cms/trash/bulk-purge → `folder trash bulk-purge`
- GET /cms/trash/:resource_type/:id/preview → `folder trash item-preview`
- POST /cms/trash/:resource_type/:id/restore → `folder trash item-restore`
- DELETE /cms/trash/:resource_type/:id → `folder trash item-purge`

## Phase 2 — media (`media`) + **UPLOAD**
- **UPLOAD**: POST /cms/media/uploads/presign + PUT presigned + POST /cms/media/uploads/commit → `media upload <file> [--folder-id] [--kind] [--no-sha256]`
- GET /cms/media → `media list`
- GET /cms/media/:id → `media get`
- PATCH /cms/media/:id → `media update`
- DELETE /cms/media/:id → `media delete`
- POST /cms/media/bulk-delete → `media bulk-delete`
- GET /cms/media/:id/presigned-get → `media download-url`
- GET /cms/media/:id/structured-preview → `media preview`
- POST /cms/media/:id/transcribe → `media transcribe`
- POST /cms/media/bulk/digest → `media bulk-digest`
- GET /cms/media/bulk/jobs/active → `media bulk jobs-active`
- GET /cms/media/bulk/jobs/:id → `media bulk job`
- POST /cms/media/bulk/jobs/:id/items/:item_id/retry → `media bulk item-retry`
- POST /cms/media/bulk/jobs/:id/items/:item_id/cancel → `media bulk item-cancel`
- PATCH /cms/media/bulk/jobs/:id/items/:item_id/priority → `media bulk item-priority`
- POST /cms/media/jobs/:run_id/cancel → `media job cancel`
- POST /cms/media/jobs/:run_id/refine → `media job refine`
- POST /cms/media/jobs/:run_id/ingest-kb → `media job ingest-kb`
- GET /cms/media/jobs/assets/:asset_id/runs → `media job asset-runs`
- GET /cms/media/jobs/:run_id/llm-calls → `media job llm-calls`
- GET /cms/media/jobs → `media job list`
- POST /cms/media/jobs/:run_id/replay → `media job replay`
- media settings: GET/PATCH /cms/admin/media-settings → `media settings get|update`; POST storage/probe|verify|reverify, DELETE storage → `media storage probe|verify|reverify|clear`
- GET /cms/media/storage/readiness → `media storage readiness` (or under readiness)

## Phase 3 — kg core (`kg`)
- entities: POST/GET /cms/kg/entities, GET/PATCH/DELETE /cms/kg/entities/:id → `kg entity create|list|get|update|delete`
- relations: POST /cms/kg/relations, DELETE /cms/kg/relations/:id → `kg relation create|delete`
- entity-types: POST/PATCH/DELETE + GET /cms/kg/entity-types → `kg entity-type create|update|delete|list`
- relation-types: POST/PATCH/DELETE + GET /cms/kg/relation-types → `kg relation-type create|update|delete|list`
- graph: GET summary|top|community/:id|neighbors/:entityId → `kg graph summary|top|community|neighbors`
- GET /cms/kg/entities/by-knowledge → `kg entities-by-knowledge`
- POST /cms/kg/entities/batch-read → `kg entities-batch-read`
- GET /cms/kg/entities/:id/detail|provenance|audit-history → `kg entity detail|provenance|audit-history`
- extractions: GET runs/active, runs/:id, cost-halt-recent → `kg extraction runs-active|run|cost-halt`
- row-facts: GET /cms/knowledges/:id/kg/row-facts/source, POST .../runs, GET /cms/kg/row-fact-runs/:id, PATCH .../proposals, POST .../promote → `kg row-facts source|generate|run|proposals|promote`

## Phase 4 — kg-admin (`kg admin ...`)
- graph analyze/analyzer-status/runs; quality report/issues/actions(replay-missing-kb, generate-dedup-candidates, generate-review-items)/review-items(list, keep, dismiss, impact, delete-entity, reextract-sources)
- extractions replay/batches(create,get)/dlq(list,get,retry)
- row-filter/preview
- dedup candidates(list, bulk, approve, dismiss, bulk-merge progress)
- merge-history(list, rollback)
- sensitive-access-log
- entities/:id/permissions(grant, revoke), effective-grants
→ map 1:1 dưới `kg admin <sub>`

## Phase 5 — workflow-ext + checkpoint
- POST /cms/workflows/with-steps → `workflow create-with-steps`
- PUT /cms/workflows/:id/steps/replace → `workflow steps replace`
- GET /cms/workflows/mcp-tools → `workflow mcp-tools`
- GET node-types, node-types/:type → `workflow node-types list|get`
- GET reference-options, POST reference-resolve → `workflow references options|resolve`
- webhooks: GET/POST /:id/webhooks, PATCH/DELETE /:id/webhooks/:triggerId, POST rotate-secret → `workflow webhook list|create|update|delete|rotate-secret`
- GET /:id/stats → `workflow stats`
- PATCH /:id/folder → `workflow move-to-folder`; POST /bulk-move → `workflow bulk-move`
- POST /:id/share, DELETE /:id/share → `workflow share|revoke-share`
- GET /:id/runs/:runId/checkpoints → `workflow run-checkpoints`
- runs: POST resume/retry, GET events, events/:eventId → `workflow run resume|retry|events|event` (cancel/steps/run-detail existing)
- checkpoint: GET /cms/checkpoints, GET /:id, POST approve/reject/cancel → `checkpoint list|get|approve|reject|cancel`

## Phase 6 — connector-ext + db
- google-sheets: GET oauth/start, oauth/callback, POST /:id/google-sheets/oauth/revoke, GET sheets tabs/values → `connector sheets oauth-start|oauth-revoke|tabs|values`
- redis: GET /:id/redis/keys, /:id/redis/value → `connector redis keys|value`
- share update: PUT /cms/connectors/:id/shares/:userId → `connector share update`
- db (mcp path): POST /mcp/connectors/:id/query → `connector query <id> --sql`; POST /mcp/connectors/:id/execute → `connector execute <id> --sql` (feature-gated)

## Phase 7 — retrieve-context + ai-policy + governance + readiness
- POST /mcp/retrieve-context → `retrieve-context --question [--mode] [--limit]`
- GET /mcp/ai-governance/effective-policy → `ai-policy [--folder-id --data-class --surface --use-case --external-cloud]`
- governance admin (/cms/ai-governance): GET overview, PATCH policy, POST/DELETE assignments, POST/DELETE provider-privacy, GET events, POST effective-preview → `governance overview|policy|assignment add/remove|provider-privacy add/remove|events|preview`
- readiness: GET /cms/aiconfig/readiness → `readiness aiconfig`; GET /cms/media/storage/readiness → `readiness media-storage`

## Phase 8 — llm + prompt
- llm providers: GET/POST /cms/llm/providers, GET/PATCH/DELETE /:id, POST /:id/verify, GET /:id/models, POST /:id/models, POST /:id/sync-models, POST /:id/probe-model → `llm provider list|create|get|update|delete|verify|models|add-model|sync-models|probe-model`
- llm models: GET /cms/llm/models/system, PATCH/DELETE /cms/llm/models/:id, GET /cms/llm/catalog/models → `llm model system-catalog|update|delete|catalog`
- llm defaults: GET/PUT /cms/llm/defaults/:useCase → `llm default get|set`
- prompt-templates: GET, GET resolve, GET/:id, POST, PATCH/:id, POST /:id/default, DELETE/:id, GET /:id/versions → `prompt template list|resolve|get|create|update|make-default|delete|versions`
- prompt use-case-types: GET, POST, PATCH/:use_case, PATCH/:use_case/active, DELETE/:use_case → `prompt use-case list|create|update|set-active|delete`

## Phase 9 — cost + usage + dashboard + audit (`ops`/split)
- cost: GET/PUT /cms/cost/budget, GET /cms/cost/budget/spend → `cost budget get|set|spend`
- usage-metrics: GET summary|trend|by-use-case|top-models → `usage metrics <sub>`
- usage-logs: GET, GET/:id → `usage logs list|get`
- resource-activity: GET usage-logs, GET audit → `usage resource-activity|audit-activity` (or under audit)
- dashboard: GET summary|trend|media-kg-stats → `dashboard summary|trend|media-kg-stats`
- audit-log: GET, GET summary → `audit list|summary`; resource-activity audit → `audit resource`

## Phase 10 — permission-ext + org-ext + branding + me + system
- resourceperm (/cms/permissions): POST grant, POST revoke, GET resource, GET audit, GET check, GET check-default → `permission grant|revoke|resource|audit|check|check-default`
- permission-group table-permissions: GET/POST /:id/table-permissions, PUT/DELETE /:id/table-permissions/:tid, GET /:id/subtree-user-count → `permission-group table-perm list|create|update|delete|subtree-count`
- user permission-groups: GET/POST /cms/users/:id/permission-groups, DELETE /:gid, POST /cms/users/:id/primary-department → `permission-group user-groups list|assign|remove`, `org user primary-department`
- org-ext: POST /cms/organizations/:id/members/invite, POST .../:memberId/resend-invite → `org invite-member|resend-invite`; GET /cms/organizations/policy → `org policy`; org/settings kg-runtime GET/PATCH → `org settings kg-runtime get|set`; /orgs/:orgID/perm-settings GET/PUT → `org perm-settings get|set`; /orgs/:orgID/audit-settings GET/PATCH → `org audit-settings get|set`
- branding: GET/PUT/DELETE /orgs/:orgID/branding/logo → `org branding get|set|delete`
- me: GET /me, PATCH /me/profile, GET /users/search → `me get|update`, `user search`
- system (/system): users(list, approve, reject, suspend, unsuspend), features, orgs(list, get, approve, suspend, unsuspend, features get/put), audit, admins, health, settings(get/put), users/:id/system-role → `system <sub>`
