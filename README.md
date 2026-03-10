# Dervaish

Dervaish is a preservation-oriented media and archive platform with:

- web and mobile clients
- offline-first audio and video playback
- synced lyrics and embedded metadata support
- a source-referenced archive with editorial and community trust signals

## Workspace

- `apps/api`: Fastify API with domain routes and mock-backed services
- `apps/web`: React + Vite PWA shell
- `apps/mobile`: Expo React Native shell
- `packages/domain`: shared domain types and seeded demo data
- `packages/validation`: shared zod schemas
- `packages/api-client`: shared HTTP client helpers
- `packages/playback-core`: offline and playback planning utilities

## Getting started

1. Install dependencies with `npm install`
2. Run the API with `npm run dev:api`
3. Run the web app with `npm run dev:web`
4. Run the mobile app with `npm run dev:mobile`

This is an implementation foundation for the v1 plan. It includes the core architecture, seeded entities, APIs, and application shells rather than a full production-ready media platform.

