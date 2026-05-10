# Dervaish Greenfield Refactor Plan

## 1. Executive recommendation

Dervaish should be rebuilt as a greenfield, Dervaish-first platform rather than directly integrating MediaCMS and Omeka S.

The direct-integration path would inherit two large products with different assumptions: MediaCMS is a general media-publishing system, and Omeka S is a cultural-heritage CMS with PHP/Zend-era architecture. Dervaish needs a narrower but deeper product: devotional listening, provenance, multilingual synchronized lyrics, correction workflows, and generated lyric-video publishing. A greenfield build lets those concerns become first-class models instead of plugins or sidecar tables.

Use MediaCMS and Omeka S as reference implementations only. Preserve their useful architectural concepts, workflow patterns, and data-model lessons, but do not mechanically merge repositories or copy large implementation blocks. This avoids product incoherence, unnecessary stack mixing, and license risk.

Greenfield is the better choice under these conditions:

- Dervaish remains a focused preservation and listening platform, not a generic CMS.
- The team accepts a phased rebuild rather than a one-shot migration.
- MediaCMS and Omeka S are treated as research references, not vendored foundations.
- The first production version can launch with minimal fresh seed fixtures and later add importers.

A direct MediaCMS or Omeka S integration would only be preferable if Dervaish needed to ship immediately on top of an existing deployed instance, or if the primary product requirement became generic media hosting or generic cultural-heritage site building rather than devotional media preservation.

## 2. Source repository assessment

### Dervaish

Useful concepts to preserve:

- Collections, people, reciter/writer credits, queues, track upvotes, track requests, submission verification, correction drafts, lyric language direction, media mirrors, offline packages, and video generation jobs.
- Shared domain vocabulary around `Track`, `Collection`, `Person`, `LyricSet`, `LyricLanguage`, `LyricSegment`, `Submission`, and `VideoGenerationJob`.
- The design-system direction: calm dark UI, listening-first workflows, visible trust signals, dense operational screens, and RTL/LTR lyric support.

Useful code patterns to study:

- Current Fastify endpoints as a rough API inventory.
- Zod schemas as early validation intent.
- Playback helpers for active lyric segment detection and language direction handling.
- Python video worker payload shape and its support for multiple visible lyric languages.

Parts not worth copying:

- Demo-data-first storage, in-memory fallbacks, and partial PostgreSQL persistence.
- Header-based role simulation.
- Single large React app component with many workflow branches.
- Prototype API contracts that expose whole catalog snapshots where paginated resources are needed.

Licensing considerations:

- The current Dervaish code can be reused if it is owned by the project, but the rebuild should still avoid carrying over prototype constraints.

Architectural risks:

- The existing TypeScript prototype already mixes production concepts with demo shortcuts.
- Keeping it as the foundation would require replacing most persistence, auth, background jobs, uploads, and admin workflows anyway.
- Shared package types are useful for vocabulary, but not sufficient as production domain boundaries.

### MediaCMS

Useful concepts to preserve:

- Upload lifecycle, media-file state transitions, encoding profiles, renditions, thumbnails, subtitles, chapters, permissions, publishing states, and background-task orchestration.
- Separation between original uploaded media, derived encodings, and player-facing URLs.
- Operational patterns for FFmpeg processing, retryable Celery jobs, and admin visibility into media status.

Useful code patterns to study:

- Celery task decomposition for chunking, encoding, cleanup, and notification.
- Media metadata extraction before processing.
- Encoding profiles and resolution-aware rendition selection.
- User and RBAC patterns for media actions.

Parts not worth copying:

- Generic video-platform product surface.
- Broad social/media features unrelated to devotional archival workflows.
- Large Django app layout as-is.
- Any implementation copied directly from AGPL-licensed files.

Licensing considerations:

- MediaCMS is AGPL-3.0. Do not copy implementation code unless Dervaish intentionally accepts AGPL obligations for the resulting network service.
- Safe use: read for architecture and behavior, then write new implementation from Dervaish requirements.

