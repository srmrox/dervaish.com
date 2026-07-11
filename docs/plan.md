# Dervaish Platform & Studio Plan

_Last updated: 2026-07-04. Single authoritative plan for the Dervaish platform.
Merges the greenfield architecture, the Studio contribution/render/distribution
plan, the storage + Markdown-wiki content model, and the domain model absorbed
from `master-build-plan.md`. We are **rebuilding the code cleanly** while adopting
that plan's domain model (Kalam/Verse/Rendition, taxonomy, federation) and keeping
our own infrastructure decisions (PWA, R2, Markdown/Git preservation, local render,
OpenSubsonic). Companion docs: `database.md`, `workflows.md`, `screens.md`,
`design-system.md`._

## 1. Overview and scope

Dervaish is a preservation-focused devotional media archive and listening platform:
a lean **player** on top, a **bottomless archive** on demand. It combines audio/
video playback, archival metadata and provenance, reciter/writer (author) profiles,
multilingual synchronized lyrics with per-line meaning, a wiki-style reading layer,
community contribution, and lyric-video generation. A **Kalam** (the work — text,
author, meaning) is modeled separately from a **Rendition** (one recorded
performance); **media attaches to the rendition.**

Dervaish **Studio** is the contribution layer: the public submits sources,
transcribes and times verses, adds translations and meaning, and writes wiki
context; admins verify and merge; finalized content is (a) published as readable
Markdown for preservation and (b) rendered into lyric videos on local GPU hardware.

## 2. Executive recommendation (greenfield)

Greenfield, Dervaish-first — MediaCMS/Omeka S as references only (no code, no
AGPL/GPL risk). The hard problems are server-side (media ingestion, durable review
state, provenance, multilingual lyrics, editor admin), which is why the backend is
Django/DRF/Celery. We rebuild cleanly rather than extend the divergent code in
place.

## 3. Current state, the two backends, and the rebuild stance

The repo contains **two backends**:

- **`apps/backend`** (older) — a `Track`/`LyricSet`-centric catalogue.
- **`backend/`** (newer, from `master-build-plan.md`) — a built, migrated,
  seeded, Coolify-packaged Django API with the **Kalam / Verse / Rendition /
  Credit** model, a `taxonomy` app, and a `federation` app (media mirrors). Its
  domain model is the right one and we adopt it.

**Decision:** rebuild the code cleanly on our terms, **adopting the `backend/`
domain model and names** (see `database.md`) as the base, and **keeping our
infrastructure decisions** — PWA client (not native/Expo), Cloudflare R2 + manual
OneDrive backup, Markdown/Git preservation with publish-on-approval, the local
5090 render worker, and OpenSubsonic for audio/offline. What we absorb vs. keep is
summarized in §18.

Remaining gaps to a working pipeline: real auth + role permissions, the media
upload/transcode pipeline (Celery tasks are stubs), the **local render worker**
(replacing any placeholder), the **content publisher** (DB→Markdown), the
**Studio/Player/Wiki UI** (frontend), and the contribution-workflow specifics
(§12).

## 4. Storage and content architecture

Three stores by data type:

- **Media blobs → Cloudflare R2** (S3-compatible; zero egress for streaming).
  Renders are produced locally on the 5090, kept in OneDrive, and uploaded to R2.
  R2 is **mirror #1 / primary** in the federation registry (§ media mirrors).
- **Text / lyrics / wiki → a Git repo of Markdown**, generated **only on approval**
  (people, kalam text + story, per-verse meaning/annotations, rendition metadata) —
  the open, versioned, human-readable preservation copy.
- **Working store → PostgreSQL**, where all live work happens and which is retained
  permanently as the transactional store and index.

Cold backup: **OneDrive/SharePoint**, manual for now; the `federation` mirror
registry is the formal path to add OneDrive/GitHub mirrors later. **Publish-on-
approval** is one-way DB → Git; editing stays in the DB. R2 = blobs, Git = published
text, Postgres = working + index.

## 5. Product surfaces

