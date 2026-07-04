# Dervaish Frontend — Screens (UI/UX)

_Last updated: 2026-07-04. Screen-by-screen spec for the React frontend, grounded
in `design-system.md` (tokens, components, templates, a11y) and the flows in
`workflows.md`. Screens are grouped by surface: Shell & Account, Player/Wiki
(consume + read), Studio (contribute), Admin (curate). Each entry lists route,
purpose, role, layout template, key components, data, states, and actions._

## Conventions

- **Templates** (from `design-system.md`): Browse/list, Detail, Review queue,
  Editor form, Companion, Admin operational.
- **States** every screen must define: loading (skeleton), empty, error, and
  partial/degraded; plus a permission state where role-gated.
- **Shell:** desktop = side nav + main + optional right rail + sticky playback bar;
  mobile = top bar + bottom nav + single column + sticky media controls.
- Lyrics render with per-lane `dir`/`lang` and mixed-direction-safe CSS
  everywhere they appear.

---

## A. Shell & Account

### A1. App shell
Route: wraps all. Purpose: persistent navigation + playback. Role: all.
Layout: shell. Components: side nav (Listen, Companion, Archive, Submit,
Community, Admin — Admin/Studio items shown per role), sticky **playback bar**
(play/pause, title, reciter/writer, position/seek, active lyric caption, queue,
route-to-Companion), account menu. States: signed-out vs signed-in nav;
role-filtered items. Actions: navigate, global search, play/pause.

### A2. Sign in / sign up
Route: `/auth`. Purpose: authentication (email magic-link or social). Role:
anonymous. Layout: editor form (minimal). Components: email field, provider
buttons, role explanation. States: sent/verify, error, already signed in.
Actions: request link, sign in, continue as guest (read-only).

### A3. Account & preferences
Route: `/me`. Purpose: profile, default visible languages, saved queues, my
contributions summary, trust score. Role: listener+. Layout: detail + fieldsets.
Components: profile fields, language-lane defaults, contribution history link.
States: loading, saved confirmation, error (input preserved).

### A4. Playback & mirror settings
Route: `/me/settings`. Purpose: playback quality, and **media-mirror / source
selection** (federation). Role: listener+. Layout: editor form. Components:
streaming quality, official **mirror directory** (from `/directory/mirrors/`) with
per-mirror enable/disable + verified/unverified trust chips, add-custom-mirror by
URL, (optional) content-source list. States: loading, offline (device-local
selections), error. Actions: toggle mirrors, add mirror/source, reset to defaults.
The player fails over across enabled mirrors in priority order.

---

## B. Player / Wiki (public)

### B1. Home / Listen (browse)
Route: `/`. Purpose: discover kalam, renditions, collections, curated groups.
Role: anonymous+. Layout: browse/list. Components: search bar, **Continue
listening** shelf (from `PlaybackState`), **Your library** shelf (from
`SavedItem`), curated shelves, rendition rows (title, reciter/author, duration,
lyric-availability chip, media type, upvote), collection cards. States: loading
skeleton shelves, empty ("no published content yet"), error. Actions: play, queue,
save to library, open kalam/rendition, upvote (gated), open collection.

### B2. Search & results
Route: `/search?q=`. Purpose: search kalam, renditions, people, collections,
archive records, videos. Role: anonymous+. Layout: browse/list + filters.
Components: query box, filter bar (media type, language, person role, collection
type, verification state, visibility, tags), typed result cards (object-type
label). States: loading, no-results (with query tips), error. Actions: filter,
open result, play.

### B3. Kalam page (the work)
Route: `/kalam/<slug>`. Purpose: the poem itself — canonical text, languages,
story/context, writer credit(s), and all its renditions. Role: anonymous+.
Layout: detail. Components: header (titles native/transliterated, author link,
genre/tradition/era taxonomy chips, languages), **story/context prose** (from
Markdown), **verses** (native · transliteration · translation · **meaning**) with
per-verse **annotation** anchors, layer + language toggles, **list of renditions**
(reciter, media type, duration, "has video"), archive context, correction entry.
States: loading, partial (no renditions yet; text draft vs canonical badge), error.
Actions: open a rendition, toggle layers/languages, jump to a verse's meaning/
annotation, propose correction.

