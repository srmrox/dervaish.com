/* KILL SWITCH. This replaces the old caching service worker. The browser always
   re-fetches sw.js from the network on navigation, so this version installs,
   deletes every cache, unregisters itself, and reloads open tabs — clearing the
   stale-app-shell problem for anyone who had the old worker. The app no longer
   registers a service worker in development (see main.tsx). */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