- **Player** (public, consume) — browse; play audio/video with synced multilingual
  lyrics; language + meaning toggles. Spans Listen, Companion, Archive.
- **Wiki / Reader** (public, read) — kalam story/context, author/reciter profiles,
  per-verse meaning and annotations, cross-links — rendered from published Markdown.
- **Studio** (contribute) — source intake and verse development (Submit/Community).
- **Admin** (curate) — verification, merge/approve, publishing, preservation.

Navigation: Listen, Companion, Archive, Submit, Community, Admin & Preservation
(+ Queues, People, Generated Media).

## 6. Target stack

- **Backend:** Django + DRF + Celery + PostgreSQL + Redis + S3-compatible storage
  (Cloudflare R2 in prod, MinIO for local dev) + FFmpeg + Django admin.
- **Frontend:** React + Vite, **mobile-first responsive PWA** per
  `design-system.md`; renders published Markdown for the Wiki/Reader. **Not** a
  native/Expo app (§14).
- **Worker:** Celery for ingest/transcode/waveform/thumbnail, **content
  publishing**, and lyric-video rendering (rendering on the **local 5090**).
- **Search:** PostgreSQL full-text + trigram for v1.

## 7. Backend module architecture

`accounts`, `taxonomy` (VocabularyTerm: genre/language/tradition/era/theme/region),
`catalog` (**Kalam, Verse, Rendition, Credit**, Collection, SavedItem, Queue,
PlaybackState), `media` (assets, encodings, derivatives, captions, upload sessions,
manifest builder), `federation` (media mirrors + resolver), `lyrics`
(RenditionVerseTiming + interop), `content` (**Annotation + Markdown publisher** —
ours), `archive` (records, citations, provenance, ratings, JSON-LD), `community`
(submissions, corrections, verification, requests), `video_generation` (render
jobs), `public`, `audit`, `imports`.

## 8. Canonical data model (summary; full schema in `database.md`)

**The spine.** **Kalam** (the work): titles (native/transliterated), author
(→Person), `primary_language`/`genre`/`tradition` (→taxonomy), themes, tags,
summary/story. **Verse** (ordered child): `text_native`, `transliteration`,
`translations{}`, and **`meaning{}`** (per-line tafseer). **Rendition** (a
recording): belongs to a kalam, voice-artist credits, media assets,
`protection_level` (open/signed/drm), rights note. **Credit** is unified
(Person ↔ Kalam or Rendition, typed role).

**Timing.** `lyrics.RenditionVerseTiming` maps a rendition's verses to
`start_ms`/`end_ms` — **the presence of a timing row is the line selection** (so
"some lyrics only in some renditions" is native), plus optional **variant text**
overrides for rendition-specific wording. Redundant passes merge by median
(§12).

**Media plane.** `MediaAsset` (immutable original in R2) → `MediaEncoding`
variants (opus/aac/mp4/hls, with `is_streaming` / `is_offline_download`) +
derivatives (waveform/poster) + captions. Playback returns a **manifest** of URLs
(never bytes); `federation.MediaMirror`/`MediaAssetMirror` let the resolver order
mirrors (**R2 primary**) into the manifest.

**Taxonomy** drives genre/tradition/era/theme/region/language everywhere.
**User-facing:** `Collection`, `SavedItem` (library), `Queue`/`QueueItem`,
`PlaybackState`, `UserLyricPreference`. **Wiki content (ours):**
`content.Annotation` (kalam/verse/rendition prose) and `content.PublishedFile`
(the DB→Git publish log). Archive/community/video/audit/imports as in `database.md`.

## 9. Media pipeline

Control-plane / media-plane split: the API returns manifests; R2 + CDN serve
immutable, **pre-transcoded** bytes. Upload → presigned R2 `UploadSession` → Celery
verify (checksum/MIME/duration/codecs) → encode audio (Opus/AAC + one progressive
`is_offline_download` file) and video (MP4 + HLS) → waveform (**required for
timing**) + poster + captions (WebVTT). Manifest: `{ protection_level,
variants:[{kind,container,bitrate,height,url|signed_url,streaming,offline_download,
mirrors[]}], captions, lyric_timings_url }`. `open` → public CDN URLs; `signed`/
`drm` → signed/expiring URLs. Generated video: preview first, editor approval,
provenance retained.

