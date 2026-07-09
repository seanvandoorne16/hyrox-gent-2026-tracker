/* HYROX Gent 2026 Tracker — service worker: cache-first app-shell voor offline gebruik */

var CACHE_NAME = "hyrox-tracker-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Network-first voor eigen bestanden: toont altijd de nieuwste versie zolang er
   internet is, valt terug op cache enkel wanneer offline (bv. tijdens trainen). */
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  var url = new URL(event.request.url);
  var isOwnAsset = url.origin === self.location.origin;
  if (!isOwnAsset) return; // Firebase/CDN-calls: laat de browser dit gewoon zelf afhandelen

  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
