# Dervaish Database Structure

_Last updated: 2026-07-04. Target relational schema (PostgreSQL via Django ORM),
aligned to `plan.md`. This merges the domain model already built in the repo's
`backend/` (Kalam/Verse/Rendition, taxonomy, federation) with the Dervaish-Studio
additions we are keeping (Markdown/Git preservation, richer contribution workflow,
local render). We are **rebuilding the code cleanly** but adopting the built
model's shapes and names as the base. Legend: **[built]** already in `backend/`;
**[add]** our addition / to-build; **[keep]** our earlier decision retained._

## Conventions

- Integer PK `id` unless noted. `TimestampedModel` → `created_at`, `updated_at`.
  `EditorialModel` → adds `visibility` (`EditorialState`), `created_by`,
  `updated_by`. Tables marked **(Editorial)** extend it.
- Timings in integer **milliseconds**. Multilingual text as JSON keyed by language
  code (`translations = {"en": "...", "ur": "..."}`).
- Public-addressable entities carry a unique `slug`. Language direction (RTL/LTR)
  is derived from the language `VocabularyTerm`.

### Enumerations

| Enum | Values |
|---|---|
| `EditorialState` | draft, pending_review, public, unlisted, private, archived |
| `ReviewState` | draft, submitted, under_review, changes_requested, approved, rejected, published |
| `RoleKind` | anonymous, listener, contributor, editor, admin |
| `PersonRole` | author/writer, reciter/voice_artist, composer, translator, source_contributor, editor |
| `TermKind` (taxonomy) | genre, language, tradition, era, theme, region |
| `ProtectionLevel` | open, signed, drm |
| `MediaKind` | audio, video, image, document |
| `ProcessingStatus` | pending, processing, ready, failed |
| `MediaMirrorKind` | r2, cdn, github, external, local |
| `ContentSourceKind` | official, community, personal |
| `AnnotationTarget` | kalam, verse, rendition |
| `PublishStatus` | pending, committed, failed |
| `VideoGenerationSourceMode` | audio_visualizer, video_overlay |
| `VideoGenerationStatus` | queued, running, completed, failed, cancelled |
| `CitationType` | interview, book, field_recording, website, manuscript |
| `VerificationField` | author, reciter, lyrics, source, overall |
| `VerificationVoteValue` | verify, dispute |
| `RequestStatus` | open, planned, fulfilled, duplicate, rejected |
| `ImportSource` / `ImportBatchStatus` | prototype/mediacms/omeka_s · draft/dry_run/running/completed/failed |

---

## accounts [built]

**User** (AbstractUser): + `display_name`, `role` (`RoleKind`, default listener),
`trust_score` (PosInt). **Role**: `code` (`RoleKind`, unique), `name`,
`description`.

---

## taxonomy [built]

### VocabularyTerm — controlled vocabularies reused everywhere
| Column | Type | Notes |
|---|---|---|
| kind | Char(16) `TermKind` | genre/language/tradition/era/theme/region |
| code | Slug(80) | unique (`kind`, `code`) |
| label | Char(160) | |
| label_native | Char(160) | script form |
| description | Text | |
| parent | FK → self | null; hierarchical terms |

Language terms should carry direction (LTR/RTL) in metadata for lyric rendering.

---

## catalog [built, + our additions]

### Person **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| name / name_native | Char(200) | Latin + script |
| slug | Slug(220) | unique |
| aliases | JSON(list) | dedup/matching |
| biography | Text | prose → `people/<slug>.md` on publish |
| era / region | Char | |
| tradition | FK → taxonomy.VocabularyTerm | null (kind=tradition) |
| portrait | FK → media.MediaAsset | null |
| external_ids | JSON(dict) | |

### Kalam (the work) **(Editorial)**
| Column | Type | Notes |
|---|---|---|
| title / title_native / title_transliterated | Char(260) | |
| slug | Slug(280) | unique |
| author | FK → Person | null; related `authored_kalams` |
| primary_language | FK → VocabularyTerm | kind=language |
| genre | FK → VocabularyTerm | kind=genre (hamd/naat/manqabat/qawwali/kafi…) |
| tradition | FK → VocabularyTerm | kind=tradition (silsila) |
| era | Char(120) | |
| themes | M2M → VocabularyTerm | kind=theme |
| tags | JSON(list) | free tags |
| summary | Text | context/story prose → `kalam/<slug>/kalam.md` |
| published_at | DateTime | null |

