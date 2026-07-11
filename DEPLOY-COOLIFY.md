# Deploying Dervaish on Coolify

Two independent apps, each built from its own Dockerfile in this repo:

| App | Domain | Dockerfile | Port |
|-----|--------|------------|------|
| API | `api.dervaish.com` | `apps/api/Dockerfile` | 8000 |
| Web | `dervaish.com` | `apps/platform-web/Dockerfile` | 80 |

Both `Dockerfile`s expect the **repository root** as the build context (Coolify's
default). The web app calls the API cross-origin; the API's CORS already allows it.

Media is **not** served from the server — playback resolves to the GitHub (`dervaish-media`)
and R2 mirrors. The local `/media/*` mirror is only a default when `DERVAISH_LOCAL_MODE=true`
(local testing).

---

## 1. API — `api.dervaish.com`

**New Resource → Application → Dockerfile**, path `apps/api/Dockerfile`.

- **Port:** `8000`
- **Persistent storage:** mount a volume at **`/data`** (holds the SQLite DB and the
  `.seeded` marker — without it, seeded data is lost on every redeploy).
- **Environment variables** (all optional; defaults shown):

  | Variable | Default | Notes |
  |----------|---------|-------|
  | `PORT` | `8000` | |
  | `HOST` | `0.0.0.0` | |
  | `DB_PATH` | `/data/dervaish.db` | keep it under the mounted volume |
  | `DERVAISH_LOCAL_MODE` | `false` | `true` only for local disk media |
  | `DERVAISH_GITHUB_BASE_URL` | `https://raw.githubusercontent.com/srmrox/dervaish-media/main/` | where media actually lives |
  | `DERVAISH_R2_BASE_URL` | `https://media.dervaish.com/` | secondary media mirror |

On first boot the container **seeds** the demo catalogue, then starts. To reseed
(destructive), delete `/data/.seeded` and redeploy.

Health check: `GET /healthz` → `{"status":"ok",...}`.

## 2. Web — `dervaish.com`

**New Resource → Application → Dockerfile**, path `apps/platform-web/Dockerfile`.

- **Port:** `80`
- **Environment variable:**

  | Variable | Default | Notes |
  |----------|---------|-------|
  | `DERVAISH_API_BASE_URL` | `https://api.dervaish.com` | the API origin the browser calls |

`DERVAISH_API_BASE_URL` is applied **at container start** (written into `/env.js`),
so you can point the site at a different API by changing this variable and
restarting — **no rebuild required**. Leave it unset to use the default.

---

## Order & DNS

1. Point `api.dervaish.com` and `dervaish.com` (A/AAAA or CNAME) at the Coolify host.
2. Deploy the **API** first, confirm `https://api.dervaish.com/healthz`.
3. Deploy the **web** app (default `DERVAISH_API_BASE_URL` already targets the API).
4. Coolify issues TLS for both domains automatically.

## Notes

- **Media playback** works once the sample files exist at the GitHub/R2 base above
  (e.g. `…/samples/tanam-farsooda/audio.mp3`). Until then the catalogue, lyrics, and
  Companion sync all work; renditions whose media can't be resolved show as
  "unavailable" rather than erroring.
- **Node ≥ 22.5** is required for `node:sqlite`; the images use `node:24-slim`.
- The web image builds with `vite build` (bundles without the strict `tsc` gate,
  which is being re-greened separately).
- The old `docker-compose.yml` at the repo root is the retired Django stack and is
  unused by this deployment.
