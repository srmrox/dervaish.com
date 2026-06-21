# Dervaish app (universal Expo — web target active)

Universal Expo Router app (React Native + React Native Web). Per the master plan
(§3), this is one codebase for web + iOS + Android; **native (EAS) builds are
deferred** and the **web target is active**.

## Run (web)
```bash
cd app
npm install
# point at the API (defaults to http://localhost:8000/api/v1)
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npx expo start --web
```
Run the Django API alongside it (`cd backend && python manage.py runserver`,
seeded via `seed_demo`) so the screens have data.

## Verify
```bash
npx tsc --noEmit          # type-check
npx expo export -p web    # static web build (SSG) → dist/
```
CI (`.github/workflows/ci.yml` → `app` job) runs both on every push/PR.

## Structure
- `app/` — Expo Router routes. Tabs: **Listen · Search · Library**; stack:
  `kalam/[slug]`, `person/[slug]`. Public routes are statically rendered (SEO).
- `src/api/` — typed client + React Query hooks against Django v1.
- `src/player/` — web audio player (`PlayerProvider`) + `MiniPlayer`; abstracted
  so native (`react-native-track-player`) can slot in when native ships.
- `src/theme/` — design tokens (§14). `src/ui/` — shared primitives.
- `src/i18n/` — RTL/direction helpers.

## Config
- `EXPO_PUBLIC_API_BASE_URL` — API base (default local Django).
