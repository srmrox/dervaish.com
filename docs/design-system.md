# Dervaish Design System

## Product Principles

Dervaish is an archival listening and contribution tool. The interface should feel dense, calm, and operational rather than promotional. It prioritizes scanning, repeated playback actions, metadata review, and multilingual lyric reading.

- Keep workflows visible and predictable: Listen, Companion, Submit, Community, and Admin.
- Preserve lyric readability above decoration, especially for mixed LTR/RTL content.
- Use icons to improve recognition for repeated actions, not as ornament.
- Keep primary actions explicit with icon and text; reserve icon-only buttons for familiar compact controls.
- Every icon-only control must have `aria-label` and `title`.

## Tokens

- Color: dark shell with `--bg`, `--nav`, `--surface`, `--surface-2`, `--line`, `--text`, `--muted`, `--soft`, `--green`, `--gold`, `--blue`, and `--danger`.
- Radius: 8px for controls, panels, cards, and popovers; circular marks only for the brand mark and pill-like badges.
- Spacing: 8px baseline for compact gaps, 12-14px for forms and rows, 18-24px for panels and page sections.
- Typography: compact operational headings inside panels; large display type only for collection/workflow headers.
- Icons: `lucide-react`, 18px default, 14px in credit labels, 34px compact icon buttons, 42px regular icon buttons.
- Focus: all buttons and form controls use a visible green focus ring via `:focus-visible`.

## Components

- Buttons:
  - Primary buttons use green fill and icon+text for submit, play, create, and queue actions.
  - Secondary buttons use bordered dark fill and icon+text for reversible or contextual actions.
  - Compact buttons are used in track rows, verification grids, and media controls.
- Icon buttons:
  - Use `IconButton` only for familiar actions such as play/pause, verify/dispute, fullscreen, close, and compact row tools.
  - Required props: icon, label, and a click handler.
- Button content:
  - Use `ButtonContent` for icon+text buttons to keep spacing and alignment consistent.
- Links:
  - Text links remain text-forward for track, collection, and person names.
  - Person credit labels use Reciter/Writer icons to identify metadata roles without replacing names.
- Navigation:
  - Workflow navigation uses icon+text with active state.
  - The active workflow must remain readable without relying only on icon or color.
- Forms:
  - Inputs, selects, and textareas keep full-width 8px controls.
  - Submit buttons should be placed at the end of the form and use icon+text.
- Tabs:
  - Community tabs use icon+text and an active green state.
- Panels and cards:
  - Use cards for repeated submissions, jobs, requests, and list items.
  - Do not nest cards inside cards.
- Track rows:
  - Keep title, credits, duration, vote, and queue controls aligned.
  - Use compact icon+text buttons for upvotes and row actions.
- Credit lists:
  - Show linked names; collapse overflow with `+N more`.
  - Popovers list all linked people.
- Playback bar:
  - Uses icon-only play/pause, a range slider, native audio, linked credits, and an active caption.
  - Captions follow the selected lyric language direction.
- Video player:
  - Thumbnail video appears in collection artwork area when relevant.
  - Theater and fullscreen actions use clear media icons.
- Language picker:
  - Checkbox chips control visible lyric languages.
  - Text direction comes from each `LyricLanguage.direction`.
- Verification summary:
  - Summary chips show verify/dispute counts.
  - Field-level verify/dispute controls use compact icon buttons with labels.
- Admin media forms:
  - Library creation and mirror attachment use icon+text submit buttons.
  - Mirror source URLs can be public paths, HTTP(S), or normalized GitHub URLs depending on API validation.

## Workflows

- Listen:
  - Shows the selected track collection, track rows, personal queue controls, Collection creation, and all tracks.
  - Main actions: play, share, change visibility, submit correction, upvote, queue.
- Collection route:
  - Shows a specific Collection by URL and supports share links.
  - User-owned Collections expose visibility controls.
- Companion:
  - Two-column layout: lyrics on the left, explanations and sources on the right.
  - Users choose visible lyric languages.
  - Sources include a correction entry point.
- Submit and Correction:
  - Normal submissions create draft metadata.
  - Correction mode pre-fills current track data and uses correction field checkboxes.
  - Drafts can add sample media/lyrics and submit for review.
- Community Requests:
  - Users post freeform or existing-track requests.
  - Requests are ranked by upvotes.
- Track Votes:
  - Catalog tracks show upvote counts and current-user vote state.
- Verify Submissions:
  - Community members can verify or dispute writer, reciter, lyrics, source, and overall fields.
- Admin:
  - Admins review submissions, prepare sample assets, queue lyric video jobs, add media libraries, and attach media mirrors.
- Queues:
  - Personal queues list ordered items and allow track removal.
- People:
  - Reciter and Writer pages list related tracks.
- Playback:
  - Playback state drives active lyric captions and Companion sync position.

## Usage Rules

- Prefer icon+text for actions whose meaning changes by context: share, submit, queue, correction, visibility, create, and admin actions.
- Prefer icon-only for universal controls: play/pause, fullscreen, close, verify, dispute.
- Never use icon-only without `aria-label` and `title`.
- Do not replace proper names, track titles, or language labels with icons.
- Keep lyric text direction and alignment language-specific; surrounding row controls remain stable LTR layout.
- Empty states should tell the user what is missing and where to go next.
- Error states should preserve user input and describe the failed operation in the status surface.
- Loading states should avoid layout shifts in panels and rows.
