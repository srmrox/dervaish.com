# Dervaish Platform & Studio Plan

_Last updated: 2026-07-04. Single authoritative plan for the Dervaish platform.
Merges the greenfield architecture, the Studio contribution/render/distribution
plan, and the storage + Markdown-wiki content model. Where sources disagreed, the
most recent decisions win. Companion: `design-system.md` (UI contract) and the
renderer-side notes in `Lyrics Video/docs/` (`HANDOFF.md`, `UPGRADE.md`)._

## 1. Overview and scope

Dervaish is a preservation-focused devotional media archive and listening
platform. It combines audio/video hosting and playback, archival metadata and
provenance, reciter/writer profiles, multilingual synchronized lyrics
(translation + transliteration, RTL/LTR), a wiki-style reading layer, community
submission and correction workflows, and lyric-video generation.

Dervaish **Studio** is the contribution layer: the public submits sources,
transcribes and times lyrics, adds translations, and writes wiki context; admins
verify and merge; finalized content is (a) published as readable Markdown files
for preservation and (b) rendered into lyric videos on local GPU hardware. Some
videos embed a source video behind the lyrics.

## 2. Executive recommendation (greenfield)

Dervaish is a greenfield, Dervaish-first platform rather than a direct integration
of MediaCMS or Omeka S. Those carry different assumptions (general media
publishing; a PHP/Zend-era heritage CMS). Dervaish needs a narrower, deeper
product where devotional listening, provenance, multilingual synchronized lyrics,
correction workflows, and generated lyric-video publishing are first-class models.
MediaCMS and Omeka S are references only (architecture and data-model lessons);
their code is not merged in, avoiding incoherence, stack mixing, and AGPL/GPL
license risk.

## 3. Current state and remaining gaps

Backend implemented and tested: Django + DRF + Celery + PostgreSQL + Redis +
S3-compatible storage. Apps: `accounts`, `catalog`, `archive`, `lyrics`,
`community`, `media`, `video_generation`, `imports`, `public`, `audit`,
`dervaish_admin`. The React frontend (`apps/platform-web`) is an early shell.

Gaps between here and a working pipeline:

1. **Rendering is a placeholder** (`video_generation` calls
   `complete_render_placeholder`); the local renderer must consume the real
   payload.
2. **Studio / Player / Wiki UI is unbuilt** (frontend shell only).
3. **Video-overlay rendering** — `video_overlay` is modeled but the local renderer
   composites only image + audio today.
4. **Kalam/Rendition split and Markdown publishing** — the data model must gain a
   work-vs-recording distinction (§8, §11) and an approval-time file publisher
   (§4). The current `Track`/`LyricSet` shape predates this.

## 4. Storage and content architecture

Three stores, split by data type; each is the right tool for its job:

- **Media blobs → Cloudflare R2.** Audio, source video, images, and generated MP4s
  live in R2 (S3-compatible, so the existing S3 code path is unchanged). At
  hundreds of GB with video, R2's zero egress is decisive for streaming. Renders
  are produced locally on the 5090, kept in OneDrive, and uploaded to R2.
- **Text / metadata / lyrics / wiki → a Git repo of Markdown.** People, kalam
  text, kalam context/story, per-line annotations, and rendition metadata are
  **published as readable Markdown/structured files** for preservation, openness,
  and portability. This is the open, versioned, human-readable backup.
- **Working store → PostgreSQL.** The database is where live work happens —
  in-progress submissions, redundant timing passes, review states, votes — and it
  is retained permanently as the transactional store and fast index. It is **not**
  discarded after publishing.

Cold backup: **OneDrive / SharePoint**, manually managed for now, until an
automated mirror/replication job exists. Provenance already stores checksums, so a
later mirror can verify copies.

**Publish-on-approval.** Contributors and admins work entirely in the database via
Studio. Only when content is **approved/canonical** does the platform generate the
Markdown/structured files into the content repo and commit them. Editing stays in
the DB (good UX, review workflow, millisecond timing); the files are the readable,
preserved output. Post-publication corrections flow through the same review path
and re-publish. Net roles: **R2 = blobs, Git/Markdown = published canonical text +
wiki, Postgres = working + index.**

