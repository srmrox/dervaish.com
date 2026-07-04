# Dervaish Database Structure

_Last updated: 2026-07-04. Target relational schema for the Dervaish backend
(PostgreSQL via Django ORM), aligned to `plan.md`. This reflects the **Kalam
(work) vs Rendition (recording)** model and the content-publishing design. Where
it differs from what is currently implemented, see §Deltas at the end._

## Conventions

- Every table has an integer primary key `id` unless noted.
- **`TimestampedModel`** (abstract) adds `created_at` (auto add) and `updated_at`
  (auto now). Every concrete table below includes these.
- **`EditorialModel`** (abstract, extends `TimestampedModel`) adds `visibility`
  (`EditorialState`), `created_by` → `accounts.User` (SET_NULL), `updated_by` →
  `accounts.User` (SET_NULL). Tables that extend it are marked **(Editorial)**.
- Durations and timings are integer **milliseconds**.
- Multilingual text is stored as JSON keyed by language `code`
  (`text_by_language = {"ur": "...", "en": "..."}`).
- Public-addressable entities carry a unique `slug`.
- `review_status` uses `ReviewState`; content/records use `EditorialState`.

### Enumerations

| Enum | Values |
|---|---|
| `EditorialState` | draft, pending_review, public, unlisted, private, archived |
| `ReviewState` | draft, submitted, under_review, changes_requested, approved, rejected, published |
| `RoleKind` | anonymous, listener, contributor, editor, admin |
| `PersonRole` | reciter, writer, translator, contributor |
| `LyricLanguageRole` | original, translation, transliteration, commentary |
| `LyricDirection` | ltr, rtl |
| `MediaKind` | audio, video, image, document |
| `ProcessingStatus` | pending, processing, ready, failed |
| `UploadSessionStatus` | pending, uploaded, cancelled, expired |
| `MediaProcessingJobKind` | ingest, transcode, thumbnail, waveform |
| `AnnotationTarget` | kalam, line, rendition |
| `VideoGenerationSourceMode` | audio_visualizer, video_overlay |
| `VideoGenerationStatus` | queued, running, completed, failed, cancelled |
| `VideoGenerationResolution` | 720p, 1080p, 4k |
| `CitationType` | interview, book, field_recording, website, manuscript |
| `VerificationField` | writer, reciter, lyrics, source, overall |
| `VerificationVoteValue` | verify, dispute |
| `TrackRequestStatus` | open, planned, fulfilled, duplicate, rejected |
| `ImportSource` | dervaish_prototype, mediacms, omeka_s |
| `ImportBatchStatus` | draft, dry_run, running, completed, failed |
| `PublishStatus` | pending, committed, failed |

---

## accounts

### User (extends Django AbstractUser)
| Column | Type | Notes |
|---|---|---|
| username, email, password, … | (AbstractUser) | standard auth fields |
| display_name | Char(160) | optional |
| role | Char(24) `RoleKind` | default listener |
| trust_score | PosInt | default 0 |

### Role
| Column | Type | Notes |
|---|---|---|
| code | Char(24) `RoleKind` | **unique** |
| name | Char(80) | |
| description | Text | |

---

## catalog

### Person **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| name | Char(180) | |
| slug | Slug(200) | **unique** |
| aliases | JSON(list) | for dedup/matching |
| primary_role | Char(32) `PersonRole` | default contributor |
| biography | Text | prose → published to `people/<slug>.md` |
| origin | Char(160) | |
| external_ids | JSON(dict) | |

### Kalam (the work) **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| title | Char(240) | |
| slug | Slug(260) | **unique** |
| primary_language_code | Char(16) | default "ur" |
| description | Text | context/story prose → `kalam/<slug>/kalam.md` |
| review_status | Char(32) `ReviewState` | default draft |
| version | PosInt | default 1; bumped on canonical edits |
| is_canonical | Bool | one canonical text per kalam |
| collection | FK → Collection | null, SET_NULL |
| published_at | DateTime | null |

Canonical text lives in **KalamLine** (below), not on recordings.

