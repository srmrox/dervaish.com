# Dervaish Design System

## Purpose

This document defines the product, interaction, content, and interface standards for Dervaish. It covers the current Dervaish application modules and should be used when designing or implementing web, mobile, API-driven admin, archive, lyrics, community, media, and video-generation features.

Dervaish is a preservation-focused devotional media archive and listening platform. The interface must support deep listening, archival context, multilingual lyrics, public discovery, community contribution, editorial review, and long-term media preservation. It should feel calm, trustworthy, precise, and operational rather than promotional.

## Product Principles

1. Preservation first. The UI must make provenance, source quality, citations, attribution, and archive context visible without interrupting listening.
2. Listening stays central. Playback, lyrics, credits, and context should remain easy to reach from every primary workflow.
3. Multilingual by default. Original text, translation, transliteration, and RTL/LTR scripts must be first-class interface concerns, not later add-ons.
4. Community contribution needs structure. Submissions, corrections, requests, verifications, and disputes must be guided, reversible where appropriate, and auditable.
5. Dense does not mean cluttered. Dervaish screens carry more metadata than a typical media app, so hierarchy, spacing, grouping, and progressive disclosure are mandatory.
6. Trust is visible. Users should be able to distinguish curated records, community-submitted material, unverified data, disputed fields, and published archive content.
7. Roles should be clear. Anonymous, listener, contributor, editor, and admin states must change available actions visibly but consistently.
8. The product must work across media states. Audio-only, video, imported media, generated video, missing media, mirrored media, and offline packages all need clear patterns.

## Information Architecture

Dervaish has the following top-level product areas:

- Listen: browse, play, queue, upvote, save, share, and create personal or curated collections.
- Companion: synchronized lyric reading, translation/transliteration display, archive context, credits, and correction entry points.
- Archive: people, credits, archive records, citations, provenance, source ratings, and collection context.
- Submit: draft submissions, correction drafts, media attachment, lyric setup, timed segments, and review submission.
- Community: track requests, request upvotes, catalog upvotes, verification/dispute activity, contributor participation, and shared knowledge building.
- Admin & Preservation: moderation, media libraries, media mirrors, review/approve/publish, video generation, source integrity checks, and operational controls.
- Queues: personal listening queues, ordered items, removal, and future reorder behavior.
- People: reciter/writer profile pages, related tracks, related archive records, and role-specific credits.
- Generated Media: lyric-video jobs, preview assets, output assets, job logs, and publishing states.

Every feature should map to one of these areas. If a feature does not fit, define the information architecture change before implementing it.

## Design Language

Dervaish should combine three visual qualities:

- Archive credibility: structured metadata, restrained colors, stable layout, and clear source references.
- Listening warmth: artwork, media controls, lyric focus, and comfortable reading surfaces.
- Operational clarity: compact controls, status chips, review queues, and admin workflows.

Avoid generic entertainment-app styling that hides source information behind glossy artwork. Avoid heavy institutional design that makes playback feel secondary.

## Design Tokens

### Color

Use semantic tokens rather than hard-coded colors in components.

- `--bg`: app background; dark, calm, low-glare.
- `--nav`: side navigation and persistent shell background.
- `--surface`: primary card/panel surface.
- `--surface-2`: nested or elevated surface where nesting is unavoidable.
- `--surface-3`: hover, selected rows, and denser metadata sections.
- `--line`: borders, dividers, table rules, inactive control outlines.
- `--text`: main text.
- `--muted`: secondary text, helper text, timestamps, metadata labels.
- `--soft`: subdued text and disabled affordances.
- `--green`: primary action, active state, play state, successful verification.
- `--green-soft`: subtle selected background and low-emphasis positive state.
- `--gold`: archive, provenance, citation, curation, and preservation emphasis.
- `--blue`: informational state, links to external sources, API/sync states.
- `--danger`: destructive, dispute, rejection, unavailable media, failed job.
- `--warning`: pending review, missing metadata, incomplete submission, queued job.
- `--success`: approved, verified, published, completed job.

Do not use color alone to communicate status. Pair status color with text, icon, or both.

### Typography