Content repo layout:

```
content/
  people/<slug>.md                 # frontmatter: roles, aliases, dates, links + bio prose
  kalam/<slug>/
    kalam.md                       # frontmatter: writer(s), languages + context/story prose
    lines.yaml                     # canonical lines: stable id + order + text per language
    annotations/<line-id>.md       # optional per-line commentary
  renditions/<slug>.md             # frontmatter: kalam ref, reciter ref, R2 media key,
                                   #   line selection + per-rendition variant overrides
  renditions/<slug>.timings.json   # per-rendition timings (machine data)
```

## 5. Product surfaces and information architecture

Three surfaces over one dataset:

- **Player** (public, consume) — browse the catalog; play audio/video with synced
  multilingual lyrics; toggle languages. Spans Listen, Companion, and Archive.
- **Wiki / Reader** (public, read) — kalam context and story, reciter/writer
  profiles, per-line annotations, and cross-links. Rendered by the app from the
  published Markdown content; not a separate wiki engine.
- **Studio** (contribute) — source intake, lyric development, and wiki authoring
  (Submit / Community). Web; desktop-first for authoring, mobile for timing.
- **Admin** (curate) — verification, merge/approve, publishing, preservation.

Primary navigation: Listen, Companion, Archive, Submit, Community, Admin &
Preservation, plus Queues, People, Generated Media. Every feature maps to one of
these.

## 6. Target stack

- **Backend:** Django, DRF, PostgreSQL, Celery, Redis, S3-compatible storage
  (Cloudflare R2 in prod, MinIO for local dev), FFmpeg, Django admin.
- **Frontend:** React + Vite per `design-system.md`; mobile-first and installable
  as a PWA (§15). Renders published Markdown for the Wiki/Reader surface.
- **Worker:** Celery for ingestion, transcoding, waveforms, thumbnails, captions,
  imports, **content-file publishing**, and lyric-video rendering.
- **Content publishing:** a service/worker that writes approved DB records out to
  the Markdown content repo and commits them.
- **Search:** PostgreSQL full-text + trigram for v1.

Django/DRF/Celery suits Dervaish's hardest problems: media ingestion, durable
workflow state, admin operations, background processing, and data integrity. No
PHP/Python mixing; Omeka S informs archive modeling only.

## 7. Backend module architecture

- `accounts`: users, roles, permissions, contributor trust, tokens, audit
  identity.
- `media`: uploads, assets, renditions (encodings), libraries, mirrors, captions,
  chapters, thumbnails, waveforms, previews, playback URL signing.
- `catalog`: **kalam (works)**, **renditions (recordings)**, collections, people,
  credits, visibility, publication states, catalog APIs, search indexing.
- `archive`: archive records, citations, provenance, source ratings, vocabulary
  terms, JSON-LD export.
- `lyrics`: canonical kalam lines, per-rendition timing and variants, languages,
  imports/exports, editor drafts, validation, direction metadata.
- `content`: wiki prose (kalam story, person bios, per-line annotations) and the
  approval-time Markdown publisher to the content repo.
- `community`: submissions, correction drafts, verification votes, disputes, track
  requests, upvotes, moderation.
- `video_generation`: render jobs (per rendition), layouts, payloads, logs,
  previews, outputs, cancellation, publishing.
- `public`: public serializers, listening/archive/wiki pages, share links,
  JSON/JSON-LD.
- `admin`: Django admin, review queues, dashboards, moderation, preservation.

(Naming note: the media term "rendition" — an encoding of a media asset — is
distinct from a catalog **Rendition** (a recording of a kalam). Keep the domain
term dominant; consider renaming the media one to "encoding" to avoid collision.)

## 8. Canonical data model

Accounts: `User` (display name, email, role, trust score) and `Role`
(anonymous/listener/contributor/editor/admin).

Catalog — **the work/recording split is the core change:**

- **`Kalam` (Work)** — the poem/text itself: title, slug, writer credit(s),
  languages present, `is_canonical`/review state/version, and a prose
  description/story. The canonical text lives here, not on a recording.
- **`KalamLine`** — kalam FK, stable `line_id`, order, `text_by_language` (JSON).
  The unit that renditions select and time and that annotations attach to.
