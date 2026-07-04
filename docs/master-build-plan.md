# Dervaish — Master Build Plan (Authoritative)

*The single source of truth for the Dervaish rebuild. Supersedes the three earlier documents and resolves the two-stack split in the existing repo.*

**Status:** Approved direction · comprehensive build spec for Claude Code · **Updated:** 21 June 2026
**Build status:** Backend v1 scaffolded, migrated, seeded & smoke-tested; packaged for Coolify (§9). Next work is the §22 milestone backlog.
**Supersedes & absorbs:** `Kalam-Archive-Product-Plan.md`, `Dervaish-Delivery-Plan.md`, the old repo `docs/plan.md`/`prompt.md`, and the standalone `docs/design-system.md` (folded into §14) — all preserved in `Dervaish/_backup-superseded-docs/`. This is the **only** plan in the repo; where anything conflicts, **this document wins.**

**Locked decisions (from review):**
- One platform delivered to **web, iOS, and Android**.
- Stack chosen for **ease of maintenance and deployment** above all.
- **Clean greenfield** rebuild; existing code is **archived for reference**, not extended in place.
- Authoritative plan first (this document); coding starts at Phase 0 after sign-off.

---

## 1. Why a rebuild, and what changed

The repo currently contains **two parallel implementations** of the same product: a TypeScript/Fastify prototype (`apps/api`, `apps/web`, `apps/mobile`, `packages/*`) and a more production-shaped Django/DRF backend (`apps/backend`), plus a stub `apps/platform-web`. Effort has been splitting across both, the web client is a single 1,453-line component, and the README describes the prototype while `docs/plan.md` describes the Django rebuild. This divergence is the core problem the rebuild solves.

The new requirement that settles the architecture: **we need real native iOS and Android apps, not just a web app** — and the stack must be the easiest to maintain and deploy across all three. That single requirement is decisive (see §3).

---

## 2. Product in one paragraph

Dervaish is a daily listening app and a living archive for devotional kalam. The **player** is the front door — fast, calm, queue-and-play, offline-capable. The **archive** is the depth — every kalam carries its author, voice artist(s), full text with transliteration, translation and line-by-line meaning, its tradition and taxonomy, multiple renditions, sources/provenance, and community corrections. The product principle throughout: **lean player on top, bottomless archive on demand.** A **Kalam** (the work — text, author, meaning) is modeled separately from a **Rendition** (one recorded performance), and the **audio/video files attach to the rendition** — this split is what lets Dervaish be Spotify and an encyclopedia at once.

---

## 3. The stack decision

**Requirement:** web + iOS + Android, easiest to maintain and deploy, one small team.

### Decision

> **One backend: Django + Django REST Framework + Celery + PostgreSQL + Redis + S3-compatible storage + FFmpeg.**
> **One client codebase: a universal Expo (React Native + React Native Web) app via Expo Router**, shipped to iOS (App Store), Android (Play Store), and the web from the same source.
> **Build & release via Expo EAS** (Build, Submit, Update/OTA). **Python Celery worker** for media + lyric-video processing.

### Why this is the easiest to maintain and deploy

- **One client codebase → three platforms.** Expo + React Native Web means the same screens, navigation, and business logic compile to native iOS, native Android, and a web app. That is the lowest-maintenance way to satisfy "web + iOS + Android" with one team — versus maintaining a separate web app and separate native apps.
- **Deployment is genuinely simple.** EAS Build produces store-ready binaries in the cloud (no local Xcode/Android Studio farm required), EAS Submit pushes to the App Store and Play Store, and EAS Update ships JavaScript/asset fixes over-the-air without a store review cycle. Web deploys as a static/SSG export to any CDN.
- **The backend is the hard part, and Django is the most maintainable choice for it.** Dervaish's real complexity is server-side: media ingestion/transcoding, durable review/moderation state, provenance, multilingual lyrics, and an admin surface for editors. Django gives a mature ORM + migrations, a batteries-included admin, permissions, and first-class Celery integration. We keep Django and reuse the repo's **app structure, media pipeline, and admin/workflow patterns** — but we **recreate the catalogue schema around the Kalam→Rendition→media model** (§7) rather than carry forward the existing Track/Collection schema. The existing models are reference, not foundation.
- **One language family across the client** (TypeScript/React) and a stable, well-trodden backend (Python/Django) — a realistic skill profile for a small team, with huge hiring and library ecosystems on both sides.

### The one real trade-off: SEO for public pages

A universal Expo app renders as a single-page app, which is weaker for search-engine indexing and rich link previews than server-rendered pages — and public discovery/sharing matters for an archive. **Mitigation, in order:**
1. **Static-render the public surface.** Use Expo Router's static rendering (SSG) to pre-generate the public kalam, artist, and collection pages with proper metadata, so search engines and shared links work for the content that matters.
2. **Server-side metadata/JSON-LD** from Django for those routes (Open Graph, structured data) — the API already plans JSON-LD export.
3. **If SEO becomes a primary growth channel**, add a thin dedicated **Next.js public-site** later that reads the same Django API and renders only the public archive/landing pages, while the Expo app remains the logged-in product. This is an additive option, not needed at launch.

This honours the "easiest to maintain" priority now, with a clear, bounded escape hatch if discovery needs more later.

### What we are explicitly NOT doing

- Not keeping the TypeScript/Fastify API (`apps/api`) — Django replaces it.
- Not building separate native apps in Swift/Kotlin — Expo covers both.
- Not adopting Flutter — it would mean a third language (Dart) and weaker web/SEO for the archive.
- Not vendoring MediaCMS (AGPL) or Omeka S (GPL) — reference only, per the existing license analysis.

---

## 4. Target architecture

```
                         ┌───────────────────────────────────────────┐
                         │  Universal Expo app (React Native + RN Web) │
                         │  iOS · Android · Web — one codebase         │
                         │  • Player (native audio + background)       │
                         │  • Companion (synced lyrics, RTL/LTR)       │
                         │  • Archive · Submit · Community · Admin      │
                         │  • Offline cache · EAS OTA updates          │
                         └───────────────┬─────────────────┬──────────┘
                                         │ REST/JSON        │ media (Opus/AAC/MP4/HLS)
                                         │ (api-client pkg) │
                         ┌───────────────▼──────────┐  ┌────▼───────────────┐
                         │ Django + DRF API         │  │ CDN  ◄─ S3 storage  │
                         │ accounts·catalog·archive │  │ signed/public URLs  │
                         │ media·lyrics·community   │  └────▲───────────────┘
                         │ video_generation·public  │       │ derived assets
                         │ + Django admin (editors) │  ┌────┴───────────────┐
                         └───────┬───────────┬──────┘  │ Celery workers      │
                                 │           │ enqueue │ FFmpeg transcode,   │
                         ┌───────▼───┐  ┌────▼─────┐    │ waveform, captions, │
                         │ PostgreSQL│  │  Redis   │───►│ lyric-video render  │
                         │ (FTS+trgm)│  │ (broker) │    │ (MoviePy)           │
                         └───────────┘  └──────────┘    └─────────────────────┘
```