Architectural risks:

- MediaCMS optimizes for general media hosting, not source-critical archival metadata or multilingual lyrics.
- Its processing pipeline is valuable, but its product model would need heavy adaptation.

### Omeka S

Useful concepts to preserve:

- Item and item-set concepts, resource/value metadata model, vocabularies, resource classes, linked resources, public site/exhibit structure, JSON-LD output, and admin metadata workflows.
- Distinction between structured archival values, display resources, and public publication contexts.

Useful code patterns to study:

- Resource/value API representations.
- Vocabulary and property modeling.
- Item-set grouping.
- Public site pages for archive browsing.
- JSON-LD-style export and linked-data thinking.

Parts not worth copying:

- PHP framework architecture.
- Generic module system and theme system.
- Full Omeka admin UI model.
- Generic cultural-heritage abstractions where Dervaish needs devotional media-specific fields.

Licensing considerations:

- Omeka S is GPL-3.0. Do not copy implementation code into a non-GPL project.
- Use as conceptual reference for metadata modeling and public archive publishing.

Architectural risks:

- Omeka-like metadata can become too abstract for editors if every field is modeled as a generic value.
- Dervaish should support vocabularies and JSON-LD without making routine catalog editing feel like ontology management.

## 3. Target stack recommendation

Use one coherent production stack:

- Backend: Django, Django REST Framework, PostgreSQL, Celery, Redis, S3-compatible object storage, FFmpeg, and Django admin.
- Frontend: React with Vite or Next.js, using a Dervaish-specific component system guided by `docs/design-system.md`.
- Worker: Celery tasks for ingestion, transcoding, waveform generation, thumbnailing, caption processing, import jobs, and lyric-video rendering.
- Storage: S3-compatible buckets for originals, renditions, captions, thumbnails, waveform data, generated videos, and import packages.
- Search: PostgreSQL full-text search for v1, with a later OpenSearch/Meilisearch option if catalog scale requires it.

Django/DRF/Celery is recommended over the current TypeScript/Fastify approach because Dervaish's hardest production problems are media ingestion, durable workflow state, admin/editor operations, background processing, and data integrity. Django gives mature ORM modeling, migrations, permissions, admin workflows, and Celery integration. MediaCMS also demonstrates that Django/Celery is a proven shape for FFmpeg-backed media pipelines.

The existing TypeScript/Fastify stack is useful as a prototype and API sketch, but hardening it would require building or selecting equivalents for many things Django already provides: admin, permissions, durable workflow modeling, object-level review states, background-job conventions, and migration discipline.

Do not mix PHP and Python in the production application. Omeka S should inform archive modeling; it should not become a runtime dependency.

## 4. Target module architecture

Create the backend as a Django project with focused apps:

- `accounts`: users, roles, permissions, contributor trust, API tokens, anonymous session policy, and audit identity.
- `media`: uploads, assets, renditions, storage libraries, mirrors, captions, chapters, thumbnails, waveforms, previews, and playback URL signing.
- `catalog`: tracks, collections, people, credits, visibility, publication states, queue-facing catalog APIs, and search indexing.
- `archive`: archive records, citations, provenance records, source ratings, vocabulary terms, resource classes, item-set-like grouping, and JSON-LD export.
- `lyrics`: lyric sets, languages, synchronized segments, imports, exports, editor drafts, validation, and direction-aware rendering metadata.
- `community`: submissions, correction drafts, verification votes, disputes, track requests, upvotes, contributor notes, and moderation workflow.
- `video_generation`: lyric-video job definitions, render layouts, source selection, worker payloads, job logs, previews, output assets, cancellation, and publishing.
- `public`: public API serializers, public archive/listening pages, SEO metadata, share links, and public JSON/JSON-LD endpoints.
- `admin`: Django admin customizations, review queues, operational dashboards, moderation actions, and preservation controls.

The React web app should be organized by product workflows rather than backend app names:

- Listen
- Companion
- Archive
- Submit
- Community
- Admin & Preservation

