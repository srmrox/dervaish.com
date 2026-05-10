# Codex Prompt: Dervaish Greenfield Refactor Plan

Use this prompt in Codex when the workspace contains the existing Dervaish repository, MediaCMS, and Omeka S, and the objective is to design a new Dervaish-first application by refactoring useful concepts from MediaCMS and Omeka S.

```text
You are working in a workspace containing three codebases:
1. The existing Dervaish repository
2. MediaCMS
3. Omeka S

Goal:
Design a new greenfield Dervaish application that refactors the useful concepts from MediaCMS and Omeka S into a coherent new codebase.

Important:
Do not mechanically merge the repositories.
Do not copy large code blocks blindly.
Treat MediaCMS and Omeka S as reference implementations.
Extract architecture, model concepts, workflow patterns, and reusable implementation ideas.
The new application should be Dervaish-first.

Product vision:
Dervaish is a preservation-focused devotional media archive and listening platform. It combines:
- audio/video media hosting and playback
- archival metadata and provenance
- reciter/writer profiles
- multilingual synchronized lyrics
- translations and transliterations
- RTL/LTR lyric rendering
- community submissions
- correction drafts
- track requests and upvotes
- verification/dispute workflow
- lyric-video generation
- public archive and listening experience

Reference roles:
MediaCMS should be studied for:
- upload handling
- storage model
- transcoding workflow
- media renditions
- captions and chapters
- player integration
- permissions/RBAC
- publishing workflow
- REST API patterns
- Celery/background tasks

Omeka S should be studied for:
- item and item-set concepts
- metadata/value model
- cultural heritage publishing model
- linked-data/JSON-LD concepts
- vocabularies/resource classes
- public site/exhibit structure
- module extension patterns

Initial task:
Create a planning document only. Do not implement the new app yet.

Create:
docs/dervaish-greenfield-refactor-plan.md

The plan must include:

1. Executive recommendation
Explain whether a greenfield refactor is better than direct MediaCMS/Omeka integration and under what conditions.

2. Source repository assessment
For each repo — Dervaish, MediaCMS, Omeka S — identify:
- useful concepts to preserve
- useful code patterns to study
- parts not worth copying
- licensing considerations
- architectural risks

3. Target stack recommendation
Recommend one stack for the new application.
Prefer a coherent stack rather than mixing PHP and Python.
Evaluate Django/DRF/Celery/PostgreSQL/S3/React/Video.js versus the current TypeScript/Fastify approach.

4. Target module architecture
Propose modules/apps:
- accounts
- media
- catalog
- archive
- lyrics
- community
- video_generation
- public
- admin

5. Canonical data model
Design the core entities:
- User
- Role
- Person
- Track
- Collection
- TrackCredit
- MediaAsset
- MediaRendition
- Caption
- Chapter
- ArchiveRecord
- Citation
- ProvenanceRecord
- SourceRating
- VocabularyTerm
- LyricSet
- LyricLanguage
- LyricSegment
- Submission
- CorrectionDraft
- VerificationVote
- TrackRequest
- TrackRequestVote
- VideoGenerationJob

6. Media pipeline design
Design upload, storage, transcoding, thumbnailing, waveform/preview generation, captions, chapters, playback URLs, and generated media publishing.

7. Archive metadata design
Design how Dervaish should support Omeka-like item metadata, vocabularies, item sets, citations, provenance, JSON-LD export, and public archive pages.

8. Lyrics design
Design synchronized multilingual lyrics, translation, transliteration, RTL/LTR rendering, active segment detection, import/export for WebVTT/LRC/TTML/JSON, and editor workflow.

9. Community workflow design
Design submissions, corrections, moderation, verification/dispute workflow, track requests, upvotes, contributor trust, and audit log.

10. API design
Propose REST endpoints for all major modules.

11. Frontend design
Propose the public listening UI, companion lyric view, archive pages, submission workflow, admin/editor workflows, and player integration.

12. Migration/import strategy
Explain how to migrate:
- existing Dervaish demo data
- MediaCMS media objects, if any
- Omeka S items/media/metadata, if any

13. Phased build roadmap
Break into PR-sized phases:
Phase 1: project skeleton and core models
Phase 2: media upload and playback pipeline
Phase 3: catalog/archive models and admin
Phase 4: lyrics model and player overlay
Phase 5: community submissions and verification
Phase 6: video generation worker
Phase 7: public archive/listening UI
Phase 8: import/export and polish

14. Validation plan
Recommend test strategy, seed data, fixtures, API tests, media processing tests, and frontend tests.

15. Risks and mitigations
Include engineering complexity, license obligations, media processing cost, metadata complexity, search, performance, and long-term maintainability.

Deliverable:
Only create docs/dervaish-greenfield-refactor-plan.md.
At the end, summarize files changed and recommend the next implementation prompt.
```
