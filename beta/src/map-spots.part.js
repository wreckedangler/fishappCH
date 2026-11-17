/* ================= FÄNGE UND EIGENE SPOTS AUF DER KARTE ================= */
// Everything here stays on the device (localStorage "spots", catches in "log").
const SPOT_TYPES={
  hotspot:{label:"Hotspot",color:"#e8590c",icon:'<path d="M12 2.5c.8 3.6-2.6 4.8-2.6 8.4a2.6 2.6 0 0 0 5.2 0c0-.9-.4-1.8-.9-2.6 2.7 1.7 3.6 3.6 3.6 5.5a5.3 5.3 0 0 1-10.6 0c0-4.6 5.3-6.2 5.3-11.3z" fill="currentColor"/>'},
  zugang:{label:"Zugang / Ufer",color:"#2b8a3e",icon:'<path d="M4 19h4v-4h4v-4h4V7h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'},
  parkplatz:{label:"Parkplatz",color:"#1c7ed6",icon:'<path d="M8 20V4h5a4.5 4.5 0 0 1 0 9H8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'},
  boot:{label:"Bootsplatz",color:"#0b7285",icon:'<path d="M3.5 14.5h17l-3 5h-11zM12 3.5v11M12 4.5l6 8.5h-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>'},
  notiz:{label:"Notiz",color:"#495057",icon:'<path d="M7 3.5h10v17l-5-4-5 4z" fill="currentColor"/>'}
};
let spots=store.get("spots",[]);
let spotMarkers=new Map(),placeMode=null,catchAt=null,pressMarker=null;
let mapFilter=Object.assign({catches:true,spots:true,art:"",period:"alle"},store.get("mapFilter",{}));
const saveSpots=()=>store.set("spots",spots);
function spotIcon(type,size=18){const t=SPOT_TYPES[type]||SPOT_TYPES.notiz;return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${t.icon}</svg>`}
function spotPinHTML(s){
  const t=SPOT_TYPES[s.type]||SPOT_TYPES.notiz;
  return `<svg class="spot-shape" viewBox="0 0 40 50" aria-hidden="true"><path d="M20 48c-1.2 0-13-14.5-13-27a13 13 0 0 1 26 0c0 12.5-11.8 27-13 27z" fill="${t.color}" stroke="#fff" stroke-width="2.5"/></svg><span class="spot-glyph" style="color:${t.color}">${spotIcon(s.type,16)}</span>`;
}
function refreshSpots(){
  spots=store.get("spots",[]);
  if(!map)return;
  const keep=new Set();
  for(const s of mapFilter.spots?spots:[]){
    keep.add(s.id);
    let m=spotMarkers.get(s.id);
    if(!m){
      const el=document.createElement("button");el.type="button";el.className="spot-pin";
      el.addEventListener("click",e=>{e.stopPropagation();openSpot(s.id)});
      m=new maplibregl.Marker({element:el,anchor:"bottom"}).setLngLat([s.lon,s.lat]).addTo(map);
      spotMarkers.set(s.id,m);
    }
    const el=m.getElement();
    el.innerHTML=spotPinHTML(s);el.setAttribute("aria-label",(SPOT_TYPES[s.type]?.label||"Spot")+": "+s.name);el.title=s.name;
    el.classList.toggle("selected",mapSel?.t==="spot"&&mapSel.id===s.id);
    m.setLngLat([s.lon,s.lat]);
  }
  for(const [id,m] of spotMarkers)if(!keep.has(id)){m.remove();spotMarkers.delete(id)}
}
function catchVisible(f){
  if(!Number.isFinite(f.lat)||!Number.isFinite(f.lon))return false;
  if(mapFilter.art&&f.art!==mapFilter.art)return false;
  if(mapFilter.period==="saison"&&!String(f.day).startsWith(String(new Date().getFullYear())))return false;
  if(mapFilter.period==="30"&&Date.now()-f.ts>30*864e5)return false;
  return true;
}
const catchCm=new Intl.NumberFormat("de-CH",{useGrouping:false,maximumFractionDigits:3});
function catchLengthText(value){
  const n=typeof value==="string"?Number(value.trim().replace(",",".")):value;
  return Number.isFinite(n)&&n>0?catchCm.format(n)+" cm":"";
}
// MapLibre requests each visible length/outcome combination once per style.
// Both the fish and its length are available offline without map font tiles.
function addCatchImage({id}){
  if(!id.startsWith("fb-catch-pin/")||map.hasImage(id))return;
  const [,outcome,label]=id.split("/"),kept=outcome==="kept";
  const pixelRatio=devicePixelRatio>1?2:1,canvas=document.createElement("canvas"),g=canvas.getContext("2d");
  const font="600 14px system-ui, sans-serif",purple="#713fad",ink=kept?"#fff":purple,fill=kept?purple:"#fff";
  g.font=font;
  const width=label?Math.ceil(32+g.measureText(label).width+11):36,height=44,middle=width/2;
  canvas.width=width*pixelRatio;canvas.height=height*pixelRatio;g.scale(pixelRatio,pixelRatio);
  g.beginPath();g.moveTo(17,2);g.lineTo(width-17,2);g.quadraticCurveTo(width-2,2,width-2,16);
  g.quadraticCurveTo(width-2,30,width-17,30);g.lineTo(middle+5,30);g.lineTo(middle,42);
  g.lineTo(middle-5,30);g.lineTo(17,30);g.quadraticCurveTo(2,30,2,16);g.quadraticCurveTo(2,2,17,2);g.closePath();
  g.lineJoin="round";g.lineWidth=2.5;g.fillStyle=fill;g.fill();g.strokeStyle=ink;g.stroke();
  g.fillStyle=ink;
  g.beginPath();g.moveTo(8,16);g.bezierCurveTo(12,11,19,9,23,15);g.lineTo(28,12);g.lineTo(28,20);g.lineTo(23,17);
  g.bezierCurveTo(19,23,12,21,8,16);g.fill();
  g.fillStyle=fill;g.beginPath();g.arc(13,15.2,1.2,0,Math.PI*2);g.fill();
  if(label){g.font=font;g.fillStyle=ink;g.textBaseline="middle";g.fillText(label,32,16);}
  map.addImage(id,g.getImageData(0,0,canvas.width,canvas.height),{pixelRatio});
}
function addCatchLayers(){
  map.addSource("fb-catches",{type:"geojson",data:catchData,cluster:true,clusterRadius:42,clusterMaxZoom:15});
  map.addLayer({id:"fb-catch-cluster",type:"circle",source:"fb-catches",filter:["has","point_count"],paint:{
    "circle-color":"#713fad","circle-radius":["step",["get","point_count"],15,10,18,30,22],
    "circle-stroke-color":"#fff","circle-stroke-width":2.5,"circle-opacity":.95}});
  map.addLayer({id:"fb-catch-count",type:"symbol",source:"fb-catches",filter:["has","point_count"],layout:{
    "text-field":["get","point_count_abbreviated"],"text-font":labelFont,"text-size":13,"text-allow-overlap":true},paint:{"text-color":"#fff"}});
  map.addLayer({id:"fb-catches",type:"symbol",source:"fb-catches",filter:["!",["has","point_count"]],layout:{
    "icon-image":["get","badge"],"icon-anchor":"bottom","icon-pitch-alignment":"viewport","icon-rotation-alignment":"viewport",
    "icon-allow-overlap":true,"icon-ignore-placement":true,"icon-padding":0}});
}
function drawCatches(){
  if(!map)return;
  const features=mapFilter.catches?state.log.filter(catchVisible).map(f=>({type:"Feature",geometry:{type:"Point",coordinates:[f.lon,f.lat]},
    properties:{id:String(f.id),kept:!!f.kept,badge:"fb-catch-pin/"+(f.kept?"kept/":"released/")+catchLengthText(f.len)}})):[];
  catchData=FC(features);if(mapReady)map.getSource("fb-catches")?.setData(catchData);
}
function catchMapClick(point,box){
  const layers=["fb-catches","fb-catch-cluster"];
  if(mapFilter.publicReports!==false)layers.push("fb-public-dots");
  // A direct tap on a badge wins over a different marker inside the touch margin.
  const direct=map.queryRenderedFeatures(point,{layers});
  const hits=direct.length?direct:map.queryRenderedFeatures(box,{layers}),first=hits[0];
  if(!first)return false;
  if(first.layer.id==="fb-public-dots"){openPublicMapFeature(first);return true}
  if(first.layer.id==="fb-catch-cluster"){
    const source=map.getSource("fb-catches");
    source.getClusterExpansionZoom(first.properties.cluster_id).then(zoom=>{
      if(map.getSource("fb-catches")===source)map.easeTo({center:first.geometry.coordinates,zoom:zoom+.3,duration:450});
    }).catch(()=>{});
    return true;
  }
  const ids=new Set(hits.filter(h=>h.layer.id==="fb-catches").map(h=>String(h.properties.id)));
  if(ids.size===1)openCatch(first.properties.id);
  else {
    const entries=state.log.filter(f=>ids.has(String(f.id)));
    cancelMapQuery();
    const choices=entries.map(f=>'<button type="button" data-map-catch="'+esc(f.id)+'"><b>'+esc([f.art,catchLengthText(f.len)].filter(Boolean).join(" · "))+'</b><small>'+esc(new Date(f.ts).toLocaleString("de-CH",{dateStyle:"short",timeStyle:"short"}))+'</small></button>').join("");
    ask('<h2>Fang auswählen</h2><div id="mapCatchOptions">'+choices+'</div>',null,false);
    const dialog=$("#dlg");$("#dlgYes").textContent="Schliessen";
    dialog.addEventListener("close",()=>{$("#dlgYes").textContent="OK"},{once:true});
    $("#mapCatchOptions").onclick=e=>{const b=e.target.closest("[data-map-catch]");if(b){dialog.close();openCatch(b.dataset.mapCatch)}};
  }
  return true;
}

/* ---- Langes Drücken: Spot speichern oder Fang hier erfassen ---- */
function closePress(){if(pressMarker){pressMarker.remove();pressMarker=null}}
function openPlaceMenu(ll){
  if(placeMode)return;
  closePress();cancelMapQuery();
  const el=document.createElement("div");el.className="press-menu";
  el.innerHTML=`<div class="press-dot"></div><div class="press-card" role="dialog" aria-label="Diese Stelle">
    <button type="button" data-press="spot">${spotIcon("hotspot",18)}<span>Spot speichern</span></button>
    <button type="button" data-press="catch"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M2 12c3-4 7-6 12-5 3 .6 5 2.3 6 3.5L23 8v8l-3-2.5c-1 1.2-3 2.9-6 3.5-5 1-9-1-12-5z" fill="currentColor"/></svg><span>Fang hier erfassen</span></button>
    <button type="button" data-press="close" class="press-x" aria-label="Schliessen">${XICON}</button></div>`;
  el.addEventListener("click",e=>{
    e.stopPropagation();
    const b=e.target.closest("[data-press]");if(!b)return;
    const a=b.dataset.press;closePress();
    if(a==="spot")editSpot(null,{lat:ll.lat,lon:ll.lng});
    if(a==="catch"){catchAt={lat:+ll.lat.toFixed(5),lon:+ll.lng.toFixed(5)};show("fang");toast("Der nächste Fang wird an der markierten Stelle gespeichert.");renderCatchAt()}
  });
  el.addEventListener("pointerdown",e=>e.stopPropagation());
  pressMarker=new maplibregl.Marker({element:el,anchor:"bottom"}).setLngLat(ll).addTo(map);
  if(navigator.vibrate)navigator.vibrate(12);
}
function renderCatchAt(){
  const box=$("#catchAtNote");
  if(!catchAt){box?.remove();return}
  const host=$("#btnSave")?.parentElement;if(!host)return;
  const el=box||Object.assign(document.createElement("div"),{id:"catchAtNote",className:"verdict v-warn"});
  el.innerHTML='<div class="ln">Ort: auf der Karte markierte Stelle statt deinem Standort.</div><button type="button" class="full" id="catchAtClear">Wieder meinen Standort verwenden</button>';
  if(!box)$("#btnSave").before(el);
  $("#catchAtClear").onclick=()=>{catchAt=null;renderCatchAt()};
}
function bindLongPress(){
  let timer=null,start=null,lastMenu=0;
  const open=ll=>{if(Date.now()-lastMenu<700)return;lastMenu=Date.now();openPlaceMenu(ll)};
  map.on("contextmenu",e=>{e.preventDefault?.();open(e.lngLat)});
  const cancel=()=>{clearTimeout(timer);timer=null};
  map.on("touchstart",e=>{
    cancel();if(e.originalEvent.touches.length!==1)return;
    start=e.point;const ll=e.lngLat;
    timer=setTimeout(()=>{timer=null;open(ll)},550);
  });
  map.on("touchmove",e=>{if(timer&&start&&Math.hypot(e.point.x-start.x,e.point.y-start.y)>9)cancel()});
  map.on("touchend",cancel);map.on("touchcancel",cancel);map.on("movestart",cancel);
}

/* ---- Spots bearbeiten ---- */
function editSpot(id,at){
  const s=id?spots.find(x=>x.id===id):null;
  const type=s?.type||"hotspot";
  const chips=Object.entries(SPOT_TYPES).map(([k,t])=>`<label class="spot-type"><input type="radio" name="spotType" value="${k}"${k===type?" checked":""}><span style="--c:${t.color}">${spotIcon(k,16)}${esc(t.label)}</span></label>`).join("");
  ask(`<h2>${s?"Spot bearbeiten":"Spot speichern"}</h2>
    <label for="spotName">Name</label><input id="spotName" maxlength="60" placeholder="z.B. Kiesbank unter der Brücke" value="${esc(s?.name||"")}">
    <label>Art</label><div class="spot-types">${chips}</div>
    <label for="spotNote">Notiz</label><textarea id="spotNote" rows="3" maxlength="500" placeholder="Was ist hier gut? Tiefe, Köder, Zugang …">${esc(s?.note||"")}</textarea>`,()=>{
    const name=$("#spotName").value.trim()||(SPOT_TYPES[document.querySelector('input[name=spotType]:checked')?.value]?.label||"Spot");
    const t=document.querySelector('input[name=spotType]:checked')?.value||"hotspot";
    const note=$("#spotNote").value.trim();
    if(s)Object.assign(s,{name,type:t,note,edited:Date.now()});
    else spots.push({id:crypto.randomUUID(),lat:+at.lat.toFixed(6),lon:+at.lon.toFixed(6),name,type:t,note,ts:Date.now()});
    if(!saveSpots()){toast("Spot konnte nicht gespeichert werden.");return}
    refreshSpots();toast(s?"Spot gespeichert":"Spot gespeichert: "+name);
    if(s&&mapSel?.t==="spot"&&mapSel.id===s.id)renderSheet();
  });
  setTimeout(()=>$("#spotName")?.focus(),60);
}
function openSpot(id){
  const s=spots.find(x=>x.id===id);if(!s)return;
  ++tapSeq;closePress();clearTapPreview();
  mapSel={t:"spot",id,name:s.name,lat:s.lat,lon:s.lon};mapHits=[];renderSheet();drawSel();refreshSpots();revealHit();
}
async function openCatch(id){
  const f=state.log.find(x=>String(x.id)===String(id));if(!f)return;
  cancelMapQuery();closePress();
  mapSel={t:"catch",id:f.id,name:f.art,lat:f.lat,lon:f.lon};mapHits=[];renderSheet();drawSel();refreshSpots();revealHit();
}
function openCatchOnMap(id){
  const f=state.log.find(x=>String(x.id)===String(id));if(!f)return;
  show("karte");
  const go=()=>{
    if(Number.isFinite(f.lat)){if(!mapFilter.catches||!catchVisible(f)){mapFilter={...mapFilter,catches:true,art:"",period:"alle"};store.set("mapFilter",mapFilter);drawCatches()}
      map.flyTo({center:[f.lon,f.lat],zoom:Math.max(map.getZoom(),14),duration:700});openCatch(f.id)}
    else startPlace({type:"catch",id:f.id},"Tippe auf die Stelle, an der du "+f.art+" gefangen hast.");
  };
  if(mapReady)go();else{const t=setInterval(()=>{if(mapReady){clearInterval(t);go()}},150)}
}
function distanceText(lat,lon){
  if(!state.pos)return "";
  const d=Math.hypot((lat-state.pos.lat)*111320,(lon-state.pos.lon)*111320*Math.cos(lat*Math.PI/180));
  return d<1000?Math.round(d)+" m entfernt":(d/1000).toFixed(d<10000?1:0)+" km entfernt";
}
function spotSheet(){
  const s=spots.find(x=>x.id===mapSel.id);if(!s)return null;
  const t=SPOT_TYPES[s.type]||SPOT_TYPES.notiz,dist=distanceText(s.lat,s.lon);
  const nav=`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
  return {
    title:s.name,pills:`<span class="pill spot-pill" style="--c:${t.color}">${spotIcon(s.type,14)}${esc(t.label)}</span>${dist?`<span class="pill p-mut">${dist}</span>`:""}`,
    actions:`<a class="btn pri" href="${nav}" target="_blank" rel="noopener">Navigation starten</a><button type="button" data-sh="spot-edit">Bearbeiten</button>`,
    body:(s.note?`<p class="sh-note">${esc(s.note)}</p>`:'<p class="sh-d">Keine Notiz.</p>')+
      `<p class="sh-d">Gespeichert am ${new Date(s.ts).toLocaleDateString("de-CH")} · ${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</p>
      <div class="sh-a"><button type="button" data-sh="spot-move">Verschieben</button><button type="button" class="del" data-sh="spot-del">Löschen</button></div>`
  };
}
function catchSheet(){
  const f=state.log.find(x=>String(x.id)===String(mapSel.id));if(!f)return null;
  const water=(f.canton||"SO")==="SO"?(typeof waterLabel==="function"?waterLabel("SO",f.sec):f.sec):cname(f.canton)+((f.waterName||cwLabel(f.canton,f.sec))?" · "+(f.waterName||cwLabel(f.canton,f.sec)):"");
  return {
    title:[f.art,catchLengthText(f.len)].filter(Boolean).join(" · "),
    pills:`<span class="pill ${f.kept?"p-ok":"p-mut"}">${f.kept?"behalten":"zurückgesetzt"}</span>${f.n>1?`<span class="pill p-mut">${f.n} Stück</span>`:""}`,
    actions:`<button type="button" class="pri" data-sh="catch-book">Im Fangbuch öffnen</button>`,
    body:`<div class="sh-photo" id="shPhoto"></div><p class="sh-d">${new Date(f.ts).toLocaleString("de-CH",{dateStyle:"full",timeStyle:"short"})}<br>${esc(water||"")}</p>${f.note?`<p class="sh-note">${esc(f.note)}</p>`:""}
      <div class="sh-a"><button type="button" data-sh="catch-move">Ort ändern</button></div>`,
    photo:f.photoKey
  };
}
let sheetPhotoUrl=null;
async function fillSheetPhoto(key){
  const box=$("#shPhoto");if(!box||!key)return;
  try{const blob=await accessPhoto("get",key);if(!blob||$("#shPhoto")!==box)return;
    if(sheetPhotoUrl)URL.revokeObjectURL(sheetPhotoUrl);sheetPhotoUrl=URL.createObjectURL(blob);
    box.innerHTML=`<img src="${sheetPhotoUrl}" alt="Fangfoto">`;}catch{}
}
function startPlace(mode,text){
  placeMode=mode;mapSel=null;renderSheet();drawSel();
  let bar=$("#placeBar");
  if(!bar){bar=document.createElement("div");bar.id="placeBar";$("#v-karte").append(bar)}
  bar.innerHTML=`<span>${esc(text)}</span><button type="button" id="placeCancel">Abbrechen</button>`;bar.hidden=false;
  $("#placeCancel").onclick=endPlace;
}
function endPlace(){placeMode=null;const bar=$("#placeBar");if(bar)bar.hidden=true}
function applyPlace(ll){
  const mode=placeMode;endPlace();
  const lat=+ll.lat.toFixed(5),lon=+ll.lng.toFixed(5);
  if(mode.type==="spot"){
    const s=spots.find(x=>x.id===mode.id);if(!s)return;
    s.lat=+ll.lat.toFixed(6);s.lon=+ll.lng.toFixed(6);saveSpots();refreshSpots();openSpot(s.id);toast("Spot verschoben");
  }else{
    const log=state.log.map(r=>String(r.id)===String(mode.id)?{...r,lat,lon}:r);
    if(!store.set("log",log)){toast("Ort konnte nicht gespeichert werden.");return}
    state.log=log;drawCatches();if(typeof renderStats==="function"&&$("#v-stat").classList.contains("on"))renderStats();openCatch(mode.id);toast("Fangort gespeichert");
  }
}
function spotAction(a){
  if(a==="spot-edit"&&mapSel?.t==="spot"){editSpot(mapSel.id);return true}
  if(a==="spot-move"&&mapSel?.t==="spot"){startPlace({type:"spot",id:mapSel.id},"Tippe auf die neue Stelle für den Spot.");return true}
  if(a==="spot-del"&&mapSel?.t==="spot"){
    const s=spots.find(x=>x.id===mapSel.id);
    ask(`<h2>Spot löschen?</h2><p>«${esc(s?.name||"")}» wird von diesem Handy entfernt.</p>`,()=>{
      spots=spots.filter(x=>x.id!==s.id);saveSpots();mapSel=null;renderSheet();drawSel();refreshSpots();toast("Spot gelöscht")});
    return true;
  }
  if(a==="catch-book"&&mapSel?.t==="catch"){
    const id=mapSel.id;mapSel=null;renderSheet();show("stat");
    setTimeout(()=>{const row=document.getElementById("catch-"+id);if(row){row.scrollIntoView({block:"center"});row.focus({preventScroll:true})}},60);return true;
  }
  if(a==="catch-move"&&mapSel?.t==="catch"){startPlace({type:"catch",id:mapSel.id},"Tippe auf die richtige Stelle des Fangs.");return true}
  return false;
}

