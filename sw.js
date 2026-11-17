// Fischer-Begleiter Service Worker
const APP = "fb-app-v59";      // versionierte App-Dateien
const LIB = "fb-lib-v1";      // Kartenbibliothek: Cache zuerst
const TILES = "fb-tiles-v1";  // Kartenkacheln: Cache zuerst, begrenzt
const MAX_TILES = 600;
const IMG = "fb-img-v1";     // Fischfotos (Wikimedia): Cache zuerst
const SECTIONS = "fb-sections-v1"; // Abschnittsdateien mit Inhalts-Hash

const FILES = ["./", "./index.html", "./beta/index.html", "./beta/map-sections-gl.js", "./map-search.js", "./data/sections/index.json", "./data/so-sections.json", "./manifest.webmanifest", "./icon.svg", "./data/updates.json", "./vendor/maplibre-gl/maplibre-gl.js", "./vendor/maplibre-gl/maplibre-gl.css", "./data/basemaps/luft.json", "./data/basemaps/topo.json"];
FILES.push("./map-sources.js","./map-rights.js","./map-rights-registers.js","./data/map-overview.json","./data/alpenraum.webp","./data/luzern-reviere.json","./data/lakes.json",...["BE","FR","GE","GL","NW","SH","TG","VD","VS"].map(c=>"./data/fisheries/"+c+".json"));
FILES.push(...["favicon-32","schild-apple-180","schild-192","schild-512","schild-maskable-512"].map(name=>"./assets/"+name+".png"));

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
  // An opaque copy (stored for an <img>) cannot answer a CORS request of the GL map.
  if (hit && !(hit.type === "opaque" && req.mode === "cors")) return hit;
  const res = await fetch(req);
  if (res.ok || (res.type === "opaque" && !hit)) {
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
    const page = /\/beta\/(?:index\.html)?$/.test(url.pathname) ? "./beta/index.html" : "./index.html";
    const shell = req.mode === "navigate" ? new URL(page,self.registration.scope).href : req;
    return e.respondWith(caches.open(APP).then(async cache=>(await cache.match(shell)) || fetch(req)));
  }
  if (url.hostname === "unpkg.com") return e.respondWith(cacheFirst(req, LIB));
  if (url.hostname === "wmts.geo.admin.ch") return e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  if (url.hostname === "vectortiles.geo.admin.ch"&&!url.pathname.endsWith("/style.json")) return e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org") return e.respondWith(cacheFirst(req, IMG, 80));
  // geo.so.ch und api3.geo.admin.ch: direkt ans Netz (App speichert die Daten selbst)
});
