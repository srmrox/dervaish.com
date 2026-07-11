# Seeding

Two seeds, mirroring the Django management commands. Node equivalent lives in `apps/api/src/seed.ts`
(currently a placeholder) — plain `INSERT … ON CONFLICT DO UPDATE` via `node:sqlite`, no ORM. Run
after the schema is applied (`db/schema.sql` runs on boot).

## `seed_demo` (baseline catalogue)

Creates the taxonomy terms + a demo catalogue (people, kalams, verses, placeholder renditions,
collections) so the read surface has content. Port from
`archive/backend-django/catalog/management/commands/seed_demo.py`. Must at least create a **Tanam**
kalam (slug/title containing "tanam") because `seed_local_media` looks it up.

## `seed_local_media` (the real, playable sample)

Port of `archive/backend-django/catalog/management/commands/seed_local_media.py`. Turns the bundled
sample files into one clean public rendition and registers the local mirror. Steps:

1. **Read metadata** from `mediafiles/samples/tanam-farsooda/lyrics.json` → `metadata.title`
   (default "Tanam Farsooda Jaan Para") and `metadata.voice` (e.g. "Zulfikar Ali").
2. **Register the local mirror** (upsert on `slug:"local"`):
   ```
   name:"This device (local)", base_url:"/media/", kind:"local",
   is_official:false, is_active:true, is_default_enabled:true, verified:true,
   carries_all: <DERVAISH_LOCAL_MODE>, priority:0
   ```
3. **Build MediaAssets** from the files on disk (skip missing):
   | file | kind | container | mime |
   |------|------|-----------|------|
   | `audio.mp3` | audio | mp3 | audio/mpeg |
   | `landscape-1080p.mp4` | video | mp4 | video/mp4 |
   | `portrait-1080p.mp4` | video | mp4 | video/mp4 |

   For each: upsert `MediaAsset` on `storage_key = "samples/tanam-farsooda/<file>"` with
   `size_bytes` from the file stat and `processing_status: ready`; upsert a `MediaRendition` variant
   (`is_streaming:true`, `is_offline_download:` true for audio); upsert a `MediaAssetMirror`
   `{ asset, mirror:local, available:true }`.
4. **Find the Tanam kalam** (created by `seed_demo`). If absent, bail with a clear message.
5. **Replace** any placeholder renditions on that kalam with **one** clean public rendition:
   `slug:"tanam-farsooda-local"`, `protection_level:open`, `visibility:public`,
   `published_at: now`; attach all built assets.
6. **Reciter credit**: get-or-create a `Person` from the `voice` string (slugified), add a `Credit`
   `{ person, rendition, role:"reciter", display_order:0 }`.

Result: a single public rendition playable end-to-end from local disk, credited to the reciter.

## Env flags

| Env | Effect |
|-----|--------|
| `DERVAISH_LOCAL_MODE=true` | local mirror `carries_all=true` → serves everything from disk |
| `LOCAL_MEDIA_BASE_URL` | override the local mirror `base_url` (default `/media/`) |

## Sample files (repo root)

`mediafiles/samples/tanam-farsooda/` → `audio.mp3`, `landscape-1080p.mp4`, `portrait-1080p.mp4`,
`lyrics.json` (metadata: title "Tanam Farsooda Jaan Para", voice "Zulfikar Ali").

## Verification
Stage 3 cards in `docs/status.html`: catalog seeded (≥1 kalam), local mirror registered, sample
rendition present (searchable by "Tanam").