## 10. Archive metadata

`ArchiveRecord`s link kalam/renditions/people/collections/citations/provenance with
visibility states; taxonomy terms + free tags; reusable citations; provenance with
checksums; editorial vs community source ratings; JSON-LD export for public
entities.

## 11. Lyrics, meaning, and wiki content

Canonical text belongs to the **Kalam** (its ordered **Verses**, each carrying
`text_native`, `transliteration`, `translations{}`, and **`meaning{}`**). Timing
belongs to the **Rendition** (`RenditionVerseTiming`, reusing the same verses — no
duplicated text across renditions). Prose is Markdown: kalam story/context, author/
reciter bios, and per-verse annotations, authored in Studio and **published to the
Git content repo on approval**. The Companion/Reader offers layer toggles
(script ↔ transliteration ↔ translation ↔ meaning) and language lanes with
per-language `dir`/`lang`. Import/export WebVTT/LRC/TTML/JSON maps to verses +
timings.

## 12. Community contribution workflow (full detail in `workflows.md`)

1. **Source intake (public):** a bulk grid (URL, title, reciter(s), writer(s)) →
   draft `Kalam` (if new) + `Rendition` + `MediaAsset`. **URL fetch is manual and
   best-effort** (per-row + "try all", Celery ingest) with an always-available
   **upload fallback**; dedup on checksum/URL; credits resolved to `Person` at
   verification.
2. **Verification (admin):** applicability, rights (`protection_level`),
   non-duplication; resolve credits + taxonomy; accept → rendition open-for-lyrics
   (waveform job runs).
3. **Development (volunteers), three micro-tasks on shared Verse ids:**
   transcription/segmentation → timing (**redundant passes**) → translation +
   meaning; wiki prose in parallel. Each is a `Submission`.
4. **Merge & approve (admin):** **median** timing across passes with divergence
   flags (~400 ms); text consensus; set canonical; bump version.
5. **Publish & render:** content publisher writes Markdown to Git; a
   `VideoGenerationJob` renders on the local 5090.
6. **Wiki loop + needs-work queue:** post-canonical `CorrectionDraft`s +
   `VerificationVote`s → admin merge → re-publish; `KalamRequest` + upvotes drive
   the needs-work queue.

## 13. Object state machines

Source/MediaAsset: submitted → verifying → accepted/rejected/duplicate. Kalam text:
draft → merge-candidate → canonical → published. Rendition: draft → open-for-lyrics
→ in-development → finalized → published. VideoGenerationJob: queued → running →
completed → published. Content file: generated → committed.

## 14. Client and distribution strategy (kept over the master plan)

We deliberately **keep our client strategy over the master plan's Expo-native
approach:**

- **Web player + Wiki/Reader as a mobile-first responsive PWA** — one React/Vite
  codebase, installable, no app-store overhead. **We are not building a native/
  Expo app**, and therefore not the native SQLite offline store / EAS pipeline.
- **Timing** (tap-to-time against the Web Audio clock) and **share-sheet source
  submission** are the mobile-friendly tasks; transcription, sustained translation,
  and merge stay desktop.
- **Audio background listening + offline via OpenSubsonic** instead of a native
  offline store: expose the catalog over Subsonic/OpenSubsonic so mature clients
  (Symfonium, Feishin, Amperfy, Supersonic) give background playback, offline,
  gapless, scrobbling. `getLyricsBySongId` maps almost one-to-one from
  `RenditionVerseTiming` + `Verse` text. Caveats: one language at a time, audio
  only, playback only. Trial Navidrome first, then implement the endpoints.
- **Native deferred indefinitely** — the API-first backend and the manifest/mirror
  design keep it a later option if listening demand ever justifies it.

Playback uses the manifest + mirror resolver (R2 primary, failover to enabled
mirrors). SEO: static-render public kalam/person/collection pages + JSON-LD.

## 15. API design