### KalamLine
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE |
| line_id | Char(32) | stable id, unique within kalam (e.g. "l001") |
| display_order | PosInt | |
| text_by_language | JSON(dict) | `{code: text}` |

Constraints: unique (`kalam`, `line_id`); index (`kalam`, `display_order`).

### Rendition (a recording) **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE |
| title | Char(240) | optional override of kalam title |
| slug | Slug(260) | **unique** |
| duration_ms | PosInt | default 0 |
| primary_language_code | Char(16) | |
| media_assets | M2M → media.MediaAsset | audio/video for this recording |
| published_at | DateTime | null |

A rendition **selects and times** kalam lines via RenditionLine.

### RenditionLine
| Column | Type | Notes |
|---|---|---|
| rendition | FK → Rendition | CASCADE |
| kalam_line | FK → KalamLine | PROTECT |
| display_order | PosInt | order within the rendition |
| start_ms | PosInt | per-rendition timing |
| end_ms | PosInt | `end_ms > start_ms` |
| variant_text_by_language | JSON(dict) | null; rendition-specific wording override |

Constraints: unique (`rendition`, `kalam_line`); index (`rendition`,
`display_order`). Models "some lines only in some renditions" (selection) and
per-recording wording (variant) and timing.

### Collection **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| title | Char(220) | |
| slug | Slug(240) | **unique** |
| owner | FK → User | null, SET_NULL |
| is_curated | Bool | |
| artwork | FK → media.MediaAsset | null, SET_NULL |
| share_token | Char(80) | unique, for private/unlisted sharing |

### KalamCredit
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE |
| person | FK → Person | CASCADE |
| role | Char(32) `PersonRole` | writer / translator |
| display_order | PosInt | |
| note | Char(240) | |

Constraint: unique (`kalam`, `person`, `role`).

### RenditionCredit
| Column | Type | Notes |
|---|---|---|
| rendition | FK → Rendition | CASCADE |
| person | FK → Person | CASCADE |
| role | Char(32) `PersonRole` | reciter / translator / contributor |
| display_order | PosInt | |
| note | Char(240) | |

Constraint: unique (`rendition`, `person`, `role`).

### RenditionVote
| Column | Type | Notes |
|---|---|---|
| rendition | FK → Rendition | CASCADE |
| user | FK → User | CASCADE |

Constraint: unique (`rendition`, `user`).

### Queue / QueueItem
| Queue | Type | Notes |
|---|---|---|
| owner | FK → User | CASCADE |
| title | Char(120) | |

| QueueItem | Type | Notes |
|---|---|---|
| queue | FK → Queue | CASCADE |
| rendition | FK → Rendition | CASCADE |
| position | PosInt | unique (`queue`, `position`) |

---

## lyrics

### Language (lane definition, per kalam)
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE |
| code | Char(16) | matches keys in `text_by_language` |
| name | Char(120) | |
| role | Char(32) `LyricLanguageRole` | original/translation/transliteration/commentary |
| direction | Char(8) `LyricDirection` | authoritative for UI/export/overlay |
| display_order | PosInt | |
| is_published | Bool | |

Constraint: unique (`kalam`, `code`, `role`).

### UserLyricPreference
| Column | Type | Notes |
|---|---|---|
| user | FK → User | CASCADE |
| rendition | FK → Rendition | CASCADE |
| visible_language_codes | JSON(list) | |

Constraint: unique (`user`, `rendition`).

_(KalamLine and RenditionLine may live in this app or `catalog`; documented under
catalog for cohesion.)_

---

## content (wiki prose + publisher)

### Annotation
| Column | Type | Notes |
|---|---|---|
| target_kind | Char(16) `AnnotationTarget` | kalam / line / rendition |
| kalam | FK → Kalam | null, CASCADE |
| kalam_line | FK → KalamLine | null, CASCADE |
| rendition | FK → Rendition | null, CASCADE |
| language_code | Char(16) | |
| body_markdown | Text | prose commentary |
| review_status | Char(32) `ReviewState` | default draft |