## 5. Canonical data model

Core account entities:

- `User`: authenticated account with display name, email, active status, role, trust score, and timestamps.
- `Role`: normalized role or permission group for anonymous, listener, contributor, editor, and admin capabilities.

Catalog entities:

- `Person`: devotional contributor profile with names, aliases, biography, origin, external identifiers, and archival links.
- `Track`: canonical devotional work or recording entry with title, slug, duration, primary language, visibility, publication state, and archive links.
- `Collection`: curated or user-owned grouping of tracks with visibility, owner, artwork, ordering, and optional share token.
- `TrackCredit`: typed relationship between a track and person, such as reciter, writer, translator, source contributor, or editor.

Media entities:

- `MediaAsset`: original uploaded or imported media object with kind, storage key, checksum, MIME type, size, duration, source URL, and provenance.
- `MediaRendition`: derived playable asset with format, bitrate, resolution, codec, storage key, processing status, and relationship to the master asset.
- `Caption`: caption/subtitle file linked to an asset or track with language, format, source, status, and storage key.
- `Chapter`: timed section marker for a track or media asset with start/end time, title, language, and optional notes.

Archive entities:

- `ArchiveRecord`: source-critical record linked to tracks, people, and collections with summary, visibility, editorial notes, and publication state.
- `Citation`: bibliographic, web, manuscript, interview, or field-recording reference with URL, date, author, and note.
- `ProvenanceRecord`: import, custody, checksum, source, acquisition, and transformation event for archive and media objects.
- `SourceRating`: editorial or community assessment of source quality with score, rationale, contributor, and timestamp.
- `VocabularyTerm`: controlled vocabulary term for resource classes, properties, genres, places, languages, source types, and devotional categories.

Lyrics entities:

- `LyricSet`: canonical or draft lyric document linked to a track, submission, or correction draft.
- `LyricLanguage`: language lane within a lyric set with code, label, role, direction, publication status, and display order.
- `LyricSegment`: timed segment with start/end milliseconds and per-language text values.

Community entities:

- `Submission`: contributor-submitted track, media, source, lyric, or metadata proposal with draft and review states.
- `CorrectionDraft`: proposed correction against an existing published track, lyric set, archive record, credit, citation, or media asset.
- `VerificationVote`: field-level verification or dispute vote with note, voter, target field, and replacement behavior per voter/field.
- `TrackRequest`: request for missing or improved material with optional target track, reciter/writer names, source hints, and status.
- `TrackRequestVote`: one user upvote per request.

Video generation entities:

- `VideoGenerationJob`: render request with source asset, source mode, layout, resolution, visible lyric languages, status, logs, preview, output asset, and failure reason.

All public models should include timestamps. Reviewable models should include created-by, updated-by, reviewed-by, state, and audit-log coverage.

## 6. Media pipeline design

Upload flow:

- Contributor, editor, or admin requests an upload session.
- API creates a `MediaAsset` in pending state and returns a direct S3 upload target or server-mediated upload endpoint.
- Client uploads the original file.
- Worker verifies checksum, MIME type, duration, codecs, size, and media kind.
- Worker updates asset metadata and queues derived processing.

Storage model:

- Originals are immutable and stored separately from derived renditions.
- Renditions are replaceable and linked back to the master asset.
- Captions, chapters, thumbnails, waveforms, and generated video outputs are separate storage objects.
- Storage keys should include environment, object type, object id, and version.

Transcoding:

- Audio: generate normalized playback formats such as Opus and AAC/MP3, preserving original lossless masters when available.
- Video: generate web MP4 and adaptive HLS renditions as needed.
- Images: generate thumbnails and responsive sizes.
- Every processing step writes durable status, logs, retry count, and failure reason.

Thumbnailing and waveform generation:

- Audio tracks get waveform JSON or binary peaks and optional cover/visual preview.
- Videos get poster frames and timeline thumbnails.
- Generated lyric videos get preview frames before publication.

