// OneSignal web push. Imported here so a SINGLE service worker owns scope "/"
// (both push and the app-shell cache below). Registering OneSignal's separate
// /OneSignalSDKWorker.js at the same scope would compete with this worker and
// silently break either push or offline caching in production.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "genie-shell-v2";
const APP_SHELL = [
  "/",
  "/site.webmanifest",
  "/apple-touch-icon.png",
  "/favicon-bevy.png",
  "/favicon-16x16.png",
  "/genie-pic2.png",
  "/genie-profile-pic.png",
  "/orb.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// This worker is now also registered in development (OneSignal registers it so
// push works in dev). Skip app-shell caching on localhost so dev never serves
// stale HTML — push still works because OneSignal's handlers run regardless.
const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
  self.location.hostname
);

self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST || event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match("/"));
    })
  );
});
