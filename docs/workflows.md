# Dervaish Backend Workflows

_Last updated: 2026-07-04. Process flows for the Dervaish backend, aligned to
`plan.md` and `database.md`. Each workflow lists its trigger, actor/role,
preconditions, steps (sync vs async), state transitions, side effects, and failure
handling. Cross-cutting concerns (auth, audit) are in §0._

## 0. Cross-cutting

**Roles** (`RoleKind`): anonymous, listener, contributor, editor, admin. Editors
and admins do verification, merge, and publish; contributors submit and time;
listeners consume and upvote; anonymous can read public content only.

**Audit.** Every state-changing action by editors/admins (verify, merge, approve,
publish, cancel, correct, role change) writes an `AuditLog` row (actor, action,
generic target, before/after, request metadata). Public reads are not audited.

**Async.** Long or external work runs as Celery tasks (`INGEST`, `TRANSCODE`,
`WAVEFORM`, `THUMBNAIL`, content publish, video render). Each has a durable job row
with status, logs, retries, and failure reason. The API never blocks on them.

**Storage split.** Working state lives in PostgreSQL; media blobs in R2; canonical
readable files in the Git content repo (written only on approval). See `plan.md`
§4.

---

## 1. Source intake (bulk submission)

**Trigger:** a contributor submits the intake grid (rows of URL, title,
reciter(s), writer(s)). **Actor:** contributor (or admin following the same path).

**Steps.**
1. For each row, resolve or create a draft `Kalam` (by title/slug match, else new)
   and create a draft `Rendition` linked to it.
2. Create a `MediaAsset` per row: URL rows store `source_url` (status `pending`);
   upload rows get a presigned `UploadSession` (R2).
3. Reciter/writer captured as free text on the `Submission` (resolved to `Person`
   at verification, §3).
4. **Duplicate guard:** check `MediaAsset.checksum_sha256` (uploads) and normalized
   `source_url`; on match, flag the row as a possible duplicate rather than
   creating a twin.
5. Wrap the batch in `Submission` rows for attribution.

**URL fetch (manual, best-effort).**
- Per-row **Fetch** enqueues a `MediaProcessingJob(kind=ingest)`; **Try to fetch
  all** enqueues one per pending URL row.
- Fetch pulls the media into R2 and updates the `MediaAsset` (storage_key,
  checksum, size, duration, status). **Expected to fail often** — on failure the
  job records the reason and the row stays awaiting a **manual upload** fallback.

**State:** `MediaAsset` → submitted; `Rendition` → draft; `Submission` → submitted.
**Failure:** fetch failure is non-fatal (upload fallback); dedup conflicts surface
to the submitter for confirm/merge.

---

## 2. Media ingest & processing (async)

**Trigger:** a `MediaAsset` becomes present (fetched or uploaded). **Actor:**
system (Celery).

**Steps.** Verify checksum/MIME/duration/codecs/size/kind → generate encodings
(`MediaEncoding`: Opus/AAC audio, MP4/HLS video) → generate `MediaDerivative`s
(**waveform** — required for timing, thumbnail, preview). Each step is a
`MediaProcessingJob` with status, attempts, logs.

**State:** `MediaAsset` pending → processing → ready (or failed). **Failure:**
ret/ry with backoff; on terminal failure mark asset failed and surface in the admin
media queue.

---

## 3. Verification (admin)

**Trigger:** admin opens the verification queue (renditions with ready/pending
sources). **Actor:** editor/admin. **Precondition:** source present.

**Steps.**
1. Confirm the source is applicable, shareable (rights), and not a duplicate.
2. **Resolve credits:** map free-text reciter/writer to `Person` (via
   `Person.aliases`), creating `KalamCredit` (writer) and `RenditionCredit`
   (reciter).
3. Decide: **accept**, **reject** (with reason), or mark **duplicate**.

**State on accept:** `Rendition` draft → open-for-lyrics; ensure waveform job ran.
**On reject/duplicate:** `Rendition`/`MediaAsset` → rejected/duplicate with a
recorded reason. **Audit:** yes.

---

## 4. Lyric development (volunteers) — three micro-tasks

All operate against **shared `KalamLine` ids**. Each contribution is a
`Submission` (status draft → submitted) for attribution. **Actor:** contributor.
**Precondition:** rendition open-for-lyrics; kalam exists.

**4a. Transcription / segmentation.** Establish the kalam's canonical text and line
breaks once: create/edit `KalamLine` rows (stable `line_id`, order,
`text_by_language[original]`). Others propose corrections rather than
re-segmenting. State: `Kalam` text → draft.

**4b. Timing.** Volunteer times the fixed lines for a given rendition: creates a
set of `RenditionLine` rows (start_ms/end_ms per included `KalamLine`) — collected
**redundantly** (multiple independent passes, each its own `Submission`).

**4c. Translation / transliteration.** Add a `Language` lane and fill
`KalamLine.text_by_language[code]` for that lane; attaches to the same line ids.