Captions and chapters:

- Accept WebVTT as the preferred interchange format for v1.
- Store captions as normalized database metadata plus the original uploaded file.
- Chapters are first-class timed records and can be exported to WebVTT chapters.

Playback URLs:

- Public assets use cacheable URLs where allowed.
- Private or pending assets use signed URLs.
- API returns a playback manifest with preferred rendition, fallback mirrors, captions, chapters, and lyric-set metadata.

Generated media publishing:

- Video jobs create preview assets first.
- Editors approve generated outputs before they become public track media.
- Generated media retains provenance linking job settings, source asset, lyric set version, layout, and output checksum.

## 7. Archive metadata design

Dervaish should implement Omeka-like archival depth without exposing a generic Omeka clone.

Archive records:

- Archive records are Dervaish-specific resources that can link to tracks, people, collections, media assets, citations, and provenance events.
- They should support visibility states: draft, pending review, public, unlisted, and archived.
- Public pages show summary, source quality, citations, provenance, linked tracks, linked people, and export links.

Vocabularies and values:

- Use `VocabularyTerm` for controlled lists and linked-data terms.
- Keep common devotional/catalog fields as explicit columns for editor usability.
- Use flexible metadata values only for extended archival properties that vary by source or tradition.

Item sets:

- Model item-set-like grouping through collections and archive groupings rather than importing Omeka's full site-builder abstraction.
- Public archive pages can expose curated record groups, people pages, and collection context.

Citations and provenance:

- Citations must be reusable and linkable.
- Provenance records should capture source name, source URL, acquisition date, checksum, imported-by user, transformation event, and notes.
- Source ratings should distinguish editorial ratings from community trust signals.

JSON-LD export:

- Provide JSON-LD for public tracks, people, archive records, collections, citations, and media assets.
- Map Dervaish terms to common vocabularies where practical, while preserving Dervaish-specific terms under a project namespace.

## 8. Lyrics design

Lyric sets:

- A track can have one published canonical lyric set and multiple draft or historical lyric sets.
- A submission or correction draft can own a draft lyric set before publication.
- Lyric sets are versioned so corrections and generated videos can reference the exact text used.

Languages:

- Each lyric language has `code`, `name`, `role`, `direction`, `display_order`, and `is_published`.
- Roles include original, translation, transliteration, commentary, and phonetic helper if needed later.
- Direction is authoritative for UI rendering, export, and video overlays.

Segments:

- Segments store start/end milliseconds and text per language.
- Segments must not overlap within a lyric set.
- Missing text in one language should be allowed so translations can be incomplete without blocking original lyrics.

Import and export:

- Import WebVTT, LRC, TTML, and JSON.
- Export WebVTT, LRC, TTML, and Dervaish JSON.
- WebVTT is the preferred v1 editor and interoperability format.

Editor workflow:

- Contributors can draft lyrics during submission.
- Editors can align timings, add languages, mark language lanes public, request changes, and publish.
- Correction drafts can target specific segments or language lanes.
- UI must set `dir` and `lang` per lyric lane and use mixed-direction-safe rendering.

Playback:

- API returns active lyric metadata with the playback manifest.
- Client detects the active segment locally from current position.
- Users can choose visible language lanes, with preferences saved for signed-in users.

## 9. Community workflow design

Submissions:

- Contributors create draft submissions for new tracks, missing media, lyrics, translations, source information, or archive notes.
- Drafts can include media attachments, citations, lyric sets, people hints, and notes.
- Submission states: draft, submitted, under review, changes requested, approved, rejected, published.

Corrections:

- Correction drafts target published records and specify fields being corrected.
- Editors can apply accepted corrections partially or fully.
- Rejected corrections remain auditable.

Verification and disputes:

- Community members can verify or dispute field-level claims on visible submissions.
- One vote per user, target, and field; later votes replace earlier votes.
- Verification summaries show counts and dispute state without automatically publishing changes.

Track requests:

