# Federation & mirrors

The **availability brain**: given a media file, decide which hosts actually carry it, in preferred
order. There are two registries and two layers.

## The two registries

- **ContentSource** — a catalogue/data backend ("database") the app can pull from. Official
  directory + user-added custom ones. One official source today. (`/directory/sources/`)
- **MediaMirror** — a media-host endpoint (R2/CDN, GitHub raw, local disk) that serves the bytes.
  Global hosts with on/off + priority. (`/directory/mirrors/`)
- **MediaAssetMirror** — per-asset availability of a file on a **non-`carries_all`** mirror, so the
  resolver only offers a mirror that actually has that file.

## The two layers

1. **Automatic (server)** — the resolver below returns every active mirror that carries the file,
   ordered by `(priority, name)`. This is what the API emits in `variants[].mirrors[]`.
2. **Manual (client, device-first)** — the frontend applies the user's enabled/disabled mirrors and
   custom additions on top. The server does **not** do this filtering; it just emits correct
   `mirrors[]`. See "Client side" below.

## The resolver (reproduce exactly)

From `archive/backend-django/federation/services.py::resolve_mirror_urls`:

```
resolve_mirror_urls(storage_key, asset?) -> MirrorUrl[]:
  if not storage_key: return []
  mirrors = MediaMirror where is_active=true, ordered by (priority, name)
  # per-asset availability + path overrides (only if asset given)
  availableMirrorIds = { am.mirrorId for am in MediaAssetMirror(asset) if am.available }
  overrides          = { am.mirrorId: am.urlOverride for am in MediaAssetMirror(asset) if am.urlOverride }
  out = []
  for m in mirrors:
      ok = m.carriesAll or (asset != null and m.id in availableMirrorIds)
      if not ok: continue
      url = overrides[m.id] || m.urlFor(storage_key)     # base_url.rstrip('/') + '/' + key.lstrip('/')
      out.push({ mirror: m.slug, name: m.name, kind: m.kind, url,
                 default_enabled: m.isDefaultEnabled, priority: m.priority })
  return out
```

Key point: a `carries_all` mirror (e.g. the primary R2 CDN, or the local mirror in local mode) is
offered for **every** key without needing a `MediaAssetMirror` row. A non-`carries_all` mirror is
only offered for assets that have an `available` row.

## `has_media` (availability filter)

From `RenditionRefSerializer.get_has_media`. A rendition has media if **any** of:
- an attached asset has a non-empty `source_url`, OR
- any variant has a non-empty `url`, OR
- any variant has a `storage_key` AND `resolve_mirror_urls(storage_key, asset)` returns ≥1 mirror.

The client refines this further with device-side mirror toggles at play time, but the server's
`has_media` is the first gate — it's what hides rendition cards that nothing can serve.

## The local mirror

The "run it locally / offline" host. Registered by the seed (see [seeding.md](./seeding.md)):

```
slug: "local", name: "This device (local)", kind: "local",
base_url: "/media/", is_default_enabled: true, verified: true, priority: 0,
carries_all: <DERVAISH_LOCAL_MODE>       # true in local mode → serves everything from disk
```

With `base_url:"/media/"`, `url_for("samples/tanam-farsooda/audio.mp3")` →
`/media/samples/tanam-farsooda/audio.mp3`, which the [media server](./media-serving.md) serves from
`MEDIA_ROOT`. Priority 0 makes it the preferred/first mirror.

## Client side (already built — don't reimplement on the server)

`apps/platform-web/src/lib/mirrors.ts` holds device-side prefs in localStorage:
`dervaish.mirror.overrides`, `dervaish.mirror.custom`, `dervaish.mirror.localbase`.
`resolveVariantUrl(variant)` is strict: only mirrors the user has enabled, no raw fallback. For the
local mirror, if `localbase` is set it joins `localbase + storage_key`, else uses the mirror's `url`.
Availability filtering (`renditionHasMedia`, `availableRenditions`) is built on this. **The Node
backend just needs to emit correct `mirrors[]`; the picking logic is already in the client.**

## Endpoints
- `GET /directory/mirrors/` → paginated `MirrorInfo`, **all active mirrors** ordered `(priority, name)`
  (local + official + community; the client badges by `is_official`/`verified`).
- `GET /directory/sources/` → content sources.

Verified by the Stage 3 ("local mirror registered") and Stage 4 ("rendition playback manifest →
variants + mirrors[]") cards in `docs/status.html`.