/* ---- Ebenen: Fänge und Spots filtern ---- */
function renderLayerPanel(){
  const p=$("#mapLayers");if(!p)return;
  const arts=[...new Set(state.log.filter(f=>Number.isFinite(f.lat)).map(f=>f.art))].sort((a,b)=>a.localeCompare(b,"de"));
  const withPos=state.log.filter(f=>Number.isFinite(f.lat)).length,noPos=state.log.length-withPos;
  p.innerHTML=`<div class="ml-head"><strong>Auf der Karte</strong><button type="button" class="ml-x" data-ml="close" aria-label="Schliessen">${XICON}</button></div>
    <label class="ml-row"><span><b>Offene Gewässer hervorheben</b><small>Grün: Saison heute offen</small></span><input type="checkbox" class="ios-switch" data-ml="openFocus"${mapFilter.openFocus!==false?" checked":""}></label>
    ${reportPanel()}
    <label class="ml-row"><span><b>Meine Fänge</b><small>${withPos} mit Ort${noPos?` · ${noPos} ohne Ort`:""}</small></span><input type="checkbox" class="ios-switch" data-ml="catches"${mapFilter.catches?" checked":""}></label>
    <div class="ml-sub"${mapFilter.catches?"":" hidden"}>
      ${arts.length>1?`<div class="ml-arts" role="group" aria-label="Fischart">${["",...arts].map(a=>`<button type="button" data-art="${esc(a)}" class="${a===mapFilter.art?"on":""}" aria-pressed="${a===mapFilter.art}">${a?esc(a):"Alle"}</button>`).join("")}</div>`:""}
      <div class="ml-seg">${[["alle","Alle"],["saison","Diese Saison"],["30","30 Tage"]].map(([k,l])=>`<button type="button" data-period="${k}" class="${mapFilter.period===k?"on":""}">${l}</button>`).join("")}</div>
    </div>
    <label class="ml-row"><span><b>Meine Spots</b><small>${spots.length} gespeichert</small></span><input type="checkbox" class="ios-switch" data-ml="spots"${mapFilter.spots?" checked":""}></label>
    ${spots.length?`<div class="ml-spots">${spots.slice().sort((a,b)=>b.ts-a.ts).map(s=>`<button type="button" data-spot="${esc(s.id)}"><span class="ml-ico" style="--c:${(SPOT_TYPES[s.type]||SPOT_TYPES.notiz).color}">${spotIcon(s.type,15)}</span><span>${esc(s.name)}<small>${esc(distanceText(s.lat,s.lon)||(SPOT_TYPES[s.type]||SPOT_TYPES.notiz).label)}</small></span></button>`).join("")}</div>`:""}
    <p class="ml-tip">Lange drücken für neuen Spot oder Fang.</p>`;
}
function bindLayerPanel(){
  const p=$("#mapLayers");
  $("#mapLayersBtn").onclick=e=>{e.stopPropagation();if(p.hidden){renderLayerPanel();p.hidden=false}else p.hidden=true};
  p.addEventListener("click",e=>{
    const days=e.target.closest("[data-report-days]");
    if(days){mapFilter.publicDays=Number(days.dataset.reportDays);store.set("mapFilter",mapFilter);renderLayerPanel();refreshReports(true);
      if(mapSel?.t==="public")openPublicSection(mapSel.id,mapSel.name,[mapSel.lon,mapSel.lat]);return;}
    if(e.target.closest("[data-report-retry]")){refreshReports(true);return;}
    const art=e.target.closest("[data-art]");
    if(art){mapFilter={...mapFilter,art:art.dataset.art};store.set("mapFilter",mapFilter);drawCatches();const sc=p.querySelector(".ml-arts").scrollLeft;renderLayerPanel();p.querySelector(".ml-arts").scrollLeft=sc;return}
    const per=e.target.closest("[data-period]");
    if(per){mapFilter={...mapFilter,period:per.dataset.period};store.set("mapFilter",mapFilter);drawCatches();renderLayerPanel();return}
    const sp=e.target.closest("[data-spot]");
    if(sp){p.hidden=true;const s=spots.find(x=>x.id===sp.dataset.spot);if(s){if(!mapFilter.spots){mapFilter={...mapFilter,spots:true};store.set("mapFilter",mapFilter);refreshSpots()}
      map.flyTo({center:[s.lon,s.lat],zoom:Math.max(map.getZoom(),15),duration:700});openSpot(s.id)}return}
    if(e.target.closest('[data-ml="close"]'))p.hidden=true;
  });
  p.addEventListener("change",e=>{
    const k=e.target.dataset.ml;if(!k)return;
    mapFilter={...mapFilter,[k]:e.target.type==="checkbox"?e.target.checked:e.target.value};store.set("mapFilter",mapFilter);
    if(k==="openFocus")applyZoneDim(zoneDim,true);
    if(k==="publicReports"){if(!mapFilter.publicReports&&mapSel?.t==="public")sheetAction("close");refreshReports(true);}
    drawCatches();refreshSpots();renderLayerPanel();
  });
  document.addEventListener("pointerdown",e=>{if(!p.hidden&&!e.target.closest("#mapLayers,#mapLayersBtn"))p.hidden=true},true);
}
