// Runtime configuration. In development this stays empty, so the app talks to the
// same origin ("/api/v1/…") through the Vite dev proxy. In production the web
// container's entrypoint OVERWRITES this file from the DERVAISH_API_BASE_URL env
// var (default https://api.dervaish.com) — change it in Coolify without rebuilding.
window.__DERVAISH_API_BASE_URL__ = "";
