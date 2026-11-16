// Fischer-Begleiter Service Worker
const APP = "fb-app-v23";      // eigene Dateien: Netz zuerst, sonst Cache
const LIB = "fb-lib-v1";      // Kartenbibliothek: Cache zuerst
const TILES = "fb-tiles-v1";  // Kartenkacheln: Cache zuerst, begrenzt
const MAX_TILES = 600;
const IMG = "fb-img-v1";     // Fischfotos (Wikimedia): Cache zuerst

const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./data/updates.json"];

self.addEventListener("install", e => e.waitUntil(caches.open(APP).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => ![APP, LIB, TILES, IMG].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function cacheFirst(req, name, limit) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") { c.put(req, res.clone()); if (limit) trim(name, limit); }
  return res;
}
async function networkFirst(req) {
  const c = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) return e.respondWith(networkFirst(req));
  if (url.hostname === "unpkg.com") return e.respondWith(cacheFirst(req, LIB));
  if (url.hostname === "wmts.geo.admin.ch") return e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org") return e.respondWith(cacheFirst(req, IMG, 80));
  // geo.so.ch und api3.geo.admin.ch: direkt ans Netz (App speichert die Daten selbst)
});
