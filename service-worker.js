const cacheName = "deshaj-admin-v1";
const assetsToCache = [
  "/admin-orders.html",
  "/style.css",
  "/header.html",
  "/icon-192.png",
  "/icon-512.png",
  "/index.html"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assetsToCache))
  );
});

// Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== cacheName) return caches.delete(key);
      }))
    )
  );
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