Canonical text lives in **Verse**.

### Verse (ordered child of Kalam) [built]
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE, related `verses` |
| order | PosInt | the stable per-kalam id / anchor |
| text_native | Text | original script |
| transliteration | Text | |
| translations | JSON(dict) | `{lang: text}` |
| meaning | JSON(dict) | `{lang: line-level tafseer/commentary}` |

Constraint: unique (`kalam`, `order`). Powers both the reader and synced lyrics.
The per-verse `meaning` gives the Companion "meaning toggle"; longer prose lives in
`content.Annotation`.

### Rendition (a recording) **(Editorial)** [built]
| Column | Type | Notes |
|---|---|---|
| kalam | FK → Kalam | CASCADE, related `renditions` |
| title | Char(260) | optional override |
| slug | Slug(280) | unique |
| duration_ms | PosInt | |
| year / album / publisher / style | — | source metadata |
| media_assets | M2M → media.MediaAsset | audio and/or video |
| protection_level | Char(8) `ProtectionLevel` | default open (streaming URL policy) |
| rights_note | Char(300) | |
| published_at | DateTime | null |

Selects and times verses via `lyrics.RenditionVerseTiming`.

### Credit (unified) [built]
| Column | Type | Notes |
|---|---|---|
| person | FK → Person | CASCADE |
| role | Char(16) `PersonRole` | author on kalam; reciter/voice on rendition |
| kalam | FK → Kalam | null |
| rendition | FK → Rendition | null |
| display_order | PosInt | |
| note | Char(240) | |

One of `kalam`/`rendition` set. (Replaces the earlier split KalamCredit/
RenditionCredit.)

### Collection **(Editorial)** / CollectionItem [built]
Collection: title, slug (unique), description, owner (FK User, null), is_curated,
artwork (FK MediaAsset), share_token, renditions (M2M through CollectionItem).
CollectionItem: collection FK, rendition FK, position; unique (`collection`,
`rendition`).

### SavedItem (library) [built] / Queue / QueueItem [built]
SavedItem: user FK, rendition FK; unique (`user`, `rendition`). Queue: user FK,
name. QueueItem: queue FK, rendition FK, position; unique (`queue`, `rendition`).

### RenditionVote [add]
rendition FK, user FK; unique (`rendition`, `user`). Lightweight upvote signal.

### PlaybackState [add]
| Column | Type | Notes |
|---|---|---|
| user | FK → User | CASCADE |
| rendition | FK → Rendition | CASCADE |
| position_ms | PosInt | resume point |
| last_played_at | DateTime | history / "continue listening" |

Unique (`user`, `rendition`).

---

## lyrics

### RenditionVerseTiming [built, + our variant fields]
| Column | Type | Notes |
|---|---|---|
| rendition | FK → catalog.Rendition | CASCADE, related `verse_timings` |
| verse | FK → catalog.Verse | CASCADE |
| start_ms | PosInt | per-rendition timing |
| end_ms | PosInt | null allowed |
| variant_text_native | Text | **[add]** rendition-specific wording override |
| variant_translations | JSON(dict) | **[add]** null; per-language override |

Constraint: unique (`rendition`, `verse`). **The existence of a timing row is the
"line selection"** — a rendition only includes the verses it times, which models
"some lyrics only appear in specific renditions." Merge target for redundant timing
passes (median start/end; see `workflows.md` §5).

### UserLyricPreference [add]
user FK, rendition FK, `visible_language_codes` (JSON list); unique (`user`,
`rendition`). Import/export interop (WebVTT/LRC/TTML/JSON) maps to Verse text +
timings; no separate segment table needed.

---

## content [add — Markdown/Git preservation layer]