REST/DRF, paginated, visibility-filtered. Kalam/Verse/Rendition read endpoints,
playback manifest (`/renditions/{slug}/playback/`), search (grouped), auth + `/me/*`
(library, queues, preferences, playback state), lyrics (timings + import/export),
wiki content reads (edits via submissions/corrections), submissions/community/
requests, admin review/publish + media, federation directory
(`/directory/mirrors/`, `/directory/sources/`), and video-generation jobs. Add
OpenSubsonic endpoints under §14.

## 16. Migration and import strategy

Fresh minimal seed (one kalam with RTL+LTR verses + translations + meaning, one
rendition with timing + a media variant, author, collection, archive record,
citation). The built `backend/seed_demo` (the naat *Tanam Farsooda*) is a working
example to reuse. Optional importers (later) map external media/metadata; imports
are batch-tracked, dry-runnable, land in draft.

## 17. Roadmap

**Frontend of record:** the Vite + React PWA at **`apps/platform-web`**. The Expo
`app/` is retired; the old two-stack `apps/backend`, the empty `web/`, and the empty
`workers/` were removed in the Phase 1 cleanup (held in `.attic/` for manual delete).
Two pillars remain: **`backend/`** (Django) + **`apps/platform-web`** (web).

- **Phase 1 — Repo cleanup + web foundation. _(done)_** Repaired the git index;
  removed dead folders; `platform-web` refactored into a real skeleton — design-
  system CSS tokens (with real focus/hover/pressed/error states + micro-interactions
  per the UI/UX notes), typed API client + TanStack Query hooks, token-auth session,
  UI kit, path-based router, app shell + sticky playback bar, PWA manifest.
- **Phase 2 — Read surface. _(built; verify against `npm run dev`)_** Screens wired
  to the live backend: Listen, Search, Kalam, Rendition/Companion, Person,
  Collection, Library, Queues, Account, Auth — using the real read + auth + `/me`
  endpoints and the audio player. _Remaining polish:_ PWA icons, wire library/queue
  mutations, and adjust once run in the browser._
- **Phase 3 — Contribution backend + Studio. _(built)_** Added `community`
  endpoints reusing existing models (no migration): `POST/GET /submissions/`
  (owner-scoped; `payload.kind` = source/transcription/timing/translation/context)
  and `/community/requests/` (+ `upvote`). Wired the Studio surface in
  `platform-web`: role-gated nav, dashboard, source intake, the transcription /
  **timing** (real tap-to-time against the audio player) / translation / context
  editors, my-submissions, and community requests — each posting a real
  `Submission`. _Deferred to later phases:_ the dedicated `content` app + direct
  canonical writes + verification voting land with admin merge (Phase 4) and the
  publisher (Phase 5); admins interpret `payload` on approval.
- **Phase 4 — Admin & curation. _(built)_** `IsEditor` permission +
  `apply_submission` service (transcription→`Verse`, timing→`RenditionVerseTiming`,
  translation→`Verse.translations`) + `/admin/review/submissions/` viewset
  (`review`/`apply`); editor-gated Admin nav, dashboard, and review/approve UI. No
  migration.
- **Phase 5 — Render & publish. _(scaffolded — needs `makemigrations`)_** New
  `content` app (`Annotation`, `PublishedFile` + DB→Markdown publisher writing to
  `CONTENT_REPO_DIR`; git commit still external) and `video_generation` app
  (`VideoGenerationJob` + `build_render_payload` + `render_video_job` task that
  hands off to the **local 5090 worker**). Endpoints `/annotations/`,
  `/admin/published/` (+`publish-kalam`), `/admin/renders/`; admin render + publish
  screens. **Run:** `makemigrations content video_generation && migrate`.
- **Phase 6 — Distribution & polish. _(partial)_** Minimal **OpenSubsonic** surface
  at `/rest/` (`ping`, `getLicense`, `getLyricsBySongId` from
  `RenditionVerseTiming`+`Verse`, `stream` redirect); **PWA** service worker +
  registration; `useDocumentTitle` for basic SEO; rewritten Playwright smoke test.
  _Deferred:_ full SSR/pre-render, offline downloads, Subsonic auth + full method
  set, a11y/RTL audit.