Exactly one of `kalam`/`kalam_line`/`rendition` is set (matches `target_kind`).
Index (`target_kind`, `kalam`, `rendition`).

### PublishedFile (DB → Git publish log)
| Column | Type | Notes |
|---|---|---|
| entity_type | Char(40) | e.g. kalam, rendition, person, annotation |
| entity_id | Char(64) | source row id |
| repo_path | Char(512) | path in the content repo |
| content_hash | Char(64) | sha256 of the emitted file |
| commit_sha | Char(64) | blank until committed |
| status | Char(24) `PublishStatus` | pending/committed/failed |
| published_at | DateTime | null |

Index (`entity_type`, `entity_id`), (`status`, `created_at`). Records the
approval-time publish of readable Markdown/structured files (see `plan.md` §4).

---

## media

### MediaAsset
| Column | Type | Notes |
|---|---|---|
| title | Char(240) | |
| kind | Char(24) `MediaKind` | audio/video/image/document |
| storage_key | Char(512) | key in R2 |
| original_filename | Char(255) | |
| mime_type | Char(120) | |
| checksum_sha256 | Char(64) | index; duplicate guard |
| size_bytes | PosBigInt | |
| duration_ms | PosInt | |
| width / height | PosInt | null (video/image) |
| source_url | URL | original URL if fetched |
| is_master | Bool | default true |
| status | Char(24) `ProcessingStatus` | |
| uploaded_by | FK → User | null, SET_NULL |
| metadata | JSON(dict) | |

Indexes: (`kind`, `status`), (`checksum_sha256`).

### UploadSession
| Column | Type | Notes |
|---|---|---|
| asset | OneToOne → MediaAsset | CASCADE |
| status | Char(24) `UploadSessionStatus` | |
| upload_url | URL(1200) | presigned |
| expires_at | DateTime | |
| expected_checksum_sha256 | Char(64) | |
| expected_size_bytes | PosBigInt | |
| completed_at | DateTime | null |

### MediaEncoding _(currently `MediaRendition` — rename to avoid clash with catalog Rendition)_
| Column | Type | Notes |
|---|---|---|
| asset | FK → MediaAsset | CASCADE |
| format | Char(32) | |
| codec | Char(80) | |
| bitrate_kbps | PosInt | null |
| width / height | PosInt | null |
| storage_key | Char(512) | |
| size_bytes | PosBigInt | |
| status | Char(24) `ProcessingStatus` | |
| is_playable | Bool | |

### MediaDerivative
| Column | Type | Notes |
|---|---|---|
| asset | FK → MediaAsset | CASCADE |
| kind | Char(24) | thumbnail / waveform / preview |
| storage_key | Char(512) | |
| format | Char(32) | |
| metadata | JSON(dict) | |
| status | Char(24) `ProcessingStatus` | |

### MediaProcessingJob
| Column | Type | Notes |
|---|---|---|
| asset | FK → MediaAsset | CASCADE |
| kind | Char(24) `MediaProcessingJobKind` | |
| status | Char(24) `ProcessingStatus` | |
| celery_task_id | Char(120) | |
| log / error | Text | |
| attempts | PosInt | |
| started_at / completed_at | DateTime | null |

### Caption
| Column | Type | Notes |
|---|---|---|
| asset | FK → MediaAsset | null, CASCADE |
| rendition | FK → catalog.Rendition | null, CASCADE |
| language_code | Char(16) | |
| label | Char(120) | |
| format | Char(32) | default webvtt |
| storage_key | Char(512) | |
| is_published | Bool | |

### Chapter
| Column | Type | Notes |
|---|---|---|
| rendition | FK → catalog.Rendition | CASCADE |
| title | Char(180) | |
| language_code | Char(16) | |
| start_ms | PosInt | |
| end_ms | PosInt | null |
| notes | Text | |

---

## archive

### VocabularyTerm
| Column | Type | Notes |
|---|---|---|
| vocabulary | Char(120) | |
| code | Char(120) | unique (`vocabulary`, `code`) |
| label | Char(180) | |
| uri | URL | |
| description | Text | |

