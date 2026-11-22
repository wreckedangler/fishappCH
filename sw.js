// Fischrevier Service Worker
const APP = "fb-app-v90";      // versionierte App-Dateien
const LIB = "fb-lib-v1";      // Kartenbibliothek: Cache zuerst
const TILES = "fb-tiles-v1";  // Kartenkacheln: Cache zuerst, begrenzt
const MAX_TILES = 600;
const IMG = "fb-img-v1";     // Fischfotos (Wikimedia): Cache zuerst
const SECTIONS = "fb-sections-v1"; // Abschnittsdateien mit Inhalts-Hash

const CORE=["./index.html","./beta/index.html","./manifest.webmanifest","./assets/holzschnitt-kiro-32.png","./assets/holzschnitt-kiro-header.png"];
const OFFLINE="fb-offline-v1";
const scope=self.registration.scope;
function optionalAsset(url){
  if(!url.href.startsWith(scope))return false;
  const path=url.pathname.slice(new URL(scope).pathname.length);
  return /^(?:data|assets|vendor)\//.test(path)||/^(?:map-[\w-]+|beta\/map-sections-gl)\.js$/.test(path)||path==="icon.svg";
}

self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(APP);
  await cache.addAll(CORE.map(path=>new Request(path,{cache:"reload"})));
  await self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  const offline=await caches.open(OFFLINE);
  for(const key of await caches.keys()){
    if(!/^fb-app-v\d+$/.test(key)||key===APP)continue;
    const previous=await caches.open(key);
    for(const req of await previous.keys()){
      if(optionalAsset(new URL(req.url))){
        const response=await previous.match(req);
        try{await offline.put(req,response)}catch{return self.clients.claim()}
      }
    }
    await caches.delete(key);
  }
  await self.clients.claim();
})()));

async function optionalResponse(event){
  const req=event.request,cache=await caches.open(APP);
  const hit=await cache.match(req);
  if(hit)return hit;
  try{
    const response=await fetch(req,{cache:"no-cache",signal:AbortSignal.timeout(20000)});
    if(response.ok){
      event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
      return response;
    }
    if(response.status<500)return response;
    return (await caches.match(req,{cacheName:OFFLINE}))||response;
  }catch(error){
    const saved=await caches.match(req,{cacheName:OFFLINE});
    if(saved)return saved;
    throw error;
  }
}

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const nextTrim=new Map();
async function cacheFirst(event, name, limit) {
  const req=event.request;
  const c = await caches.open(name);
  const hit = await c.match(req);
  // An opaque copy (stored for an <img>) cannot answer a CORS request of the GL map.
  if (hit && !(hit.type === "opaque" && req.mode === "cors")) return hit;
  const res = await fetch(req);
  if (res.ok || (res.type === "opaque" && !hit)) {
    event.waitUntil(c.put(req,res.clone()).then(async()=>{
      if(limit){
        const count=(nextTrim.get(name)||0)+1;
        nextTrim.set(name,count%20);
        if(count===1)await trim(name,limit);
      }
    }).catch(()=>{}));
  }
  return res;
}
async function networkFirst(event) {
  const req=event.request;
  const c = await caches.open(APP);
  try {
    const res = await fetch(req,{signal:AbortSignal.timeout(8000)});
    if (res.ok) event.waitUntil(c.put(req,res.clone()).catch(()=>{}));
    else if(res.status>=500)throw Error("Server "+res.status);
    return res;
  } catch (e) {
    const hit = await c.match(req,{ignoreSearch:true})||await caches.match(req,{cacheName:OFFLINE,ignoreSearch:true});
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.endsWith("/data/updates.json")) return e.respondWith(networkFirst(e));
    if (/\/data\/sections\/[\w-]+-[0-9a-f]{10}\.json$/.test(url.pathname)) return e.respondWith(cacheFirst(e, SECTIONS, 160));
    if(req.mode!=="navigate"&&optionalAsset(url))return e.respondWith(optionalResponse(e));
    const page = /\/beta\/(?:index\.html)?$/.test(url.pathname) ? "./beta/index.html" : "./index.html";
    const shell = req.mode === "navigate" ? new URL(page,self.registration.scope).href : req;
    return e.respondWith(caches.open(APP).then(async cache=>(await cache.match(shell)) || fetch(req)));
  }
  if (url.hostname === "unpkg.com") return e.respondWith(cacheFirst(e, LIB));
  if (url.hostname === "wmts.geo.admin.ch") return e.respondWith(cacheFirst(e, TILES, MAX_TILES));
  if (/^vectortiles[0-4]?\.geo\.admin\.ch$/.test(url.hostname)&&!url.pathname.endsWith("/style.json")) return e.respondWith(cacheFirst(e, TILES, MAX_TILES));
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org") return e.respondWith(cacheFirst(e, IMG, 80));
  // geo.so.ch und api3.geo.admin.ch: direkt ans Netz (App speichert die Daten selbst)
});
