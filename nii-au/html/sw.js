// Offline support for the scroll journey.
// fingerprint.sh fills ASSETS with this build's content-hashed files, so every
// deploy changes this file and the browser installs the new worker.
const ASSETS = [];
const CACHE = 'nii-au';
// Everything the first screen needs. Videos are cached when the page loads one,
// so a phone keeps only its own video instead of all four.
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png',
  ...ASSETS.filter(path => !path.endsWith('.mp4'))];
const HASHED = /\.[0-9a-f]{10}\.[a-z0-9]+$/;
const NAVIGATION_TIMEOUT = 3000;

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(removeStale().then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // Range requests come from the plain <video src> fallback; the network answers them.
  if (request.headers.has('range')) return;
  if (request.mode === 'navigate' || (SHELL.includes(url.pathname) && !HASHED.test(url.pathname))) {
    event.respondWith(fromNetworkFirst(event, url.pathname));
  } else if (HASHED.test(url.pathname)) {
    event.respondWith(fromCacheFirst(event, url.pathname));
  }
});

// The page reports the video it loaded before this worker took control of it.
self.addEventListener('message', event => {
  const path = event.data && event.data.cache;
  if (typeof path !== 'string' || !ASSETS.includes(path)) return;
  event.waitUntil(caches.open(CACHE).then(async cache => {
    if (!await cache.match(path)) await cache.add(path);
  }));
});

// Hashed files never change, so fetch only the ones the cache lacks (usually
// straight from the HTTP cache); the page itself is always revalidated.
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async path => {
    if (!HASHED.test(path)) return cache.add(new Request(path, {cache: 'no-cache'}));
    if (!await cache.match(path)) await cache.add(path);
  }));
}

// Drop the files of earlier deploys.
async function removeStale() {
  const cache = await caches.open(CACHE);
  const keep = new Set([...SHELL, ...ASSETS]);
  const requests = await cache.keys();
  await Promise.all(requests
    .filter(request => !keep.has(new URL(request.url).pathname))
    .map(request => cache.delete(request)));
}

// A fresh copy when the network answers in time, otherwise the cached one.
async function fromNetworkFirst(event, path) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then(response => {
    if (response.ok && !response.redirected) event.waitUntil(cache.put(path, response.clone()));
    return response;
  });
  const cached = await cache.match(path);
  if (!cached) return network;
  const late = new Promise(resolve => setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT));
  return Promise.race([network, late]).catch(() => cached);
}

// Hashed files never change: serve the cached copy, or fetch it and keep it.
async function fromCacheFirst(event, path) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(path);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok && ASSETS.includes(path)) event.waitUntil(cache.put(path, response.clone()));
  return response;
}