### B4. Rendition player + Companion
Route: `/rendition/<slug>`. Purpose: play a recording with synced multilingual
lyrics; or watch its video / generated lyric video. Role: anonymous+. Layout:
Companion. Components: **audio or video player**, synced lyric view (active verse
prominent, prev/next context, original + transliteration + translation stacked),
**layer toggle** (script ↔ transliteration ↔ translation ↔ **meaning**),
**language picker** (checkbox chips, roles labelled), reciter credit, kalam/archive
context rail, per-verse **meaning** + annotation popovers, correction entry,
queue/add.
States: loading, media-error (missing source / unavailable mirror / unsupported /
network — explained), lyrics-missing (link to contribute in Studio), partial
(some lanes incomplete). Actions: play/seek, toggle lanes, save language
preference, add to queue, open annotation, propose correction, share.

### B5. Person page (reciter / writer)
Route: `/person/<slug>`. Purpose: who wrote / who is reciting — bio + credited
work. Role: anonymous+. Layout: detail. Components: name, role(s), origin, **bio
prose** (Markdown), credited kalam (as writer), credited renditions (as reciter),
related archive records, disputed/unverified attribution chips. States: loading,
partial (sparse bio), error. Actions: open kalam/rendition, open archive record.

### B6. Collection page
Route: `/collection/<slug>`. Purpose: curated or user grouping of renditions.
Role: anonymous+ (owner controls for private). Layout: detail + list. Components:
title, curated/user chip, artwork, rendition list, share-token control (owner).
States: loading, empty, private-shared indicator, error. Actions: play all,
queue, manage/share (owner).

### B7. Archive record page
Route: `/archive/<slug>`. Purpose: source-critical context — provenance, citations,
ratings. Role: anonymous+. Layout: detail. Components: summary, subjects/terms,
linked kalam/renditions/people/collections, citation cards, provenance timeline,
source ratings (editorial vs community), JSON-LD/export links, editorial notes
(where public). States: loading, partial (missing citations), error. Actions:
open linked items, copy citation, export JSON-LD.

### B8. Queues
Route: `/me/queues`. Purpose: personal listening queues. Role: listener+. Layout:
list. Components: queue list, ordered items (rendition rows), remove, future
reorder handles. States: empty ("create a queue from Listen"), loading, error.
Actions: create/rename/delete queue, remove item, play.

---

## C. Studio (contribute)

### C1. Studio dashboard
Route: `/studio`. Purpose: entry to contribution — where help is needed and my
work. Role: contributor+. Layout: admin operational (light). Components:
**needs-work queue** (needs transcription / N more timings / a translation /
context), my in-progress submissions with status chips, quick "submit a source".
States: loading, empty (nothing needs work), error. Actions: pick a task, resume a
submission, start intake.

### C2. Source intake (bulk grid)
Route: `/studio/submit`. Purpose: submit sources (Stage 1). Role: contributor+.
Layout: editor form (grid). Components: **editable table** — rows of URL, title,
reciter(s), writer(s); per-row **Fetch** button + status; **Try to fetch all**;
per-row **upload fallback** (file picker → presigned upload); duplicate-flag
indicator; add/remove rows; submit. States: per-row (idle, fetching, fetched,
fetch-failed→upload, uploaded, duplicate), validation summary, saving. Actions:
add rows, fetch (one/all), upload, resolve duplicate, submit batch.

### C3. Transcription / segmentation editor
Route: `/studio/kalam/<slug>/text`. Purpose: establish canonical text + line
breaks (task 4a). Role: contributor+. Layout: editor form. Components: line list
(add/split/merge/reorder), per-line original-language text (RTL-safe), language
lane setup, validation. States: draft vs canonical badge, unsaved changes,
validation errors (empty line, order), autosave status. Actions: edit lines,
propose correction (if canonical exists), submit.

