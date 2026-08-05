# AgentBrain CLI — Full Backend Parity Plan

**Created:** 2026-08-05 | **Branch:** `claude/agentbrain-mcp-cli-parity-bc59f4` | **Route:** feature
**Scope decision:** Full CMS admin coverage (user-confirmed) — CLI phải cover **mọi** endpoint backend AgentBrain, gồm cả upload tài liệu.

## Outcome
CLI `agentbrain` cover toàn bộ backend API AgentBrain: mọi nhóm `/v1/cms/*`, các path `/v1/mcp/*` (retrieve_context, ai_policy, db query/execute), `/v1/system/*`, `/v1/orgs/:orgID/*`, `/v1/permissions/*`, `/v1/me`, cộng **upload tài liệu** (presign→PUT→commit). Không thiếu tính năng nào so với backend.

## Non-goals
- Không tạo endpoint backend mới (chỉ dùng cái đã có).
- Không build MCP server trong repo CLI.
- Public/OAuth-callback routes chạy trong trình duyệt (google-sheets oauth callback) chỉ wrap ở mức khả dụng, không tự động hoá browser flow.

## Constraints
- Giữ pattern hiện có (commander + `withErrorHandler`/`fetchAndPrint`/`createClient`), output json/table/yaml.
- **Auth theo prefix (đã verify từ source backend):** `/cms/*`, `/system/*`, `/orgs/*`, `/permissions/*`, `/me` yêu cầu `Authorization: Bearer <JWT>` (`mw.Auth()` → 401 nếu thiếu). Chỉ `/mcp/*` nhận `X-API-Key` (hoặc Bearer) + `X-Org-Id` (`mw.APIKeyWithOrg`). ⇒ CLI phải có config `token` (JWT) cho toàn bộ CMS admin, `apiKey` chỉ dùng cho `/mcp`. `X-Org-Id` luôn gửi khi có. Không in secret ra log (mask cả `apiKey` lẫn `token`).
- Node ≥ 20, ESM, tsup build, vitest.
- Modular: mỗi domain 1 file `src/commands/<domain>-command.ts` (< ~200 LOC/file; tách nếu vượt).

## Acceptance criteria
- [ ] `pnpm lint` (tsc --noEmit) và `pnpm build` sạch.
- [ ] `pnpm test` xanh; có test cho: http-client (putBytes, đa prefix, unwrap envelope), luồng upload (presign→PUT→commit, tự dò mime/size/kind), và ≥1 command đại diện mỗi domain nhóm lớn.
- [ ] Mọi endpoint trong `coverage-matrix.md` có command CLI tương ứng, đánh dấu DONE.
- [ ] `agentbrain --help` liệt kê đủ nhóm lệnh mới; README + docs cập nhật.
- [ ] Upload tài liệu chạy được end-to-end (verify bằng test mock fetch cho 3 bước).

## Architecture changes (Phase 0 — nền tảng, làm tập trung)
0. **auth token (DONE):** thêm `token` vào config schema/env (`AGENTBRAIN_TOKEN`)/global flag `--token`; `SECRET_CONFIG_KEYS=["apiKey","token"]` để mask trong `config list`. http-client chọn header **theo prefix**: `/mcp/*` → `X-API-Key` (fallback Bearer), còn lại → `Authorization: Bearer <token>`; luôn gửi `X-Org-Id` khi có; báo lỗi rõ khi thiếu credential.
1. **http-client (DONE):** đổi base `{apiUrl}/v1/cms` → `{apiUrl}/v1`; mọi command truyền path đầy đủ (`/cms/...`, `/mcp/...`, `/system/...`, `/orgs/...`, `/permissions/...`, `/me`). Có `buildUrl` prefix guard (chặn path sai). Thêm `patch<T>()`. Thêm `putAbsoluteBytes(url, body: Uint8Array|Blob, contentType)` — PUT raw bytes lên presigned URL, KHÔNG kèm auth header, không JSON. Giữ `get/post/put/delete/stream`, unwrap `{data}` envelope.
2. **command-helpers (DONE):** thêm `runAction` (mutation → in message), `parseJsonOption`, `compact` (bỏ key undefined khỏi body PATCH/PUT).
3. **upload util** (`src/utils/media-upload.ts`): dò contentType (theo ext), sizeBytes, kind (audio/video/image/raw_doc); orchestrate presign→PUT→commit; tuỳ chọn tính sha256.
4. **api-types**: bổ sung type cho Folder, MediaAsset, KGEntity/Relation/EntityType, Checkpoint, WorkflowRunEvent, LLMProvider/Model, PromptTemplate, Budget, AuditLog, v.v. (light interfaces).
5. **index.ts**: đăng ký tất cả nhóm lệnh mới (làm tập trung, tránh xung đột khi chạy song song).
6. Cập nhật các command cũ dùng prefix `/cms/...` (mechanical).