### Citation
| Column | Type | Notes |
|---|---|---|
| title | Char(260) | |
| source_type | Char(32) `CitationType` | |
| author | Char(180) | |
| published_at | Char(80) | free text |
| url | URL | |
| note | Text | |

### ArchiveRecord **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| title | Char(260) | |
| slug | Slug(280) | **unique** |
| summary | Text | |
| editorial_notes | Text | |
| contributor_notes | JSON(list) | |
| kalam | M2M → catalog.Kalam | (was `tracks`) |
| renditions | M2M → catalog.Rendition | |
| people | M2M → catalog.Person | |
| collections | M2M → catalog.Collection | |
| citations | M2M → Citation | |
| terms | M2M → VocabularyTerm | |

### ProvenanceRecord
| Column | Type | Notes |
|---|---|---|
| archive_record | FK → ArchiveRecord | null, CASCADE |
| media_asset | FK → media.MediaAsset | null, CASCADE |
| event_type | Char(80) | |
| source_name | Char(180) | |
| source_url | URL | |
| source_identifier | Char(180) | |
| checksum_sha256 | Char(64) | |
| note | Text | |
| metadata | JSON(dict) | |

### SourceRating
| Column | Type | Notes |
|---|---|---|
| archive_record | FK → ArchiveRecord | CASCADE |
| kind | Char(24) | editorial / community |
| value / max_value | PosSmallInt | e.g. 4/5 |
| rationale | Text | |
| contributor | FK → User | null, SET_NULL |

---

## community

### Submission
| Column | Type | Notes |
|---|---|---|
| submitter | FK → User | null, SET_NULL |
| title | Char(240) | |
| voice | Char(180) | reciter (free text) |
| writer | Char(180) | free text |
| source_name | Char(240) | |
| notes | Text | |
| status | Char(32) `ReviewState` | default draft |
| target_kalam | FK → catalog.Kalam | null, SET_NULL |
| target_rendition | FK → catalog.Rendition | null, SET_NULL |
| citations | M2M → archive.Citation | |
| media_assets | M2M → media.MediaAsset | |
| reviewed_by | FK → User | null, SET_NULL |
| reviewed_at | DateTime | null |

Index (`status`, `created_at`).

### CorrectionDraft
| Column | Type | Notes |
|---|---|---|
| submission | FK → Submission | CASCADE |
| target_kalam | FK → catalog.Kalam | null, CASCADE |
| target_rendition | FK → catalog.Rendition | null, CASCADE |
| target_archive_record | FK → archive.ArchiveRecord | null, CASCADE |
| fields | JSON(list) | which fields are corrected |
| proposed_changes | JSON(dict) | |
| status | Char(32) `ReviewState` | |

### VerificationVote
| Column | Type | Notes |
|---|---|---|
| submission | FK → Submission | CASCADE |
| voter | FK → User | CASCADE |
| field | Char(32) `VerificationField` | |
| vote | Char(16) `VerificationVoteValue` | |
| note | Text | |

Constraint: unique (`submission`, `voter`, `field`).

### TrackRequest
| Column | Type | Notes |
|---|---|---|
| requester | FK → User | null, SET_NULL |
| title | Char(240) | |
| target_kalam | FK → catalog.Kalam | null, SET_NULL |
| target_rendition | FK → catalog.Rendition | null, SET_NULL |
| reciter_name | Char(180) | |
| writer_name | Char(180) | |
| source_hint | Text | |
| status | Char(24) `TrackRequestStatus` | |
| moderator_note | Text | |

Index (`status`, `created_at`).

### TrackRequestVote
| Column | Type | Notes |
|---|---|---|
| request | FK → TrackRequest | CASCADE |
| user | FK → User | CASCADE |

Constraint: unique (`request`, `user`).

---

## video_generation