### C4. Timing editor (flagship; mobile-first)
Route: `/studio/rendition/<slug>/timing`. Purpose: time fixed lines to audio
(task 4b), redundantly. Role: contributor+. Layout: Companion-like, touch-first.
Components: **waveform** + playhead + click-to-seek, playback controls, the line
list, **tap-to-time** (tap sets in/out per line, timed against the Web Audio
clock), current-line highlight, undo, progress. States: loading (needs waveform
derivative), in-progress, submitted, error. Actions: play/seek, tap-time lines,
nudge times, undo, submit pass. Mobile: large tap target, single-column, minimal
chrome.

### C5. Translation / transliteration editor
Route: `/studio/kalam/<slug>/lang/<code>`. Purpose: add a language lane against
existing line ids (task 4c). Role: contributor+. Layout: editor form. Components:
line-by-line parallel view (original + target field), lane role/direction setup,
partial-allowed indicator. States: partial (incomplete allowed), saving, error.
Actions: fill lines, set direction/role, submit.

### C6. Wiki authoring
Route: `/studio/kalam/<slug>/context` (and person/annotation variants). Purpose:
write kalam story/context, person bios, per-line annotations (prose). Role:
contributor+. Layout: editor form + Markdown. Components: **Markdown editor** with
preview, target selector (kalam / specific line / rendition), language, citation
attach. States: draft, submitted, saving, error. Actions: write, preview, attach
citation, submit for review.

### C7. My submissions
Route: `/studio/submissions`. Purpose: track my contributions and their review
state. Role: contributor+. Layout: list. Components: submission cards (target,
type, status chip, reviewer notes), resume link. States: empty, loading, error.
Actions: resume, view feedback, withdraw.

### C8. Request a kalam / rendition
Route: `/community/request` (Studio-accessible). Purpose: request missing/improved
material. Role: listener+. Layout: editor form. Components: title, target
(existing kalam/rendition optional), reciter/writer hints, source hint. States:
submitted, error. Actions: submit request.

---

## D. Community (public participation)

### D1. Requests (needs-work)
Route: `/community/requests`. Purpose: browse/upvote `KalamRequest`s (missing/
improved material). Role: anonymous+ (vote listener+). Layout: browse/list.
Components: request cards (title/target, author/reciter hints, status Open/Planned/
Fulfilled, upvote + current-user state), sort by upvotes/recency. States: empty,
loading, error, vote-gated prompt. Actions: upvote, open, create.

### D2. Verification participation
Route: on rendition/submission surfaces. Purpose: community verify/dispute of
writer/reciter/lyrics/source/overall. Role: contributor+. Components: field-level
verify/dispute controls + note, summary chips (counts, mixed state). States:
voted, changed, gated. Actions: verify, dispute, add note.

---

## E. Admin (curate)

### E1. Admin dashboard
Route: `/admin`. Purpose: operational overview. Role: editor/admin. Layout: admin
operational. Components: queue metrics (to verify, to merge, corrections, render
jobs, publish failures), status tiles, jump links. States: loading, all-clear,
error. Actions: open a queue.

### E2. Verification queue + detail
Route: `/admin/verify`. Purpose: review submitted sources (Stage 2). Role:
editor/admin. Layout: review queue + detail drawer. Components: queue table
(submission, submitter, media attached, target, status), detail drawer with media
preview, **credit resolver** (free-text → `Person` with alias matches), duplicate
indicator, decision controls. States: loading, empty, media-not-ready, error.
Actions: accept (open-for-lyrics), reject (reason), mark duplicate, resolve
credits.

