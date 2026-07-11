# Deploying the Dervaish API to Coolify

This is the step-by-step for getting the backend live at **`https://api.dervaish.com`**
on your existing Coolify server. You stay in control of all credentials.

Two paths are given. **Path A (recommended)** uses Coolify-managed Postgres/Redis +
a Dockerfile app — cleanest and easiest to operate. **Path B** deploys the whole
stack from the compose file in one resource.

---

## 0. Push the code to GitHub (run on your machine)

The repo has a stale git lock from OneDrive; remove it first, then commit.

```powershell
# from D:\repos\dervaish.com
del .git\index.lock                      # if it exists

# (optional but recommended) snapshot the old two-stack code before it's archived
git branch archive/pre-rebuild

git add backend .gitattributes
git commit -m "feat(backend): greenfield Django API with Kalam/Rendition model + Coolify deploy"
git push origin main
```

> The new backend lives entirely in `backend/`. Your existing `apps/` is untouched —
> we archive it later; the Coolify build only looks at `backend/`.

---

## Path A — Dockerfile app + managed Postgres/Redis (recommended)

### A1. Create the databases
1. In Coolify, open your **Project → Environment** (e.g. `production`).
2. **+ New Resource → Database → PostgreSQL 16.** Create it. Open it and copy the
   **internal connection URL** (looks like `postgres://user:pass@<host>:5432/db`).
   Then open **Backups → Scheduled Backups**, set a daily schedule with a sensible
   retention, and point the destination at an **S3-compatible bucket** (e.g. a
   `dervaish-backups` R2 bucket) so the data survives volume/server loss — *off-server,
   not just on the volume.*
3. **+ New Resource → Database → Redis.** Create it; copy its internal URL
   (`redis://<host>:6379`). This is the Celery broker; durability isn't critical.

### A2. Create the API application
1. **+ New Resource → Application → Public/Private Repository →**
   `https://github.com/srmrox/dervaish.com` (connect the GitHub App if prompted).
2. Branch: `main`. **Build Pack: Dockerfile.**
3. **Base Directory: `/backend`** (so Coolify builds `backend/Dockerfile`).
4. **Port: `8000`.** **Health check path: `/healthz`.**

### A2.5. Media storage — Cloudflare R2 (done in the Cloudflare dashboard)

Media is the *media plane* (master plan §4A): immutable objects served from a CDN, not
through the app server. R2 gives zero egress + an edge CDN via a custom domain.

1. **R2 → Create bucket**, e.g. `dervaish-media`.
2. **R2 → Manage API Tokens → Create** an *Object Read & Write* token scoped to that
   bucket. Note the **Access Key ID**, **Secret Access Key**, and your account's S3
   endpoint `https://<accountid>.r2.cloudflarestorage.com`.
3. **Bucket → Settings → Custom Domains → Connect** `media.dervaish.com`. Cloudflare
   auto-creates the CNAME and provisions the CDN + TLS. Public objects are then served +
   cached at the edge with **no egress cost**. This value is `S3_CUSTOM_DOMAIN`.
4. *(Optional)* create a second bucket `dervaish-backups` for the Postgres backups (A1.2).

These map to the `USE_S3`/`S3_*` vars in A3. The old MinIO path is still available via the
compose file (Path B) if you prefer self-hosted storage.

### A3. Environment variables (Application → Environment Variables)
Paste these, filling in real values (see `backend/.env.example`):

```
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<a long random string>
DJANGO_ALLOWED_HOSTS=api.dervaish.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://api.dervaish.com
DJANGO_CORS_ALLOWED_ORIGINS=https://dervaish.com,https://www.dervaish.com
DJANGO_TIME_ZONE=Asia/Karachi
DATABASE_URL=<the Postgres internal URL from A1>
REDIS_URL=<the Redis internal URL from A1>
# media storage → Cloudflare R2 (see A2.5)
USE_S3=true
S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<R2 token access key>
S3_SECRET_ACCESS_KEY=<R2 token secret>
S3_BUCKET=dervaish-media
S3_REGION=auto
S3_CUSTOM_DOMAIN=media.dervaish.com
S3_QUERYSTRING_AUTH=false
```

> Set the **same media + DB + Redis vars on the Celery worker** resource (A6) too.

### A4. Domain + TLS
1. Application → **Domains**: set `https://api.dervaish.com`.
2. Make sure DNS has an **A record `api` → your server's IP**. Coolify's proxy
   (Traefik) will issue a Let's Encrypt certificate automatically.

### A5. Deploy
Click **Deploy**. The container's entrypoint runs `migrate` + `collectstatic`
then starts gunicorn. Watch logs until healthy.

### A6. The Celery worker (background jobs / media pipeline)
Add a second resource for the worker (same image, different command):
1. **+ New Resource → Application →** same repo, Base Directory `/backend`,
   Build Pack Dockerfile, **no domain**.
2. **Start command override:** `worker` (the entrypoint accepts `web|worker|beat`).
3. Give it the **same env vars** (DATABASE_URL, REDIS_URL, S3_*). Deploy.

### A7. First-run admin + seed (Application → Terminal)
```bash
python manage.py createsuperuser
python manage.py seed_demo        # optional demo content
```

### A8. Verify
- `https://api.dervaish.com/healthz` → `{"status":"ok","database":true,...}`
- `https://api.dervaish.com/api/v1/kalams/` (and `/api/v1/renditions/<slug>/` → playback manifest)
- `https://api.dervaish.com/admin/`
- **Media → R2 round-trip** (Application → Terminal):
  ```bash
  python manage.py shell -c "from django.core.files.base import ContentFile; \
  from django.core.files.storage import default_storage as s; \
  p=s.save('healthcheck.txt', ContentFile(b'ok')); print(s.url(p)); s.delete(p)"
  ```
  Expect a printed URL like `https://media.dervaish.com/healthcheck.txt` (fetchable while it exists).
- **Persistence:** redeploy the app and confirm seeded data survives (it lives in the managed
  Postgres volume + R2, never the app container).

---

## Path B — One Docker Compose resource

1. **+ New Resource → Docker Compose →** repo `srmrox/dervaish.com`, branch `main`.
2. **Base Directory: `/backend`**, **Compose file: `docker-compose.coolify.yml`**.
3. Set these env vars (Coolify substitutes them into the compose file):
   `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS=api.dervaish.com`,
   `DJANGO_CSRF_TRUSTED_ORIGINS=https://api.dervaish.com`,
   `DJANGO_CORS_ALLOWED_ORIGINS=https://dervaish.com`,
   `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_BUCKET=dervaish`.
4. Map the domain `api.dervaish.com` to the **`web`** service, port **8000**.
5. Deploy. Then run `seed_demo` / `createsuperuser` from the `web` container terminal
   (as in A7).

This brings up web + worker + Postgres + Redis + MinIO together. It's simpler to
start but couples the databases to the app lifecycle; Path A is better for backups
and independent scaling.

---

## Notes
- **Migrations are committed** in each app's `migrations/`. The entrypoint applies
  them on every deploy, so schema changes ship automatically.
- The image installs **ffmpeg** for the upcoming media-transcoding pipeline.
- Static files are served by **WhiteNoise** (no separate web server needed).
- Set a strong `DJANGO_SECRET_KEY` and keep `DJANGO_DEBUG=false` in production.