- Use compact, readable sans-serif typography for application UI.
- Use large display type sparingly for collection, track, and archive page headers.
- Body text for lyrics and long-form archive notes must use comfortable line height.
- Metadata labels should be small but legible; avoid all-caps paragraphs.
- Do not compress Arabic, Persian, Urdu, Sindhi, or other RTL scripts. Increase line height for lyric blocks where needed.
- Use numeric tabular alignment for durations, counts, job progress, and queue positions.

### Spacing

Use an 8px baseline.

- 4px: icon-to-label gaps, dense metadata separators.
- 8px: compact row gaps, chips, buttons, field stacks.
- 12px: form groups, list item internal spacing.
- 16px: card padding on compact screens.
- 20-24px: section spacing, desktop panel padding.
- 32px+: major page breaks or hero/route headers.

Do not rely on whitespace alone for data grouping in dense admin screens; use labels, dividers, or panel headings.

### Shape and Radius

- 8px: default controls, inputs, cards, panels, popovers.
- 12px: prominent media cards and route-level panels.
- 999px: pills, badges, segmented controls, compact role/status indicators.
- Full circle: brand mark, avatars, and icon-only circular media controls.

### Elevation

Use shadow sparingly. Prefer borders and contrast for structure. Use elevation for popovers, modals, player overlays, and active command surfaces.

### Icons

- Icon library: `lucide-react` unless a platform-specific icon system is adopted.
- Default icon size: 18px.
- Compact icon size: 14-16px in labels, metadata, and chips.
- Icon-only controls: 34-42px touch target depending on density.
- Use icons to improve recognition for repeated actions, not as ornament.
- Do not replace proper names, track titles, language labels, citations, or source names with icons.

## Accessibility Standards

Dervaish must meet modern accessible UI expectations.

- Every icon-only control must include `aria-label` and `title`.
- Active navigation must not rely on color alone.
- All interactive controls must support keyboard focus using `:focus-visible`.
- Focus rings should be visible, high contrast, and consistent.
- Minimum touch target: 44px for mobile and frequently used media controls; 34px minimum for dense desktop-only controls.
- Use semantic buttons for actions and links for navigation.
- Long tables or grids must preserve keyboard navigation order.
- Lyrics must expose `dir` and `lang` attributes based on language metadata.
- Mixed-direction lyric blocks should use `unicode-bidi: plaintext` or an equivalent approach to prevent punctuation and inline text errors.
- Form validation must identify fields, explain the issue, and preserve entered data.
- Motion and animated transitions must be short and nonessential. Respect reduced-motion preferences for lyric transitions and video overlays.

## Layout System

### App Shell

The standard desktop app shell has:

- persistent side navigation for primary workflows;
- main content region for workflow-specific surfaces;
- optional right rail for context, archive notes, queue, or job details;
- persistent or sticky playback bar where applicable.

The standard mobile shell has:

- top app bar with product identity and active context;
- bottom navigation or compact segmented navigation for primary workflows;
- media controls reachable without scrolling through long metadata;
- progressive disclosure for archive and admin detail.

### Page Templates

Use these templates consistently:

- Browse/list page: page title, filters/search, primary list/grid, empty state, optional right context.
- Detail page: hero/header, media or artwork, primary metadata, tabs/sections, related records, actions.
- Review queue: status summary, filter bar, sortable cards/table, inline decision controls, detail drawer.
- Editor form: title, status, grouped fieldsets, validation summary, sticky save/submit actions.
- Companion view: media context, active lyrics, language controls, archive context, correction entry point.
- Admin operational page: metrics/status, table or queue, detail drawer, batch and individual actions.

### Responsive Behavior

- Desktop: two- or three-column layouts are allowed when the user is comparing media, lyrics, and metadata.
- Tablet: collapse right rail below the main panel; keep playback controls sticky.
- Mobile: use single-column flow; replace dense tables with cards; place destructive/admin actions behind explicit menus or confirmation steps.
- Lyric reading must remain comfortable before secondary metadata is shown.

## Navigation

Primary workflow navigation uses icon+text labels:

- Listen
- Companion
- Submit
- Community
- Admin

Rules:

- Keep workflow labels stable across roles. Hide or disable unavailable workflows only where necessary.
- Anonymous users can view public listening/archive content and create anonymous sessions where supported, but contribution actions must clearly explain sign-in or role requirements.
- Editors/admins see additional review and preservation actions, but the base listening interface should remain unchanged.
- Deep routes must be shareable for collections, people, queues, archive records, tracks, and generated media where access allows.

## Components

### Buttons

Use clear hierarchy:

- Primary: play, create, submit, publish, save, queue, approve.
- Secondary: share, edit, change visibility, add mirror, add language, attach media.
- Tertiary/ghost: cancel, close, back, view details, copy link.
- Destructive: delete, reject, remove, cancel job, mark unavailable.

Rules:

- Use icon+text for actions whose meaning changes by context.
- Use icon-only controls only for universal, repeated controls such as play/pause, fullscreen, close, verify, dispute, and row tools.
- Place primary actions at the end of forms or in the page/action header.
- Use confirmation for destructive actions affecting published records, media assets, submissions, queues, mirrors, or generated outputs.

### Links

- Track, collection, person, archive record, citation, and source names should be text-forward links.
- External links need an external-link icon or text cue when they leave Dervaish.
- Source URLs should be shortened visually but copyable in full.

### Cards and Panels

Use cards for repeated content: tracks, collections, submissions, requests, people, generated jobs, and archive records.

- Do not nest cards inside cards unless the nested card is a clearly different object type.
- Use panel headers with action areas for review/admin views.
- Cards should show status, ownership/role, and key metadata without requiring hover.
- Hover-only controls are not acceptable for critical actions.

### Tables and Data Grids

Use tables for admin/review lists with many comparable rows.

- Keep first column identifiable and sticky where useful.
- Use status chips rather than only color-coded text.
- Use compact row actions but include accessible labels.
- Long metadata values should truncate with tooltip or detail drawer, not break table layout.
- Filters should be explicit and resettable.

### Forms

- Group fields by meaning: identity, media, source, lyrics, moderation, visibility.
- Required fields must be obvious before submission.
- Use helper text for archive/source fields where the expected evidence standard is not obvious.
- Use inline validation and a summary for multi-section forms.
- Preserve form state after failed API calls.
- For draft workflows, autosave may be used only when status is visible and recoverable.

### Chips and Badges

Use chips for compact state and metadata:

- role: Anonymous, Listener, Contributor, Editor, Admin;
- visibility: Public, Private, Unlisted, Pending Review;
- curation: Curated, User Collection, Community Submitted;
- verification: Verified, Disputed, Needs Review, Mixed;
- media: Audio, Video, Image, Mirror, Generated, Offline;
- job: Queued, Running, Completed, Failed, Cancelled.

Badges must contain text. Do not rely on icon or color only.

### Popovers, Drawers, and Modals

- Use popovers for compact metadata expansion such as full credit lists.
- Use drawers for review/detail panels while preserving list context.
- Use modals only for blocking decisions, destructive confirmations, or focused creation workflows.
- Modals must have clear title, close control, focus trap, and Escape behavior.

## Media and Playback

### Playback Bar

The playback bar should include:

- play/pause;
- track title;
- reciter/writer credits where space allows;
- duration and current position;
- seek slider;
- active lyric caption;
- queue/add action;
- volume or mute where applicable;
- route to Companion view.

Rules:

- Playback controls should remain stable during track changes.
- The active lyric caption must follow selected language direction.
- Long track names and people names must truncate predictably.
- Media errors must explain whether the issue is missing source, unavailable mirror, unsupported format, or network failure.

### Audio Player

- Prioritize low-latency start and reliable seeking.
- Show waveform only if it adds navigation value; do not use decorative waveforms.
- Include fallback media mirror information when primary playback is unavailable.

### Video Player

- Use clear actions for theater, fullscreen, captions, language, and generated-video context.
- Thumbnail video can appear in collection artwork areas when relevant.
- Avoid obscuring subtitles/lyrics with controls; controls should fade only when keyboard and accessibility behavior remain correct.

### Offline Packages

Offline state should show:

- package target: track, collection, queue, archive bundle, generated video;
- estimated size;
- pinned/smart-cache reason;
- last synced timestamp;
- available/unavailable state;
- storage budget impact.

