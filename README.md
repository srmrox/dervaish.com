# Dervaish

Dervaish is a preservation-oriented media and archive platform with:

- web and mobile clients
- offline-first audio and video playback
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

Optional local services for the production path are declared in `docker-compose.yml`:

- PostgreSQL for durable catalog/submission data
- Redis for background job queues
- MinIO for S3-compatible source and generated media storage

The current API implementation keeps an in-memory repository so the submission, lyrics, and video-generation flows can be exercised without provisioning those services yet.

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