### Annotation
| Column | Type | Notes |
|---|---|---|
| target_kind | Char(16) `AnnotationTarget` | kalam / verse / rendition |
| kalam / verse / rendition | FK | exactly one set |
| language_code | Char(16) | |
| body_markdown | Text | prose commentary/context |
| review_status | Char(32) `ReviewState` | |

### PublishedFile (DB → Git publish log)
| Column | Type | Notes |
|---|---|---|
| entity_type / entity_id | Char | source row |
| repo_path | Char(512) | path in content repo |
| content_hash | Char(64) | sha256 of emitted file |
| commit_sha | Char(64) | blank until committed |
| status | Char(24) `PublishStatus` | |
| published_at | DateTime | null |

Records the approval-time emit of readable Markdown/structured files (`plan.md`
§4). One-way DB → Git; DB stays the editing source of truth.

---

## media [built, + our additions]

### MediaAsset [built]
kind (`MediaKind`), storage_key (R2), source_url, mime_type, checksum_sha256
(dup-guard), size_bytes, duration_ms, width/height, processing_status/error/log/
attempts, source_name, original_filename. **[add]** `metadata` JSON.

### UploadSession [add]
asset OneToOne, status, presigned `upload_url`, `expires_at`, expected checksum/
size, completed_at.

### MediaEncoding (built as `MediaRendition` — **rename** to avoid clash with catalog Rendition)
| Column | Type | Notes |
|---|---|---|
| asset | FK → MediaAsset | related `variants` |
| container | Char(16) | opus/aac/mp3/mp4/hls |
| bitrate_kbps / height / codec | — | |
| storage_key / url | — | |
| is_streaming | Bool | adaptive/online |
| is_offline_download | Bool | single progressive file for offline |
| processing_status | Char(12) `ProcessingStatus` | |

### MediaDerivative [add] / MediaProcessingJob [add]
Derivative: asset FK, kind (thumbnail/waveform/poster), storage_key, format,
metadata, status. ProcessingJob: asset FK, kind (ingest/transcode/thumbnail/
waveform), status, celery_task_id, log/error, attempts, timestamps.

### Caption [built] / Chapter [add]
Caption: asset FK, language_code, fmt (default vtt), storage_key, url. Chapter:
rendition FK, title, language_code, start_ms, end_ms, notes.

---

## federation [built — formalizes our "mirrors" plan]

### MediaMirror
| Column | Type | Notes |
|---|---|---|
| name | Char(160) | |
| slug | Slug(180) | unique |
| base_url | URL | |
| kind | Char(12) `MediaMirrorKind` | r2/cdn/github/external/local |
| is_official / is_active / is_default_enabled / verified | Bool | |
| carries_all | Bool | true = hosts whole catalogue (like primary R2) |
| priority | Int | lower = preferred in resolver order |

**Cloudflare R2 is mirror #1 / primary.** OneDrive/SharePoint and GitHub repos can
be added as mirrors later (this is the "mirrors setup" we deferred).

### MediaAssetMirror
asset FK, mirror FK, `available`, `url_override`, `checksum_ok`, `last_checked`;
unique (`asset`, `mirror`). Availability of one file on a non-`carries_all` mirror.

### ContentSource [built — deferred/optional]
Registry of catalogue backends (name, slug, base_url, kind, is_official/is_default/
is_enabled/verified, priority). Designed-for-federation; single official source for
now. **Not required for our launch** — keep the table, defer multi-source
aggregation.

The resolver orders enabled + available mirrors per file into the **playback
manifest** (`variants[].mirrors[]`).

---

## archive [built]

**Citation** (title, source_type `CitationType`, author, published_at text, url,
note). **ArchiveRecord** (Editorial): title, slug, summary, editorial_notes,
contributor_notes JSON; M2M → Kalam, Rendition, Person, Collection, Citation,
taxonomy.VocabularyTerm. **ProvenanceRecord**: archive_record/media_asset FK (null),
event_type, source_name/url/identifier, checksum_sha256, note, metadata. **SourceRating**:
archive_record FK, kind (editorial/community), value/max_value, rationale,
contributor FK.

---

## community [built core, + workflow additions]