Do not present offline availability as guaranteed unless the asset is actually cached.

### Media Mirrors and Libraries

Media library and mirror screens must distinguish:

- primary media asset vs mirror;
- storage, GitHub, external, or local public path;
- available vs unavailable;
- last checked state;
- source URL vs resolved playback URL;
- checksum or integrity metadata where available.

## Lyrics and Companion Experience

### Lyric Display

Lyric display is a core Dervaish pattern.

- Show active segment prominently.
- Show previous/next context without competing with the active line.
- Support original, translation, and transliteration simultaneously.
- Respect language-specific `direction` and `lang` metadata.
- Use `text-align` based on language direction, while preserving the surrounding control layout.
- Use enough line height for RTL scripts and poetry line breaks.
- Avoid animated lyric transitions that impair reading.

### Language Picker

- Use checkbox chips or segmented language controls.
- Show language name and role: Original, Translation, Transliteration.
- Allow up to the configured rendering limit for generated videos; make the limit visible.
- For saved preferences, show whether the setting is session-only or account-level.

### Timed Lyric Editing

Lyric segment editors should show:

- start and end time;
- validation for overlapping or reversed segments;
- text by language;
- segment preview;
- import/export controls for WebVTT, LRC, TTML, or JSON where implemented;
- status of each language: draft, submitted, verified, published.

### Companion Context

The Companion view should combine:

- active lyric segment;
- visible language controls;
- reciter and writer links;
- archive record summary;
- citations/source notes;
- correction entry point;
- playback position controls.

The user must never lose playback context while reading archive material.

## Archive and Provenance

Archive screens must make trust and attribution explicit.

### People

Person pages should show:

- name;
- role: reciter, writer, or both;
- origin/bio where available;
- related tracks;
- related archive records;
- credits grouped by role;
- disputed or unverified attribution states where relevant.

### Credits

Credit labels must be explicit:

- Reciter
- Writer
- Both
- Unknown
- Community Suggested
- Verified
- Disputed

Do not display a person as verified unless a verification or editorial state supports it.

### Archive Records

Archive record detail pages should include:

- title and summary;
- tags/subjects;
- visibility and curation state;
- related tracks, people, collections, and generated videos;
- citations;
- editorial notes;
- contributor notes;
- source ratings;
- revision count;
- export formats where available.

### Citations

Citation cards should show:

- title;
- source type;
- author where available;
- published date where available;
- URL where available;
- note/excerpt;
- relationship to track, lyric, credit, or archive record.

### Provenance

Provenance views should show:

- source name;
- imported date;
- original filename;
- checksum/metadata snapshot where available;
- media chain: master, playback rendition, mirror, generated output;
- contributor or editorial source;
- confidence/trust indicator.

## Collections and Catalog

### Collections

Collections can be curated or user-created.

Collection cards should show:

- title;
- curated/user state;
- visibility;
- artwork or representative media;
- track count;
- year where available;
- owner or role context where appropriate;
- share state for private/unlisted links.

User-owned private collections should expose share-token controls only to the owner.

### Track Rows

Track rows should show:

- title;
- reciter/writer credits;
- duration;
- language or lyric availability;
- media type and mirror state where relevant;
- upvote count and current-user state;
- queue/add action;
- correction entry point where role allows.

Keep row actions aligned. Do not make the user scan across inconsistent action placement.

### Search and Filtering

Search should support tracks, people, collections, archive records, and videos. Filters should include:

- media type;
- language;
- person role;
- collection type;
- verification state;
- visibility;
- archive tags;
- contributor/editor status where relevant.

Search result cards must identify object type clearly.

## Submission and Correction Workflows

### Draft Creation

Submission forms should separate:

- identity: title, voice/reciter, writer;
- source: source name, citation, notes;
- media: audio, video, image, supporting file;
- lyrics: languages, timed segments;
- correction: target track and correction fields;
- visibility/review state.

### Correction Drafts

Correction mode should:

- show the target track prominently;
- prefill known metadata where possible;
- ask which fields are being corrected;
- distinguish proposed changes from current published values;
- allow evidence/citation attachment;
- preserve a clear path back to the original track.

### Submission Status

Use clear status chips:

