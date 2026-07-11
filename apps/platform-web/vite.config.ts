import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev proxy: the browser talks only to :5174; Vite forwards the API + Subsonic
// paths to Django on :8000, so there is no cross-origin (CORS) request at all.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/rest": { target: "http://localhost:8000", changeOrigin: true },
      "/media": { target: "http://localhost:8000", changeOrigin: true },
      "/healthz": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
