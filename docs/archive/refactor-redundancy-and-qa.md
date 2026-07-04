# Refactor Redundancy and QA Report

Date: 2026-05-14

## Test summary

Backend validation was run against the greenfield Django platform with SQLite enabled for local test isolation.

| Check | Command | Result |
| --- | --- | --- |
| Django system checks | `DJANGO_USE_SQLITE=1 python manage.py check` | Passed, no issues |
| Migration drift check | `DJANGO_USE_SQLITE=1 python manage.py makemigrations --check --dry-run` | Passed, no model drift |
| Unit and integration tests | `DJANGO_USE_SQLITE=1 python manage.py test` | Passed, 26 tests |

Frontend validation was run against `apps/platform-web`.

| Check | Command | Result |
| --- | --- | --- |
| Dependency install | `npm install --prefix apps/platform-web --no-package-lock --ignore-scripts` | Passed |
| TypeScript check | `npm run typecheck --prefix apps/platform-web` | Passed |
| Production build | `npm run build --prefix apps/platform-web` | Passed |

The production build completed with Vite and emitted the web bundle successfully.

## Integration coverage exercised

The Django test suite currently covers the main greenfield integration surfaces created through Phase 8:

- Media/catalog interactions for tracks, assets, renditions, captions, chapters, and playback manifests.
- Archive metadata paths for records, citations, provenance, vocabularies, public listing, and JSON-LD-style export.
- Lyrics APIs and services for lyric sets, multilingual segments, import/export behavior, and user lyric preferences.
- Community workflows for submissions, correction drafts, moderation state, votes, requests, trust, and audit behavior.
- Video generation job flow for job creation, validation, status transitions, rendered outputs, and publication.
- Import/export support for dry-run imports, committed imports, search indexing, and public discovery views.

## UI/UX review

The UI review was performed as a source-level and build-level check because no browser executable was available in the environment. Chromium, Chrome, and Edge were not present, so screenshot, pixel, and interactive browser testing could not be completed here.

Observed strengths:

- The platform shell is task-oriented and dense, matching the operational preservation direction from the design system.
- Primary workflows are exposed as top-level navigation: Listen, Companion, Archive, Submit, Community, and Admin.
- The active workflow state uses `aria-current`, and navigation, playback controls, vote buttons, and lyric regions include ARIA labels.
- The companion lyric view includes `lang`, `dir`, and `unicode-bidi: plaintext` handling for RTL/LTR lyric rendering.
- Keyboard focus styles are defined for buttons, inputs, selects, textareas, and links.
- Responsive breakpoints collapse the shell, review grids, archive tables, and playback bar for narrower screens.
- The sticky playback bar keeps listening controls available while moving between archive, lyric, and contribution workflows.

Follow-up UI/UX risks:

- A browser-backed test should still verify actual rendering, overlap, sticky playback behavior, mobile layout, and focus order.
- The current platform web shell uses representative local data; live API integration remains a separate hardening step.
- The design system asks for icon-led controls where possible, but `apps/platform-web` does not yet use a shared icon library.
- The range control has an accessible label and adjacent time readout, but a browser audit should verify screen-reader output and keyboard ergonomics.
- The mobile playback bar relies on grid auto-placement for secondary actions and should be visually checked once a browser is available.

## Redundant after the refactor

The items below have been superseded by the greenfield Django and React platform direction. They should not be deleted blindly while the repository is still dirty and while parity checks are incomplete, but they are no longer production foundations.

| Area | Redundant or superseded artifact | Greenfield replacement | Recommendation |
| --- | --- | --- | --- |
| API backend | `apps/api` Fastify prototype | `apps/backend` Django/DRF backend | Archive or remove after endpoint parity is confirmed |
| Web frontend | `apps/web` prototype PWA shell | `apps/platform-web` listening and preservation shell | Archive after any remaining useful UI copy or behavior is ported |
| Mobile shell | `apps/mobile` Expo prototype | No Phase 1-8 production mobile target | Keep only if a future mobile roadmap is approved |
| Shared domain package | `packages/domain` demo types and seed data | Django models, serializers, fixtures, and API schemas | Keep temporarily as import/reference material, then remove |
| Shared validation package | `packages/validation` Zod schemas | DRF serializers and Django model validation | Remove after API clients no longer import it |
| API client package | `packages/api-client` Fastify-oriented client | Future generated or handwritten DRF client | Replace during live frontend API integration |
| Playback package | `packages/playback-core` prototype helpers | Backend playback manifests plus platform-web player state | Port any useful helper logic, then remove |
| Video worker | `workers/video-generator` standalone JSON/MoviePy flow | `apps/backend/video_generation` Celery-managed jobs | Keep renderer concepts only if needed by the Celery worker |
| Prototype migrations | `apps/api/migrations` | Django migrations under each backend app | Remove with the old Fastify backend |
| Reference repos | `ref/mediacms`, `ref/omeka-s` if present | Architecture references only | Move outside production source or keep clearly marked as reference-only |
| Root workspace scripts | Old TypeScript monorepo scripts in root package files | App-specific backend and platform-web commands | Update after deciding whether legacy apps remain in the repo |
| Old README structure | README references to Fastify, prototype apps, and shared packages | Django/DRF/Celery backend plus platform-web React shell | Rewrite before a public handoff |

## Cleanup order

1. Confirm the greenfield backend exposes every public/admin behavior still needed from the old Fastify API.
2. Connect `apps/platform-web` to the DRF API and remove static representative data.
3. Port any unique playback, lyric, or video-rendering helper logic from old packages into the greenfield apps.
4. Rewrite root README and root package scripts around the new platform.
5. Remove or archive the old prototype workspace in one explicit cleanup PR.

## Recommended next QA step

Install a browser runtime for Playwright or use a CI image with Chromium, then run a real UI smoke suite covering:

- Desktop and mobile first paint.
- Workflow navigation.
- Playback bar controls.
- RTL/LTR lyric rendering.
- Archive table responsiveness.
- Submission and admin review forms.
- Keyboard focus order and basic accessibility assertions.
