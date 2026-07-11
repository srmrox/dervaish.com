import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { SessionProvider } from "./lib/session";
import { PlayerProvider } from "./lib/player";
import { router } from "./app/router";
import "./theme/tokens.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <PlayerProvider>
          <RouterProvider router={router} />
        </PlayerProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Register the PWA service worker only in production builds — in dev it caches
// the app shell and serves stale code, hiding your changes.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else if ("serviceWorker" in navigator) {
  // Clean up any dev-registered worker + its caches from earlier runs.
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}