**Shared code** lives in TypeScript packages consumed by the Expo app: `domain` (types), `validation` (zod), `api-client` (typed HTTP), `playback-core` (active-segment + offline planning). These are salvaged from the current repo (see §6).

---

## 4A. Backend & media delivery — lessons from Spotify, SoundCloud, YouTube, and Dervaish's offline-first design

> Drawn from well-established public engineering knowledge of these systems (live web citations were unavailable at time of writing; can be added later). The goal is to copy the *patterns*, right-sized to Dervaish — not the planet-scale machinery.

### How the big apps are built (the parts that matter to us)

**The one architectural idea they all share: split the control plane from the media plane.**
- The **control plane** is small JSON — catalog/metadata, accounts, playlists, search, playback *manifests*. Served by application services from a database.
- The **media plane** is large bytes — the audio/video itself. It is **pre-transcoded, immutable, stored as static objects, and served directly from a CDN**, never streamed through the application server.

The app server's job at play time is only to return a **manifest**: "here are the URLs (signed if protected) for this rendition's audio/video variants, captions, and lyric timings." The bytes then flow CDN→device. This separation is the single most important thing to carry over.

**Spotify.** Hundreds of small microservices, each team-owned ("the Spotify model"), on Google Cloud; wide-column stores (Cassandra/Bigtable) and an event pipeline (Kafka/Pub-Sub) for scale. Audio is **pre-transcoded Ogg Vorbis at fixed bitrates (~96/160/320 kbps)** sitting on a CDN as plain static files; the client picks a bitrate. Metadata and audio are completely separate systems. Offline = **encrypted local copies, license tied to account/device, periodic online re-validation (~every 30 days), device/track caps**, plus predictive caching of likely-next tracks.

**SoundCloud.** Migrated a Rails monolith ("Mother") to microservices behind an API gateway using a **Backends-for-Frontends (BFF)** pattern (a tailored API per client type). Uploads are **transcoded to HLS** (adaptive) plus progressive fallback, served via CDN; search on Elasticsearch.

**YouTube.** Upload → **transcode into many resolutions/codecs → segment into short chunks (~5s) → serve via DASH adaptive streaming** from a global edge CDN (caches inside ISPs). Metadata in sharded SQL (Vitess/MySQL, Spanner) separate from the media bytes. Offline (Premium) = encrypted downloads with a ~30-day expiry and re-validation.

### What we take, and what we deliberately don't

| Pattern | Adopt for Dervaish? | Why |
|---|---|---|
| Control plane / media plane split | **Yes — core** | Django returns manifests; S3+CDN serve bytes. Keeps the app server cheap and fast. |
| Pre-transcode on upload to fixed variants | **Yes** | Already in the Celery pipeline. Never transcode per request. |
| Adaptive streaming (HLS/DASH) when online | **Yes (HLS)** | One protocol for audio+video; broad client support. |
| CDN edge delivery + signed URLs for protected items | **Yes** | Fast playback; rights-gating where needed. |
| Hundreds of microservices, Cassandra, Kafka, BFF-per-client | **No** | Scale machinery we don't need. A **modular Django monolith + Celery** is far easier to maintain (our stated priority). One well-structured API serves all clients. |
| Hard DRM (Widevine/FairPlay), 30-day expiry, device caps | **Default no** | See offline design below — rights-dependent and a maintenance burden. |

The headline: **we mimic Spotify's *data-flow shape* (separate metadata from immutable CDN-served media, pre-transcoded variants, manifest-driven playback) without its *org-scale infrastructure*.**

### Dervaish is offline-first (not just "offline supported")

You want local-first media with downloads encouraged. That is a stronger stance than the big apps take, and it shapes the client architecture:

- **The local store is the primary read source.** The Expo app keeps a local **SQLite** catalog (kalam, renditions, verses, translations, artist/taxonomy) and a media cache. The UI reads **local-first** and renders instantly offline; the network is a background sync, not a precondition.
- **Sync engine.** On reconnect, pull **catalog deltas** by `updated_at` cursor (cheap JSON) and push queued **user actions** (library changes, playlists, playback positions) with last-write-wins on user state. Content is read-only on the client, so sync stays simple.
- **Download manager.** Background, **resumable** downloads (`expo-file-system`), a per-device **storage budget**, "make available offline" on a rendition or a whole collection, and optional **auto-download** of followed artists / saved collections. Show storage used and let users free space easily.
- **Offline media format — a concrete, maintainable choice:** **stream via HLS when online, but download a single progressive file per chosen quality for offline** (one Opus/AAC audio, or one MP4 for video). Managing one file per offline rendition is far simpler on-device than caching HLS segment sets, and the kalam are short enough that adaptive bitrate matters little once downloaded.
- **Playback:** use a background-capable player (e.g. **react-native-track-player**) that plays **local files transparently** — the player resolves a rendition to its local copy if present, else the streaming manifest. Lyrics/translation/verse timings are cached alongside the audio so the Companion view works fully offline.

### Protection level — a rights-driven decision (ties to §11)

The big apps use heavy DRM because their catalogue is licensed major-label content. Dervaish's content is largely **owned, Creative-Commons, or traditional devotional material that is often *meant* to be shared** — so we should not cargo-cult DRM:

- **Recommended default:** **no hard DRM.** Store downloads in **app-private storage, encrypted at rest** (OS keystore-backed key), which protects casual copying without the cost and fragility of a full DRM/license-server stack. No forced expiry, no re-validation check-ins — consistent with a preservation/sharing ethos and far easier to maintain.
- **Escalation only if needed:** for any specifically *licensed* renditions that require it, gate those items with **signed, expiring URLs** for streaming and **platform DRM (Widevine/FairPlay)** or app-level per-item encryption with expiry for downloads — applied per-rendition via a `protection_level` field, not globally.

This keeps the common case simple and only pays the DRM tax where a license actually demands it. **Decision owner: the audio-rights call in §11.**

---

## 4B. Federation: data sources & media mirrors

Two parallel registries let the **system choose automatically** and the **user choose manually** where catalogue data and media bytes come from. Each has an *official directory* served by the backend, supports *user-added* entries, and a *selection* layer. (Built & tested — `federation` app, §9.)

**Data sources ("databases") — `ContentSource`.** A content source is a Dervaish catalogue backend the app can pull from. *Designed-for-federation:* one official source today (`api.dervaish.com`), but the app holds a **source registry** and the backend serves an official **directory** (`GET /api/v1/directory/sources/`) listing known official sources; users may add a custom source by URL. *Automatic:* default to the official source. *Manual:* the user switches/adds sources in settings. Full multi-source aggregation (cross-source dedup, per-source auth/trust) is deliberately deferred — the abstraction exists now so it can land without a schema change.

**Media mirrors — `MediaMirror` + `MediaAssetMirror`.** The media plane (§4A) can be served from several hosts. A **global mirror registry** lists media-host endpoints — **Cloudflare R2 (`media.dervaish.com`) is mirror #1 / primary** — each with kind (r2/cdn/github/external/local), `priority`, `is_active`, `is_default_enabled`, `verified`, and `carries_all` (true = hosts the whole catalogue like the primary CDN; false = needs a per-asset availability row). `MediaAssetMirror` records that a specific file exists on a non-carries-all mirror. Official directory: `GET /api/v1/directory/mirrors/`.

