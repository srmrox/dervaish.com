# Auth & users

## Token auth (match the frontend)

The frontend stores a token in localStorage (`dervaish.token`) and sends it as
`Authorization: Token <token>` on every authed request. It reads the token from the login response
under any of `token` / `key` / `access` / `auth_token` (first present wins).

**Opaque token table** (native, matches Django's DRF `TokenAuthentication`): an `auth_token` row
`{ token, user_id, created_at }` in SQLite; login creates/returns one, logout deletes it. The token
is `crypto.randomBytes(32).toString("hex")` — **no JWT library**. Wire format stays
`Authorization: Token <opaque>`.

### Auth in the request pipeline
Before the route handler runs, a small hand-written step reads the `Authorization: Token <t>`
header, looks the token up in `auth_token` → loads the `user` row → attaches `ctx.user` (with
`role`, `trust_score`). No/invalid token → anonymous. Handlers that require auth call a
`requireUser(ctx)` guard; role-gated ones call `requireRole(ctx, "editor")` which checks the rank.
All standard code — no middleware framework.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/auth/register/` | `{username, password, display_name?}` | created user (and/or token) |
| POST | `/auth/login/` | `{username, password}` | `{ token }` |
| POST | `/auth/logout/` | (auth) | ok; invalidates the token |
| GET | `/me/` | (auth) | `{ id, username, display_name, role, trust_score }` |
| GET | `/me/preferences/` | (auth) | the preferences JSON blob |
| PUT | `/me/preferences/` | (auth) `{...}` | updated blob |

## Users & roles

From `archive/backend-django/accounts/models.py`:

```
User: username, password(hash), display_name, role, trust_score, preferences(json)
Role:  listener | contributor | editor | admin        (+ anonymous = no token)
rank:  listener(1) < contributor(2) < editor(3) < admin(4)
has_role(min) = rank(user.role) >= rank(min)
```

Guards used by the routes:
- **authed** — any valid token (library, queues, `/me`, submissions).
- **editor+** — `has_role("editor")` for `/admin/review/*`, `/admin/published/`, `/admin/renders/`,
  `/media/assets/` list/detail.

## Preferences

Free-form, **client-owned** JSON (visible lyric lanes, theme, autoplay, mirror prefs sync, …). The
API just persists and returns it — don't impose a schema server-side. Stored on `User.preferences`.

## Password hashing (native — `node:crypto` scrypt)

No bcrypt/argon2 dependency; use built-in **scrypt**:

```ts
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;   // → store in user.password_hash
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Django users won't carry over (different PBKDF2 format) — moot for a fresh reseeded dev DB.
**TODO/refine** only if importing existing accounts.

## Verification
Stage 5 cards in `docs/status.html`: login captures the token and reuses it for `/me`,
`/me/preferences/`, `/me/library/`, `/me/queues/`. Register + logout are marked ⚠ (mutating).