- **`Rendition` (Recording)** — a specific performance (this is what `Track`
  becomes): kalam FK, reciter credit(s), media asset(s), visibility, publication
  state, `published_at`. A rendition *selects and times* kalam lines.
- **`RenditionLine`** — rendition FK, `KalamLine` FK, order, `start_ms`, `end_ms`,
  optional `variant_text_by_language` override. **Timing is per-rendition** (each
  recording is timed differently); variant text handles rendition-specific
  wording; the selection handles "some lines only appear in some renditions."
- `Person` (names, aliases, biography prose, origin, roles, external ids),
  `Collection`, `TrackCredit`/`RenditionCredit` (writer(s) on the kalam;
  reciter(s)/translator(s) on the rendition).

Media: `MediaAsset` (original; kind, storage key in R2, checksum, MIME, size,
duration, provenance), `MediaEncoding` (derived playable rendition of the asset),
`Caption`, `Chapter`, `UploadSession`, `MediaDerivative` (thumbnail/waveform/
preview), `MediaProcessingJob`.

Archive: `ArchiveRecord`, `Citation`, `ProvenanceRecord`, `SourceRating`,
`VocabularyTerm` (as before — source-critical metadata, provenance, JSON-LD).

Lyrics/content: canonical text = `Kalam` + `KalamLine`; timing/variants =
`Rendition` + `RenditionLine`; `Language` lanes (code, name, role
original/translation/transliteration/commentary, direction, is_published) apply at
the kalam level (available) and are chosen per rendition (visible/rendered).
Wiki prose lives as `Kalam.description`, `KalamLine.annotation`, `Person.biography`
(all published to Markdown on approval). `UserLyricPreference` persists visible
languages per user. (This supersedes the earlier `LyricSet/LyricLanguage/
LyricSegment`-on-Track shape: canonical text moves up to the kalam, timing moves
down to the rendition.)

Community: `Submission`, `CorrectionDraft`, `VerificationVote`, `TrackRequest`,
`TrackRequestVote` — as in §12.

Video generation: `VideoGenerationJob` renders a **Rendition** (source asset +
`RenditionLine` timing + text resolved from `KalamLine` and variant overrides;
title/writer from the kalam, reciter from the rendition), with source mode
audio_visualizer|video_overlay, layout id, resolution, payload, logs, preview/
output assets.

All public models carry timestamps; reviewable models carry created/updated/
reviewed-by, state, and audit coverage.

## 9. Media pipeline

Upload: request session → `MediaAsset` pending + presigned `UploadSession` (R2) →
client uploads original → worker verifies checksum/MIME/duration/codecs/size/kind,
updates metadata, queues derived processing. Originals immutable, stored separately
from replaceable encodings; captions, chapters, thumbnails, waveforms, and
generated outputs are separate objects; storage keys include environment, object
type, id, and version. Transcode audio (Opus, AAC/MP3, preserving masters), video
(web MP4, HLS), images (thumbnails, responsive). Audio waveforms are **required for
Studio timing**. WebVTT is the v1 caption interchange. Playback returns a manifest
(preferred encoding, fallback mirrors, captions, chapters, lyric metadata) with
signed URLs for private/pending assets and cacheable URLs (CDN) for public ones.
Generated video: preview first, editor approval, provenance retained (see §14).

## 10. Archive metadata

Omeka-like archival depth without a generic clone. `ArchiveRecord`s link kalam,
renditions, people, collections, media, citations, and provenance, with visibility
states. `VocabularyTerm` for controlled/linked-data terms, but common devotional
fields stay explicit columns for editor usability. Citations are reusable/linkable;
provenance captures source, URL, acquisition date, checksum, importer,
transformation, notes; source ratings separate editorial from community trust.
JSON-LD for public kalam, renditions, people, records, collections, citations, and
media.

## 11. Lyrics and wiki content design

**Canonical text belongs to the Kalam; timing belongs to the Rendition.** A
`Kalam` holds its lines (`KalamLine`, stable ids) with text per language, the
writer(s), and the story/context prose. A `Rendition` references a kalam, selects
which lines it includes (subset/reordering), optionally overrides wording
(`variant_text_by_language`), and stores per-line `start_ms`/`end_ms`. This models
"some lyrics appear only in specific renditions" and per-recording timing directly.