- **Automatic (server):** the resolver (`federation.services.resolve_mirror_urls`) returns, for a media file, the ordered list of mirror URLs that actually carry it — lowest `priority` first. This is surfaced in the **playback manifest**: each variant carries `url` (primary) + `mirrors: [{mirror, name, kind, url, default_enabled, priority}]`.
- **Manual (client):** the app keeps an enabled/disabled set + custom mirrors **device-side first** (offline-first), merged with the official directory; the player tries enabled mirrors in priority order, failing over. The user toggles mirrors on/off, adds one by URL, and sees the official list. Selections sync to the account once auth lands (M1).

**GitHub repos as media sources.** Two complementary ways to read media from GitHub: (1) a **whole repo as a mirror** — a `MediaMirror` of kind `github` (raw root URL + per-asset availability rows, or `carries_all` if the repo mirrors everything), on by default; and (2) a **per-rendition specific GitHub URL** — a `MediaAsset.source_url` pointing at a file in a repo. `github.com/.../blob/...` (and `/raw/...`, `?raw=true`) links are normalized to `raw.githubusercontent.com` by `federation.github.normalize_github_url` and surfaced in the manifest as a directly-playable variant (`"source": true`, container guessed from extension) — so real audio/video can ship **before the M2 transcode pipeline exists**. (Built & tested.)

**Trust/safety:** `is_official`/`verified` flags drive UI trust signals; user-added sources and mirrors are clearly marked unverified.

---

## 5. Greenfield repo structure

A clean monorepo. Backend in Python, clients + shared logic in a TS workspace.

