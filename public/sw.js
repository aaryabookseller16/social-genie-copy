// OneSignal web push. Imported here so a SINGLE service worker owns scope "/"
// (both push and the app-shell cache below). Registering OneSignal's separate
// /OneSignalSDKWorker.js at the same scope would compete with this worker and
// silently break either push or offline caching in production.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Bumped v2 -> v3 deliberately. `activate` deletes every cache whose name is not
// this one, so changing the name is the ONLY thing that purges the poisoned v2
// cache from devices that already have the app installed. Any future change to
// the caching rules below must bump this too, or existing installs keep serving
// entries that were stored under the old rules.
const CACHE_NAME = "genie-shell-v3";

// "/" is precached purely as an OFFLINE FALLBACK document. It is never served
// while the network is reachable — see the navigate branch in `fetch`.
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

// This worker is also registered in development (OneSignal registers it so push
// works in dev). Skip caching entirely on localhost so dev never serves a stale
// anything — push still works because OneSignal's handlers run regardless.
const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
  self.location.hostname
);

/**
 * Cache-first is only ever safe for URLs whose bytes can never change. The
 * previous version of this worker applied it to EVERY 200 GET response, which
 * caused three separate production failures:
 *
 *  1. `/api/**` responses were stored permanently. A first visit that correctly
 *     returned `{profile: null}` pinned "you are not a producer" forever, so
 *     users who had completed onboarding were sent back to the signup form on
 *     every role switch. Same mechanism stranded stale `is_following` state and
 *     empty venue-search results (which silently blocked offer creation).
 *  2. The Cache API keys on URL and the stored response's `Vary` header. Vercel
 *     does not send `Vary: Authorization`, so one signed-in user's API responses
 *     were replayed to the next account to sign in on that device.
 *  3. The HTML document was served from cache indefinitely. Installed PWAs kept
 *     booting a frozen shell that requested `/_next/static` chunk hashes which
 *     no longer existed after a deploy — producing ChunkLoadErrors, and (via the
 *     old `.catch(() => caches.match("/"))` fallback) HTML delivered in response
 *     to script requests, i.e. "expected a JavaScript module, got text/html".
 *
 * The routing below is therefore allow-list shaped: a request is only cached if
 * it matches an explicit rule. Anything else goes to the network untouched.
 */

/** Next.js content-hashes everything under /_next/static — the bytes at a given URL never change. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Precached icons/logos. "/" is excluded — it is handled by the navigate branch. */
function isShellAsset(url) {
  return url.pathname !== "/" && APP_SHELL.includes(url.pathname);
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;

    return fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
  });
}

/**
 * Serve from cache immediately, refresh in the background. These filenames are
 * NOT content-hashed, so cache-first would strand devices on old bytes forever
 * the moment one of the images is replaced.
 */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || fromNetwork;
    })
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (IS_LOCALHOST || request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Cross-origin (Cloudinary media, OneSignal, Xano). We cannot reason about
  // their freshness — leave them to the network and the normal HTTP cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER cache the API. Every staleness bug this worker caused lived here.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Documents: network-first. The cached shell is a last resort for genuine
  // offline only, so a deploy is picked up on the next launch instead of
  // freezing the installed app on the build it was installed with.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || Response.error())
      )
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else — RSC payloads (`?_rsc=`), /_next/image, anything new —
  // goes to the network and is never stored.
});