Text and timing are structured; **prose is Markdown**. Millisecond timings live in
`RenditionLine` / `timings.json` frontmatter, never in prose. The wiki content —
kalam story/context, reciter/writer bios, and per-line annotations — is authored as
prose and published to Markdown.

Descriptions/annotations attach at three levels: **kalam** (overall story),
**line** (a note keyed to a `KalamLine` id), and **rendition** (recording-specific
notes). The Reader surface renders these with line anchors so a visitor can jump
from a verse to its commentary and see who wrote and who is reciting.

Editing: contributors draft in Studio; editors align timing, add languages/
annotations, and publish. Import/export WebVTT, LRC, TTML, Dervaish JSON. On
approval the content publisher writes `kalam/`, `renditions/`, `people/`, and
`annotations/` files to the Git repo (§4). Lanes carry `dir`/`lang` with
mixed-direction-safe rendering everywhere.

## 12. Community contribution workflow

### 12.1 Stage 1 — Source intake (public)

Row-based **bulk grid**: URL, title, reciter(s), writer(s) per row → a draft
**Rendition** (and its `Kalam` if new) + a `MediaAsset`. **URL fetch is manual and
best-effort** (per-row Fetch + Try-to-fetch-all; Celery `INGEST`), with an
always-available **manual upload** fallback; fetchers are pluggable. Reciter/writer
free text is **resolved to `Person`** at verification (via aliases). Duplicate
guard on `checksum_sha256` and normalized URLs.

### 12.2 Stage 2 — Verification (admin only)

Confirm applicability, shareability (rights), non-duplication; resolve credits;
record a rejection reason. On accept, the rendition opens for lyric work and ingest
side-jobs run (duration, **waveform**, thumbnail).

### 12.3 Stage 3 — Lyric development (volunteers), three micro-tasks

Against **shared line IDs** (the `KalamLine`s): (1) **transcription/segmentation**
establishes the kalam's canonical text and line breaks once; (2) **timing** — many
volunteers time the fixed lines for a given rendition, collected redundantly; (3)
**translation/transliteration** attaches languages to the same line ids. Wiki
prose (story, bios, annotations) is a parallel authoring task. Each contribution is
a `Submission` for attribution.

### 12.4 Stage 4 — Merge and approve (admin)

Shared segmentation makes merges deterministic: per line, **median start/end**
across timing passes, auto-flagging disagreement beyond ~400 ms; per-line text
consensus; combine languages; set canonical, bump version; preserve attribution.

### 12.5 Stage 5 — Publish and render

Approval triggers two outputs: the **content publisher** writes Markdown/structured
files to the Git repo (§4), and a `VideoGenerationJob` renders the rendition on the
local GPU worker (§14).

### 12.6 Wiki loop and needs-work queue

Post-canonical, the public proposes `CorrectionDraft`s (text, timing, or wiki
prose); others verify/dispute via `VerificationVote`; an admin merges and
re-publishes. A **needs-work queue** (via `TrackRequest` + upvotes) surfaces kalam
needing transcription, N more timing passes, a translation, or missing context.

### 12.7 Supporting mechanics

Submission review states (draft → submitted → under review → changes requested →
approved/rejected → published); partial correction acceptance; one verification
vote per user/field (writer, reciter, lyrics, source, overall); track-request
statuses; contributor trust that can order queues but not bypass review in v1 (a
trusted fast-path is open — §19). Every moderation/publish/correction action writes
an audit entry.

## 13. Object state machines

- **Source / MediaAsset:** submitted → verifying → accepted / rejected /
  duplicate.
- **Kalam text:** draft → merge-candidate → canonical (→ published to Markdown).
- **Rendition:** draft → open-for-lyrics → in-development → finalized → published.
- **VideoGenerationJob:** queued → running → completed → published.
- **Content file:** (on approval) generated → committed to content repo.

## 14. Rendering architecture