- Draft
- Submitted
- Under Review
- Changes Requested
- Approved
- Rejected
- Published

Each status should have a short explanation and next action.

## Community

### Track Requests

Track request cards should show:

- request title or linked track;
- reciter/writer suggestions where provided;
- requester role or anonymized identity as appropriate;
- notes;
- status: Open, Planned, Fulfilled, Rejected;
- upvote count;
- current-user vote state.

Rank requests by upvotes and recency where no editorial order is applied.

### Upvotes

Upvotes are lightweight signals, not verification.

- Do not style upvotes as proof of accuracy.
- Show current-user state distinctly.
- Explain sign-in or role restrictions when anonymous users attempt to vote.

### Verification and Disputes

Field-level verification must be explicit for:

- writer;
- reciter;
- lyrics;
- source;
- overall.

Verification controls should show both vote direction and field label. Summary chips must show verify/dispute counts and mixed states. Disputes should invite notes/evidence where supported.

### Contributor Trust

Where contributor reputation is introduced, display it as a contextual signal rather than a replacement for evidence.

## Admin and Preservation

Admin screens must be operational, auditable, and safe.

### Review Queues

Review queue cards/tables should show:

- submission or correction title;
- submitter;
- status;
- target track where applicable;
- media attached;
- lyric language count;
- verification summary;
- pending fields;
- primary decision actions.

### Moderation Actions

Moderation actions must be explicit:

- Start review
- Request changes
- Approve
- Reject
- Publish
- Cancel job
- Mark mirror unavailable

Risky actions require confirmation and should capture a note where auditability is needed.

### Media Library and Mirrors

Admin media forms should include:

- library title;
- kind: storage, GitHub, external;
- base URL;
- primary flag;
- mirror source URL;
- resolved playback URL preview;
- availability state;
- last checked timestamp;
- checksum field where available.

### Video Generation Jobs

Job cards should show:

- job ID;
- source track or submission;
- source mode: audio visualizer or video overlay;
- resolution;
- selected languages;
- status;
- progress;
- output assets;
- preview asset;
- logs;
- failure reason.

Progress should not fake precision. If only queued/running/completed is known, show state rather than simulated percentages.

## Generated Video Design

Generated lyric videos must preserve lyric readability.

- Limit visible lyric languages to the supported rendering count.
- Use safe margins for subtitles and lyric blocks.
- Avoid placing lyrics over high-contrast or busy imagery without a backing panel.
- Respect RTL/LTR alignment in generated layouts.
- Include title, voice/reciter, writer, and source context where layout allows.
- Preview image should reflect representative lyric placement.

## Role-Based UI Rules

### Anonymous

Can browse public content, listen to public media, view public archive context, and see community counts. Cannot vote, verify, create requests, submit corrections, or manage collections unless anonymous submission is explicitly supported.

### Listener

Can create personal queues/collections, upvote, save preferences, and submit requests where enabled.

### Contributor

Can create submissions, correction drafts, lyric proposals, and participate in verification where policy allows.

### Editor

Can review submissions, manage archive metadata, verify fields, manage media mirrors, and publish approved content.

### Admin

Can manage libraries, roles, review policy, video jobs, system-level preservation settings, and destructive operations.

Role differences should be implemented through visible affordance changes and clear permission errors, not silent failures.

## States and Feedback

### Loading

- Use skeletons for lists/cards where layout is predictable.
- Use spinners only for short blocking actions.
- Preserve layout dimensions to avoid jumping.

### Empty States

Empty states must explain:

- what is missing;
- why it may be missing;
- the next best action.

Examples:

- No queues: create a queue from Listen.
- No lyric languages: add a language before timed segments.
- No archive records: add citations or provenance before publishing.
- No media mirrors: attach a mirror or use primary asset playback.

### Error States

Error messages should identify the failed operation:

- Could not load catalog.
- Could not save lyric preferences.
- Media URL is invalid or unsupported.
- Submission could not be verified.
- Video job failed during rendering.

Always preserve user input after errors.

### Success States

Use calm confirmations. Avoid excessive celebration. Include object names where useful: `Created queue Evening Listening` rather than `Success`.

### Partial and Degraded States

Dervaish must handle partial data gracefully:

