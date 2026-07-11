# API contract (`/api/v1`)

**This is the part that must match exactly.** The frontend calls `fetch(`${BASE}/api/v1${path}`)`
where `BASE` is empty in dev (same-origin via the Vite proxy). Auth header when logged in:
`Authorization: Token <token>`. Authoritative TS source: `apps/platform-web/src/lib/types.ts`.
Authoritative spec source: `archive/backend-django/catalog/serializers.py`.

## Global rules

- **Base path** `/api/v1`. (`/media/*`, `/rest/*`, `/healthz` are top-level.)
- **Lists are paginated**: `{ count, next, previous, results[] }`.
- **Public surfaces filter** `visibility in [public, unlisted]`.
- Trailing slashes are present on Django routes (`/kalams/`). Keep them (or accept both).

## Route map

### Auth / user
| Method | Path | Body / notes | Returns |
|--------|------|--------------|---------|
| POST | `/auth/register/` | | user |
| POST | `/auth/login/` | `{username, password}` | `{ token }` (or `key`/`access`/`auth_token`) |
| POST | `/auth/logout/` | | ok |
| GET | `/me/` | auth | `{ id, username, display_name, role, trust_score }` |
| GET/PUT | `/me/preferences/` | auth | client-owned JSON blob |

### Catalog (read)
| Method | Path | Returns |
|--------|------|---------|
| GET | `/kalams/` | paginated `KalamListItem` |
| GET | `/kalams/{slug}/` | `KalamDetail` (incl. `verses[]`, `credits[]`, `renditions[]` with `playback`) |
| GET | `/renditions/{slug}/` | `Rendition` (with `playback`) |
| GET | `/people/` , `/people/{slug}/` | paginated / detail |
| GET | `/collections/` , `/collections/{slug}/` | paginated / detail |
| GET | `/search/?q=` | `{ kalams[], people[], renditions[], collections[] }` (renditions are `RenditionRef`) |

### Federation
| Method | Path | Returns |
|--------|------|---------|
| GET | `/directory/sources/` | content sources |
| GET | `/directory/mirrors/` | paginated `MirrorInfo` — **all active mirrors**, ordered by `(priority, name)` |

### User-scoped (auth)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST/DELETE | `/me/library/` | items expose `rendition_detail: RenditionRef` |
| GET/POST | `/me/queues/` | items expose `rendition_detail` |

### Contribution / admin (can be stubs for MVP — keep routes)
`/submissions/`, `/community/requests/`, `/admin/review/submissions/`, `/annotations/`,
`/admin/published/`, `/admin/renders/`, `/media/assets/`, `/media/upload-sessions/`.
See [contribution-admin.md](./contribution-admin.md).

## Exact JSON shapes

Field names are load-bearing. These come straight from `catalog/serializers.py`.

### Pagination envelope
```json
{ "count": 12, "next": "…?page=2", "previous": null, "results": [ /* items */ ] }
```

### KalamListItem  (KalamListSerializer)
```json
{ "slug":"tanam-farsooda", "title":"Tanam Farsooda Jaan Para",
  "title_native":"…", "title_transliterated":"…",
  "author_name":"Amir Khusrow", "genre":"Naat" }
```

### KalamDetail  (KalamDetailSerializer)
```json
{ "slug":"…", "title":"…", "title_native":"…", "title_transliterated":"…", "summary":"…",
  "author": { "slug":"…","name":"…","name_native":"…","era":"…","region":"…" },
  "primary_language":"Persian", "genre":"Naat", "tradition":"Chishti",
  "era":"…", "themes":["love","longing"], "tags":["…"],
  "verses":[ { "order":0,"text_native":"…","transliteration":"…",
               "translations":{"en":"…"},"meaning":{"en":"…"} } ],
  "credits":[ { "role":"reciter","person_name":"Zulfikar Ali",
                "person_slug":"zulfikar-ali","display_order":0,"note":"" } ],
  "renditions":[ /* Rendition objects, see below — only public/unlisted */ ] }
```

### Rendition  (RenditionSerializer)
```json
{ "slug":"tanam-farsooda-local", "title":"Tanam Farsooda Jaan Para",
  "duration_ms":0, "year":null, "album":"", "publisher":"", "style":"",
  "protection_level":"open", "rights_note":"",
  "credits":[ { "role":"reciter","person_name":"Zulfikar Ali","person_slug":"zulfikar-ali","display_order":0,"note":"" } ],
  "playback": { /* PlaybackManifest */ } }
```

### PlaybackManifest / PlaybackVariant / MirrorUrl  (RenditionSerializer.get_playback)
```ts
PlaybackManifest = { protection_level: string, variants: PlaybackVariant[] }
PlaybackVariant  = {
  kind: "audio"|"video", storage_key: string, container: string,
  bitrate_kbps: number|null, height: number|null,
  url: string,               // primary = first mirror's url, else variant.url/storage_key
  mirrors: MirrorUrl[],      // ordered (priority asc); client picks per user prefs
  streaming: boolean, offline_download: boolean, source: boolean
}
MirrorUrl = { mirror: string, name: string, kind: string, url: string,
              default_enabled: boolean, priority: number }
```

**How to build it** (mirror `get_playback` exactly): for each attached asset, for each variant,
resolve mirrors (see [federation-mirrors.md](./federation-mirrors.md)) → emit a variant with
`source:false`. Additionally, if the asset has a `source_url` (e.g. a GitHub-hosted original), emit
one extra directly-playable variant with `source:true` and a single synthetic mirror
(`mirror:"github-source"|"external-source"`, `priority:10`).

Example variant for the local sample:
```json
{ "kind":"audio","storage_key":"samples/tanam-farsooda/audio.mp3","container":"mp3",
  "bitrate_kbps":null,"height":null,
  "url":"/media/samples/tanam-farsooda/audio.mp3",
  "mirrors":[ { "mirror":"local","name":"This device (local)","kind":"local",
                "url":"/media/samples/tanam-farsooda/audio.mp3",
                "default_enabled":true,"priority":0 } ],
  "streaming":true,"offline_download":true,"source":false }
```

### RenditionRef  (RenditionRefSerializer — used in search/library/queue)
```json
{ "slug":"…","title":"…","kalam_slug":"…","kalam_title":"…","duration_ms":0,"has_media":true }
```
`has_media` = true if any asset has `source_url`, OR any variant has `url`, OR (`storage_key` and
the resolver returns ≥1 mirror). See [federation-mirrors.md](./federation-mirrors.md).

### MirrorInfo  (/directory/mirrors/)
All active mirrors, ordered `(priority, name)`; the client badges by `is_official`/`verified`.
```json
{ "slug":"local","name":"This device (local)","base_url":"/media/","kind":"local",
  "is_official":false,"is_default_enabled":true,"verified":true,"carries_all":true,"priority":0 }
```
(Confirm the exact field set emitted by `federation/views.py::MirrorDirectoryViewSet`.)

## Verification
Every shape above has a card in `docs/status.html` (Stage 4). The deep one — kalam detail carrying
`renditions[].playback` with `variants[].mirrors[]` of correct `MirrorUrl` fields — is the check
that proves the contract is faithful.