**Wiki authoring (parallel task).** Draft `Annotation`s (kalam/line/rendition) and
edit `Kalam.description` / `Person.biography` prose. State: `review_status` draft →
submitted.

**Failure/validation:** segment timing must be non-overlapping and `end>start`;
incomplete translations are allowed (a language may be partial).

---

## 5. Merge & approve (admin)

**Trigger:** a rendition has enough submissions. **Actor:** editor/admin.

**Steps.**
1. **Timing merge:** per `KalamLine`, compute **median** start/end across the
   redundant `RenditionLine` passes; auto-flag lines whose spread exceeds a
   threshold (~400 ms) for manual review.
2. **Text consensus:** per line, reconcile `text_by_language`; highlight
   disagreements.
3. **Languages:** combine lanes into the canonical set.
4. Set `Kalam.is_canonical = true`, bump `version`; move `Rendition` →
   finalized. Approve associated `Annotation`s.
5. Preserve attribution (which `Submission`/user contributed each part).

**State:** Kalam text → canonical; Rendition → finalized. **Triggers:** §6 publish
and (optionally) §7 render. **Audit:** yes.

---

## 6. Publish-on-approval (content publisher, async)

**Trigger:** canonical/finalized approval. **Actor:** system (Celery), acting as a
bot committer.

**Steps.** Serialize the approved data to files and commit to the Git content repo:
`people/<slug>.md`, `kalam/<slug>/kalam.md` + `lines.yaml`,
`kalam/<slug>/annotations/<line-id>.md`, `renditions/<slug>.md` +
`<slug>.timings.json`. For each file write a `PublishedFile` row (repo_path,
content_hash, status pending → committed, commit_sha).

**State:** `PublishedFile` generated → committed. **Direction:** one-way DB → Git;
the DB stays the source of truth for editing. **Failure:** retry commit; on
terminal failure mark `PublishedFile` failed and surface to admin; DB state
unaffected.

---

## 7. Video generation (render)

**Trigger:** admin/editor queues a render for a finalized `Rendition` (or auto on
approval). **Actor:** editor/admin + system + **local 5090 worker**.

**Steps.**
1. Create `VideoGenerationJob` (rendition, source_asset, source_mode, layout_id,
   resolution, visible_language_codes, denormalized title/voice/writer).
2. `build_render_payload` assembles segments from `RenditionLine` timing with text
   resolved from `KalamLine` + variant overrides; status → queued; dispatch Celery
   task (Redis broker).
3. The **local 5090 worker** picks up the job: downloads the source from R2 →
   adapter maps payload to renderer inputs → runs the GPU pipeline (video-gen-v3 /
   gpu_render, NVENC) → uploads preview + output MP4 to R2 (also kept locally in
   OneDrive) → creates output `MediaAsset`(s).
4. Status → completed. **Publish** attaches the output asset to the `Rendition`
   after editor approval of the preview.

**States:** queued → running → completed → published (or failed/cancelled).
**Failure:** worker records failure_reason + log; NVENC session-limit overflow
falls back to libx264 (logged, harmless); job retryable. **Note:** the queue drains
only while the 5090 is online.

---

## 8. Correction & wiki-edit loop (post-canonical)

**Trigger:** anyone proposes a change to published content. **Actor:** contributor
→ editor/admin.

**Steps.** Create a `CorrectionDraft` (target kalam/rendition/record; fields;
proposed_changes) or a wiki `Annotation` edit → community `VerificationVote`s
(verify/dispute per field) accumulate → admin reviews, applies partially/fully →
bumps version → re-runs §6 publish (and §7 render if timing/text changed).
Rejected corrections remain auditable.

---

## 9. Community signals

**Verification voting:** one `VerificationVote` per (submission, voter, field);
later votes replace earlier ones; summaries show verify/dispute counts (never
auto-publish). **Track requests / needs-work:** `TrackRequest` (+ `TrackRequestVote`
upvotes) captures demand; the needs-work queue derives from renditions missing a
transcription, N timing passes, a translation, or context. **Upvotes:**
`RenditionVote` is a lightweight signal, not verification.

---

## 10. Distribution (OpenSubsonic, later)

**Trigger:** a Subsonic client requests catalog/stream/lyrics. **Actor:** external
client + backend. **Steps.** Implement OpenSubsonic endpoints over the catalog:
browse → `Rendition`/`Kalam`; stream → signed R2 URL; `getLyricsBySongId` →
`structuredLyrics` built from `RenditionLine` timing + `KalamLine` text (one entry
per `Language`). Read-only; auth via Subsonic token mapped to `accounts.User`.

---

## 11. Auth & permission gating (summary)

| Action | Min role |
|---|---|
| Read public catalog/wiki, play public media | anonymous |
| Upvote, queue, save language preferences, submit request | listener |
| Submit source, transcribe/time/translate, propose correction | contributor |
| Verify source, merge/approve, publish, manage media, queue render | editor |
| Manage roles/libraries, destructive ops, preservation settings | admin |

Anonymous contribution actions return a clear sign-in/role prompt, never a silent
failure.
