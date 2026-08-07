# Uploading and managing media / documents

The `media` group handles the full asset lifecycle: upload, list, preview,
transcribe, delete, background jobs, org-level settings, and BYO storage.

## The 3-step upload flow (automated)

`agentbrain media upload <file>` runs the AgentBrain 3-step flow in one shot:

1. **Presign** — POST to `/media/presign` with filename, kind, content-type,
   optional sha256 → returns a presigned PUT URL + asset ID.
2. **PUT** — upload the raw file bytes directly to storage (S3 / R2 / BYO
   bucket) with the presigned URL. No re-encoding, no proxying.
3. **Commit** — POST to `/media/commit/{id}` to mark the asset ready and index
   metadata.

The CLI is the only officially supported client that does all three
transactionally. If any step fails it exits non-zero without leaving orphaned
half-uploaded assets.

## `media upload` — options

```bash
agentbrain media upload <file>
```

| Flag | Purpose |
|---|---|
| `--folder-id <id>` | Destination folder (organizes in the UI + query filters) |
| `--kind <kind>` | `raw_doc` \| `image` \| `audio` \| `video` — auto-detected from extension |
| `--content-type <mime>` | Override MIME (auto-detected from extension) |
| `--no-sha256` | Skip client-side sha256 (auto-skipped for very large files) |

### Auto-detection rules

| Extension | Kind | Default content-type |
|---|---|---|
| `.pdf`, `.md`, `.txt`, `.csv`, `.tsv`, `.json`, `.xml`, `.html`, `.docx`, `.pptx`, `.xlsx` | `raw_doc` | matched by ext |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` | `image` | `image/*` |
| `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg` | `audio` | `audio/*` |
| `.mp4`, `.mov`, `.mkv`, `.webm` | `video` | `video/*` |

Override when the extension is misleading:

```bash
agentbrain media upload dump.bin --kind raw_doc --content-type application/pdf
```

### Constraints

- Max file size: **500 MB**. Server returns `413` above this — split or upload
  through the storage console.
- sha256 is auto-**skipped** when the file is very large (avoids OOM on the
  hashing pass). Pass `--no-sha256` to force-skip smaller files too.
- Upload timeout scales with file size; if you still hit a timeout, raise the
  base with `agentbrain config set timeout 300000` (5 min).

### Examples

```bash
# Simplest: auto-detect everything
agentbrain media upload ./report.pdf

# Into a folder, force kind + MIME
agentbrain media upload ./notes.txt \
  --folder-id fld_xxx --kind raw_doc --content-type text/plain

# Large video, skip hashing to shave a full pass
agentbrain media upload ./interview.mp4 --no-sha256

# Verbose to see the presign URL host + status codes (signatures are redacted)
agentbrain media upload ./big.pdf --verbose
```

## Managing uploaded assets

```bash
agentbrain media list                                  # all assets
agentbrain media list --folder-id fld_xxx              # scoped to folder
agentbrain media list --kind raw_doc                   # scoped to kind
agentbrain media get <id>                              # full metadata
agentbrain media update <id> --file-name "new.pdf" --folder-id fld_yyy
agentbrain media delete <id>
agentbrain media bulk-delete --ids id1,id2,id3
```

### Download & preview

```bash
agentbrain media download-url <id>          # short-lived presigned GET
agentbrain media preview <id>               # structured preview (headings, snippets, etc.)
```

`download-url` returns a URL that expires in minutes — do not store it, do not
share it in tickets/wiki. Redirect it into `curl`:

```bash
curl -L "$(agentbrain media download-url <id> -o json | jq -r .url)" -o out.pdf
```

### Transcription (audio / video only)

```bash
agentbrain media transcribe <id>            # starts the job
agentbrain media job list                   # check status
```

Returns a job ID. Poll `media job` (below) or wait for a webhook.

## `media job` — processing-run jobs

Every ingest, transcription, and re-processing spawns a background job.

```bash
agentbrain media job list                   # recent jobs
agentbrain media job get <jobId>            # detail incl. status + errors
agentbrain media job cancel <jobId>         # cancel an in-flight job
agentbrain media job retry <jobId>          # retry a failed job
```

Job statuses: `queued`, `running`, `succeeded`, `failed`, `cancelled`.

## `media bulk` — bulk digest jobs

Kick off a batch operation across many assets at once (re-index, re-summarize,
re-embed).

```bash
agentbrain media bulk create --ids id1,id2,id3 --op reindex
agentbrain media bulk list
agentbrain media bulk get <batchId>
```

Available ops depend on your platform build — run `--help` for the current
list.

## `media settings` — org-level upload policy

```bash
agentbrain media settings get               # view current org policy
agentbrain media settings set --max-size 500MB --allowed-kinds raw_doc,image
```

Typical fields: max size, allowed kinds/mimes, default folder, retention
window, auto-transcribe on upload. **Admin-only.**

## `media storage` — BYO bucket

Bring your own S3-compatible bucket (S3, R2, MinIO). AgentBrain manages
presigning; your data never enters the AgentBrain-managed bucket.

```bash
agentbrain media storage get                # view current backing store
agentbrain media storage set \
  --provider s3 \
  --region us-east-1 \
  --bucket agentbrain-assets \
  --access-key-id AKIA… \
  --secret-access-key … \
  --endpoint https://s3.us-east-1.amazonaws.com
agentbrain media storage readiness           # test IAM + CORS + bucket-list
```

**Admin-only.** Never print the secret access key back to the user. Use
`--secret-access-key -` to read from stdin, or set it via env.

## Common upload errors

| Error | Cause | Fix |
|---|---|---|
| `413 Payload too large` | > 500 MB | split file, or raise limit via `media settings set` |
| `401 on presign` | JWT expired | `agentbrain auth login` |
| `403 on PUT` | presign expired (slow client) | retry the whole `upload` |
| `422 kind mismatch` | `--kind` doesn't match content | remove the flag, let auto-detect |
| `ENOSPC` client-side | local temp full during sha256 | `--no-sha256` |
| `ETIMEDOUT` mid-PUT | slow network | raise `timeout` config, retry |
