# Dervaish — Node backend design docs

> **Status: raw draft.** These describe how the new Node/TypeScript backend (`apps/api/`) will
> work as it replaces the archived Django backend (`archive/backend-django/`). Written to be
> refined. Where a doc says **TODO/refine**, that part is a sketch, not a decision.

The migration goal is a **drop-in backend**: the existing React app (`apps/platform-web/`) must
work unchanged against the new server. So the Node API reproduces the URL shapes and JSON payloads
of the Django API exactly. The Django code stays around only as the reference spec.

**Design principle:** least libraries, native, simple — depend on the Node standard library and
nothing else at runtime (`node:http`, `node:sqlite`, `node:crypto`, …), with TypeScript (`tsc`) as
the only dev dependency. Every avoided library is one fewer thing that breaks on update. See
[architecture.md](./architecture.md).

## Read in this order

| Doc | What it covers |
|-----|----------------|
| [00-overview.md](./00-overview.md) | What Dervaish is, the migration decision, the big picture |
| [architecture.md](./architecture.md) | Native stack (node:http, node:sqlite, tsc), layers, lifecycle |
| [data-model.md](./data-model.md) | SQL schema (`db/schema.sql`) — entities, enums, relations |
| [api-contract.md](./api-contract.md) | `/api/v1` routes + exact JSON shapes the frontend needs |
| [media-serving.md](./media-serving.md) | `GET /media/*` Range/MIME server (the 0:00-bug killer) |
| [federation-mirrors.md](./federation-mirrors.md) | Mirror registry + resolver + `has_media` + local mirror |
| [auth-users.md](./auth-users.md) | Token auth, roles, `/me`, preferences |
| [seeding.md](./seeding.md) | `seed_demo` + `seed_local_media` equivalents |
| [contribution-admin.md](./contribution-admin.md) | Submissions, review→apply, annotations, renders (stubbable) |
| [local-dev.md](./local-dev.md) | Running `apps/api` + `platform-web` locally, ports, CORS |
| [testing-and-status.md](./testing-and-status.md) | The kanban harness in `docs/status.html`, manual + automated checks |
| [migration-plan.md](./migration-plan.md) | The 7 stages, order, and done-criteria |

## Source-of-truth pointers

- **Contract (TypeScript side):** `apps/platform-web/src/lib/types.ts`
- **Contract (spec side):** `archive/backend-django/catalog/serializers.py`, `.../config/api.py`
- **Resolver:** `archive/backend-django/federation/services.py`
- **Media server:** `archive/backend-django/config/media_serve.py`
- **Seed:** `archive/backend-django/catalog/management/commands/seed_local_media.py`
- **Original handoff:** `docs/HANDOFF-node-migration.md`
