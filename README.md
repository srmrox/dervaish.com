# Dervaish

Dervaish is a preservation-oriented media and archive platform with:

- web and mobile clients
- offline-first audio and video playback
- user and curated Collections with shareable visibility
- Reciter and Writer credits linked to profile pages
- personal listening queues
- community track requests, track upvotes, and submission verification
- synced lyrics and embedded metadata support
- a source-referenced archive with editorial and community trust signals
- contributor submissions with multilingual timed lyrics
- Python/MoviePy lyric-video generation for submitted audio and video sources

## Workspace

- `apps/api`: Fastify API with domain routes and mock-backed services
- `apps/web`: React + Vite PWA shell
- `apps/mobile`: Expo React Native shell
- `packages/domain`: shared domain types and seeded demo data
- `packages/validation`: shared zod schemas
- `packages/api-client`: shared HTTP client helpers
- `packages/playback-core`: offline and playback planning utilities
- `workers/video-generator`: JSON-driven MoviePy worker adapted from the existing video generation sample

## Getting started

1. Install dependencies with `npm install`
2. Run the API with `npm run dev:api`
3. Run the web app with `npm run dev:web`
4. Run the mobile app with `npm run dev:mobile`

Local services for the durable API path are declared in `docker-compose.yml`:

- PostgreSQL for durable catalog/submission data
- Redis for background job queues
- MinIO for S3-compatible source and generated media storage

The API defaults `DATABASE_URL` to the Docker Compose PostgreSQL connection:

```bash
postgres://dervaish:dervaish@localhost:5432/dervaish
```

Set `DATABASE_URL=""` to use the seeded in-memory fallback for local smoke tests or UI work without PostgreSQL.

Run the API smoke tests with:

```bash
npm run smoke -w @dervaish/api
```

The smoke tests cover the hard Collection rename, curated Collection labeling, Reciter/Writer track credits, Collection sharing, private ownership checks, personal queue item lifecycle, track requests, track upvotes, and community submission verification.

## Collections and queues

The catalog exposes `collections`, not `releases`. Admin/editor-created Collections render as Curated Collections. User-created Collections can be public or private; private Collections can generate unlisted share-token links.

Personal queues are owner-scoped and available through `/me/queues`. Until real authentication is added, the web app sends `X-Dervaish-User-Id` and `X-Dervaish-Role` headers from the demo role selector.

## Community

Signed-in demo roles (`listener`, `contributor`, `editor`, and `admin`) can:

- post freeform or existing-track requests through `/community/track-requests`
- toggle request upvotes and catalog track upvotes
- view the community submission queue at `/community/submissions`
- verify or dispute submission fields (`writer`, `reciter`, `lyrics`, `source`, and `overall`)

Anonymous users can view public request and track counts, but cannot create requests, vote, or verify submissions.

## Video generation worker

Install the Python worker dependencies with:

```bash
pip install -r workers/video-generator/requirements.txt
```

Render a JSON job with:

```bash
python workers/video-generator/render_job.py --job workers/video-generator/sample-job.json
```

Set `IMAGEMAGICK_BINARY` if MoviePy needs an explicit ImageMagick executable for text rendering.

This is an implementation foundation for the v1 plan. It includes the core architecture, seeded entities, APIs, and application shells rather than a full production-ready media platform.