### Submission [built]
author FK, title, `payload` JSON, status (`ReviewState`), reviewer_note. **[add]**
typed target links: `target_kalam` / `target_rendition` (FK null) and
`media_assets` M2M for intake attribution.

### CorrectionDraft [add]
submission FK, target_kalam/target_rendition/target_archive_record (FK null),
`fields` JSON, `proposed_changes` JSON, status.

### VerificationVote [add]
submission FK, voter FK, field (`VerificationField`), vote (`VerificationVoteValue`),
note; unique (`submission`, `voter`, `field`).

### KalamRequest [built] / RequestUpvote [built]
KalamRequest: requested_by FK, title, details, author_hint, reciter_hint, status
(`RequestStatus`). **[add]** optional `target_kalam`/`target_rendition` so rendition
requests reuse it. RequestUpvote: request FK, user FK; unique (`request`, `user`).
Drives the **needs-work queue**.

---

## video_generation [add — local 5090 worker]

### VideoGenerationJob
| Column | Type | Notes |
|---|---|---|
| requested_by | FK → User | null |
| submission | FK → community.Submission | null |
| rendition | FK → catalog.Rendition | null |
| source_asset | FK → media.MediaAsset | PROTECT |
| source_mode | Char(32) `VideoGenerationSourceMode` | audio_visualizer / video_overlay |
| layout_id | Char(80) | worker-side layout files |
| resolution | Char(16) | 720p/1080p/4k |
| visible_language_codes | JSON(list) | |
| title / voice / writer | Char | denormalized for render |
| status | Char(24) `VideoGenerationStatus` | |
| celery_task_id | Char(120) | |
| render_payload | JSON(dict) | contract for the worker |
| log / failure_reason | Text | |
| preview_asset / output_asset | FK → media.MediaAsset | null |
| cancelled_at / published_at | DateTime | null |

Runs on the **local i9/RTX 5090** Celery worker; segments derive from
`RenditionVerseTiming` + `Verse` text (with variant overrides). Index (`status`,
`created_at`).

---

## audit [built] / imports [add]

**AuditLog**: actor FK, action, generic target (content_type + object_id),
before/after JSON, request_meta JSON. **ImportBatch**: source (`ImportSource`),
status, dry_run, source_label, payload/summary JSON, error, created_by.

---

## Relationship overview

```
Person ──authored──► Kalam ──has ordered──► Verse (text_native · translit · translations · meaning)
   │  ▲ credits (unified)      │                       ▲
   │                           │ has many              │ timed/selected by
   ▼                           ▼                       │
 Credit                     Rendition ──RenditionVerseTiming(+variant)─┘
                       performed by │  └─ media_assets ─► MediaAsset ─► MediaEncoding (opus/aac/mp4/hls)
                             Person  │            └─ Caption · MediaDerivative(waveform/poster)
              Kalam tagged ► taxonomy.VocabularyTerm ; described ► ArchiveRecord · Citation · Provenance
MediaAsset ──availability──► MediaAssetMirror *─1 MediaMirror (R2 primary)   [manifest resolver]
Annotation ─?→ Kalam | Verse | Rendition        PublishedFile ─→ (published entity)  [DB→Git log]
User ► SavedItem · Queue/QueueItem · PlaybackState · UserLyricPreference
```

## What we adopted from `master-build-plan.md`

Verse (with transliteration + per-line `meaning`), the `taxonomy` app + devotional
vocabularies (genre/silsila/era/theme/region), unified `Credit`, `protection_level`
per rendition, media variants with `is_streaming`/`is_offline_download` + the
playback **manifest**, the **federation** mirror registry (R2 primary), and the
user-facing `SavedItem`/`Queue`/`PlaybackState` models.

## What stays ours (kept over the master plan)

The `content` app (`Annotation`, `PublishedFile`) and **publish-on-approval to a
Git Markdown repo** for preservation; **`RenditionVerseTiming` variant fields** +
the redundant-pass median-merge workflow; **`MediaEncoding` rename**; the **local
5090** render worker; and PWA + OpenSubsonic distribution (no native/Expo, no
native offline store). See `plan.md` §14–15.