- Users can request missing tracks or improvements to existing tracks.
- Requests support upvotes, status, source hints, reciter/writer names, and moderator notes.
- Editors can mark requests open, planned, fulfilled, duplicate, or rejected.

Contributor trust:

- Trust score grows from accepted submissions, useful verification, and low dispute rate.
- Trust can influence queue ordering but should not bypass editor review in v1.

Audit log:

- Every moderation, publication, correction, media state change, and role-sensitive action creates an audit entry.
- Audit entries should include actor, target, action, before/after summary, timestamp, and request metadata.

## 10. API design

Use REST APIs with DRF serializers and pagination. Public endpoints must avoid leaking draft or private data.

Accounts:

- `POST /api/auth/session/`
- `GET /api/me/`
- `PATCH /api/me/preferences/`
- `GET /api/me/queues/`
- `POST /api/me/queues/`
- `POST /api/me/queues/{id}/items/`
- `PATCH /api/me/queues/{id}/items/reorder/`
- `DELETE /api/me/queues/{id}/items/{item_id}/`

Catalog and playback:

- `GET /api/catalog/search/`
- `GET /api/catalog/tracks/`
- `GET /api/catalog/tracks/{id}/`
- `POST /api/catalog/tracks/{id}/upvote/`
- `GET /api/catalog/tracks/{id}/playback/`
- `GET /api/catalog/collections/`
- `GET /api/catalog/collections/{id}/`
- `POST /api/catalog/collections/{id}/share-token/`
- `GET /api/catalog/people/`
- `GET /api/catalog/people/{id}/`

Archive:

- `GET /api/archive/records/`
- `GET /api/archive/records/{id}/`
- `GET /api/archive/records/{id}.jsonld`
- `GET /api/archive/citations/`
- `GET /api/archive/vocabularies/`
- `GET /api/archive/provenance/{id}/`

Lyrics:

- `GET /api/tracks/{id}/lyrics/`
- `POST /api/submissions/{id}/lyrics/languages/`
- `PUT /api/submissions/{id}/lyrics/segments/`
- `POST /api/lyrics/import/`
- `GET /api/lyrics/{id}/export/`

Submissions and community:

- `POST /api/submissions/`
- `GET /api/submissions/{id}/`
- `PATCH /api/submissions/{id}/`
- `POST /api/submissions/{id}/submit/`
- `POST /api/submissions/{id}/media/`
- `POST /api/submissions/{id}/corrections/`
- `GET /api/community/submissions/`
- `POST /api/community/submissions/{id}/verifications/`
- `GET /api/community/track-requests/`
- `POST /api/community/track-requests/`
- `POST /api/community/track-requests/{id}/upvote/`

Admin and preservation:

- `GET /api/admin/review/submissions/`
- `PATCH /api/admin/review/submissions/{id}/`
- `POST /api/admin/review/submissions/{id}/publish/`
- `GET /api/admin/media/assets/`
- `POST /api/admin/media/assets/{id}/process/`
- `GET /api/admin/media/renditions/`
- `GET /api/admin/media/mirrors/`
- `POST /api/admin/media/mirrors/`
- `GET /api/admin/audit-log/`

Video generation:

- `POST /api/video-generation/jobs/`
- `GET /api/video-generation/jobs/`
- `GET /api/video-generation/jobs/{id}/`
- `POST /api/video-generation/jobs/{id}/cancel/`
- `POST /api/video-generation/jobs/{id}/publish/`

## 11. Frontend design

Use the Dervaish design system as the binding UI contract.

Application shell:

- Desktop uses persistent side navigation, main workflow surface, optional right rail, and sticky playback bar.
- Mobile uses top app bar, bottom navigation, single-column flow, and sticky media controls.
- Primary workflows: Listen, Companion, Submit, Community, Admin.

Listen:

- Browse tracks, collections, people, and curated archive groups.
- Keep playback controls visible.
- Show reciter, writer, source quality, media state, upvote count, and collection context without hiding listening actions.

Companion:

