// API base URL. Override per-environment with EXPO_PUBLIC_API_BASE_URL
// (e.g. https://api.dervaish.com/api/v1). Defaults to local Django for dev.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
