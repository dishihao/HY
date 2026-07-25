/*
 * This service worker only removes the previous offline cache and then
 * unregisters itself. The application no longer enables offline caching.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));

    await self.registration.unregister();

    // Reload once only when an old application cache was actually removed.
    if (keys.length > 0) {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(windows.map(client => client.navigate(client.url)));
    }
  })());
});