### E3. Merge & approve workspace
Route: `/admin/rendition/<slug>/merge`. Purpose: merge redundant contributions to
canonical (Stage 4). Role: editor/admin. Layout: review (comparison). Components:
**timing comparison** across passes with **median** overlay and **divergence
flags** (>~400 ms), per-line text consensus with disagreement highlights, language
combine, annotation approvals, attribution view, preview player. States: loading,
insufficient-passes, conflicts-to-resolve, error. Actions: accept median / adjust
line, resolve text, set canonical + bump version, finalize rendition, trigger
publish + render.

### E4. Correction review queue
Route: `/admin/corrections`. Purpose: review post-canonical corrections & wiki
edits. Role: editor/admin. Layout: review queue + detail. Components: correction
cards (target, fields, proposed vs current, verify/dispute summary, evidence),
apply partial/full. States: loading, empty, error. Actions: apply, reject
(auditable), request changes, re-publish.

### E5. Media library & asset detail
Route: `/admin/media`. Purpose: manage assets, encodings, derivatives, mirrors.
Role: editor/admin. Layout: admin operational + detail. Components: asset table
(kind, status, checksum, size, duration), detail (encodings, waveform/thumbnail,
processing jobs + logs, mirrors: primary vs mirror, resolved playback URL,
availability, last-checked). States: processing, failed-job, missing-mirror,
error. Actions: reprocess, add mirror, mark mirror unavailable.

### E6. Video generation jobs
Route: `/admin/renders`. Purpose: queue/monitor lyric-video renders (Stage 5).
Role: editor/admin. Layout: admin operational + detail. Components: job table
(rendition, source mode audio/overlay, resolution, languages, **status**, progress
as state not fake %), detail (logs, failure reason, **preview asset**, output
asset). States: queued/running/completed/failed/cancelled, worker-offline notice.
Actions: create job (layout, resolution, languages), cancel, approve preview,
publish output to rendition.

### E7. People & credits
Route: `/admin/people`. Purpose: manage `Person` records, merge duplicates,
attach credits. Role: editor/admin. Layout: browse/list + editor. Components:
person table (name, aliases, roles), merge tool, unified `Credit` editor (author on
kalam; reciter/voice on rendition). States: loading, duplicate-candidates, error.
Actions:
create/edit/merge, resolve aliases, edit bio.

### E8. Publish log / content repo
Route: `/admin/publish`. Purpose: monitor DB→Git Markdown publishing. Role:
editor/admin. Layout: admin operational. Components: `PublishedFile` table
(entity, repo_path, status pending/committed/failed, commit_sha, content_hash),
re-publish control. States: pending, committed, **failed** (surfaced), error.
Actions: retry publish, view diff/commit.

### E9. Audit log
Route: `/admin/audit`. Purpose: accountability trail. Role: admin. Layout: admin
operational (table). Components: audit rows (actor, action, target, before/after,
time), filters (actor/action/target). States: loading, empty, error. Actions:
filter, inspect entry.

### E10. Users & roles
Route: `/admin/users`. Purpose: manage accounts, roles, trust, tokens. Role:
admin. Layout: admin operational. Components: user table (role, trust score,
status), role editor, token management. States: loading, error, confirm on
role/destructive change. Actions: change role, adjust trust, revoke token.

---

## F. Global states & patterns

- **Loading:** skeletons for predictable lists; spinners only for short blocking
  actions; preserve layout dimensions.
- **Empty:** state what's missing, why, and the next best action (e.g. "No lyrics
  yet — start timing in Studio").
- **Error:** name the failed operation; always preserve user input.
- **Partial/degraded:** kalam with no rendition, media with no lyrics, incomplete
  translation, missing citations, unavailable mirror, failed render — visible but
  non-blocking for unrelated actions.
- **Roles:** gate via visible affordance changes + explicit permission prompts,
  never silent failures.
- **Mobile:** prioritize listening card, active lyric + translation, quick
  language toggle, queue, context preview, and the **timing** task; keep authoring
  and merge desktop-optimized (read-only-friendly on mobile).