- Center synchronized lyrics with language lane controls.
- Show archive context, credits, citations, and correction entry points near the active track.
- Use `dir`, `lang`, and mixed-direction-safe CSS per language lane.

Archive:

- Person pages show credited tracks, related archive records, citations, provenance, and source ratings.
- Archive record pages show structured metadata, linked tracks, citations, provenance timeline, JSON-LD export, and editorial notes where public.

Submit:

- Guided draft workflow with field groups for identity, source, media, lyrics, citations, and notes.
- Preserve draft state after validation failures.
- Make review status visible and recoverable.

Community:

- Track request queue with upvotes and status filters.
- Submission verification queue with field-level verify/dispute actions.
- Contributor-facing history and pending actions.

Admin & Preservation:

- Review queues for submissions, corrections, media processing, disputes, and video generation.
- Detail drawers preserve list context.
- Tables show status chips, source quality, media state, job state, and actionable controls.

Visual constraints:

- Use semantic tokens from `docs/design-system.md`.
- Keep cards for repeated objects, not nested page sections.
- Use lucide icons for repeated controls.
- Every icon-only button needs `aria-label` and `title`.
- Do not rely on color alone for status.

## 12. Migration/import strategy

Initial v1 data strategy:

- Start fresh with minimal seed fixtures.
- Seeds should include one public track, one person, one collection, one archive record, one citation, one lyric set with RTL and LTR lanes, and one media asset placeholder.
- Current Dervaish demo data may inform examples but is not mandatory to preserve.

Existing Dervaish prototype:

- Use current domain types and API routes as a behavior inventory.
- Do not migrate prototype storage tables directly.
- Later importer can map current demo JSON-like structures into Django models if needed.

MediaCMS imports:

- Build an optional importer only after the core media model is stable.
- Map MediaCMS media objects to `MediaAsset`, encodings to `MediaRendition`, subtitles to `Caption`, categories/tags to vocabulary terms, and user ownership to provenance/import metadata.
- Imported files should be copied into Dervaish-controlled object storage, not hot-linked as the canonical master.

Omeka S imports:

- Build an optional importer for items, item sets, media, values, vocabularies, and resource classes.
- Map items to archive records or catalog records depending on resource type.
- Map item sets to archive groupings or collections.
- Preserve original Omeka IDs in provenance records and external identifiers.

Import safety:

- Every import run creates an import batch record.
- Imports should be dry-runnable, resumable, and reversible where practical.
- Imported records enter draft or pending-review state unless explicitly trusted.

## 13. Phased build roadmap

Phase 1: project skeleton and core models

- Scaffold Django project, DRF, Celery, Redis, PostgreSQL, S3 settings, React app, and shared local dev compose services.
- Implement accounts, roles, audit logging, base model mixins, and minimal seed fixtures.
- Add core catalog, archive, lyrics, media, and community models.

Phase 2: media upload and playback pipeline

- Implement upload sessions, object storage integration, checksum verification, asset metadata extraction, basic audio renditions, thumbnails, and playback manifest endpoint.
- Add Celery task state and admin visibility for processing jobs.

Phase 3: catalog/archive models and admin

- Implement track, collection, person, credits, archive records, citations, provenance, source ratings, vocabulary terms, and Django admin workflows.
- Add public list/detail APIs and JSON-LD export for archive records.

Phase 4: lyrics model and player overlay

- Implement lyric sets, languages, segments, import/export, editor APIs, saved language preferences, and active-segment client behavior.
- Build direction-aware companion lyric view.

Phase 5: community submissions and verification

- Implement submissions, correction drafts, track requests, upvotes, verification votes, review states, trust scoring, and audit coverage.
- Build contributor and editor review UI.

Phase 6: video generation worker

- Port the current worker concept into Celery-managed jobs.
- Implement render payload generation, job logs, preview frames, output assets, cancellation, and publishing approval.

Phase 7: public archive/listening UI

