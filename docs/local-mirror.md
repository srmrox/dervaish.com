# Local mirror — self-host offline & (optionally) share

Dervaish is preservation-first, so anyone should be able to run the **whole thing
on their own machine, fully offline**, and — if they choose — expose their copy as
a **media mirror** others can fall back to. This is powered by the existing
`federation` app (`MediaMirror` / `MediaAssetMirror` + resolver) plus local media
serving.

## Part A — Run a full offline instance

Everything runs from disk; no Cloudflare R2 or internet required.

```bash
# 1. backend (SQLite + local media; no Postgres/Redis needed for a solo instance)
cd backend
python -m venv .venv && . .venv/Scripts/activate        # (or bin/activate on *nix)
pip install -r requirements.txt
$env:DERVAISH_LOCAL_MODE = "true"        # PowerShell; export DERVAISH_LOCAL_MODE=true on *nix
python manage.py migrate
python manage.py seed_demo               # sample kalam + rendition + metadata
python manage.py seed_local_media        # local media mirror + a playable sample
python manage.py runserver

# 2. web app
cd ../apps/platform-web
npm install
npm run dev                              # http://localhost:5174
```

What makes it work offline:

- **Media served from disk.** `SERVE_MEDIA_LOCALLY` (on by default in DEBUG or
  `DERVAISH_LOCAL_MODE`) makes Django serve `MEDIA_ROOT` at `/media/`. The Vite dev
  proxy forwards `/media` to Django, so the browser fetches everything same-origin.
- **A `local` mirror.** `seed_local_media` registers a `MediaMirror(kind="local",
  priority=0, is_default_enabled=True)`. The resolver puts it first in every
  playback manifest, so the player prefers local files. With
  `DERVAISH_LOCAL_MODE=true` it's marked `carries_all` (serves the whole catalogue
  from disk); otherwise it serves only assets that have a `MediaAssetMirror`
  availability row.
- **Content is files.** Kalam text/annotations are (or will be) published as
  Markdown to the content repo (plan §4), so an offline copy = clone the code repo +
  the content repo + a media folder. No live service required to read.

To put your own audio in: drop files under `backend/mediafiles/<path>` and point a
`MediaRendition.storage_key` at `<path>` (or upload via the media pipeline). The
local mirror resolves `storage_key` → `/media/<path>`.

## Part B — Become a mirror for others (opt-in)

Because media is content-addressed by `storage_key` and served over a normal URL,
any instance can act as a mirror for the network — **only if its operator opts in.**

1. **Expose your media** at a reachable URL (e.g. `https://media.yourhost.tld/` in
   front of `MEDIA_ROOT`, or an S3/R2 bucket). Set that as your mirror's `base_url`.
2. **Register the mirror.** Create a `MediaMirror` row (kind `local`/`external`/
   `r2`/`github`) with `carries_all=true` if you host the full catalogue, else add
   `MediaAssetMirror` rows for the files you have. Set `is_default_enabled` as you
   wish.
3. **Publish to the directory (optional).** The official directory
   (`GET /api/v1/directory/mirrors/`) lists `is_official` + `verified` mirrors. To
   have yours listed for everyone, submit it for review; until verified it's marked
   **unverified** in clients. Users can always add your mirror **manually** by URL
   in Settings, without any central approval.
4. **Trust signals.** `is_official` / `verified` drive the UI trust badges;
   user-added and unverified mirrors are clearly marked so listeners know the
   provenance.

The resolver already orders enabled + available mirrors by `priority` into each
manifest, and the client applies the user's enable/disable choices on top — so a
listener who adds your mirror will fail over to it automatically when the primary
is unreachable.

## Notes

- Serving media through Django (`SERVE_MEDIA_LOCALLY`) is fine for solo/offline and
  small self-hosts; larger public mirrors should front `MEDIA_ROOT` with nginx or a
  CDN and leave Django to the API.
- A future step is a one-command `docker-compose` bring-up (Postgres/Redis/MinIO
  already declared) and a content-repo sync so replicas stay current — see
  `plan.md` §4/§14.