**Actual layout (reflecting what's built — §9):**
```
dervaish.com/
├─ backend/                    # Django + DRF + Celery (the API)  ← BUILT & TESTED (§9)
│  ├─ config/                  # settings, urls, api router, wsgi/asgi, celery
│  ├─ common/ accounts/ taxonomy/ catalog/ media/ lyrics/ archive/ community/
│  ├─ */migrations/            # committed
│  ├─ Dockerfile entrypoint.sh docker-compose.coolify.yml .env.example
│  ├─ README.md  DEPLOY-COOLIFY.md
│  └─ requirements.txt  manage.py
├─ app/                        # Universal Expo app (web + iOS + Android)  ← TO BUILD (M3)
│  ├─ app/                     # Expo Router routes (public = static-rendered)
│  ├─ src/{api,db,sync,player,downloads,ui,i18n,features}/   # see §13
│  └─ eas.json app.json
├─ packages/                   # shared TS, repointed to Django (M3)
│  ├─ domain/ validation/ api-client/ playback-core/
├─ docs/
│  └─ master-build-plan.md     # THIS document — the only plan in-repo (design system folded into §14)
├─ .gitattributes              # eol=lf (line-ending fix) ← added
└─ apps/  packages/  workers/  ← OLD two-stack code, to be moved to branch `archive/pre-rebuild`
```
*(The original standalone design system is preserved in `Dervaish/_backup-superseded-docs/repo-docs-design-system.md`; its build-ready subset is folded into §14. The MoviePy video worker and local docker-compose are salvaged from the old `workers/` and root.)*

---

## 6. Cutover: what to salvage, archive, and discard

**Step 0 — preserve.** Tag current `main` and push a branch `archive/pre-rebuild`. Nothing is lost; the rebuild starts from a clean structure on a new branch.

**Salvage (carry forward, refactored):**
- The Django **app structure, media pipeline, admin, and lyrics/community/archive/video workflow patterns** — and the **provenance, citation, and source-rating modeling** (these are sound). The **media, lyrics, archive, community, accounts, audit** models port over with light renaming.
- *Recreate, do not copy:* the **catalogue core**. The existing `Track`/`Collection`/`TrackCredit` schema is replaced by `Kalam` + `Verse` + `Rendition` + `Credit` per §7. Read the old models for field inventory only.
- TS packages `domain`, `validation`, `playback-core`, `api-client` (repoint to Django; update `domain` types to Kalam/Rendition/Verse).
- `workers/video-generator` (MoviePy) — orchestrate via Celery; output becomes a video media file on a rendition.
- The local `docker-compose.yml` (Postgres/Redis/MinIO). The original `docs/design-system.md` is preserved in `Dervaish/_backup-superseded-docs/` and its build-ready subset is folded into **§14**.
- Seed fixtures and the imported VTT lyric/media samples (`tanam-farsooda-ja-para`, `ya-nabi-salam-alayka`) as test data.

**Archive (reference only, not in the build):**
- `apps/api` (Fastify/TS API) — superseded by Django.
- `apps/web` monolithic `App.tsx`, `apps/mobile` shell, `apps/platform-web` stub — superseded by the unified Expo app.

**Discard:**
- In-memory data store, header-based fake auth, demo-only API contracts that dump full catalog snapshots.
- The `Track`/`Collection`-centric catalogue schema (replaced by the Kalam→Rendition→media model in §7).

**Housekeeping fix (do first):** the entire working tree currently shows as modified because of CRLF↔LF line endings (OneDrive/Windows). Add `.gitattributes` (`* text=auto eol=lf`) and renormalize so diffs are reviewable from day one.

---

## 7. Data model (canonical)

**This is the model from the original product plan, and it is the one we build.** The repo's existing schema is Track/Collection-centric (a MediaCMS-style media catalogue); we are **not** carrying that structure forward. Dervaish is archive-first, so the *work* is the spine: a **Kalam** is the poem/work, a **Rendition** is one performance of it, and **audio/video files attach to the Rendition.** The existing Django models are studied as reference only and re-expressed as the entities below.

### The spine

- **Kalam** (the work — exists independently of any recording): title (original script + transliteration + common English title), primary language + any mixed languages, genre/form (hamd, naat, manqabat, qawwali, kafi, ghazal, nasheed…), **author** (→ Person), tradition/silsila, era, themes/occasions, sources/citations, status (draft/review/published). Owns its ordered **Verses**.
- **Verse / Line** (ordered children of a Kalam — the unit that powers both the reader and synced lyrics): order index, original text (in script), transliteration, **Translation(s)** (one per target language), and a line-level **meaning/commentary** note (tafseer, Qur'an/Hadith references, idiom). Translations and meaning live here, at the verse level.
- **Rendition** (one recording of a Kalam): belongs to one Kalam; **voice artist(s)** (→ Person, role = qawwal / naat khwan / reciter / vocalist / chorus); year/date, album/source, label/publisher; style/instrumentation; rights/licence + attribution (mandatory before publish); status. Has its own **lyric-sync timing map** and one or more **media files**.

### Media (audio *and* video, attached to a Rendition)

- **MediaAsset** — the immutable original uploaded/imported file for a rendition: **kind = audio | video**, format, checksum, MIME, size, duration, dimensions (video), `storageKey` and/or external/GitHub `sourceUrl`, provenance. A rendition can carry both an audio asset and a video asset.
- **MediaRendition** — derived playable variants of an asset: audio (Opus/AAC/MP3) and video (web MP4 / adaptive HLS), bitrate/resolution, codec, `storageKey`, processing status, link back to the master asset. Originals are immutable; variants are replaceable. Includes a flag marking the **progressive variant used for offline download** (one file per quality — see §4A).
- **Protection level** — each Rendition carries a `protection_level` (e.g. `open` | `signed` | `drm`) so the common owned/CC case streams from public CDN URLs and downloads to app-private encrypted-at-rest storage with no DRM, while only specifically licensed items escalate to signed/expiring URLs or platform DRM (§4A, decided by §11 rights).
- **Caption / Chapter** — timed subtitle/section files linked to an asset or rendition (WebVTT preferred), plus **waveform** peaks and poster/thumbnail frames.
- **Mirror** — alternate playback source/URL for a media file (e.g. public GitHub raw, CDN), normalised by the API.

### People & taxonomy

- **Person** (one model, many roles — author *and* voice artist): name (script + transliteration), aliases/honorifics, role(s), biography, era, region, tradition, portrait, external IDs. Derived: kalam authored, renditions performed.
- **Credit** — typed Person↔(Kalam or Rendition) relationship: author/writer, reciter/voice artist, composer, translator, source contributor, editor; display order.
- **VocabularyTerm / Taxonomy** — controlled vocabularies reused everywhere: genre/form, language, tradition/silsila, era, theme/occasion, region — plus free **tags**.

### Synced lyrics (per rendition, reusing the Kalam's verses)

- **LyricTimingMap** — for a specific Rendition, the start (and optional end) time of each **Verse**. Because timings hang on the rendition and the text/translation lives on the Kalam's verses, every rendition of the same kalam reuses the same verses and translations with its own timings — no duplicated text.
- **LyricLanguage / LyricSegment** retained for import/export interop (WebVTT/LRC/TTML/JSON): language `code`, `role` (original/translation/transliteration/commentary), **direction** (authoritative for RTL/LTR), and per-language segment text; segments must not overlap.

### Archive, community, generation, user

- **Archive:** `ArchiveRecord` (linked to Kalam/Person/Rendition), `Citation`, `ProvenanceRecord`, `SourceRating` (editorial vs community), JSON-LD export.
- **Community:** `Submission`, `CorrectionDraft`, `VerificationVote`, `KalamRequest`/`RenditionRequest` + upvotes, contributor trust, full audit log.
- **Video generation:** `VideoGenerationJob` (source rendition/asset, layout, visible lyric languages, status, preview, output asset, provenance) — produces a lyric-video that becomes a video media file on the rendition after editor approval.
- **User-facing:** `Playlist`/`Collection` (ordered renditions, curated or user, visibility, share token), `Library`/saved items, `Queue`/`QueueItem`, `PlaybackState` (per-rendition position, history), playback + language preferences.

### Federation: sources & mirrors (see §4B)

- **ContentSource** — a catalogue backend ("database") the app can pull from: name, slug, `base_url`, `kind` (official/community/personal), `is_official`/`is_default`/`is_enabled`/`verified`, `priority`. Official directory + user-added.
- **MediaMirror** — a media-host endpoint (r2/cdn/github/external/local): `base_url`, `kind`, `priority`, `is_active`, `is_default_enabled`, `verified`, `carries_all`. R2 (`media.dervaish.com`) is the primary mirror.
- **MediaAssetMirror** — availability of a `MediaAsset` on a non-`carries_all` mirror (`available`, `url_override`, `checksum_ok`, `last_checked`).

The resolver orders enabled + available mirrors per file into the playback manifest; the client applies user toggles/custom mirrors on top.

### Relationships at a glance

```
Person ──authored──► Kalam ──has ordered──► Verse (text · translit · translation · meaning)
                       │                         ▲
                       │ has many                │ timed by
                       ▼                         │
                    Rendition ──LyricTimingMap───┘
            performed by │  └─ has media ─► MediaAsset (audio|video) ─► MediaRendition (Opus/AAC/MP4/HLS)
                  Person  │                         └─ Caption · Chapter · Waveform · Mirror
                         tagged ► VocabularyTerm/Taxonomy ; described ► ArchiveRecord · Citation · Provenance
```

All public models carry timestamps; reviewable models carry created/updated/reviewed-by + state + audit coverage.

---

## 8. Epics

| ID | Epic | One-line outcome |
|----|------|------------------|
| E1 | Platform foundations & DevOps | Monorepo, CI, EAS pipelines, environments, design system, `.gitattributes` fix |
| E2 | Backend core & data model | Django apps, **Kalam/Verse/Rendition/Person/Credit schema** (§7), accounts/roles, audit, seeds, real auth |
| E3 | Media pipeline (audio + video) | Upload sessions, S3, checksum, FFmpeg audio (Opus/AAC) + video (MP4/HLS) variants, waveforms/posters, playback manifest, Celery state |
| E4 | Universal app shell | Expo Router nav, design-system UI, web/iOS/Android build targets, RTL-aware layout |
| E5 | Player (audio + video) | Native + web playback of renditions, background/lock-screen, mini-player, queue, resume, history |
| E6 | Kalam archive & reader | Work/verse pages: text, transliteration, translation, meaning, renditions, sources |
| E7 | Synced lyrics (Companion) | Per-rendition timing, follow + meaning toggle, language lanes, authoring tool |
| E8 | People & discovery | Person pages, search (Postgres FTS + trigram), browse, filters/taxonomy |
| E9 | Accounts & library | Auth, anonymous playback, library, playlists, queues, cross-device + preferences |
| E10 | Contributor & community | Submissions, corrections, verification votes, kalam/rendition requests, moderation queues |
| E11 | Admin & preservation | Django admin + in-app review queues, media/job dashboards, provenance, JSON-LD |
| E12 | Offline-first & sync | Local SQLite catalog (read local-first), resumable download manager + storage budget, app-private encrypted-at-rest media, delta sync, manifest-driven local-or-stream playback (§4A) |
| E13 | Multilingual & RTL | Multi-script typography, bidi-safe rendering, UI localisation framework |
| E14 | SEO & sharing (public) | Static-rendered public pages, structured data, share links/cards |
| E15 | Video generation | Celery lyric-video jobs, previews, editor approval, publishing |
| E16 | Recommendations & editorial | Featured kalam, collections, following/notifications, recs, multi-translation |
| E17 | Store launch & ops | App Store + Play Store submission, monitoring, analytics, performance, support |
| E18 | Federation: sources & mirrors | Content-source registry + official directory (designed-for-federation), media-mirror registry + per-asset availability + resolver, auto + manual (toggle/add) selection, R2 as primary mirror (§4B) — *backend built (§9); client settings UI in M6/M7* |

---

## 9. Current build status (what already exists)

> This section grounds Claude Code: the backend is **already scaffolded, migrated, seeded, and smoke-tested**, and is packaged for Coolify. Start from here; do not re-scaffold it.

**`backend/` — Django + DRF + Celery API (built & tested).**
- Project config: `config/` (`settings.py` env-driven with SQLite fallback, `urls.py`, `api.py` router, `wsgi.py`, `asgi.py`, `celery.py`).
- Apps implemented with models + migrations + admin: `common` (base mixins, `Visibility`/`EditorialState`), `accounts` (custom `User` + role + trust), `taxonomy` (`VocabularyTerm`), `catalog` (`Person`, `Kalam`, `Verse`, `Rendition`, `Credit`, `Collection`, `CollectionItem`), `media` (`MediaAsset`, `MediaRendition`, `Caption`), `lyrics` (`RenditionVerseTiming`), `archive` (`ArchiveRecord`, `Citation`, `ProvenanceRecord`, `SourceRating`), `community` (`Submission`, `KalamRequest`, `RequestUpvote`), `federation` (`ContentSource`, `MediaMirror`, `MediaAssetMirror` + mirror resolver — §4B).
- Public read API live and verified (see §11 for the contract): `/healthz`, `/api/v1/kalams/`, `/api/v1/kalams/{slug}/`, `/api/v1/renditions/{slug}/`, `/api/v1/people/…`, `/api/v1/collections/…`, plus `/admin/`.
- `catalog/management/commands/seed_demo.py` — idempotent seed (a complete public example: the naat *Tanam Farsooda*, author, verses+translations, rendition, media variant, archive record).
- Deploy assets: `Dockerfile` (with ffmpeg), `entrypoint.sh` (`web|worker|beat`; auto migrate + collectstatic + gunicorn), `docker-compose.coolify.yml`, `.env.example`, WhiteNoise static, `/healthz` healthcheck. Step-by-step in `backend/DEPLOY-COOLIFY.md`.
- Verified: `manage.py check` clean; migrations apply; seed runs; endpoints return correct nested data with RTL scripts intact and a working playback manifest.

**Not yet built (the work ahead):** real auth + per-role permissions, `/me/*` endpoints, search endpoint, the media upload/transcode pipeline (Celery tasks are stubs), the **Expo universal app** (`app/`), the shared TS packages repointed to Django, CI/CD, and EAS. These map to the milestones in §22.

**Repo note:** the live backend is at **`backend/`** (top level), not `apps/backend`. The old two-stack code still sits under `apps/` and `packages/` and is to be archived to branch `archive/pre-rebuild` (see §6). The Expo app will be created at **`app/`** (or `apps/app/`).

---

## 10. Phased roadmap & sprints

Two-week sprints; continuous delivery behind feature flags + EAS channels. Content seeding by the editor runs in parallel throughout. Velocity is recalibrated after the first two sprints. The milestone backlog in §22 is the executable version of this.

- **Phase 0 — Decisions & cutover.** Resolve §20 decisions (audio rights, translation strategy first). Branch `archive/pre-rebuild`; confirm `backend/` as canonical; line-endings fix. **Exit:** clean repo, signed-off decisions. *(Backend scaffold already done — §9.)*
- **Phase 1 — Backend hardening & foundations.** Real auth + role permissions, `/me/*` (library, queues, preferences), search, error/pagination envelope, tests, CI. Scaffold the Expo app shell booting on all three targets against the live API. **Exit:** authenticated API + app boots everywhere.
- **Phase 2 — Media + player.** Upload→checksum→FFmpeg variants→manifest with Celery state and admin visibility; player with mini-player, queue, resume, background audio; anonymous playback. **Exit:** stream a rendition on web/iOS/Android.
- **Phase 3 — Archive, lyrics, discovery.** Kalam/verse reader pages; Companion synced lyrics with follow/meaning toggle and language lanes + authoring tool; person pages; search/browse/filters UI. **Exit:** the depth experience works.
- **Phase 4 — Accounts, community, admin.** Library, playlists, preferences sync; submissions, corrections, verification, requests; moderation in-app + Django admin; provenance + JSON-LD. **Exit:** content contributed and governed in-product.
- **Phase 5 — Offline, SEO, launch.** Offline downloads on native + PWA; static-rendered public pages with structured data/share cards; performance, a11y, analytics; **App Store + Play Store submission.** **Exit:** Release 1 live on web + both stores.
- **Phase 6 — Editorial, recs, video generation.** Featured kalam, collections, following/notifications, recommendations, multiple translations; Celery lyric-video generation with editor approval.

---

## 11. Backend implementation guide (Django + DRF)

### 11.1 App responsibilities
- `common` — abstract base models (`TimestampedModel`, `EditorialModel`), shared enums (`Visibility`, `EditorialState`). All reviewable entities subclass `EditorialModel`.
- `accounts` — custom `User` (role ∈ anonymous/listener/contributor/editor/admin, trust_score), auth, `/me/*`, preferences.
- `taxonomy` — `VocabularyTerm` (kind ∈ genre/language/tradition/era/theme/region) + free tags.
- `catalog` — the spine: `Person`, `Kalam`, `Verse`, `Rendition`, `Credit`, `Collection`/`CollectionItem`, plus `Queue`/`QueueItem` (to add).
- `media` — `MediaAsset` (immutable original, kind audio|video), `MediaRendition` (variants; `is_offline_download` flag), `Caption`; upload sessions + manifest builder (to add).
- `lyrics` — `RenditionVerseTiming` (per-rendition map over verses) + WebVTT/LRC import-export (to add).
- `archive` — `ArchiveRecord`, `Citation`, `ProvenanceRecord`, `SourceRating`; JSON-LD export (to add).
- `community` — `Submission`, `KalamRequest`, `RequestUpvote`; `CorrectionDraft`, `VerificationVote` (to add); moderation review actions.

### 11.2 API contract (v1)
Base path `/api/v1/`. JSON. Page-number pagination (`?page=`, `PAGE_SIZE=25`). Filtering via `django-filter`, full-text via `?search=`, ordering via `?ordering=`.

**Live now (read-only):**
- `GET /healthz` → `{"status":"ok","database":true,"service":"dervaish-api"}`
- `GET /api/v1/kalams/?search=&genre=&primary_language=&tradition=&ordering=` → paginated list (slug, titles, author_name, genre)
- `GET /api/v1/kalams/{slug}/` → detail: author, taxonomy labels, `verses[]` (order, text_native, transliteration, translations{}, meaning{}), `credits[]`, `renditions[]`
- `GET /api/v1/renditions/{slug}/` → rendition + **playback manifest**: `{ "protection_level":"open", "variants":[{kind,container,bitrate_kbps,height,url,streaming,offline_download}] }`
- `GET /api/v1/people/`, `GET /api/v1/people/{slug}/` (authored kalams), `GET /api/v1/collections/`, `GET /api/v1/collections/{slug}/`
- **Federation directory:** `GET /api/v1/directory/sources/`, `GET /api/v1/directory/mirrors/` (official entries). The rendition playback manifest now carries per-variant `mirrors[]` (resolver-ordered) in addition to the primary `url` (§4B).

**To build (keep these exact paths):**
- Auth: `POST /api/v1/auth/register/`, `POST /api/v1/auth/login/` (token), `POST /api/v1/auth/logout/`, `GET /api/v1/me/`
- Library/queues/prefs: `GET/POST /api/v1/me/library/`, `GET/POST /api/v1/me/queues/`, `POST /api/v1/me/queues/{id}/items/`, `PATCH /api/v1/me/preferences/`
- Search: `GET /api/v1/search/?q=` → grouped `{kalams[],people[],renditions[],collections[]}`
- Media: `POST /api/v1/media/upload-sessions/`, `POST /api/v1/media/assets/{id}/complete/`, `GET /api/v1/renditions/{slug}/playback/` (signed manifest)
- Lyrics: `GET /api/v1/renditions/{slug}/lyrics/`, editor `PUT …/timings/`, `POST /api/v1/lyrics/import/`
- Community: `POST /api/v1/submissions/`, `GET /api/v1/community/requests/`, `POST …/{id}/upvote/`, `POST …/{id}/verifications/`
- Admin/review: `GET /api/v1/admin/review/submissions/`, `PATCH …/{id}/`, `POST …/{id}/publish/`
- Archive: `GET /api/v1/archive/records/{slug}/`, `GET …/{slug}.jsonld`

### 11.3 Conventions
- **Visibility filtering is mandatory** on every public queryset: `filter(visibility__in=["public","unlisted"])`. Never leak draft/pending.
- Read endpoints are `ReadOnlyModelViewSet` with `select_related`/`prefetch_related` to avoid N+1.
- Write endpoints enforce **role permissions** (DRF permission classes): contributor can submit/draft; editor can review/publish; admin manages everything. Anonymous = read + anonymous session only.
- Serializers: list vs detail split; expose taxonomy as `label` (slug-related read-only), never raw FK ids in public output.
- **Error envelope:** use DRF default `{"detail": …}` / field errors; never 500 with a stack trace in prod (`DJANGO_DEBUG=false`).
- **Migrations are committed** and applied automatically by `entrypoint.sh` on deploy. Always `makemigrations` per app and review before commit.

### 11.4 How to add a model / endpoint
1. Add/modify the model in the owning app; `makemigrations <app>`; review the migration.
2. Add a serializer (list + detail) honoring visibility and label exposure.
3. Add a `ReadOnlyModelViewSet` (or `ModelViewSet` with permissions for writes); register in `config/api.py`.
4. Register in that app's `admin.py` with `list_display`/`list_filter`/`search_fields` (autocomplete targets need `search_fields`).
5. Add tests (§16). Run `manage.py check` + the app's tests. Update the seed if it's core.

### 11.5 Run locally
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # blank DATABASE_URL → SQLite
python manage.py migrate && python manage.py seed_demo && python manage.py runserver
```

---

## 12. Media pipeline implementation (E3 / §4A)

The pipeline realises the control-plane / media-plane split. **Originals are immutable; variants are derived; the API returns a manifest of URLs, never bytes.**

**Upload flow:**
1. Client `POST /api/v1/media/upload-sessions/` (kind, mime, size) → server creates a `MediaAsset` (status `pending`) and returns a **direct-to-S3 presigned PUT** (or a server-mediated upload).
2. Client uploads bytes to S3/MinIO.
3. Client `POST …/assets/{id}/complete/` → enqueues a Celery job.

**Celery worker (`media/tasks.py`):**
- Verify checksum, MIME, duration, codecs (ffprobe).
- **Audio:** transcode to `opus` (~128k) for streaming + a progressive download file; optionally `aac` for compatibility. **Video:** `mp4` (H.264/AAC) + HLS variant set.
- Generate **waveform peaks** (audio) / **poster + thumbnails** (video); extract/normalise **captions** (WebVTT).
- Write `MediaRendition` rows (`is_streaming`, `is_offline_download`), update `MediaAsset.processing_status` → `ready` (or `failed` + reason). Every step writes durable status/logs/retries.

**Storage key scheme:** `{env}/{kind}/{asset_id}/{variant}.{ext}` (e.g. `prod/audio/4127/opus-128.opus`). Originals under `…/original`.

**Manifest** (`GET /renditions/{slug}/playback/`): `{ protection_level, variants:[{kind,container,bitrate_kbps,height,url|signed_url,streaming,offline_download}], captions:[…], lyric_timings_url }`. `protection_level=open` → public CDN URLs; `signed`/`drm` → signed/expiring URLs.

---

## 13. Universal app implementation guide (Expo)

Create at **`app/`**. Expo (SDK current) + Expo Router + React Native Web → iOS, Android, web from one codebase. **Offline-first: the local SQLite store is the primary read source (§4A).**

### 13.1 Stack & libraries
- **Routing:** `expo-router` (file-based; public routes set to static rendering for SEO — §3, E14).
- **Server cache:** `@tanstack/react-query` (with persistence) over the typed `api-client` package.
- **Local store:** `expo-sqlite` — mirror of catalog (kalam, verses, renditions, people, taxonomy) for instant offline reads.
- **Sync:** custom engine — pull catalog deltas by `updated_at` cursor; push queued user actions (LWW on user state).
- **Downloads:** `expo-file-system` (resumable, background) + a download-manager module with storage budget.
- **Player:** `react-native-track-player` (background/lock-screen; resolves a rendition to its **local file if present**, else the streaming manifest).
- **Encryption at rest:** `expo-secure-store` holds the key; downloaded media in app-private storage (§4A protection default).
- **Validation/types:** shared `packages/domain` (types) + `packages/validation` (zod) + `packages/playback-core` (active-segment + offline planning).

### 13.2 Folder structure
```
app/                         # Expo Router routes
  _layout.tsx                # providers: QueryClient, theme, player, i18n/RTL
  (tabs)/_layout.tsx         # Listen · Search · Library · Community  (+ Admin if editor)
  (tabs)/index.tsx           # Listen (home: featured, continue, collections)
  (tabs)/search.tsx
  (tabs)/library.tsx
  (tabs)/community.tsx
  kalam/[slug].tsx           # archive/reader page  (static-rendered for web)
  rendition/[slug].tsx
  person/[slug].tsx
  collection/[slug].tsx
  player.tsx                 # Now Playing + Companion (synced lyrics)
  submit/…  admin/…
src/
  api/                       # api-client hooks (useKalam, useRendition, useSearch…)
  db/                        # sqlite schema, migrations, DAOs
  sync/                      # delta pull + action push engine
  player/                    # track-player setup + usePlayer hooks
  downloads/                 # download manager + storage budget
  ui/                        # design-system components + tokens (§14)
  i18n/                      # dir/lang/alignment utilities (RTL)
  features/                  # listen · companion · archive · submit · community · admin
```

### 13.3 Screen ↔ data map (build order matches §22)
- **Listen (home):** featured + continue-listening (local) + curated collections.
- **Kalam page:** `GET /kalams/{slug}/` → header (author/genre/tradition), renditions list, verse blocks (script · transliteration · translation · meaning) with correct `dir`/`lang`.
- **Now Playing / Companion:** track-player state drives the active verse (via `playback-core`); toggle layer script↔translit↔meaning; language lanes.
- **Person page:** `GET /people/{slug}/` → bio + authored kalams + performed renditions.
- **Search:** `GET /search/?q=` grouped results.
- **Library/Queues:** local-first, synced to `/me/*`.

### 13.4 Offline-first rules
- Every read tries SQLite first, then network (React Query `initialData` from DAO), then writes back to SQLite.
- Player checks the downloads table for a local file before using a streaming URL.
- Companion caches verses + timings + translations alongside the audio so it works fully offline.

---

## 14. Design system (folded in)

> The full original design system is preserved at `Dervaish/_backup-superseded-docs/repo-docs-design-system.md`. This is the condensed, build-ready subset. **Note:** that doc uses older "Track/reciter/writer" terms — in this rebuild **Track → Rendition** and roles come from `Credit` (author, reciter/voice artist). Keep its UX patterns; map its nouns to §7.

**Feel:** calm, trustworthy, precise, operational — not promotional. Three qualities together: archive credibility, listening warmth, operational clarity. Dark, low-glare default.

**Product principles:** preservation visible without interrupting listening; listening stays central; multilingual/RTL first-class; community contribution structured & auditable; dense ≠ cluttered (hierarchy + progressive disclosure); trust is visible (curated vs community vs disputed); roles change affordances visibly.

**Tokens (semantic, centralized — never hard-code):**
- Color: `--bg --nav --surface --surface-2 --surface-3 --line --text --muted --soft --green(primary/play) --green-soft --gold(archive/provenance) --blue(info/links) --danger --warning --success`. Never status-by-color alone — pair with text/icon.
- Spacing: 8px baseline (4/8/12/16/20–24/32+). Radius: 8 (controls/cards), 12 (media/route panels), 999 (pills/badges), circle (avatars/icon-media). Elevation sparingly (popovers/modals/player).
- Type: compact readable sans for UI; display sparingly for headers; comfortable line-height for lyrics/long-form; tabular numerals for durations/counts; never compress RTL scripts.
- Icons: `lucide-react` (web) / equivalent RN set; 18px default, 14–16 in chips; icon-only controls need 34–44px target + `aria-label`+`title`. Never replace names/titles/citations with icons.

**Components inventory (build reusable):** buttons (primary/secondary/ghost/destructive), icon-buttons, chips/badges (role · visibility · curation · verification · media · job), cards/panels (no card-in-card unless different object), tables/data-grids (status chips not color-only, sticky first col, resettable filters), forms (grouped fieldsets, inline + summary validation, preserve input on error), popovers/drawers/modals (drawers for review detail; modals only for blocking/destructive), language blocks, credit lists, track/rendition rows, verification controls, job cards, the **playback bar**, audio/video players, lyric display, language picker, timed-lyric editor.

**Layout:** desktop = side-nav + main + optional right rail + sticky playback bar; mobile = top bar + bottom nav + media reachable without scrolling + progressive disclosure. Page templates: browse/list, detail, review queue, editor form, companion, admin operational.

**Accessibility (required, part of DoD):** icon-only controls have `aria-label`+`title`; `:focus-visible` rings; ≥44px mobile / ≥34px dense-desktop targets; semantic buttons vs links; lyrics expose `dir`+`lang`; mixed-direction uses `unicode-bidi: plaintext`; forms identify field + issue + preserve input; respect reduced-motion.

**States (every module ships all):** loading (skeletons), empty (what/why/next action), error (name the failed op, preserve input), success (calm, name the object), partial/degraded (track w/o media, lyrics w/o translation, unavailable mirror — visible but non-blocking).

**Content/tone:** clear, calm, precise; no marketing copy in workflows. Preferred nouns: Rendition, Kalam, Collection, Archive record, Citation, Provenance, Source, Submission, Correction, Verification, Dispute. Durations `4:18` / `1:02:30`. Title case headers, sentence case helpers; consistent verbs (Create/Add/Save/Submit/Review/Approve/Publish/Reject/Verify/Dispute).

**Role-based UI:** anonymous (browse/listen/public archive; contribution prompts sign-in), listener (queues/collections/upvote/prefs/requests), contributor (submissions/corrections/lyrics/verify), editor (review/metadata/verify/publish/mirrors), admin (libraries/roles/jobs/destructive). Differences via visible affordances + clear permission errors, never silent failure.

**Module checklist (before "done"):** primary goal · role permissions · loading/empty/error/success/partial · keyboard + screen-reader · mobile layout · status chips + labels · source/provenance where applicable · multilingual/RTL where applicable · audit/review trail where applicable · destructive confirmation where applicable.

---

## 15. Engineering conventions & how Claude Code should work

**Languages/tools.** Backend: Python 3.12, Django 5.1, DRF, Celery; format/lint with **Ruff** (and Black-compatible); type hints throughout. Client: **TypeScript strict**, React/React Native, ESLint + Prettier. Shared logic in `packages/*`, not duplicated in screens.

**Structure rules.** One Django app per domain; one feature folder per client workflow. No business logic in route components — put it in `src/api`, `src/db`, `src/sync`, `src/player`, `packages/*`. Centralize tokens and status-label derivation; don't re-string domain states in components.

**Git.** Conventional Commits (`feat:`, `fix:`, `chore:`…). Small, vertical-slice PRs (one feature path, with tests). Feature flags / EAS channels decouple deploy from release. Never commit secrets or `db.sqlite3*`.

**How Claude Code should operate:**
1. Read this plan + `backend/README.md` + `backend/DEPLOY-COOLIFY.md` before changing code.
2. Work the **§22 milestones in order**, one vertical slice at a time, each ending green (tests + `manage.py check` / typecheck).
3. Honor visibility filtering, role permissions, RTL, and the states checklist (§14) — these are acceptance criteria, not polish.
4. Keep migrations committed and reviewed. Update this plan + `backend/README` when architecture changes.
5. Prefer extending existing apps/packages over new top-level structures; match established patterns.

---

## 16. Testing & QA

- **Backend:** Django/pytest tests per app — model constraints (unique verse order, non-overlapping timings, visibility), API permission + pagination + serialization, visibility leak checks, media state transitions, review/publish flows. `manage.py check` clean. Target meaningful coverage on serializers/permissions/visibility.
- **Client:** component tests (player bar, lyric lanes, status chips, forms), hook tests for sync/offline resolution, and e2e (Maestro or Detox) for listen → companion → submit → admin-publish. Accessibility checks (focus, labels, `dir`/`lang`).
- **Cross-cutting:** every new module must include loading/empty/error/permission states before it's "done" (§14, §19). High-stakes changes get a review pass (a sub-agent or a second reviewer).

---

## 17. CI/CD, environments & configuration

**GitHub Actions.**
- `backend` job: Ruff lint, `makemigrations --check --dry-run` (fail on missing migrations), `manage.py check`, run tests (Postgres service container).
- `app` job: typecheck, ESLint, unit tests, `expo export` (web) build check.
- `release` job (on tag): **EAS Build** (iOS/Android) + **EAS Submit** to stores; backend deploy promotes to production.

**Environments:** `local → staging → production`. Merge to main → staging; tagged release → production. EAS channels `preview`/`production` mirror these.

**Config (env vars).** Backend (see Appendix A & `backend/.env.example`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `REDIS_URL`, `USE_S3` + `S3_*`. App: `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://api.dervaish.com`), EAS project/secret config.

---

## 18. Deployment (Coolify)

The backend is Coolify-ready. Full step-by-step lives in **`backend/DEPLOY-COOLIFY.md`**. Summary: push to GitHub → Coolify managed **Postgres + Redis** (+ optional MinIO) → **Application** from repo, Base Directory `/backend`, Dockerfile build, port 8000, health path `/healthz` → set env vars → domain `api.dervaish.com` (Traefik auto-TLS) → deploy → add a **second resource as the Celery `worker`** (start command `worker`) → `createsuperuser` + `seed_demo`. The Expo web target deploys separately as a static export; native ships via EAS to the stores.

---

## 19. Definition of Done (per feature)

Clear user-value met · acceptance criteria verified · tests passing (unit + integration where relevant) · works in **RTL** and ≥1 non-Latin script where text is involved · responsive on mobile + desktop · accessible (keyboard + contrast + labels) · loading/empty/error/permission states present · visibility/role rules enforced · migrations committed · no Sev-1/2 bugs · deployed to staging behind a flag · plan/docs updated if architecture changed.

---

## 20. Open decisions (resolve in Phase 0)

1. **Audio rights** — biggest non-technical risk; gates ingestion, offline downloads, open contribution, and store review. Start with owned/licensed/traditional content; sets the default `protection_level`.
2. **Translation strategy** — whose translations, which languages, how vetted. A trust issue with this audience.
3. **Monetisation / sustainability** — free/donation, membership, institutional. Decide before any billing; affects store config.
4. **Contribution scope at launch** — recommend **closed** (you + trusted editors), opening gradually with moderation.
5. **Brand & identity** — Dervaish naming is set; finalize the calm, reverent visual identity and tokens.

---

## 21. Risks

- **Two-stack drift** — *resolved by this plan*: one backend (`backend/`), one client (`app/`), old code archived.
- **Audio rights** — curate owned/licensed first; document for store review.
- **SEO from a SPA** — mitigated by static-rendering public routes + JSON-LD; Next.js public site as a bounded fallback (§3).
- **Synced-lyric authoring cost** — manual timing is the scaling bottleneck; good tooling now, assisted alignment later.
- **Native release overhead** — store review, signing, device testing; EAS reduces but doesn't remove it — budget Phase 5.
- **Scope breadth** — media + archive + lyrics + community + admin + 3 platforms is large; ship vertical slices; hold "lean player, deep on demand" in every review.

---

## 22. Build backlog for Claude Code (ordered milestones)

Each milestone is a vertical slice ending green and demoable. **M0 is done.**

- **M0 — Backend scaffold + deploy.** ✅ Done (§9). Django API with Kalam/Rendition model, migrations, seed, health, admin, Dockerized for Coolify.
- **M1 — Backend hardening.** Real auth (token) + `/me/`; role permission classes; `/me/library`, `/me/queues`, `/me/preferences`; `/api/v1/search/` grouped; pagination/error envelope confirmed; tests per app; GitHub Actions backend job. **Accept:** authenticated CRUD on library/queues; search returns grouped results; permission tests pass; CI green.
- **M2 — Media pipeline (E3).** Upload-session API + presigned S3; Celery transcode tasks (ffmpeg → opus/aac + mp4/hls), waveform/poster, caption normalise; real manifest from variants; admin shows processing status. **Accept:** upload an audio file → variants appear → `/renditions/{slug}/playback/` returns playable URLs; failures recorded.
- **M3 — Expo app shell (E4/E13).** Create `app/`; Expo Router tabs; design tokens + base UI (§14); `api-client`/`domain`/`validation` packages repointed to Django; RTL utilities; `EXPO_PUBLIC_API_BASE_URL`. **Accept:** app boots on web, iOS, Android against the live API and lists kalams with correct RTL.
- **M4 — Player + reader (E5/E6).** Track-player integration (background/lock-screen), mini-player, queue, resume; Kalam reader page (verses: script/translit/translation/meaning); rendition selection. **Accept:** play a rendition on all three platforms; read a full kalam page.
- **M5 — Companion synced lyrics (E7).** Per-rendition timings drive active-verse highlight + auto-scroll; layer toggle (script↔translit↔meaning); language lanes; tap-to-timestamp authoring tool (contributor). **Accept:** lyrics follow playback within tolerance; meaning toggle works; a contributor can time a rendition.
- **M6 — Accounts, library, search UI (E9/E8).** Sign-up/in; save to library; playlists; search/browse/filters screens; preferences sync. **Accept:** signed-in user builds a library + playlist that syncs across devices.
- **M7 — Offline-first + mirror/source selection (E12/E18).** SQLite catalog mirror + local-first reads; resumable download manager + storage budget; encrypted-at-rest media; player prefers local; delta sync. **Mirror/source UI:** Settings screens that read the official directory (`/directory/sources`, `/directory/mirrors`), let the user toggle mirrors on/off, add a custom mirror/source by URL (device-local, synced to account), and drive playback failover via the manifest's `mirrors[]`. **Accept:** download a collection, go offline, browse + play + read lyrics fully; disabling the primary mirror fails over to the next enabled one; a user-added mirror works.
- **M8 — Community + admin (E10/E11).** Submissions, corrections, verification votes, requests; moderation review queues in-app + Django admin; provenance + JSON-LD export. **Accept:** a submission flows draft→review→publish; editors verify fields; JSON-LD validates.
- **M9 — SEO + launch (E14/E17).** Static-render public kalam/person/collection routes + structured data/share cards; performance + a11y pass; analytics; App Store + Play Store submission. **Accept:** public pages indexable + shareable; builds submitted to both stores.
- **M10 — Editorial, recs, video gen (E15/E16).** Featured/collections, following/notifications, recommendations, multiple translations; Celery lyric-video jobs with editor approval. **Accept:** daily featured surfaces; a lyric-video renders, previews, and publishes after approval.

---

## Appendix A — Environment variables

**Backend** (`backend/.env.example`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_TIME_ZONE`, `DATABASE_URL` (blank → SQLite), `REDIS_URL`, `USE_S3`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `GUNICORN_WORKERS`, `GUNICORN_TIMEOUT`; compose-only: `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
**App:** `EXPO_PUBLIC_API_BASE_URL`, plus EAS project id / store credentials (managed in EAS).

## Appendix B — Command cheat-sheet

```bash
# Backend
cd backend && source .venv/bin/activate
python manage.py makemigrations <app> && python manage.py migrate
python manage.py seed_demo
python manage.py createsuperuser
python manage.py runserver           # http://127.0.0.1:8000
ruff check . && python manage.py check && python manage.py test

# App (once scaffolded)
cd app && npm install
npx expo start                       # dev (web/iOS/Android)
npx expo export --platform web       # static web build
eas build --platform all             # store binaries
eas submit --platform all            # push to stores
```

---

*End of plan. This document is the canonical build spec for Dervaish; the superseded planning docs and the original full design system are preserved in `Dervaish/_backup-superseded-docs/`.*