```
Browser (React Studio) → DRF API → PostgreSQL (working + index, review state)
                                  → R2 (audio, source video, waveforms, outputs)
                                  → Git content repo (published Markdown, on approval)

DRF queues VideoGenerationJob (per Rendition) → Redis (Celery broker)
  → Celery worker on the local i9 / RTX 5090          [CONFIRMED render host]
      downloads source asset from R2
      adapter: render_payload → renderer inputs
      runs existing GPU pipeline (video-gen-v3 / gpu_render, NVENC)
      uploads preview + output MP4 to R2  (also kept locally in OneDrive)
      marks job COMPLETED → publish attaches output to the rendition
```

Render host (confirmed): local 5090 as a Celery worker — reuses the renderer and
GPU at near-zero cost; the machine must be online to drain the queue. `build_render_payload`
already emits `{ jobId, sourceMode, sourceUrl, layoutId, resolution, title, voice,
writer, visibleLanguages, segments:[{startMs,endMs,textByLanguageId}], outputDir }`;
segments now come from `RenditionLine` timing with text resolved from `KalamLine` +
variant overrides. A small **adapter** maps the payload to the renderer's current
inputs (its `lyrics.json` shape + `layouts/<layout_id>/`); layouts stay as files on
the worker. `video_overlay` compositing is a new renderer capability. Generated
media follows §9: preview first, editor approval, provenance retained.

## 15. Client and distribution strategy

- **Web player + Wiki/Reader** (desktop + mobile-responsive) — the distinctive
  Dervaish experience: parallel multilingual synced lyrics, video, and the
  reading/context layer.
- **Mobile via responsive PWA, not native (for now).** Timing (tap-to-time) and
  single/share-sheet source submission suit mobile; transcription, sustained
  translation, and merge stay desktop. Time against the Web Audio clock.
- **Audio background listening + offline via OpenSubsonic.** Expose the catalog
  over Subsonic/OpenSubsonic so mature third-party clients (Symfonium, Feishin,
  Amperfy, Supersonic) give background playback, offline, gapless, and scrobbling.
  OpenSubsonic `getLyricsBySongId` carries synced multi-language lyrics (per-entry
  `lang` + `synced`); `RenditionLine` timing + `KalamLine` text map to it almost
  one-to-one. Caveats: most clients show one language at a time, audio only,
  playback only. Adoption: trial **Navidrome** first, then implement the endpoints
  in the backend.
- **Native deferred**; API-first backend makes it a later drop-in.

Frontend follows `design-system.md`: semantic tokens, lucide icons, `aria-label`+
`title` on icon-only controls, no color-only status, `dir`/`lang` and
mixed-direction-safe lyric rendering.

## 16. API design

REST with DRF and pagination; public endpoints never leak drafts. Accounts,
catalog+playback (now split into kalam and rendition resources), archive+JSON-LD,
lyrics (kalam lines, rendition timings, import/export), wiki content
(kalam/person/annotation reads; edits via submissions/corrections), submissions +
community verification + track requests, admin review/publish + media, and
video-generation jobs (`POST/GET /api/video-generation/jobs/…`,
`…/{id}/cancel/`, `…/{id}/publish/`). Add OpenSubsonic endpoints under §15.

## 17. Migration and import strategy

Start fresh with minimal seed fixtures (one kalam with RTL+LTR lines, one
rendition with timing, one person, one collection, one archive record, one
citation, one media asset). Use the old prototype only as a behavior inventory.
Optional importers (after the model is stable) map MediaCMS media → `MediaAsset`,
encodings → `MediaEncoding`, subtitles → captions; Omeka S items/sets/values →
archive records/collections/values; preserve original ids in provenance. Imports
are batch-tracked, dry-runnable, resumable, and land in draft/pending.

## 18. Roadmap

The greenfield backend build is largely complete; QA validated the integration
surfaces. Go-forward (authoritative):

- **Phase 0 — Prove the pipe.** Local docker-compose (Postgres/Redis/MinIO),
  connect the local worker, replace the render placeholder for `audio_visualizer`.
  Success = one job: browser → queue → 5090 → real MP4 in R2 → COMPLETED.