- track with no media;
- media with no lyrics;
- lyrics without translation;
- archive record with missing citations;
- unverified credits;
- unavailable mirror;
- failed generated video job.

Partial state should be visible but not block unrelated actions.

## Content Standards

### Tone

Use clear, precise, calm language. Avoid marketing copy inside operational workflows.

Preferred terms:

- Reciter
- Writer
- Collection
- Track
- Archive record
- Citation
- Provenance
- Source
- Submission
- Correction
- Verification
- Dispute
- Generated video

Avoid ambiguous terms such as artist/author where reciter/writer is more accurate for Dervaish content.

### Labels

- Use title case for page headers and sentence case for helper text.
- Use consistent verbs: Create, Add, Save, Submit, Review, Approve, Publish, Reject, Verify, Dispute.
- Use `Public`, `Private`, and `Unlisted` consistently; do not mix with unclear terms such as hidden unless technically required.

### Dates and Times

- Durations: `4:18`, `1:02:30`.
- Timestamps in lyric editor: milliseconds or `mm:ss.mmm` depending on editor mode; do not mix within one surface.
- Audit timestamps should include date and time where sequence matters.

## Mobile Standards

Mobile should not be a reduced copy of desktop. Prioritize:

- listening card;
- active lyric and translation;
- quick language toggle;
- queue access;
- archive context preview;
- correction/request entry point;
- simple submission progress.

Admin and review workflows may be read-optimized on mobile but should not hide critical status or decision history.

## Implementation Rules

- Use reusable components for buttons, icon buttons, chips, status badges, language blocks, credit lists, track rows, verification controls, and job cards.
- Keep semantic tokens centralized.
- Do not introduce one-off colors or spacing inside workflow components.
- All icon-only controls require `aria-label` and `title`.
- Language rendering should use shared utilities for `dir`, `lang`, and alignment.
- Status labels should be derived from domain state, not duplicated as local strings in multiple components.
- API errors should flow into shared status/error surfaces.
- New modules must add empty, loading, error, and permission states before being considered complete.

## Module Coverage Checklist

Before shipping a Dervaish module, confirm it covers:

- primary user goal;
- role permissions;
- loading, empty, error, success, and partial states;
- keyboard and screen-reader behavior;
- mobile layout;
- status chips and metadata labels;
- source/provenance requirements where applicable;
- multilingual and RTL/LTR requirements where applicable;
- audit or review trail where applicable;
- destructive action confirmation where applicable.

## Current Workflow Rules

### Listen

- Shows selected collection/track context, track rows, personal queue controls, collection creation, and all tracks.
- Main actions: play, share, change visibility, submit correction, upvote, queue.
- Queue and collection actions should stay near the relevant track or collection.

### Collection Route

- Shows a specific collection by URL and supports share links.
- User-owned collections expose visibility and share controls.
- Private shared collections must clearly indicate share-token access.

### Companion

- Uses lyric-first layout with archive context nearby.
- Users choose visible lyric languages.
- Sources include a correction entry point.
- Playback position drives active lyric segment.

### Submit and Correction

- Normal submissions create draft metadata.
- Correction mode pre-fills current track data where available and uses correction field checkboxes.
- Drafts can add media, lyrics, and submit for review.

### Community Requests

- Users post freeform or existing-track requests.
- Requests are ranked by upvotes and recency unless editorial status overrides.

### Track Votes

- Catalog tracks show upvote counts and current-user vote state.
- Upvote actions must explain role restrictions.

### Verify Submissions

- Community members can verify or dispute writer, reciter, lyrics, source, and overall fields.
- Verification summaries must remain visible in review surfaces.

### Admin

- Admins review submissions, prepare sample assets, queue lyric-video jobs, add media libraries, and attach media mirrors.
- Admin actions should include status feedback and failure reasons.

### Queues

- Personal queues list ordered items and allow track removal.
- Future reorder behavior should use accessible drag handles or explicit move controls.

### People

- Reciter and writer pages list related tracks and archive records.
- Credit roles must be visually distinguishable but name-forward.

### Playback

- Playback state drives active lyric captions and Companion sync position.
- Media and lyric state must remain coherent across route changes.