### VideoGenerationJob
| Column | Type | Notes |
|---|---|---|
| requested_by | FK → User | null, SET_NULL |
| submission | FK → community.Submission | null, SET_NULL |
| rendition | FK → catalog.Rendition | null, SET_NULL (was `track`) |
| source_asset | FK → media.MediaAsset | PROTECT |
| source_mode | Char(32) `VideoGenerationSourceMode` | audio_visualizer / video_overlay |
| layout_id | Char(80) | default landscape-1 |
| resolution | Char(16) `VideoGenerationResolution` | default 1080p |
| visible_language_codes | JSON(list) | |
| title / voice / writer | Char | denormalized for the render |
| status | Char(24) `VideoGenerationStatus` | |
| celery_task_id | Char(120) | |
| render_payload | JSON(dict) | contract handed to the worker |
| log | Text | |
| failure_reason | Text | |
| preview_asset | FK → media.MediaAsset | null, SET_NULL |
| output_asset | FK → media.MediaAsset | null, SET_NULL |
| cancelled_at / published_at | DateTime | null |

Index (`status`, `created_at`). Segments in `render_payload` derive from
`RenditionLine` timing + text resolved from `KalamLine` + variant overrides.

---

## audit

### AuditLog
| Column | Type | Notes |
|---|---|---|
| actor | FK → User | null, SET_NULL |
| action | Char(120) | |
| content_type / object_id | GenericFK | polymorphic target |
| before / after | JSON(dict) | change snapshot |
| request_meta | JSON(dict) | |

Indexes: (`action`, `created_at`), (`content_type`, `object_id`). Ordered newest
first.

---

## imports

### ImportBatch
| Column | Type | Notes |
|---|---|---|
| source | Char(32) `ImportSource` | |
| status | Char(24) `ImportBatchStatus` | |
| dry_run | Bool | default true |
| source_label | Char(180) | |
| payload / summary | JSON(dict) | |
| error | Text | |
| created_by | FK → User | null, SET_NULL |

Index (`source`, `status`, `created_at`).

---

## Relationship overview

```
User 1─* Submission *─1 Kalam / Rendition
Kalam 1─* KalamLine 1─* RenditionLine *─1 Rendition
Kalam 1─* Rendition ; Kalam 1─* Language ; Kalam 1─* KalamCredit *─1 Person
Rendition *─* MediaAsset ; Rendition 1─* RenditionCredit *─1 Person
MediaAsset 1─* MediaEncoding / MediaDerivative / Caption / MediaProcessingJob
Rendition 1─1(canonical) VideoGenerationJob 1─1 output MediaAsset
Annotation ─?→ Kalam | KalamLine | Rendition
PublishedFile ─→ (any published entity)  [DB→Git log]
ArchiveRecord *─* Kalam/Rendition/Person/Collection/Citation/VocabularyTerm
```

## Deltas from the current implementation

1. **Track → Kalam + Rendition.** The current `catalog.Track` conflates work and
   recording; it splits into `Kalam` (canonical text/lines/story) and `Rendition`
   (recording, selection, per-rendition timing).
2. **Lyrics remodel.** `LyricSet`/`LyricLanguage`/`LyricSegment` become
   `KalamLine` (canonical text) + `RenditionLine` (per-rendition timing/variants)
   + `Language` (lane defs). Timing moves from the set to the rendition.
3. **New `content` app** — `Annotation` (kalam/line/rendition prose) and
   `PublishedFile` (the approval-time DB→Git Markdown publisher log).
4. **`MediaRendition` → `MediaEncoding`** (rename) to avoid colliding with the
   catalog `Rendition`.
5. **Repointing** — `Submission`, `CorrectionDraft`, `TrackRequest`,
   `VideoGenerationJob`, `ArchiveRecord`, `Caption`, `Chapter` now reference
   `Kalam`/`Rendition` instead of `Track`.
6. **Split credits** — `TrackCredit` → `KalamCredit` (writer/translator) +
   `RenditionCredit` (reciter/translator); `TrackVote` → `RenditionVote`.

These deltas are a schema migration to plan for; the rest matches the built model.
