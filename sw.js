// Fischer-Begleiter Service Worker
const APP = "fb-app-v39";      // eigene Dateien: Netz zuerst, sonst Cache
const LIB = "fb-lib-v1";      // Kartenbibliothek: Cache zuerst
const TILES = "fb-tiles-v1";  // Kartenkacheln: Cache zuerst, begrenzt
const MAX_TILES = 600;
const IMG = "fb-img-v1";     // Fischfotos (Wikimedia): Cache zuerst
const SECTIONS = "fb-sections-v1"; // Abschnittsdateien mit Inhalts-Hash

const FILES = ["./", "./index.html", "./map-sections.js", "./map-search.js", "./data/sections/index.json", "./data/so-sections.json", "./manifest.webmanifest", "./icon.svg", "./data/updates.json", "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css", "./vendor/leaflet/images/layers-2x.png", "./vendor/leaflet/images/layers.png", "./vendor/leaflet/images/marker-icon-2x.png", "./vendor/leaflet/images/marker-icon.png", "./vendor/leaflet/images/marker-shadow.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(APP).then(c => c.addAll(FILES.map(path=>new Request(path,{cache:"reload"})))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("fb-")&&![APP, LIB, TILES, IMG, SECTIONS].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const nextTrim=new Map();
async function cacheFirst(req, name, limit) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    try {
      await c.put(req,res.clone());
      if(limit){
        const count=(nextTrim.get(name)||0)+1;
        nextTrim.set(name,count%20);
        if(count===1)await trim(name,limit);
      }
    } catch { /* A full or disabled offline cache must still return the map. */ }
  }
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
  if (url.origin === location.origin) {
    if (url.pathname.endsWith("/data/updates.json")) return e.respondWith(networkFirst(req));
    if (/\/data\/sections\/[\w-]+-[0-9a-f]{10}\.json$/.test(url.pathname)) return e.respondWith(cacheFirst(req, SECTIONS, 160));
    const shell = req.mode === "navigate" ? new URL("./index.html",self.registration.scope).href : req;
    return e.respondWith(caches.open(APP).then(async cache=>(await cache.match(shell)) || fetch(req)));
  }
  if (url.hostname === "unpkg.com") return e.respondWith(cacheFirst(req, LIB));
  if (url.hostname === "wmts.geo.admin.ch") return e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org") return e.respondWith(cacheFirst(req, IMG, 80));
  // geo.so.ch und api3.geo.admin.ch: direkt ans Netz (App speichert die Daten selbst)
});