- Build production React workflows for Listen, Companion, Archive, Submit, Community, and Admin.
- Add responsive navigation, sticky playback bar, accessible controls, and dense admin tables.

Phase 8: import/export and polish

- Add optional Dervaish prototype, MediaCMS, and Omeka S importers.
- Add export endpoints, search improvements, performance tuning, monitoring, and production hardening.

## 14. Validation plan

Backend tests:

- Model tests for required fields, visibility states, unique constraints, segment timing, votes, and publication rules.
- API tests for permissions, pagination, serialization, signed playback URLs, public/private visibility, review actions, and validation errors.
- Celery tests for media processing state transitions, retry behavior, failed jobs, cancellation, and generated output publishing.

Media tests:

- Fixture media files for audio, video, captions, bad MIME types, checksum mismatch, and unsupported codecs.
- Verify originals remain immutable and renditions link to their master asset.
- Verify waveform, thumbnail, caption, and playback manifest generation.

Lyrics tests:

- Import/export WebVTT, LRC, TTML, and JSON.
- Verify RTL/LTR metadata, active segment detection, incomplete translations, and non-overlapping segment validation.

Community tests:

- Submission lifecycle from draft to published.
- Correction draft partial acceptance.
- Verification vote replacement.
- Track request upvote uniqueness and status changes.
- Contributor trust score changes.

Frontend tests:

- Component tests for playback bar, lyric lanes, status chips, review cards, forms, and tables.
- End-to-end tests for listening, lyric companion, submission draft, verification, track request upvote, and admin publish flow.
- Accessibility checks for keyboard navigation, focus visible states, icon labels, and direction-aware lyric rendering.

Seed data:

- Keep minimal deterministic fixtures for one complete public track and one review workflow.
- Do not rely on large imported demo data for tests.

## 15. Risks and mitigations

Engineering complexity:

- Risk: media processing, archive metadata, lyrics, community, and admin workflows are too broad for one release.
- Mitigation: follow the phased roadmap and ship vertical slices with real persistence and review states.

License obligations:

- Risk: copying MediaCMS AGPL-3.0 or Omeka S GPL-3.0 code could impose unwanted obligations.
- Mitigation: use both repositories only as references unless the project explicitly accepts their license terms.

Media processing cost:

- Risk: transcoding and generated videos can consume significant CPU, storage, and queue time.
- Mitigation: use explicit encoding profiles, quotas, job priorities, retry limits, and editor approval before expensive generation.

Metadata complexity:

- Risk: Omeka-style generic values can overwhelm editors and make common workflows slow.
- Mitigation: use explicit Dervaish models for common fields and flexible vocabulary/value metadata only where it adds archival value.

Search:

- Risk: simple database search may be insufficient for multilingual text and archive discovery.
- Mitigation: start with PostgreSQL full-text and trigram search, then add a dedicated search service when data volume justifies it.

Performance:

- Risk: large catalog snapshots and nested archive serializers can become slow.
- Mitigation: use paginated APIs, selected prefetching, read-optimized serializers, CDN-backed media, and cache public archive pages.

Long-term maintainability:

- Risk: custom workflows become hard to reason about as roles and states grow.
- Mitigation: keep state machines explicit, centralize permissions, add audit logs early, and keep modules aligned with product workflows.

Frontend density:

- Risk: preservation metadata can make the interface cluttered.
- Mitigation: follow `docs/design-system.md`: progressive disclosure, stable panels, status chips with text, compact controls, and listening-first hierarchy.

## Files changed

- Created `docs/dervaish-greenfield-refactor-plan.md`.

## Recommended next implementation prompt

Use this next:

```text
Using docs/dervaish-greenfield-refactor-plan.md and docs/design-system.md, scaffold Phase 1 of the Django/DRF/Celery/PostgreSQL/S3 + React greenfield Dervaish platform. Do not copy implementation code from MediaCMS or Omeka S. Create the project skeleton, core Django apps, base models, minimal seed fixtures, and initial tests for accounts, catalog, archive, lyrics, media, community, and video_generation.
```