_Earlier "prove the pipe" render-worker milestone folds into Phase 5._

## 18. Decisions — absorbed vs. kept

**Absorbed from `master-build-plan.md`:** the Kalam/**Verse**(+meaning)/Rendition/
unified **Credit** model; the **taxonomy** app + devotional vocabularies;
**protection_level** per rendition; the control-plane/media-plane split with a
playback **manifest** and `is_streaming`/`is_offline_download` variants; the
**federation** media-mirror registry (R2 primary) — our formal "mirrors" layer; and
user models `SavedItem`/`Queue`/`PlaybackState`.

**Kept as ours (over the master plan):** PWA (not native/Expo); **OpenSubsonic** for
audio/offline (not a native offline store); **local 5090** render worker (not
server-side render); **Cloudflare R2** + manual OneDrive backup; **Markdown/Git
preservation** with publish-on-approval and the `content` app (`Annotation`,
`PublishedFile`); `RenditionVerseTiming` **variant fields** + median-merge workflow;
the `MediaEncoding` rename (avoids clashing with catalog `Rendition`); and a clean
**code rebuild** rather than extending either existing backend in place.

**Open:** trusted-contributor fast path (leaning later); layouts as worker files vs
DB/JSON; SVG import dependency; audio-rights default (`protection_level`) and
shareability/bandwidth; whether to keep `ContentSource` federation (deferred) and
when to add OneDrive/GitHub mirrors.

## 19. Validation plan

Backend: model constraints (unique verse order, non-overlapping/median timing,
visibility), API permission/pagination/serialization + visibility-leak checks,
Celery transitions incl. **content publish** and render output. Media: fixtures +
manifest + waveform/poster. Lyrics/content: import/export round-trips; RTL/LTR;
annotation linkage; publish-to-Markdown fidelity (DB→files→re-read). Community:
submission lifecycle, corrections, vote replacement, request uniqueness. Frontend:
component + e2e + a real browser Playwright smoke (desktop/mobile first paint,
navigation, playback bar, RTL/LTR lyrics + meaning toggle, wiki reading, forms,
focus order).

## 20. Risks, gotchas, environment notes

Broad scope → vertical slices ("lean player, deep on demand"). Audio rights →
curate owned/licensed first; per-rendition `protection_level`. Egress → R2. SEO
from a SPA → static-render public routes + JSON-LD. Synced-lyric authoring cost →
good tooling now, assisted alignment later. **Operational:** the 5090 is the render
farm (queue drains only while online); NVENC session limits → libx264 fallback
(logged); browser preview ≠ final render; DB↔files drift avoided by one-way
publish-on-approval with checksums; term collision "MediaEncoding" (media) vs
"Rendition" (catalog) resolved by the rename. **Sandbox note:** OneDrive-mounted
renderer files may read truncated — verify via Read/Grep.

## 21. Two backends — reconciliation note

`backend/` (Kalam/Verse/Rendition, taxonomy, federation — built & seeded) is the
domain reference we adopt; `apps/backend` (Track/LyricSet) is superseded. Since we
are rebuilding cleanly, we start from the `backend/` model + names, layer in the
`content` app, `RenditionVerseTiming` variants, `MediaEncoding` rename, and our
render/distribution choices, and archive the old `apps/backend`.

## 22. References

- `docs/archive/master-build-plan.md` — prior authoritative plan (domain model +
  Expo/federation/offline design), absorbed here in part; archived for reference.
- OpenSubsonic `getLyricsBySongId`:
  https://opensubsonic.netlify.app/docs/endpoints/getlyricsbysongid/
- Navidrome: https://www.navidrome.org/apps/ ,
  https://deepwiki.com/navidrome/navidrome/9.4-lyrics
- `docs/design-system.md`, `docs/database.md`, `docs/workflows.md`,
  `docs/screens.md`.
- `Lyrics Video/docs/HANDOFF.md`, `UPGRADE.md` — renderer-side notes.