## Phases (thực thi song song theo domain sau Phase 0)
Chi tiết endpoint↔command: xem `coverage-matrix.md`.

| Phase | Domain | File(s) | Ghi chú |
|------|--------|---------|---------|
| 0 | Foundation | http-client, command-helpers, media-upload, api-types, index.ts, update existing→/cms | Tập trung, chặn các phase sau |
| 1 | folder + trash | folder-command.ts | CRUD, move, trash preview/restore/purge, poly-trash |
| 2 | media + **upload** | media-command.ts (+ media-upload util) | **upload tài liệu**, crud, transcribe, bulk-digest, jobs, settings, storage readiness |
| 3 | kg (core) | kg-command.ts | entities/relations CRUD, entity/relation-types, graph, by-knowledge/batch-read/detail/provenance, extractions runs, row-facts |
| 4 | kg-admin | kg-admin-command.ts | graph analyze, quality, extractions dlq/batches, dedup, merge-history, sensitive-log, entity perms |
| 5 | workflow-ext + checkpoint | workflow-command.ts (extend) + checkpoint-command.ts | with-steps, replace-steps, node-types, reference-*, webhooks, move/bulk-move, share, stats, run resume/retry/events; checkpoints |
| 6 | connector-ext + db | connector-command.ts (extend) + db via connector | google-sheets oauth/tabs/values, redis keys/value, share update; `connector query`/`execute` (mcp path) |
| 7 | retrieve-context + ai-policy + governance + readiness | context-command.ts, governance-command.ts, readiness-command.ts | mcp retrieve-context/effective-policy; cms ai-governance admin; readiness snapshots |
| 8 | llm + prompt | llm-command.ts, prompt-command.ts | providers/models/defaults/verify/sync/probe/catalog; prompt-templates + use-case-types |
| 9 | cost + usage + dashboard + audit | ops-command.ts (or split) | budget, usage-metrics/logs, dashboard, audit-log, resource-activity |
| 10 | permission (resourceperm) + org-ext + branding + me + system | permission-command.ts (extend), org-command.ts (extend), branding/me/system-command.ts | grant/revoke/check, table-permissions, user-groups, invite, org settings/perm/audit, branding logo, /me, system admin |

## Verify
- Sau mỗi phase: `pnpm lint` + `pnpm build`; test trọng tâm phần logic mới.
- Cuối: full `pnpm test`, `agentbrain --help` snapshot, đối chiếu coverage-matrix.
- `/ak:code-review --pending` trước khi ship.

## Risks / rollback
- Đổi base URL `/v1/cms`→`/v1` phá command cũ nếu quên prefix → mitigate: cập nhật đồng loạt + test.
- Song song nhiều agent sửa `index.ts`/`api-types.ts`/`http-client.ts` → mitigate: các file shared do controller (main) sở hữu; subagent chỉ tạo/sửa file domain của mình + trả về type cần thêm.
- Upload presigned PUT khác nhau giữa provider → theo đúng DTO backend (PUT, Fields rỗng); giữ Content-Type khớp presign.
- Rollback: revert theo phase (mỗi phase = commit riêng).