- **Phase 1 — Kalam/Rendition + minimal Studio loop.** Introduce the work/recording
  split; editor (pick rendition → transcribe kalam → time → translate → submit) +
  reviewer approve → canonical; wire `platform-web` to the live API.
- **Phase 1b — Content publisher + Wiki/Reader.** On approval, generate Markdown
  files to the content repo; build the read surface (kalam story, person pages,
  line annotations).
- **Phase 2 — Video overlay + rich layouts.**
- **Phase 3 — Community + distribution.** Verification votes, track requests,
  corrections in the UI; trial Navidrome; then OpenSubsonic endpoints.

## 19. Decisions made and open decisions

**Decided:** greenfield Django/DRF/Celery; local 5090 Celery render worker;
media blobs on **Cloudflare R2**, renders kept in OneDrive + uploaded to R2,
**OneDrive/SharePoint as manual cold backup** until an automated mirror exists;
**database is the working store (retained)**, **readable Markdown files generated
only on approval** as the preservation/open copy; **Kalam (work) vs Rendition
(recording)** as distinct entities with per-rendition line selection, variants, and
timing; wiki-style reading layer rendered from the Markdown content; URL fetch
manual + best-effort with upload fallback; Stage 3 split into transcription →
timing → translation on shared line ids; mobile via PWA with timing as the flagship
task; audio/offline via OpenSubsonic (Navidrome first).

**Open:** trusted-contributor fast path (leaning later); layouts as worker files vs
DB/JSON; SVG import dependency; exact rendered-language selection mapping; the
content repo's edit path for non-technical wiki contributors (all via the app, or
direct Git for advanced users); and confirming automated mirror design when it
replaces manual backup.

## 20. Validation plan

Backend: model tests (kalam/rendition constraints, line selection, per-rendition
timing non-overlap, votes, publication); API tests (permissions, pagination,
signed URLs, visibility, review); Celery tests (processing transitions, retries,
cancellation, **content-file publishing**, render output). Media: fixtures for
audio/video/captions/bad inputs; immutable masters; waveform/thumbnail/manifest.
Lyrics/content: import/export round-trips; RTL/LTR; annotation linkage;
publish-to-Markdown fidelity (DB → files → re-read). Community: submission
lifecycle, partial corrections, vote replacement, request uniqueness, trust.
Frontend: component + e2e + a real browser Playwright smoke suite (desktop/mobile
first paint, navigation, playback bar, RTL/LTR lyrics, wiki reading, forms,
keyboard focus).

## 21. Risks, gotchas, and environment notes

**Risks/mitigations:** broad scope → vertical slices; MediaCMS/Omeka licensing →
reference only; media/egress cost → R2 zero-egress + encoding profiles, quotas,
retry limits, editor approval before expensive generation; metadata
over-abstraction → explicit models, flexible values only where they earn it;
search → Postgres FTS/trigram first; performance → pagination, prefetch,
read-optimized serializers, CDN, cached public/wiki pages; DB↔files drift →
one-way publish-on-approval with checksums, DB remains source for editing;
maintainability → explicit state machines, centralized permissions, early audit.

**Operational gotchas:** the 5090 is the render farm — the queue drains only while
it is on; many concurrent NVENC sessions can exceed the session limit → libx264
fallback (logged, harmless); browser preview ≠ final render (different text engine;
local render is source of truth); term collision between media "rendition"
(encoding) and catalog **Rendition** (recording) — prefer "encoding" for media.
**Assistant-sandbox note:** OneDrive-mounted renderer files can read truncated in
the coding sandbox — verify via Read/Grep; the user's disk is correct.

## 22. References

- OpenSubsonic — `getLyricsBySongId`:
  https://opensubsonic.netlify.app/docs/endpoints/getlyricsbysongid/
- OpenSubsonic — Song Lyrics extension:
  https://opensubsonic.netlify.app/docs/extensions/songlyrics/
- Navidrome — Lyrics: https://deepwiki.com/navidrome/navidrome/9.4-lyrics
- Navidrome — Client apps: https://www.navidrome.org/apps/
- `docs/design-system.md` — UI and workflow design rules.
- `Lyrics Video/docs/HANDOFF.md`, `UPGRADE.md` — renderer-side notes.
