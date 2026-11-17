const appOrigin = "https://wreckedangler.github.io";
const federalLayer = "ch.swisstopo.swisstlm3d-gewaessernetz";
const swissDate = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
const encoder = new TextEncoder();
const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function before(day,days) {
  const d = new Date(day+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()-days);
  return d.toISOString().slice(0,10);
}
async function digest(s) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))), b=>b.toString(16).padStart(2,"0")).join("");
}
function fail(status,message) { throw Object.assign(new Error(message),{status}); }
async function federalSection(id) {
  if (!/^CH:\d{1,12}$/.test(id)) return null;
  const url = "https://api3.geo.admin.ch/rest/services/api/MapServer/"+federalLayer+"/"+id.slice(3)+"?sr=4326&geometryFormat=geojson&lang=de";
  const response = await fetch(url,{signal:AbortSignal.timeout(6500)});
  if (response.status===404) return null;
  if (!response.ok) fail(503,"Der amtliche Gewässerabschnitt ist gerade nicht abrufbar.");
  const {feature:f} = await response.json();
  if (!f || String(f.featureId??f.id)!==id.slice(3)) return null;
  const g=f.geometry, props=f.attributes||f.properties||{};
  const lines=g?.type==="LineString"?[g.coordinates]:g?.type==="MultiLineString"?g.coordinates:
    g?.type==="Polygon"?[g.coordinates[0]]:g?.type==="MultiPolygon"?g.coordinates.map(p=>p[0]):[];
  const line=lines.reduce((best,l)=>l.length>best.length?l:best,[]);
  const point=line[Math.floor(line.length/2)];
  if (!point || !(point[0]>=5.8 && point[0]<=10.6 && point[1]>=45.7 && point[1]<=47.9)) return null;
  const name=String(props.name||props.seename||props.seename_d||"").split("|")[0].trim();
  return [id,(name&&name!=="-"?name:"Gewässer")+" · Abschnitt "+id.slice(3),+point[0].toFixed(4),+point[1].toFixed(4)];
}
export function createReports(catalogue,{now=()=>new Date(),lookupFederal=federalSection}={}) {
  const byId=new Map(catalogue.sections.map(s=>[s[0],s]));
  const species=new Set(catalogue.species);
  const federalCache=new Map();
  let quotaDay="",quotaSalt="";
  async function writerKey(db,day,request) {
    if (quotaDay!==day) {
      const result=await db.batch([
        db.prepare("DELETE FROM report_quota_days WHERE day < ?").bind(day),
        db.prepare("INSERT OR IGNORE INTO report_quota_days (day,salt) VALUES (?,hex(randomblob(32)))").bind(day),
        db.prepare("SELECT salt FROM report_quota_days WHERE day=?").bind(day)
      ]);
      quotaSalt=result[2].results[0].salt;quotaDay=day;
    }
    return digest(quotaSalt+(request.headers.get("CF-Connecting-IP")||"local"));
  }
  async function section(id) {
    if (byId.has(id)) return byId.get(id);
    if (!/^CH:\d{1,12}$/.test(id)) return null;
    if (federalCache.has(id)) return federalCache.get(id);
    const s=await lookupFederal(id);
    if (s) { if (federalCache.size>=256) federalCache.delete(federalCache.keys().next().value); federalCache.set(id,s); }
    return s;
  }
  return async function handle(request,env) {
    const url=new URL(request.url), path=url.pathname, q=url.searchParams;
    const origin=request.headers.get("Origin");
    const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin",
      "Access-Control-Allow-Methods":"GET, PUT, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Report-Key","Access-Control-Max-Age":"600"};
    if (origin===appOrigin || origin===url.origin) headers["Access-Control-Allow-Origin"]=origin;
    const reply=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers});
    try {
      if (origin && !headers["Access-Control-Allow-Origin"]) fail(403,"Unbekannte Herkunft.");
      if (request.method==="OPTIONS") return reply(null,204);
      const today=swissDate.format(now());
      if (request.method==="GET") {
        if (path==="/" || path==="/v1/health") return reply({service:"Fangmeldungen",version:1});
        if (path==="/v1/sections") {
          const c=q.get("canton")||"", text=normalize((q.get("q")||"").slice(0,100));
          if (!/^[A-Z]{2}$/.test(c)) fail(400,"Kanton fehlt.");
          const hint=q.get("id")||"", exact=hint.startsWith(c+":") || hint.startsWith("CH:")?await section(hint):null;
          const terms=text.split(/\s+/).filter(Boolean);
          const matches=catalogue.sections.filter(s=>s[0].startsWith(c+":")&&terms.every(t=>normalize(s[1]).includes(t))).slice(0,30);
          return reply({sections:[...(exact?[exact]:[]),...matches.filter(s=>s[0]!==exact?.[0])].slice(0,30).map(([id,name])=>({id,name}))});
        }
        const days=Number(q.get("days")||30);
        if (![7,30].includes(days)) fail(400,"Zeitraum ungültig.");
        const from=before(today,days-1);
        if (path==="/v1/map") {
          const box=(q.get("bbox")||"").split(",");
          const [w,s,e,n]=box.map(Number);
          if (box.length!==4 || box.some(v=>!v.trim()||!Number.isFinite(Number(v))) || w>=e || s>=n || w< -180||e>180||s< -90||n>90) fail(400,"Kartenausschnitt ungültig.");
          const rows=(await env.DB.prepare(`SELECT section AS id, name, lon, lat, SUM(qty) AS count, MAX(day) AS last FROM reports
            WHERE day BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?
            GROUP BY section ORDER BY last DESC, section LIMIT 501`).bind(from,today,w,e,s,n).all()).results;
          return reply({sections:rows.slice(0,500),more:rows.length>500});
        }
        if (path==="/v1/section") {
          const id=q.get("id")||"";
          if (!/^[A-Z]{2}:[\w-]{1,32}$/.test(id)) fail(400,"Abschnitt ungültig.");
          const rows=(await env.DB.prepare(`SELECT species, SUM(qty) AS count, MIN(len) AS min, MAX(len) AS max, MAX(day) AS last
            FROM reports WHERE section=? AND day BETWEEN ? AND ? GROUP BY species ORDER BY last DESC, species`).bind(id,from,today).all()).results;
          return reply({species:rows});
        }
        fail(404,"Unbekannte Adresse.");
      }
      if (path!=="/v1/report" || !["PUT","DELETE"].includes(request.method)) fail(405,"Methode nicht verfügbar.");
      const token=request.headers.get("X-Report-Key")||"";
      if (!/^[0-9a-f]{64}$/.test(token)) fail(401,"Freigabeschlüssel fehlt.");
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) fail(415,"JSON erforderlich.");
      if (+(request.headers.get("Content-Length")||0)>768) fail(413,"Meldung zu gross.");
      const reader=request.body?.getReader();
      if (!reader) fail(400,"Meldung fehlt.");
      let size=0, body="", decoder=new TextDecoder();
      for (;;) {
        const {value,done}=await reader.read(); if (done) break;
        size+=value.byteLength; if(size>768){await reader.cancel();fail(413,"Meldung zu gross.");}
        body+=decoder.decode(value,{stream:true});
      }
      let p;try{p=JSON.parse(body+decoder.decode());}catch{fail(400,"Meldung ungültig.");}
      const remove=request.method==="DELETE", fields=remove?["revision"]:["revision","section","species","len","count","day"];
      if (!p||typeof p!=="object"||Object.keys(p).length!==fields.length||!fields.every(k=>Object.hasOwn(p,k))||
        !Number.isSafeInteger(p.revision)||p.revision<1) fail(400,"Angaben zur Freigabe ungültig.");
      let place=[];
      if (!remove) {
        if (typeof p.day!=="string"||!/^\d{4}-\d\d-\d\d$/.test(p.day)||p.day<before(today,29)||p.day>today||
            !Number.isFinite(Date.parse(p.day))||new Date(p.day).toISOString().slice(0,10)!==p.day) fail(422,"Nur Fänge der letzten 30 Tage können geteilt werden.");
        if (!species.has(p.species)||!Number.isInteger(p.count)||p.count<1||p.count>999||
            !(p.len===null||Number.isFinite(p.len)&&p.len>0&&p.len<=500)) fail(422,"Art, Länge oder Anzahl ungültig.");
        if (typeof p.section!=="string" || !(place=await section(p.section))) fail(422,"Bitte einen kartierten Abschnitt wählen.");
      }
      const key=await digest(token);
      const db=env.DB;
      const writer=await writerKey(db,today,request);
      const result=await db.batch([
        db.prepare("DELETE FROM reports WHERE touched < ?").bind(before(today,32)),
        db.prepare(`INSERT INTO reports (key,rev,section,name,lon,lat,species,len,qty,day,touched,writer)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM reports WHERE key=?) OR
          (SELECT COUNT(*) FROM reports WHERE writer=? AND touched=?)<150
          ON CONFLICT(key) DO UPDATE SET rev=excluded.rev,section=excluded.section,name=excluded.name,lon=excluded.lon,
          lat=excluded.lat,species=excluded.species,len=excluded.len,qty=excluded.qty,day=excluded.day,touched=excluded.touched
          WHERE (excluded.section IS NULL OR excluded.rev>reports.rev) AND reports.section IS NOT NULL`).bind(key,p.revision,...[0,1,2,3].map(i=>place[i]??null),
            p.species??null,p.len??null,p.count??null,p.day??null,today,writer,key,writer,today),
        db.prepare("SELECT rev,section FROM reports WHERE key=?").bind(key)
      ]);
      const row=result[2].results[0];
      if (!row) fail(429,"Zu viele neue Meldungen. Bitte später erneut versuchen.");
      if (!remove && (row.section===null||row.rev>p.revision)) fail(409,"Diese Freigabe wurde bereits geändert.");
      return reply({shared:row.section!==null});
    } catch (e) {
      return reply({error:e.status?e.message:"Fangmeldungen sind vorübergehend nicht erreichbar."},e.status||503);
    }
  };
}
