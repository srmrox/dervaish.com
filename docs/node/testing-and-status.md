# Testing & the status board

Verification is built into `docs/status.html` — a **swimlane kanban** where each migration stage is
a lane and every check is verified two ways: an **automated** call to the running Node server and a
**manual** sign-off with notes.

## How to use it

1. Open `docs/status.html` in a browser.
2. Set the **Node base URL** (default `http://localhost:8000`) and login credentials at the top.
3. **Run all automated** (or "Run stage", or a single card's "Run"). Each card shows green pass /
   red fail / gold skip with a reason.
4. For each card, record the **manual** result (Pass / Fail / N/A) and type notes.
5. **Save notes → .md** to write `manual-checks.md`.

## The board

Columns are verification states; cards flow left→right:

```
To verify  →  Automated ✓  →  Manual ✓  →  Done ✓✓
```
A card reaches **Done** only when both its automated check passes **and** its manual check is Pass.
Placement is state-driven (no drag): running an automated check or setting a manual result moves the
card. A red left-border means the automated or manual check is failing.

Lanes = Stage 1…7 (the migration steps). The stage filter chips focus a single lane.

## Automated checks (per stage)

- **Stage 1 Scaffold** — `/healthz` up; `/api/v1` reachable.
- **Stage 2 Media** — 200 + `audio/mpeg`; `Accept-Ranges: bytes`; `Range → 206`; path-traversal
  rejected; **audio.mp3 + landscape.mp4 play inline** (loads metadata, asserts duration > 0 — the
  real acceptance test; works cross-origin regardless of CORS).
- **Stage 3 Seed** — catalog non-empty; local mirror registered; "Tanam" searchable.
- **Stage 4 Reads** — pagination shape; kalam detail (verses/credits/renditions); deep `playback`
  manifest (variants + `MirrorUrl` fields); search buckets; people/collections/sources.
- **Stage 5 Auth** — login captures the token, reused for `/me`, preferences, library, queues;
  register + logout marked ⚠ (mutating, excluded from Run all).
- **Stage 6 Contribution/admin** — every route; a `401/403` counts as "route exists · gated".
- **Stage 7 Later** — OpenSubsonic `/rest/ping`; BullMQ/Postgres/deploy are manual-only cards.

## Manual checks

Every card has manual Pass/Fail/N/A + a notes field. The three infra items in Stage 7 (BullMQ,
Postgres, deploy) are **manual-only** — nothing to hit automatically. Use manual checks to confirm
things the automated call can't prove (e.g. "audio actually sounds right", "video shows on the
Companion page", "mirror picker lists the local mirror in the real UI").

## Persistence & the `.md` export

- Config, manual results, notes, and last automated results persist in the browser (localStorage).
- **Save notes → .md** writes `manual-checks.md`: in Chrome/Edge via the File System Access API
  (writes the file you pick and re-saves to it); other browsers download a copy. **Download .md**
  always downloads.
- The file is a per-stage checklist with `[x]`/`[ ]` boxes, the automated result + timestamp, the
  manual status, and your notes.

## Automated tests in the codebase (native)

The status board is manual-run. For CI, use the **built-in `node:test` runner + `node:assert`** —
no vitest/jest dependency. Unit-test the pure pieces (serializers, mirror resolver, `has_media`,
Range math) and, for integration, boot the `node:http` server against a seeded temp SQLite DB and hit
it with `fetch`. Run with `node --test` (add `--experimental-sqlite` for the integration specs).
Mapping the same assertions the board makes into `node:test` specs is the natural next step.
**TODO/refine.**
