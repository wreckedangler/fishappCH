/* ================= KARTE (MapLibre GL) ================= */
// Zoom conventions: MapLibre uses 512 px tiles. All data thresholds below are written
// in Leaflet/WMTS zoom levels (256 px tiles), therefore lz() = map zoom + 1.
let map=null,mapReady=false,follow=false,meAnim=null,mePos=null;
const lz=()=>map?map.getZoom()+1:0;
const swissCalendar=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
let mapDate=swissCalendar.format(new Date());
let mapTime=null;
function mapRuleDate(){const [y,m,d]=mapDate.split("-").map(Number);return new Date(y,m-1,d,12)}
function sectionMark(c,kind,buried,rule,rev,region){
  const mark=FishSections.symbol(kind,buried);
  if(buried||FishSections.restriction(kind))return mark;
  if(c==="SG"&&FishRights.sgProtection(rev,region))return "condition";
  if(rule&&RULES[c]?.closed?.some(cl=>cl.w.includes(rule)&&inRange(mapRuleDate(),cl.from,cl.to)))return "closed";
  // Known water class with cantonal rules and no general closure today: season open.
  if(rule&&(mark==="permit"||mark==="district")&&RULES[c]?.w?.some(([k])=>k===rule))return "open";
  return mark;
}
function westMark(c,f){
  const mark=sectionMark(c,f.art,false,f.cw);
  if(mark==="closed")return mark;
  const period=fisheryPeriod(c,f,mapTime);
  return period==="night"?"closed":period||mark;
}
function soSymbol(f){
  const sec=secById(f.id);
  if(isDetailed("SO")&&sec.kind!=="other"&&sec.kind!=="schon"){
    if(secStatus(sec,mapRuleDate()).some(s=>s.lvl==="bad"))return "closed";
    if(sec.kind==="patent"&&GEO.official)return "open";
  }
  return FishSections.symbol(f.art);
}

/* ---- Quellen / Credits ---- */
const credits={base:new Set(['© <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener">swisstopo</a>']),sections:new Set(),west:new Set(),so:new Set(),east:new Set(),overview:new Set()};
function setCredits(group,set){credits[group]=set;updateCredits()}
function updateCredits(){
  const all=[...new Set(Object.values(credits).flatMap(s=>[...s]))];
  const detail=$("#mapCreditDetail");if(detail)detail.innerHTML=all.join(" · ");
}

/* ---- Hilfsfunktionen Geometrie ---- */
const R_EARTH=6378137;
const merc=(lat,lon)=>[lon*Math.PI/180*R_EARTH,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*R_EARTH];
const unmerc=(x,y)=>({lat:(2*Math.atan(Math.exp(y/R_EARTH))-Math.PI/2)*180/Math.PI,lng:x/R_EARTH*180/Math.PI});
function partsBox(parts){
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  const add=p=>{b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1])};
  for(const part of parts){for(const l of part.lines||[])l.forEach(add);for(const poly of part.polygons||[])for(const r of poly)r.forEach(add)}
  return Number.isFinite(b[0])?b:null;
}
const FC=features=>({type:"FeatureCollection",features});

/* ---- Zonenstil ---- */
const DASHED={private:[2.5,1.4],unknown:[1,1.4],culvert:[2.5,1.8],closed:[1.4,1.8]};
const RULE_MARKS=["protected","closed","condition"];
// FishSections is loaded with the map, so styles are built on demand.
const colorExpr=()=>["match",["get","k"],...Object.entries(FishSections.symbols).flatMap(([k,s])=>[k,s.color]),"#7b8c92"];
const isArea=["==",["get","a"],1];
const kIs=k=>["==",["get","k"],k];
// Widths and opacities as in the Leaflet brush. MapLibre needs ["zoom"] at the top of the
// expression, so every zoom band carries its own data expression.
// Bands in MapLibre zoom: <8 overview (Leaflet <9), 8–9, 9–11, 11–14, ≥14.
const zstep=fn=>["step",["zoom"],fn(0),8,fn(1),9,fn(2),11,fn(3),14,fn(4)];
const zoneAreaK=()=>["in",["get","k"],["literal",["district","private","condition"]]];
const ruleK=()=>["in",["get","k"],["literal",RULE_MARKS]];
const LINE_W=[1.5,1.5,2,2.8,3.5];
function bandInk(band){
  const prot=["case",kIs("protected"),.6,0];
  if(band===0)return ["case",kIs("open"),2.2,ruleK(),1.4,.85];
  const area=band<3?["case",zoneAreaK(),1.6,.85]:["case",zoneAreaK(),2.4,1.35];
  return ["case",isArea,area,["+",LINE_W[band],prot]];
}
const inkWidth=()=>zstep(bandInk);
const casingWidth=()=>zstep(b=>["+",bandInk(b),b===0?1:["case",isArea,["case",zoneAreaK(),2,1],b<3?1.5:2.2]]);
const selWidth=extra=>zstep(b=>["+",LINE_W[b],extra,["case",kIs("protected"),.6,0]]);
let zoneDim=1;
// "Offene hervorheben": everything that is not open fades back.
const openFocus=()=>mapFilter.openFocus!==false;
const notOpenF=()=>openFocus()?.5:1;
const focusMul=v=>["*",v,["case",kIs("open"),1,notOpenF()]];
const casingOpacity=()=>zstep(b=>focusMul(b===0?["case",kIs("open"),.73*zoneDim,.22*zoneDim]:.73*zoneDim));
const inkOpacity=()=>zstep(b=>focusMul(b===0?["case",["any",kIs("open"),ruleK()],zoneDim,.64*zoneDim]:zoneDim));
const glowOpacity=()=>zstep(b=>(b===0?.42:b<3?.5:.4)*zoneDim*(openFocus()?1:.6));
const glowWidth=()=>zstep(b=>["+",bandInk(b),b===0?5:b<3?7:9]);
function fillOpacity(){
  return focusMul(["*",zoneDim,["case",ruleK(),.62,kIs("open"),.3,zoneAreaK(),.23,.12]]);
}
const ZONE_SOURCES=["fb-sec","fb-west","fb-so"];
const zoneData={"fb-sec":FC([]),"fb-west":FC([]),"fb-so":FC([])};
function tierFilter(tier,extra){
  const base=tier==="rule"?["in",["get","k"],["literal",RULE_MARKS]]:tier==="open"?kIs("open"):
    ["all",["!",["in",["get","k"],["literal",RULE_MARKS]]],["!=",["get","k"],"open"]];
  return extra?["all",base,extra]:base;
}
function zoneLayerSpecs(){
  const specs=[];
  for(const src of ZONE_SOURCES)specs.push({id:src+"-fill",type:"fill",source:src,filter:isArea,
    paint:{"fill-color":colorExpr(),"fill-opacity":fillOpacity(),"fill-antialias":false},meta:"fill"});
  const lineLayout={"line-cap":"round","line-join":"round"};
  for(const src of ZONE_SOURCES)specs.push({id:src+"-glow",type:"line",source:src,filter:kIs("open"),layout:lineLayout,
    paint:{"line-color":"#12c28e","line-width":glowWidth(),"line-blur":["step",["zoom"],3,11,4.5],"line-opacity":glowOpacity()},meta:"glow"});
  for(const tier of ["normal","open","rule"]){
    for(const src of ZONE_SOURCES)specs.push({id:`${src}-case-${tier}`,type:"line",source:src,filter:tierFilter(tier),layout:lineLayout,
      paint:{"line-color":"#fff","line-width":casingWidth(),"line-opacity":casingOpacity()},meta:"casing"});
    for(const src of ZONE_SOURCES){
      const dashed=Object.keys(DASHED).filter(k=>tier==="rule"?RULE_MARKS.includes(k):tier==="normal"&&!RULE_MARKS.includes(k));
      specs.push({id:`${src}-ink-${tier}`,type:"line",source:src,filter:tierFilter(tier,["!",["in",["get","k"],["literal",dashed]]]),layout:lineLayout,
        paint:{"line-color":colorExpr(),"line-width":inkWidth(),"line-opacity":inkOpacity()},meta:"ink"});
      for(const k of dashed)specs.push({id:`${src}-ink-${tier}-${k}`,type:"line",source:src,filter:kIs(k),layout:{"line-join":"round"},
        paint:{"line-color":colorExpr(),"line-width":inkWidth(),"line-opacity":inkOpacity(),"line-dasharray":DASHED[k]},meta:"ink"});
    }
  }
  return specs;
}
function applyZoneDim(f,force){
  if((f===zoneDim&&!force)||!mapReady)return;zoneDim=f;
  for(const s of zoneLayerSpecs()){
    if(!map.getLayer(s.id))continue;
    if(s.meta==="fill")map.setPaintProperty(s.id,"fill-opacity",fillOpacity());
    else map.setPaintProperty(s.id,"line-opacity",s.meta==="casing"?casingOpacity():s.meta==="glow"?glowOpacity():inkOpacity());
  }
  if(map.getLayer("fb-lakes-fill")){map.setPaintProperty("fb-lakes-fill","fill-opacity",lakeFillOpacity());map.setPaintProperty("fb-lakes-line","line-opacity",lakeLineOpacity())}
  if(map.getLayer("fb-hydro"))map.setPaintProperty("fb-hydro","raster-opacity",hydroOpacity());
  for(const img of coarseImages){const id="fb-coarse-"+img.id;if(map.getLayer(id))map.setPaintProperty(id,"raster-opacity",zoneDim)}
}
function hydroOpacity(){
  const luft=store.get("base","luft")!=="topo",f=zoneDim<1?.75:1;
  return luft?["step",["zoom"],.30*f,10,.38*f,14,.54*f]:["step",["zoom"],.26*f,10,.34*f];
}
let labelFont=["Frutiger Neue Regular"];

/* ---- Datenquellen zeichnen ---- */
function setZones(src,fc){zoneData[src]=fc;if(mapReady)map.getSource(src)?.setData(fc)}
const soFeatureCache={key:"",fc:null};
function drawGeo(){
  if(!map||!GEO.official)return;
  const zoom=Math.floor(lz()),key=[zoom<=11?zoom:12,mapDate,DATA_META.version,GEO.date,GEO.features.length].join("|");
  if(soFeatureCache.key===key)return;
  soFeatureCache.key=key;
  setCredits("so",GEO.features.length?new Set(["© Amt für Wald, Jagd und Fischerei SO"]):new Set());
  const features=[];
  for(const f of GEO.features){
    const box=f.box||(f.box=(()=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const l of f.l)for(const [x,y] of l){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)}return b})());
    if(detailBounds&&!FishSections.intersects(box,detailBounds))continue;
    const k=kindOf(f.art),mark=soSymbol(f);
    const tiny=FishSections.subPixel(box,lz());
    const geometry=tiny?{type:"LineString",coordinates:FishSections.shortMark(f.l[0][0],lz())}:{type:"MultiLineString",coordinates:f.l};
    features.push({type:"Feature",geometry,properties:{k:mark,a:0,key:"SO/"+f.id,lb:k==="patent"||k==="schon"?f.id:"",ls:k==="schon"?1:0}});
  }
  setZones("fb-so",FC(features));
}
let catchData=FC([]);
function accuracyRadius(p){
  const mpp0=156543.03392*Math.cos(p.lat*Math.PI/180)/2; // metres per px at GL zoom 0 (512 px tiles)
  const r0=p.acc/mpp0;
  return ["interpolate",["exponential",2],["zoom"],0,r0,22,r0*2**22];
}
function locationPoint(p){
  return FC(p?[{type:"Feature",geometry:{type:"Point",coordinates:[p.lon,p.lat]},properties:{}}]:[]);
}
function updateMe(){
  const p=state.pos;if(!map||!p)return;
  if(mapReady){
    const source=map.getSource("fb-me"),from=mePos;
    cancelAnimationFrame(meAnim);
    const paint=pos=>{mePos=pos;source.setData(locationPoint(pos))};
    if(!from||!$("#v-karte").classList.contains("on")||matchMedia("(prefers-reduced-motion: reduce)").matches)paint(p);
    else if(from.lat!==p.lat||from.lon!==p.lon){
      const start=performance.now();let last=start;
      const step=now=>{
        if(!mapReady||map.getSource("fb-me")!==source)return;
        const k=Math.min(1,(now-start)/700);
        if(k===1){paint(p);return}
        // Bound worker updates while the GPS dot glides between two fixes.
        if(now-last>=50){const e=1-(1-k)**3;paint({lat:from.lat+(p.lat-from.lat)*e,lon:from.lon+(p.lon-from.lon)*e});last=now}
        meAnim=requestAnimationFrame(step);
      };
      meAnim=requestAnimationFrame(step);
    }
    map.setPaintProperty("fb-me-acc","circle-radius",accuracyRadius(p));
  }
  if(follow){
    const target=[p.lon,p.lat];
    if(map.project(target).dist(map.project(map.getCenter()))>1)map.easeTo({center:target,duration:700});
  }
  syncLocateButton();
}

/* ---- Fischerei-Geodaten weiterer Kantone (gebündelt, im Hintergrund aktualisiert) ---- */
const eastCoverage={
  JU:["Der öffentliche Kartendienst des Jura unterscheidet Patentstrecken, Reservate und besondere Vorschriften. Die genaue Auskunft am Punkt wird online geladen.","Kantonale Fischereikarte Jura","https://geo.jura.ch/s/ENV_04_33"],
  NW:["Die Karte zeigt die privaten Fischenzen im See. Das Recht kann auf bestimmte Fischarten oder Geräte beschränkt sein.","Fischenzenkarte Nidwalden","https://www.gis-daten.ch/karte/jagd-und-fischerei-nw/"],
  GE:["Die Genfer Sektoren stammen aus der amtlichen Fischereikarte. Örtliche Sperren und Fangzeiten richten sich nach Gewässer und Fischart.","Fischereisektoren Kanton Genf","https://www.ge.ch/permis-peche/pecher-geneve-repeuplement-etangs"],
  LU:["Die Luzerner Fischereikarte zeigt Reviere, Patentgebiete und private Fischereirechte. Am Sempachersee sind auch die amtlichen Reservat- und Ruhezonen eingezeichnet. Blaue Gewässer haben hier keine Revierauskunft.","Fischereikarte Kanton Luzern","https://map.geo.lu.ch/fauna/fischerei/"],
  AG:["Gewässer- und Reviernamen gemäss AGIS. Die Revierkarte des Kantons beschreibt die befischbaren Abschnitte und die Schutzgebiete.","Aargauer Revierkarten","https://www.ag.ch/de/themen/landwirtschaft-tiere/wild-wassertiere/fischerei/fischerei-im-kanton-aargau/revierkarten"],
  ZH:["Geometrien gemäss Fischerei- und Jagdverwaltung. Auch kleine und eingedolte Bäche können zu einem Revier gehören.","Zürcher Fischereireviere","https://geolion.zh.ch/geodatensatz/386"],
  AI:["Die amtliche Fischereikarte verwendet die Farben des Kantons. Die genaue Abgrenzung und die Bedingungen stehen in der kantonalen Karte.","Fischereikarte Innerrhoden","https://www.geoportal.ch/ktai/map/146"],
  AR:["Reviergrenzen und Schonstrecken sind hier nicht eingezeichnet. Die amtliche Liste beschreibt die Reviere und Grenzgewässer.","Revierliste Ausserrhoden (PDF)","https://ar.ch/fileadmin/user_upload/Departement_Bau_Volkswirtschaft/Amt_fuer_Umwelt/Umwelt/Publikationen/Formular/Fischerei/Fischerei_Fischereireviere.pdf"],
  GL:["Gewässer mit Fangzeiten und kartierten Verboten. Zusätzliche Schutzgebietsregeln beim Kanton prüfen.","Glarner Schutzgebiete und Vorschriften","https://www.gl.ch/verwaltung/bau-und-umwelt/umwelt-wald-und-energie/jagd-und-fischerei/fischerei/fischereigesetzgebung.html/798"],
  GR:["Erfasst sind Fischgewässer, private Rechte, Sonderregeln und Schongewässer. Die kantonale Karte enthält die Bedingungen.","Fischereikarte Graubünden","https://map.geo.gr.ch/theme/Fischerei"],
  SG:["Ein Revier kann mehrere Zuflüsse umfassen. Die Revierkarte beschreibt die Grenzen und die geltenden Bedingungen.","St. Galler Revierkarten","https://www.sg.ch/umwelt-natur/jagd-fischerei/fischerei/fischereipatente/pachtgewaesser-kanton-st--gallen.html"],
  SH:["Kartierte Reviere und bezeichnete Verbote. Für das Uferpatent gelten abschnitts- und uferabhängige Grenzen.","Schaffhauser Uferpatent und Karte","https://sh.ch/CMS/Webseite/Kanton-Schaffhausen/Beh-rde/Verwaltung/Departement-des-Innern/Jagd-und-Fischerei/Fischerei-1238041-DE.html"],
  TG:["Schongebiete, Fischenzen, Freiangelrecht, lokale Verbote und Uferregeln. Fischreiser und weitere lokale Einschränkungen separat prüfen.","Thurgauer Fischereiverwaltung","https://jfv.tg.ch/fischerei.html/8653"]
};
function coverageInfo(c){
  const entry=eastCoverage[c];
  return entry?`<p class="sh-d">${entry[0]} <a href="${entry[2]}" target="_blank" rel="noopener">${entry[1]}</a></p>`:"";
}
const eastWms=[
  ["AI","https://www.geoportal.ch/services/wms/ktai","ch.geoportal.wald_flora_fauna.146.0.fischereikarte_kt_ai",[[47.23,9.30],[47.47,9.63]]],
  ["JU","https://geoservices.jura.ch/wms","ju.env_04_33_secteurs_de_peche",[[47.106,6.695],[47.536,7.645]]]
];
function westIntersects(c,box){
  return FishSections.intersects(XBOX[c],box)&&(c!=="BE"||box[1]<46.90||box[0]<8);
}
function viewBox(){return FishSections.boxOf(map.getBounds())}
let detailBounds=null;
function updateDetailBounds(){
  // Keep an extra screen on each side for panning. Overview zooms use all loaded zones.
  if(lz()>=12){
    const bounds=viewBox();if(FishSections.contains(detailBounds,bounds))return false;
    detailBounds=FishSections.pad(bounds,1);
  }else{
    if(!detailBounds)return false;
    detailBounds=null;
  }
  soFeatureCache.key="";xStamp="";return true;
}
function xInView(){if(!map)return[];const box=viewBox();return Object.keys(XSRC).filter(c=>westIntersects(c,box))}
const XGEO={};
let sectionMap=null,xFrame=0,xVersion=0,xStamp="";
function xg(c){return XGEO[c]||(XGEO[c]={feats:{},zones:new Map(),busy:false,all:false,fail:0})}
function xAdd(c,fc,mapf,layerIndex,target=xg(c),footprints){
  const {feats:features,zones}=target;
  for(const [index,x] of fc.features.entries()){
    const p=x.properties||{},m=mapf(p,x);if(!m?.id)continue;
    const g=m.cantonalFootprint&&footprints?footprints.get(m.id):x.geometry;
    if(!g)continue;
    if(m.cantonalFootprint)(target.footprints??=new Map()).set(m.id,g);
    const poly=g.type.includes("Polygon"),line=g.type.includes("LineString");
    if(!poly&&!line)continue;
    const sourceId=/null|undefined/i.test(m.id)?(x.id??p.OBJECTID??index):m.id;
    const zoneId=JSON.stringify([c,layerIndex,sourceId,m.art,m.name,m.t||"",m.x||[],m.cw||"",m.url||""]);
    if(!zones.has(zoneId))zones.set(zoneId,new Set());
    const parts=g.type.startsWith("Multi")?g.coordinates:[g.coordinates];
    for(const [part,coords] of parts.entries()){
      const l=poly?coords:[coords];
      if(!l.length||l.some(r=>r.length<(poly?4:2)))continue;
      const bounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(const ring of l)for(const [x,y] of ring){bounds[0]=Math.min(x,bounds[0]);bounds[1]=Math.min(y,bounds[1]);bounds[2]=Math.max(x,bounds[2]);bounds[3]=Math.max(y,bounds[3])}
      const id=[layerIndex,m.id,x.id??p.OBJECTID??index,part].join("|");
      features[id]={...m,id,zoneId,l,poly,bounds};zones.get(zoneId).add(id);
    }
  }
}
function loadX(){if(map)xInView().forEach(startWest)}
function startWest(c){
  const g=xg(c);
  if(g.all){refreshWest(c);return Promise.resolve()}
  if(!g.loading)g.loading=loadXc(c).finally(()=>{g.loading=null});
  return g.loading;
}
async function loadXc(c){
  const G=xg(c);
  if(G.busy||G.all||Date.now()-G.fail<30000)return;
  G.busy=true;updateHint();
  try{
    const res=await fetch("./data/fisheries/"+c+".json",{signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw Error("Kartenstand "+res.status);
    const {layers,date}=await res.json(),next={feats:{},zones:new Map()};
    for(const [i,rows] of layers.entries()){
      const features=rows.map(([id,properties,area,parts])=>({id,properties,geometry:area?
        {type:"MultiPolygon",coordinates:parts.map(rings=>rings.map(FishSections.decode))}:
        {type:"MultiLineString",coordinates:parts.map(FishSections.decode)}}));
      xAdd(c,{features},p=>p,i,next);
    }
    Object.assign(G,next,{all:true,fail:0,built:date});++xVersion;
    refreshWest(c);
  }catch(e){if(navigator.onLine)await refreshWest(c,true);if(!G.all)G.fail=Date.now()}
  finally {G.busy=false;scheduleWest();updateHint()}
}
function refreshWest(c,force=false){
  const g=xg(c);
  if(g.refreshing)return g.refreshing;
  if(!navigator.onLine||(!force&&lz()<10)||g.liveDay===mapDate||Date.now()-(g.retry||0)<30000)return;
  const layers=XSRC[c].layers;
  g.refreshing=Promise.all(layers.map(l=>westFeatures(l.url()))).then(collections=>{
    const next={feats:{},zones:new Map()};
    const footprints=g.footprints||new Map();
    collections.forEach((fc,i)=>xAdd(c,fc,layers[i].map,i,next,footprints));
    Object.assign(g,next,{all:true,fail:0,retry:0,liveDay:mapDate,built:mapDate});++xVersion;
    mapHits=mapHits.filter(h=>h.t!=="x"||h.code!==c||next.feats[h.id]);
    if(mapSel?.t==="x"&&mapSel.code===c&&!next.feats[mapSel.id])mapSel=null;
    if(chosenMapHit?.t==="x"&&chosenMapHit.code===c&&!next.feats[chosenMapHit.id])chosenMapHit=null;
    if(mapReady){scheduleWest();renderSheet();drawSel()}
  }).catch(e=>{g.retry=Date.now();if(!g.all)g.fail=g.retry;console.warn("Aktualisierung Fischereigeodaten",c,e)})
    .finally(()=>{g.refreshing=null;updateHint()});
  return g.refreshing;
}
function scheduleWest(){
  if(!xFrame)xFrame=requestAnimationFrame(()=>{xFrame=0;drawX()});
}
function drawX(){
  if(!map)return;
  drawLakes();
  const zoom=Math.floor(lz()),stamp=[zoom<=11?zoom:12,xVersion,mapDate,DATA_META.version,mapTime?.glNight].join("|");
  if(stamp===xStamp)return;
  xStamp=stamp;
  const features=[],active=new Set();
  for(const [code,G] of Object.entries(XGEO)){
    for(const f of Object.values(G.feats)){
      if(detailBounds&&!FishSections.intersects(f.bounds,detailBounds))continue;
      active.add(code);
      const mark=westMark(code,f),tiny=FishSections.subPixel(f.bounds,lz());
      let geometry;
      if(tiny)geometry={type:"LineString",coordinates:FishSections.shortMark(f.l[0][0],lz())};
      else if(f.poly)geometry={type:"Polygon",coordinates:FishSections.orient(f.l)};
      else geometry={type:"LineString",coordinates:f.l[0]};
      features.push({type:"Feature",geometry,properties:{k:mark,a:f.poly&&!tiny?1:0,key:"X/"+code+"/"+f.id}});
    }
  }
  setCredits("west",new Set([...active].map(c=>XSRC[c]?.attr).filter(Boolean)));
  setZones("fb-west",FC(features));
}
async function zoneJson(url){
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error("Zonenabfrage "+r.status);
  const data=await r.json();
  if(!Array.isArray(data.features))throw Error("Ungültige Zonendaten");
  return data;
}
async function cantonalWmsHits(entry,lat,lon,tol){
  const [code,url,layers]=entry;
  const [x,y]=merc(lat,lon);
  const half=50.5*40075016.686/(256*2**Math.max(lz(),11));
  const params=new URLSearchParams({service:"WMS",version:"1.3.0",request:"GetFeatureInfo",layers,query_layers:layers,
    crs:"EPSG:3857",bbox:[x-half,y-half,x+half,y+half].join(","),width:101,height:101,i:50,j:50,
    feature_count:20,styles:"",format:"image/png",info_format:"application/json"});
  if(code==="JU"){
    params.set("info_format","application/vnd.ogc.gml");
    const response=await fetch(url+"?"+params,{signal:AbortSignal.timeout(5500)});
    if(!response.ok)throw Error("Fischereikarte Jura "+response.status);
    const xml=new DOMParser().parseFromString(await response.text(),"application/xml");
    if(xml.documentElement.localName!=="msGMLOutput")throw Error("Ungültige Antwort der Fischereikarte Jura");
    const hits=[];
    for(const f of xml.getElementsByTagName("ju.env_04_33_secteurs_de_peche_feature")){
      const field=n=>f.getElementsByTagName(n)[0]?.textContent.trim()||"";
      const kind=juraKind(field("droit_peche"),field("secteurs_interdits"),field("gestion"));
      const lines=Array.from(f.getElementsByTagNameNS("*","LineString"),line=>{
        if(line.getAttribute("srsName")!=="EPSG:3857")throw Error("Unerwartetes Koordinatensystem");
        const coords=line.getElementsByTagNameNS("*","coordinates")[0]?.textContent.trim();
        return coords?coords.split(/\s+/).map(pair=>{
          const [mx,my]=pair.split(",").map(Number);
          if(!Number.isFinite(mx)||!Number.isFinite(my))throw Error("Ungültige Abschnittsgeometrie");
          const p=unmerc(mx,my);return [p.lng,p.lat];
        }):[];
      }).filter(line=>line.length>1);
      if(!lines.length)throw Error("Abschnittsgeometrie fehlt");
      const point=FishSections.nearest(lat,lon,lines);
      if(point.d>tol)continue;
      const water=field("cours_d_eau"),rev=field("troncon");
      const detail=[field("nom_complement"),field("secteurs_interdits"),field("periodes"),field("remarques")].filter(Boolean).join(" · ");
      hits.push({...point,t:"zone",code:"JU",zoneId:"JU/"+field("objectid"),water,rev,kind,name:water||"Gewässerabschnitt",
        detail,l:lines,parts:[{symbol:FishSections.symbol(kind),lines,polygons:[]}]});
    }
    return hits;
  }
  const data=await zoneJson(url+"?"+params);
  return data.features.map(f=>({t:"zone",code:"AI",zoneId:"AI/"+(f.id??f.properties?.Info??f.label),lat,lon,d:0,l:[],parts:[],pointOnly:true,name:String(f.properties?.Info||f.label||"Kartierte Zone"),kind:"Amtliche Karteninformation"}));
}

/* ---- Auswahl ---- */
let mapSel=null;
async function identifyJSON(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error();
  const data=await response.json();if(!Array.isArray(data.results))throw Error();
  return data;
}
async function waterAt(lat,lon,tolm){
  const d=tolm/111320,dx=d/Math.cos(lat*Math.PI/180),ext=[lon-dx*10,lat-d*10,lon+dx*10,lat+d*10].join(",");
  const layers="ch.swisstopo.swisstlm3d-gewaessernetz";
  const params=new URLSearchParams({geometry:lon+","+lat,geometryType:"esriGeometryPoint",layers:"all:"+layers,sr:"4326",
    tolerance:"10",mapExtent:ext,imageDisplay:"200,200,96",returnGeometry:"true",geometryFormat:"geojson",lang:"de",limit:"20"});
  const data=await identifyJSON("https://api3.geo.admin.ch/rest/services/api/MapServer/identify?"+params);
  const candidates=[];
  for(const record of data.results){
    const attrs=record.attributes||record.properties||{},g=record.geometry;
    if(!g||!Array.isArray(g.coordinates))continue;
    const poly=g.type==="Polygon"||g.type==="MultiPolygon",line=g.type==="LineString"||g.type==="MultiLineString";
    if(!poly&&!line)continue;
    const paths=g.type.startsWith("Multi")?g.coordinates:[g.coordinates];
    const lines=line?paths:[],polygons=poly?paths:[];
    const point=poly?polygons.map(rings=>FishSections.nearest(lat,lon,rings,true)).sort((a,b)=>a.d-b.d)[0]:FishSections.nearest(lat,lon,lines);
    if(!point||point.d>tolm)continue;
    const names=String(attrs.name||attrs.seename||attrs.seename_d||record.value||"").split("|").map(n=>n.trim()).filter(n=>n&&n!=="-"&&!/^\d+$/.test(n));
    candidates.push({...point,names,name:names[0]||"",hydroId:attrs.gwl_nr||"",lake:poly||Number(attrs.objektart)===101,area:poly,
      zoneId:record.layerBodId+"/"+(record.featureId??record.id??[point.lon,point.lat].join(",")),parts:[{symbol:"water",lines,polygons}]});
  }
  candidates.sort((a,b)=>a.d-b.d||Number(!a.name)-Number(!b.name)||Number(a.area)-Number(b.area));
  const first=candidates[0];
  if(first)first.ambiguous=candidates.some(w=>w.hydroId&&first.hydroId&&w.hydroId!==first.hydroId&&Math.abs(w.d-first.d)<1);
  return first||null;
}
const wNorm=x=>String(x).toLowerCase().replace(/[^a-zäöüéèàâêîôûç]/g,"");
function matchW(c,w){
  const R=RULES[c];if(!R||!R.w||!w)return{cand:[],sug:""};
  const ns=w.names.map(wNorm).filter(n=>n.length>=3);
  let cand=R.w.filter(([id,l])=>{const ln=wNorm(l);return ns.some(n=>ln.includes(n))}).map(x=>x[0]);
  const st=R.w.filter(([id,l])=>cand.includes(id)&&ns.some(n=>wNorm(l).startsWith(n))).map(x=>x[0]);if(st.length)cand=st;
  if(cand.length)return{cand,sug:cand.length===1?cand[0]:""};
  const re=w.lake?/übrige[^,]*(stehend|seen)|bergseen|kleinseen|alpenseen|kleine seen/i:/übrige[^,]*fliess|^fliessgewässer$|^flüsse|^bergflüsse|übrige flüsse|übrige bäche/i;
  const g=R.w.filter(([id,l])=>re.test(l));
  return{cand:[],sug:g.length===1?g[0][0]:""};
}
let lastNear=null,chosenMapHit=null,selKey="",selParts=[];
function selectionFC(parts){
  const features=[];
  const hasLines=parts.some(p=>p.lines?.length);
  for(const part of parts){
    for(const rings of part.polygons||[])features.push({type:"Feature",geometry:{type:"Polygon",coordinates:FishSections.orient(rings)},
      properties:{k:part.symbol,a:1,fp:part.footprints&&hasLines?1:0}});
    if(part.lines?.length)features.push({type:"Feature",geometry:{type:"MultiLineString",coordinates:part.lines},properties:{k:part.symbol,a:0,fp:0}});
  }
  return FC(features);
}
let pinFC=FC([]),selFC=FC([]);
function setPins(){
  const features=[];
  const hit=mapSel||currentConfirmed();
  if(Number.isFinite(hit?.lat)&&Number.isFinite(hit?.lon)&&hit.t!=="spot"&&hit.t!=="catch")features.push({type:"Feature",geometry:{type:"Point",coordinates:[hit.lon,hit.lat]},properties:hit.wholeDistrict?{t:"pin",name:hit.name}:{t:"pin"}});
  if(tapPreview)features.push({type:"Feature",geometry:{type:"Point",coordinates:[tapPreview.lon,tapPreview.lat]},properties:{t:"preview"}});
  pinFC=FC(features);if(mapReady)map.getSource("fb-pins")?.setData(pinFC);
}
function currentConfirmed(){
  return chosenMapHit?.code===state.canton&&state.xsel?.[state.canton]===chosenMapHit?.choiceName?chosenMapHit:null;
}
function drawSel(){
  if(!map)return;
  const confirmed=currentConfirmed();
  const hit=mapSel||confirmed;
  const soId=hit?.t==="sec"?hit.id:(!hit&&isSO()&&!unknownWater()?state.sec:null);
  let parts=hit?.districtView?.parts||hit?.fullParts||hit?.parts||[],identity=hit?.zoneId||"";
  if(soId&&GEO.official){
    const f=hit?.source||GEO.features.find(row=>row.id===soId);
    if(f){parts=[{symbol:soSymbol(f),lines:f.l,polygons:[]}];identity=(hit?.zoneId||"SO/"+soId)+"/"+parts[0].symbol+"/"+GEO.date}
  }else if(hit?.t==="x"){
    const g=xg(hit.code),f=g.feats[hit.id];if(!f)return;
    const part={symbol:westMark(hit.code,f),lines:[],polygons:[]};
    for(const id of g.zones.get(f.zoneId)){const row=g.feats[id];if(row.poly)part.polygons.push(row.l);else part.lines.push(...row.l)}
    parts=[part];
  }
  parts=syncGroup(hit,parts);
  if(hit?.t==="zone"&&!hit.districtView){
    const mark=sectionMark(hit.code,hit.kind,hit.buried,hit.rule,hit.rev,hit.region);
    if(mark==="closed"||mark==="condition")parts=parts.map(p=>({...p,symbol:mark}));
  }
  const key=[identity,hit?.t==="x"?hit.id:"",mapDate,DATA_META.version,xVersion,!!hit?.districtView,(hit?.group||hit?.wholeDistrict)&&!hit.fullParts?hit.id:"",parts.length].join("|");
  if(key!==selKey){
    selKey=key;selParts=parts;selFC=selectionFC(parts);
    if(mapReady)map.getSource("fb-sel")?.setData(selFC);
  }
  applyZoneDim(mapSel?.districtView?.28:mapSel&&parts.length?.46:1);
  setPins();
  if(spotMarkers.size)for(const [id,m] of spotMarkers)m.getElement().classList.toggle("selected",mapSel?.t==="spot"&&mapSel.id===id);
  if((hit?.group||hit?.wholeDistrict)&&!hit.fullParts&&!hit.loading&&!hit.partial){
    hit.loading=true;
    sectionMap.wholeZone(hit).then(all=>{hit.fullParts=all},()=>{hit.partial=true}).finally(()=>{
      hit.loading=false;
      if(mapSel===hit||(!mapSel&&chosenMapHit===hit)){drawSel();renderSheet()}
    });
  }
}
function mapPadding(){
  const h=$("#map").clientHeight;
  return {top:Math.min(110,h*.18),bottom:Math.min(sheetVisible()+42,h*.62),left:24,right:24};
}
function fitSelectedGeometry(){
  const b=partsBox(selParts);if(!b)return;
  map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:mapPadding(),maxZoom:16,duration:550});
}
async function showMapExtent(hit){
  const seq=tapSeq;
  if((hit.group||hit.wholeDistrict)&&!hit.fullParts){
    try{hit.fullParts=await sectionMap.wholeZone(hit)}catch{hit.partial=true}
  }
  if(hit!==mapSel||seq!==tapSeq)return;
  follow=false;syncLocateButton();drawSel();renderSheet();fitSelectedGeometry();
}
async function toggleDistrict(hit){
  const seq=tapSeq;
  if(hit.districtView){
    const {center,zoom}=hit.districtView;hit.districtView=null;drawSel();renderSheet();
    map.easeTo({center,zoom,duration:450});revealHit();return;
  }
  try{
    const parts=await sectionMap.district(hit);
    if(mapSel!==hit||seq!==tapSeq)return;
    hit.districtView={parts,center:map.getCenter(),zoom:map.getZoom()};
    follow=false;syncLocateButton();drawSel();renderSheet();fitSelectedGeometry();
  }catch{if(mapSel===hit&&seq===tapSeq)toast("Die Revierübersicht konnte nicht geladen werden.")}
}
let hintT=null,hintMsg="";
function flashHint(t,ms){hintMsg=t;clearTimeout(hintT);updateHint();if(ms)hintT=setTimeout(()=>{hintMsg="";updateHint()},ms)}
function updateHint(){
  const el=$("#mapHint");if(!el||!mapReady)return;
  let t=hintMsg;
  if(!t){const v=xInView();
    if(v.some(c=>xg(c).busy&&!xg(c).all))t="Gewässerzonen werden geladen …";
    else{
      const failed=v.filter(c=>!xg(c).all&&xg(c).fail&&Date.now()-xg(c).fail<30000);
      if(sectionMap?.error)t="Ein Teil der Gewässerdaten fehlt. Zum erneuten Laden die Karte bewegen.";
      else if(failed.length)t="Revierdaten für "+failed.map(cname).join(" und ")+" konnten nicht geladen werden. Bitte später erneut versuchen.";
    }}
  el.textContent=t;el.classList.toggle("on",!!t);
}
const XICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function rightsPanel(right){
  if(!right)return "";
  return '<section class="sh-rights" aria-label="Fischereiberechtigung">'+(right.title?'<strong>'+esc(right.title)+'</strong>':"")+'<p>'+esc(right.body)+
    '</p><a href="'+esc(right.source[1])+'" target="_blank" rel="noopener">'+esc(right.source[0])+'</a></section>';
}

/* ---- Regeln des angetippten Gewässers ---- */
function withCanton(c,fn){
  const prev=state.canton;state.canton=c;
  try{return fn()}finally{state.canton=prev}
}
function zoneGroup(z){
  if(z.code==="LU")return cwLabel("LU",z.rule)?z.rule:"";
  if(z.code==="ZH"){
    const named=z.water?matchW("ZH",{names:[z.water],lake:z.lake}):null;
    return named?.cand.length===1?named.cand[0]:["f","g","b"].includes(z.rule)?z.rule:"";
  }
  if(z.water||(z.code==="SG"&&z.region)){
    if(!(z.code==="AG"&&wNorm(z.water)==="aare"))return pickCW(z.code,[z.water||z.region],z.lake);
  }
  return "";
}
function hitRules(hit){
  if(!hit||restrictedHit(hit))return "";
  let c,sec;
  if(hit.t==="sec"){c="SO";sec=secById(hit.id)}
  else if(hit.t==="x"){c=hit.code;const f=xg(c).feats[hit.id];if(!f)return "";sec={id:pickCW(c,[f.name,f.name.split(/[\s\d(]/)[0]],f.poly,f.cw),kind:"cw"}}
  else if(hit.t==="zone"){c=hit.code;sec={id:zoneGroup(hit),kind:"cw"}}
  else if(hit.t==="w"){c=hit.code;sec={id:pickCW(c,hit.water.names,hit.water.lake),kind:"cw"}}
  if(!c)return "";
  const group=c!=="SO"&&hasCM(c)?cwLabel(c,sec.id):"";
  const table=withCanton(c,()=>rulesTableFor(sec));
  const note=c==="SO"?"":hasCM(c)?(group?`Regelgruppe: ${esc(group)}`:"Keine eindeutige Regelgruppe – die Werte gelten für übrige Gewässer des Kantons."):"Nur nationale Mindestvorgaben geladen.";
  return `<section class="sh-rules"><h3>Regeln an diesem Gewässer</h3>${note?`<p class="sh-d">${note}</p>`:""}${table}</section>`;
}

/* ---- Blatt unten: klein / halb / ganz ---- */
let sheetState="closed";
function sheetHeights(){
  const host=$("#v-karte").clientHeight||600,el=$("#mapSheet");
  const peekEl=el.querySelector(".sh-peek");
  const peek=Math.min(host*.5,(peekEl?peekEl.offsetHeight:120)+30);
  return {peek,half:Math.max(peek,Math.round(host*.52)),full:Math.round(host*.9),host};
}
function sheetVisible(){
  if(sheetState==="closed")return 0;
  const h=sheetHeights();return h[sheetState]||0;
}
function placeSheet(stateName,animate=true){
  const el=$("#mapSheet");
  sheetState=stateName;
  const h=sheetHeights();
  el.style.height=h.full+"px";
  const visible=stateName==="closed"?0:h[stateName];
  el.style.transition=animate?"transform .28s cubic-bezier(.2,.8,.2,1)":"none";
  el.style.transform=`translateY(${h.full-visible+(stateName==="closed"?24:0)}px)`;
  el.classList.toggle("on",stateName!=="closed");
  el.classList.toggle("full",stateName==="full");
  el.setAttribute("aria-hidden",stateName==="closed");
  $("#v-karte").style.setProperty("--sheet",(stateName==="full"?h.half:visible)+"px");
  const body=el.querySelector(".sh-body"),peekEl=el.querySelector(".sh-peek");
  if(body){
    // The body only spans the visible part, so it can always be scrolled to its end.
    body.style.flex="none";
    body.style.height=Math.max(0,(stateName==="closed"?h.peek:visible)-22-(peekEl?.offsetHeight||0))+"px";
    if(stateName==="peek")body.scrollTop=0;
  }
}
function bindSheetDrag(){
  const el=$("#mapSheet");
  let drag=null;
  el.addEventListener("pointerdown",e=>{
    if(!el.classList.contains("on"))return;
    const handle=e.target.closest(".sh-grab,.sh-peek");
    if(!handle||e.target.closest("button,a,select,input,summary"))return;
    const h=sheetHeights();
    drag={y:e.clientY,start:h.full-(sheetState==="closed"?0:h[sheetState]),t:performance.now(),v:0,last:e.clientY,moved:false,h};
    el.setPointerCapture(e.pointerId);el.style.transition="none";
  });
  el.addEventListener("pointermove",e=>{
    if(!drag)return;
    const dy=e.clientY-drag.y;if(Math.abs(dy)>4)drag.moved=true;
    const now=performance.now();drag.v=(e.clientY-drag.last)/Math.max(1,now-drag.t);drag.t=now;drag.last=e.clientY;
    const y=Math.max(0,Math.min(drag.h.full,drag.start+dy));
    el.style.transform=`translateY(${y}px)`;
  });
  const end=e=>{
    if(!drag)return;
    const d=drag;drag=null;
    if(!d.moved){if(e.target.closest(".sh-grab"))placeSheet(sheetState==="peek"?"half":sheetState==="half"?"full":"peek");else placeSheet(sheetState);return}
    const m=/translateY\(([-\d.]+)px\)/.exec(el.style.transform),y=m?+m[1]:0,visible=d.h.full-y;
    const snaps=[["peek",d.h.peek],["half",d.h.half],["full",d.h.full]];
    let target;
    if(d.v>.6)target=visible<d.h.peek*.8?"closed":visible>d.h.half?"half":"peek";
    else if(d.v<-.6)target=visible<d.h.half?"half":"full";
    else target=snaps.reduce((a,b)=>Math.abs(b[1]-visible)<Math.abs(a[1]-visible)?b:a)[0];
    if(target==="closed"){sheetAction("close");return}
    placeSheet(target);
  };
  el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
  addEventListener("resize",()=>{if(sheetState!=="closed")placeSheet(sheetState,false)});
}
function renderSheet(){
  const el=$("#mapSheet");if(!el||!map)return;
  if(shoreView&&!$("#shorePanel").hidden){if(sheetState!=="closed")placeSheet("closed");return}
  updateHint();renderTop();
  const right=mapSel&&!pendingSelection&&mapSel.t!=="public"?mapRight(mapSel):null,access=rightsPanel(right);
  const evidence={section:"Amtlicher Abschnitt",water:"Regel für dieses Gewässer",guide:"Kantonale Auskunft",unknown:"Zuordnung ungeklärt",restriction:"Einschränkung"};
  const rightBadge=right?'<span class="pill '+(["unknown","restriction"].includes(right.level)?"p-warn":"p-mut")+'">'+evidence[right.level]+'</span>':"";
  const canFit=!pendingSelection&&(mapSel?.t==="sec"||mapSel?.t==="x"||mapSel?.parts?.length);
  const extentLabel=mapSel?.wholeDistrict?"Ganzes Revier auf der Karte zeigen":"Ganzen Abschnitt auf der Karte zeigen";
  const fit=canFit?'<button type="button" class="sh-fit" data-sh="extent" aria-label="'+extentLabel+'" title="'+extentLabel+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg></button>':"";
  const head=(title,pills)=>`<div class="sh-h"><div class="sh-t">${esc(title)}</div><div class="sh-controls">${fit}<button type="button" class="sh-x" data-sh="close" aria-label="Schliessen">${XICON}</button></div></div><div class="sh-p">${pills}</div>`;
  const chip=c=>`<span class="pill p-mut">${esc(cname(c))}</span>`;
  let top="",actions="",body="",photo=null;
  if(["spot","catch","public"].includes(mapSel?.t)){
    const o=mapSel.t==="spot"?spotSheet():mapSel.t==="public"?publicSheet():catchSheet();
    if(!o)mapSel=null;else{top=`<div class="sh-h"><div class="sh-t">${esc(o.title)}</div><div class="sh-controls"><button type="button" class="sh-x" data-sh="close" aria-label="Schliessen">${XICON}</button></div></div><div class="sh-p">${o.pills}</div>`;actions=o.actions;body=o.body;photo=o.photo}
  } else if(mapSel&&mapSel.t==="sec"){
    const f=GEO.features.find(x=>x.id===mapSel.id)||{t:""},sec=secById(mapSel.id),st=secStatus(sec),k=sec.kind;
    const pill=k==="schon"?`<span class="pill p-bad">Schonstrecke</span>`:st.some(x=>x.lvl==="bad")?`<span class="pill p-bad">Heute gesperrt</span>`:rightBadge;
    const r=k==="patent"?soRule(sec,"Bachforelle"):null;
    const bad=st.find(x=>x.lvl==="bad"&&!/^Schonstrecke/.test(x.txt));
    const chosen=state.canton==="SO"&&state.sec===sec.id;
    top=head(sec.name,pill+chip("SO"))+(bad?`<div class="sh-d sh-warn">${esc(bad.txt)}</div>`:"")+
      (r&&r.slot?`<div class="sh-d">Bachforelle ${fmtSlot(r.slot)} · Schonzeit ${fmtR(r.schon)}</div>`:"");
    if(k!=="schon")actions=chosen?`<button type="button" class="pri" data-sh="rules">Regeln ansehen</button>`:`<button type="button" class="pri" data-sh="ok">Gewässer wählen</button>`;
    body=access+(f.t?`<div class="sh-d">${esc(f.t)}</div>`:"");
  } else if(mapSel&&mapSel.t==="x"){
    const c=mapSel.code,f=XGEO[c].feats[mapSel.id],k=kindOf(f.art);
    const chosen=state.canton===c&&(state.xsel||{})[c]===f.name;
    const mark=westMark(c,f);
    const seasonBadge=mark==="closed"?`<span class="pill p-bad">${fisheryPeriod(c,f,mapTime)==="night"?"Nächtliche Fangpause":"Fangzeit geschlossen"}</span>`:
      mark==="open"&&["section","water"].includes(right?.level)?'<span class="pill p-ok">Fangsaison offen · Berechtigung prüfen</span>':"";
    top=head(f.name,chip(c)+(seasonBadge||rightBadge));
    if(!(k==="schon"||mark==="closed"||FishSections.localCondition(f.art)))actions=chosen?`<button type="button" class="pri" data-sh="rules">Regeln ansehen</button>`:`<button type="button" class="pri" data-sh="okx">Gewässer wählen</button>`;
    body=access+(f.t?`<div class="sh-d">${esc(f.t)}</div>`:"")+(f.x||[]).filter(t=>t!==f.t).slice(0,2).map(t=>`<div class="sh-d">${esc(t)}</div>`).join("")+
      (f.url?`<div class="sh-d"><a href="${esc(f.url)}" target="_blank" rel="noopener">Amtliche Angaben zum Gewässer</a></div>`:"");
  } else if(mapSel?.t==="zone"){
    const z=mapSel;
    const lu=z.code==="LU"&&z.kind==="Fischereirevier"&&!!z.rev;
    if(lu&&!luDistricts)loadLUDistricts();
    const district=z.rev?(lu?"Revier-ID ":"Revier ")+z.rev:z.kind;
    const section=[district,z.region&&z.region!==z.name?z.region:""].filter(Boolean).join(" · ");
    top=z.districtView?head("Revier "+z.rev,chip(z.code)):head(z.name,chip(z.code)+rightBadge)+`<div class="sh-section">${esc(section)}</div>`+(lu?luMeasurements(z.rev):"");
    if(!restrictedHit(z)&&!z.buried&&!z.districtView)actions='<button type="button" class="pri" data-sh="zone">Gewässer wählen</button>';
    if(z.hasDistrict&&!z.wholeDistrict)actions+='<button type="button" class="sh-district" data-sh="district">'+(z.districtView?"Zum Abschnitt":"Ganzes Revier "+esc(z.rev))+'</button>';
    body=access;
    if(!z.districtView&&z.code==="LU"&&FishSections.localCondition(z.kind))
      body+='<div class="sh-d">Hier gelten örtliche und zeitliche Einschränkungen. <a href="https://lawa.lu.ch/fischerei/angelfischerei/sempachersee" target="_blank" rel="noopener">Vorschriften am Sempachersee</a></div>';
  } else if(mapSel&&mapSel.t==="w"){
    const c=mapSel.code,w=mapSel.water,chosen=state.canton===c&&(state.xsel||{})[c]===w.name;
    top=head(w.name||(w.lake?"See ohne Namen":"Bach ohne Namen"),chip(c)+rightBadge);
    body=access;
    if(mapSel.border?.length>1)body+='<div class="sh-d">Zuständige Stellen: '+mapSel.border.map(code=>'<a target="_blank" rel="noopener" href="'+esc(FishRights.offices[code][1])+'">'+esc(cname(code))+'</a>').join(' · ')+'</div>';
    if(c==="SO")body+='<div class="sh-d">Kein amtlicher Solothurner Revierabschnitt an dieser Position erfasst.</div>';
    else if(!(mapSel.border?.length>1)&&!w.ambiguous&&right?.level!=="restriction")actions=chosen?`<button type="button" class="pri" data-sh="rules">Regeln ansehen</button>`:`<button type="button" class="pri" data-sh="okw">Gewässer wählen</button>`;
  }
  let h="";
  if(top){
    if(pendingSelection){top=head(mapSel.name,chip(mapSel.code||"SO"));actions="";body='<p class="sh-d">Weitere Zonen werden geprüft …</p>'}
    else{
      if(mapSel?.partial)body+='<p class="sh-warn">Nur der geladene Teil der Zone ist markiert.</p>';
      if(mapSel?.pointOnly)body+='<p class="sh-d">Der Kartendienst liefert hier nur eine Punktauskunft.</p>';
      if(!mapSel.districtView&&mapHits.includes(mapSel)&&mapHits.length>1){
        if(!restrictedHit(mapSel)&&mapHits.some(restrictedHit))top+='<p class="sh-warn">Am selben oder unmittelbar benachbarten Ort ist eine Einschränkung kartiert. Schutzgebiet und Geltungsbereich prüfen.</p>';
        body+='<details class="sh-more"><summary>Weitere Abschnitte hier ('+(mapHits.length-1)+')</summary><div class="chips">'+mapHits.map((z,i)=>z===mapSel?"":`<button type="button" data-sh="hit-${i}">${esc(z.name)} · ${esc(z.code||"SO")} ${esc(z.rev||"")} · ${esc(z.kind)}</button>`).join("")+"</div></details>";
      }
      if(mapHits.includes(mapSel)&&hitWarning)top+=`<p class="sh-warn">${esc(hitWarning)}</p>`;
      if(!mapSel.districtView){
        if(["sec","x","zone","w"].includes(mapSel.t)&&mapFilter.publicReports!==false)body='<button type="button" class="report-link" data-sh="reports">Öffentliche Fänge ansehen</button>'+body;
        body+=hitRules(mapSel);
      }
      if(mapSel?.code){
        const built=mapSel.t==="x"?xg(mapSel.code).built:mapSel.built;
        const stand=built?`<p class="sh-d">Kartenstand der App · ${esc(fmtD(built))}</p>`:"";
        const listedName=mapSel.wholeDistrict&&luDistricts?.[mapSel.rev]?.registerName;
        const more=(listedName?`<p class="sh-d">Name im Pachtverzeichnis · ${esc(listedName)}</p>`:"")+(mapSel.detail?`<p class="sh-d">${esc(mapSel.detail)}</p>`:"")+stand+coverageInfo(mapSel.code)+
          '<p class="sh-d">Abgleich der Bewilligungsquellen · 17.11.2026. Kurzfristige Verfügungen und Signalisation vor Ort beachten.</p>';
        body+='<details class="sh-more"><summary>Details und Quelle</summary>'+more+'</details>';
      }
    }
    h=`<div class="sh-grab" aria-hidden="true"><span></span></div><div class="sh-peek">${top}${actions?`<div class="sh-a">${actions}</div>`:""}</div><div class="sh-body">${body}</div>`;
  }
  const changed=el.sheetContent!==h;
  if(h){if(changed){const keep=el.querySelector(".sh-body")?.scrollTop||0;el.innerHTML=h;if(el.sheetKey===mapSel)el.querySelector(".sh-body").scrollTop=keep}
    if(sheetState==="closed"||el.sheetKey!==mapSel){el.sheetKey=mapSel;placeSheet("peek",sheetState!=="closed")}
    else placeSheet(sheetState,false);
  }else if(sheetState!=="closed"){el.sheetKey=null;placeSheet("closed")}
  el.sheetContent=h;
  if(photo&&changed)fillSheetPhoto(photo);
}
function pickCW(c,names,lake,pref){
  const R=RULES[c];if(!R||!R.w)return"";
  if(pref&&R.w.some(w=>w[0]===pref))return pref;
  const m=matchW(c,{names,lake});return m.sug||(m.cand.length===1?m.cand[0]:"");
}
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !document.querySelector("dialog[open]") && mapSel && $("#v-karte").classList.contains("on")){sheetAction("close");map?.getCanvas().focus()}
});
function sheetAction(a){
  if(pendingSelection&&a!=="close")return;
  if(a==="reports"&&mapSel){
    const hit=mapSel;void idForReportHit(hit).then(id=>{if(mapSel===hit)openPublicSection(id,hit.name,[hit.lon,hit.lat]);});
    return;
  }
  if(a==="report-retry"&&mapSel?.t==="public"){openPublicSection(mapSel.id,mapSel.name,[mapSel.lon,mapSel.lat]);return;}
  if(a==="lu-retry"){loadLUDistricts(true);return}
  if(spotAction(a))return;
  if(pendingSelection){pendingSelection=false;hitWarning=""}
  ++tapSeq;clearTapPreview();
  if(a==="extent"&&mapSel){showMapExtent(mapSel);return}
  if(a==="district"&&mapSel?.hasDistrict){toggleDistrict(mapSel);return}
  if(a.startsWith("hit-")){const z=mapHits[Number(a.slice(4))];if(z){mapSel=z;renderSheet();drawSel();revealHit()}return}
  if(a==="zone"&&mapSel?.t==="zone"&&!restrictedHit(mapSel)&&!mapSel.buried){
    const z=mapSel;
    if(z.districtView)return;
    const name=(z.water||z.code==="SG"||!z.rev)?z.name:"Revier "+z.rev+(z.region?" · "+z.region:"");
    const rev=z.code==="LU"&&z.kind==="Fischereirevier"?z.rev:"";
    chooseWater(z.code,rev?luWaterName(name,rev):name,zoneGroup(z),rev);return;
  }
  if(a==="close"){mapSel=null}
  else if(a==="rules"){mapSel=null;renderSheet();drawSel();show("hier");return}
  if(a==="ok"&&mapSel){const id=mapSel.id;state.canton="SO";state.cantonAuto=false;state.sec=id;state.secAuto=false;state.pin=null;chosenMapHit=null;mapSel=null;save();renderSheet();toast(secById(id).name+" gewählt");onCantonChanged();
    show("hier");return}
  if(a==="okx"&&mapSel){const c=mapSel.code,f=XGEO[c].feats[mapSel.id];if(!f||restrictedHit(mapSel))return;chooseWater(c,f.name,pickCW(c,[f.name,f.name.split(/[\s\d(]/)[0]],f.poly,f.cw));return}
  if(a==="okw"&&mapSel?.t==="w"&&!(mapSel.border?.length>1)&&!mapSel.water.ambiguous&&mapRight(mapSel)?.level!=="restriction"){
    const c=mapSel.code,w=mapSel.water;chooseWater(c,w.name||"Gewässer",pickCW(c,w.names,w.lake));return;
  }
  renderSheet();drawSel();
}
let tapSeq=0,mapHits=[],hitWarning="",pendingSelection=false,tapPreview=null;
function clearTapPreview(){if(tapPreview){tapPreview=null;setPins()}}
function cancelMapQuery(){
  ++tapSeq;clearTapPreview();
  if(pendingSelection){pendingSelection=false;hitWarning="";mapSel=null;mapHits=[];renderSheet();drawSel()}
}
function restrictedHit(hit){
  if(hit.code==="SG"&&FishRights.sgProtection(hit.rev,hit.region))return true;
  if(hit.t==="x"){const f=xg(hit.code).feats[hit.id];if(f&&westMark(hit.code,f)==="closed")return true}
  if(hit.t==="zone"&&sectionMark(hit.code,hit.kind,hit.buried,hit.rule)==="closed")return true;
  if(hit.t==="sec"&&hit.source&&soSymbol(hit.source)==="closed")return true;
  return FishSections.restriction(hit.kind)||(hit.code==="AI"&&/schon|verbot/i.test(hit.name));
}
function revealHit(){
  if(pendingSelection||!Number.isFinite(mapSel?.lat)||!Number.isFinite(mapSel?.lon))return;
  const y=map.project([mapSel.lon,mapSel.lat]).y;
  const bottom=$("#map").clientHeight-sheetHeights().peek-38;
  if(y>bottom)map.panBy([0,Math.ceil(y-bottom)],{duration:300});
}
// Short "Gewässer" fragments (bridges, culverts) lie on top of the Revier line and carry no right.
// If a Revier or Patent zone of the same canton runs right there, it is the answer.
const unclearHit=h=>(h.t==="zone"||h.t==="x")&&FishSections.symbol(h.kind)==="water";
function dropFragments(hits,metresPerPixel){
  const unclear=unclearHit;
  const reach=Math.max(25,metresPerPixel*12);
  return hits.filter(h=>!unclear(h)||!hits.some(o=>o!==h&&o.code===h.code&&!unclear(o)&&!restrictedHit(o)&&
    ["district","permit"].includes(FishSections.symbol(o.kind))&&o.d<=h.d+reach));
}
function chooseHits(hits,metresPerPixel=1,preferred=null){
  hits=dropFragments(hits,metresPerPixel);
  const group=h=>Math.floor(h.d/Math.max(1,Math.min(5,metresPerPixel*1.5)));
  const zones=new Map();
  for(const hit of hits){
    const key=hit.zoneId||[hit.code||"SO",hit.t,hit.id].join("|"),other=zones.get(key);
    const close=other&&Math.abs(hit.d-other.d)<=Math.min(2,metresPerPixel);
    const preferLine=close&&!!other.area!==!!hit.area;
    if(!other||(preferLine?!hit.area:hit.d<other.d))zones.set(key,hit);
  }
  mapHits=[...zones.values()].sort((a,b)=>group(a)-group(b)||Number(restrictedHit(b))-Number(restrictedHit(a))||
    Number(/privat/i.test(b.kind))-Number(/privat/i.test(a.kind))||
    Number(a.code==="LU"&&a.kind==="Gewässer")-Number(b.code==="LU"&&b.kind==="Gewässer")||
    a.d-b.d||Number(!!a.area)-Number(!!b.area)||Number(!a.water)-Number(!b.water));
  const wanted=preferred&&mapHits.find(h=>h.code===preferred.code&&h.kind===preferred.kind&&h.name===preferred.name&&
    (!preferred.rev||(h.t==="sec"?h.id:h.rev)===preferred.rev));
  mapSel=wanted||mapHits[0];flashHint("");renderSheet();drawSel();revealHit();
}
function labelAt(point){
  if(!mapReady||!point)return null;
  const box=[[point.x-14,point.y-12],[point.x+14,point.y+12]];
  const f=map.queryRenderedFeatures(box,{layers:["fb-labels"]})[0];
  const row=f&&sectionMap.row(f.properties.key);if(!row)return null;
  const p=FishSections.nearest(map.unproject(point).lat,map.unproject(point).lng,row.paths||[],row.poly);
  return Number.isFinite(p.d)?{ll:{lat:p.lat,lng:p.lon},row}:null;
}
async function mapTap(e){
  clearShore();closePress();
  pendingSelection=false;
  const seq=++tapSeq;clearTapPreview();$("#mapMsg").className="hide";flashHint("");
  const previewTimer=setTimeout(()=>{
    if(seq!==tapSeq)return;
    tapPreview={lat:e.latlng.lat,lon:e.latlng.lng};setPins();
    flashHint("Abschnitt wird gesucht …");
  },80);
  try{await resolveMapTap(e,seq)}finally{clearTimeout(previewTimer);if(seq===tapSeq)clearTapPreview()}
}
async function resolveMapTap(e,seq){
  const label=labelAt(e.point);
  const ll=e.latlng,lat=ll.lat,lon=ll.lng;
  const metresPerPixel=40075016*Math.cos(lat*Math.PI/180)/2**(lz()+8);
  const tol=Math.min(360,metresPerPixel*18),box=FishSections.tapBox(lat,lon,tol*1.04);
  const hits=[],jobs=[];
  for(const f of GEO.official?GEO.features:[]){
    if(f.box&&!FishSections.intersects(f.box,box))continue;
    const point=FishSections.nearest(lat,lon,f.l);if(point.d<=tol)hits.push({...point,t:"sec",id:f.id,source:f,zoneId:JSON.stringify(["SO",f.id,f.art,f.t]),code:"SO",name:secById(f.id).name,kind:f.art});
  }
  if(sectionMap)jobs.push({code:"Kartenausschnitt",request:sectionMap.hits(lat,lon,tol)});
  for(const code of xInView()){
    if(!westIntersects(code,box))continue;
    jobs.push({code,request:(async()=>{
      const g=xg(code);
      if(!g.all)await (g.loading||startWest(code));
      if(!g.all)throw Error("Geodaten fehlen");
      const matches=[];
      for(const f of Object.values(g.feats)){
        if(!FishSections.intersects(box,f.bounds))continue;
        const point=FishSections.nearest(lat,lon,f.l,f.poly);
        if(point.d<=tol)matches.push({...point,t:"x",code,id:f.id,zoneId:f.zoneId,area:f.poly,name:f.name,kind:f.art});
      }
      return matches;
    })()});
  }
  for(const entry of eastWms){
    const [code,,,b]=entry;
    if(lz()>=11&&lat>=b[0][0]&&lat<=b[1][0]&&lon>=b[0][1]&&lon<=b[1][1])jobs.push({code,request:cantonalWmsHits(entry,lat,lon,tol)});
  }
  hitWarning="";
  const hintTimer=setTimeout(()=>{
    if(seq!==tapSeq)return;
    if(hits.length){
      pendingSelection=true;hitWarning="Weitere Zonen werden geprüft …";chooseHits([...hits],metresPerPixel);
    }else{if(mapSel){mapSel=null;mapHits=[];renderSheet();drawSel()}flashHint("Abschnitt wird gesucht …")}
  },200);
  const results=await Promise.allSettled(jobs.map(async j=>{hits.push(...await j.request)}));
  clearTimeout(hintTimer);
  if(seq!==tapSeq)return;
  pendingSelection=false;hitWarning="";
  const failed=[];
  results.forEach((r,i)=>{if(r.status==="rejected")failed.push(jobs[i].code)});
  if(label&&!hits.some(h=>h.d<=Math.min(10,metresPerPixel*3))){
    try{
      const atLabel=await sectionMap.hits(label.ll.lat,label.ll.lng,Math.max(2,Math.min(10,metresPerPixel*2)));
      if(atLabel.some(h=>h.id===label.row.key))hits.push(...atLabel);
    }catch{failed.push("Beschriftung")}
    if(seq!==tapSeq)return;
  }
  if(failed.length)hitWarning="Zonenabfrage unvollständig ("+failed.join(", ")+"). Berechtigung unbekannt.";
  // Only an unclear fragment found: look a little further for the Revier it belongs to.
  if(hits.length&&sectionMap&&hits.every(unclearHit)){
    try{
      const near=Math.min(...hits.map(h=>h.d));
      const more=await sectionMap.hits(lat,lon,Math.min(400,near+30));
      if(seq!==tapSeq)return;
      hits.push(...more.filter(h=>!unclearHit(h)&&!hits.some(x=>x.zoneId===h.zoneId)));
    }catch{}
  }
  if(hits.length){chooseHits(hits,metresPerPixel,e.preferred);return}
  mapSel=null;mapHits=[];flashHint("");renderSheet();drawSel();
  if(!navigator.onLine){mapFailure(()=>mapTap(e));return}
  flashHint("Gewässer wird gesucht …");
  const tolm=Math.min(140,Math.max(35,tol));
  const u=`https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&layers=all:ch.swisstopo.swissboundaries3d-kanton-flaeche.fill,ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill&sr=4326&tolerance=0&returnGeometry=false&timeInstant=${mapDate.slice(0,4)}&lang=de`;
  let cj,w;
  try{[cj,w]=await Promise.all([identifyJSON(u),waterAt(lat,lon,tolm)])}
  catch(err){if(seq===tapSeq){flashHint("");mapFailure(()=>mapTap(e))}return}
  if(seq!==tapSeq)return;
  if(w&&(Math.abs(w.lat-lat)>0.000005||Math.abs(w.lon-lon)>0.000005)){
    const snapped=new URL(u);snapped.searchParams.set("geometry",w.lon+","+w.lat);
    try{cj=await identifyJSON(snapped)}catch{if(seq===tapSeq){flashHint("");mapFailure(()=>mapTap(e))}return}
    if(seq!==tapSeq)return;
  }
  const cantons=[...new Set(cj.results.filter(row=>row.layerBodId==="ch.swisstopo.swissboundaries3d-kanton-flaeche.fill")
    .map(row=>row.attributes?.ak).filter(code=>Object.hasOwn(FishRights.offices,code)))].sort();
  const c=cantons[0];
  if(c&&failed.length){
    const relevant=failed.filter(code=>!Object.hasOwn(FishRights.offices,code)||cantons.includes(code));
    hitWarning=relevant.length?"Zonenabfrage unvollständig ("+relevant.join(", ")+"). Berechtigung unbekannt.":"";
  }
  const communities=[...new Set(cj.results.map(row=>row.attributes).filter(a=>a?.is_current_jahr===true&&a.kanton===c).map(a=>a.gemname).filter(Boolean))];
  if(!c||!w){
    if(hitWarning){mapFailure(()=>mapTap(e));return}
    if(c&&lz()<10){map.easeTo({center:[lon,lat],zoom:9,duration:500});flashHint("Für die Auskunft den genauen Gewässerabschnitt antippen.",2500);return}
    flashHint(c?"An dieser Stelle ist kein Gewässer":"Ausserhalb der Schweiz",2000);return;
  }
  hintMsg="";
  mapSel={t:"w",code:c,border:cantons,municipality:communities.length===1?communities[0]:"",water:w,name:w.name,lat:w.lat,lon:w.lon,zoneId:w.zoneId,parts:w.parts};mapHits=[mapSel];renderSheet();drawSel();revealHit();
}
function mapFailure(retry){
  const msg=$("#mapMsg");msg.className="";
  const directoryReady=$("#permitCanton").options.length>0;
  msg.innerHTML='<div class="card">Kartendienst nicht erreichbar.<div class="row"><button>Erneut versuchen</button><button>Gewässer wählen</button></div>'+
    (directoryReady?'<button type="button" class="sh-district">Bewilligung nach Kanton</button>':"")+'</div>';
  const [again,manual,offices]=msg.querySelectorAll("button");
  again.onclick=()=>{msg.className="hide";retry()};
  manual.onclick=()=>{msg.className="hide";show("hier");openWater()};
  if(offices)offices.onclick=()=>{
    $("#legendDialog").showModal();$("#permitDirectory").open=true;$("#permitCanton").focus();
  };
}

/* ---- Uferstellen ---- */
let shoreView=null,shoreMarkers=[];
function clearShore(){
  shoreView=null;
  shoreMarkers.forEach(m=>m.remove());shoreMarkers=[];
  const panel=$("#shorePanel");
  if(!panel.hidden){panel.hidden=true;map?.resize();if(mapSel)renderSheet()}
}
// Uferstellen-Schlüssel (Kanton/Gewässergruppe) für ein auf der Karte angetipptes Gewässer.
function hitShoreKey(hit){
  if(!hit)return "";
  if(hit.t==="sec")return "SO/"+hit.id;
  if(hit.t==="x"){const f=xg(hit.code).feats[hit.id];return f?hit.code+"/"+pickCW(hit.code,[f.name,f.name.split(/[\s\d(]/)[0]],f.poly,f.cw):""}
  if(hit.t==="zone")return hit.code+"/"+zoneGroup(hit);
  if(hit.t==="w")return hit.code+"/"+pickCW(hit.code,hit.water.names,hit.water.lake);
  return "";
}
function showShoreMarkers(){
  if(!shoreView||!map||shoreMarkers.length)return;
  const {fish,key,season}=shoreView,sec=currentSec();
  if(!shoreView.fromMap&&key!==state.canton+"/"+sec.id){clearShore();return}
  const title=shoreView.title||sec.name;
  const points=shoreSites[key];
  const [,depth,time]=fish?waterApproach[fish][season]:[];
  const spot=shoreView.spot;
  const preference=/schatten|gehölz|äste/i.test(spot)?"Gehölznähe":/tief|halde|abbruch|steil/i.test(spot)?"Tiefenlinie in Ufernähe":"Uferbiegung";
  const distance=p=>state.pos?Math.hypot((p[0]-state.pos.lat)*111000,(p[1]-state.pos.lon)*75000):0;
  const ranked=fish?[...points].sort((a,b)=>Number(b[2].includes(preference))-Number(a[2].includes(preference))||distance(a)-distance(b)).slice(0,3):points;
  ++tapSeq;
  follow=false;syncLocateButton();
  if(!shoreView.fromMap)mapSel=null;
  const panel=$("#shorePanel");panel.hidden=false;
  renderSheet();drawSel();
  panel.innerHTML=`<div class="shore-head"><strong>${fish?esc(fish)+" · ":""}${esc(title)}</strong><button type="button" data-shore-close>Schliessen</button></div><div class="shore-options" role="group" aria-label="Uferstelle wählen"></div><div class="shore-detail" aria-live="polite">Nummer auf der Karte oder hier antippen.</div><p class="small">Suchpunkte an kartierten Wegen. Zugang, Sperren und Ufer vor Ort prüfen.</p><small>Geodaten © swisstopo</small>`;
  panel.querySelector("[data-shore-close]").onclick=clearShore;
  const locationButtons=panel.querySelector(".shore-options");
  ranked.forEach(([lat,lon,tags],i)=>{
    const title="Uferstelle "+(i+1);
    const el=document.createElement("button");el.type="button";el.className="shore-pin";el.title=title;el.setAttribute("aria-label",title);el.innerHTML=`<span>${i+1}</span>`;
    const marker=new maplibregl.Marker({element:el}).setLngLat([lon,lat]).addTo(map);shoreMarkers.push(marker);
    const button=document.createElement("button");
    button.type="button";button.textContent=String(i+1);button.setAttribute("aria-label",title);
    button.setAttribute("aria-pressed","false");locationButtons.append(button);
    const open=ev=>{
      ev?.stopPropagation();
      locationButtons.querySelector('[aria-pressed="true"]')?.setAttribute("aria-pressed","false");
      button.setAttribute("aria-pressed","true");
      shoreMarkers.forEach(m=>m.getElement().classList.toggle("selected",m===marker));
      const rows=[["Kartierte Merkmale",tags.join(" · ")]];
      if(fish)rows.push(["Vor Ort suchen",spot],["Köder",baitBySeason[fish][season]],["Tiefe",depth],["Tageszeit",time]);
      panel.querySelector(".shore-detail").innerHTML=`<strong>${title}</strong><dl>${rows.map(([label,value])=>`<dt>${label}</dt><dd>${esc(value)}</dd>`).join("")}</dl>`;
      panel.scrollTop=0;
      map.resize();
      map.easeTo({center:[lon,lat],zoom:Math.max(15,map.getZoom()),duration:450});
    };
    el.addEventListener("click",open);button.onclick=open;
  });
  requestAnimationFrame(()=>{
    map.resize();
    const lats=ranked.map(p=>p[0]),lons=ranked.map(p=>p[1]);
    map.fitBounds([[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]],{padding:{top:70,bottom:60,left:36,right:36},maxZoom:15,duration:0});
  });
}
$("#waterFish").onclick=e=>{
  const b=e.target.closest("[data-shore-fish]");if(!b)return;
  const fish=b.dataset.shoreFish,sec=currentSec(),key=state.canton+"/"+sec.id;
  if(!shoreSites[key]||!baitBySeason[fish]||secStatus(sec).some(s=>s.lvl==="bad")||artStatus(fish)[0]==="p-bad")return;
  clearShore();
  const season=Math.floor(((new Date().getMonth()+10)%12)/3);
  shoreView={fish,key,season,spot:b.parentElement.querySelector(".water-approach dd").textContent};
  show("karte");
};

/* ---- Suche direkt in der Leiste oben ---- */
async function swissPlaces(query,signal){
  const params=new URLSearchParams({type:"locations",origins:"gg25,gazetteer,kantone",searchText:query,limit:"7",lang:"de",sr:"4326"});
  const response=await fetch("https://api3.geo.admin.ch/rest/services/ech/SearchServer?"+params,{signal});
  if(!response.ok)throw Error("Ortssuche "+response.status);
  const {results}=await response.json();
  return results.map(({attrs:a})=>{
    const name=String(a.label||a.detail||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
    return {name,lat:a.lat,lon:a.lon,sub:"Ort oder Gewässer · swisstopo",zoom:a.origin==="kantone"?10:14};
  }).filter(p=>p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
}
function bindInlineSearch(localRows,select){
  const input=$("#mapQ"),panel=$("#mapQResults"),clear=$("#mapQClear"),bar=$("#mapSearchBar");
  let serial=0,timer,request,lastQuery="";
  const stop=()=>{++serial;clearTimeout(timer);request?.abort()};
  const close=()=>{stop();panel.hidden=true;bar.classList.remove("open");input.blur()};
  const status=t=>{panel.querySelector(".msr-status").textContent=t};
  function shell(){
    panel.innerHTML='<p class="msr-status" role="status"></p><div class="msr-list"></div>';panel.hidden=false;bar.classList.add("open");
    const value=input.value.trim();
    const nearby=state.canton==="LU"||lz()>=10&&Array.from(sectionMap.visible.values()).some(row=>row.code==="LU");
    if(!FishMapSearch.isLUList(value)&&(nearby||/\b(lu|luzern|luzerner)\b/i.test(value))){
      const b=document.createElement("button");b.type="button";b.className="msr-directory";b.textContent="Alle Luzerner Fischereireviere";
      b.onclick=()=>{input.value="Luzerner Reviere";update()};panel.prepend(b);
    }
  }
  function render(groups,state){
    const list=panel.querySelector(".msr-list");list.replaceChildren();
    for(const [title,items] of groups){
      if(!items.length)continue;
      const h=document.createElement("h3");h.textContent=title;list.append(h);
      for(const item of items){
        const b=document.createElement("button");b.type="button";b.className="msr-item";
        b.innerHTML=`<span>${esc(item.name)}</span><small>${esc(item.sub||"")}</small>`;
        b.onclick=()=>{input.value=item.name;clear.hidden=false;close();select(item)};
        list.append(b);
      }
    }
    status(state);
  }
  function update(){
    stop();
    const query=input.value.trim(),id=serial,browse=FishMapSearch.isLUList(query);
    clear.hidden=!input.value;
    if(query.length<2){if(document.activeElement===input){shell();status("Gewässer, Revier oder Ort eingeben")}else panel.hidden=true;return}
    if(query===lastQuery&&!panel.hidden&&panel.querySelector(".msr-item"))return;
    lastQuery=query;shell();status("Suche läuft …");
    timer=setTimeout(async()=>{
      const controller=new AbortController();request=controller;
      const deadline=setTimeout(()=>controller.abort(),6500);
      let zones=[],locations=[],remaining=2;const fail=[];
      const paint=()=>{if(id!==serial)return;
        render([[browse?"Luzerner Fischereireviere ("+zones.length+")":"Gewässer und Reviere",zones],["Orte und Gewässer",locations]],
          fail.length?fail.join(" "):remaining?(zones.length||locations.length?"Weitere Treffer werden gesucht …":"Suche läuft …"):(zones.length||locations.length?"":"Keine Treffer für «"+query+"»."))};
      const local=async()=>{
        const result=await FishMapSearch.localSearch(sectionMap,localRows,query,map.getCenter(),loadLUDistricts,items=>{zones=items;paint()});
        zones=result.zones;if(result.partial)throw Error("Teilindex");
      };
      const remote=async()=>{if(!browse&&!/\brevier\s*\d+|\p{L}\s+\d{1,3}$/iu.test(query))locations=await swissPlaces(query,controller.signal)};
      await Promise.all([local().catch(()=>fail.push("Ein Teil der Reviersuche ist offline.")).finally(()=>{--remaining;paint()}),
        remote().catch(e=>{if(e.name!=="AbortError")fail.push("Die Ortssuche ist offline.")}).finally(()=>{--remaining;paint()})]);
      clearTimeout(deadline);
    },160);
  }
  input.addEventListener("input",()=>{lastQuery="";update()});
  input.addEventListener("focus",()=>{update()});
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter"){const first=panel.querySelector(".msr-item");if(first){e.preventDefault();first.click()}}
    else if(e.key==="Escape"){e.preventDefault();close()}
  });
  clear.onclick=()=>{input.value="";clear.hidden=true;lastQuery="";input.focus();update()};
  // Tapping the map or another control ends the search.
  document.addEventListener("pointerdown",e=>{if(!panel.hidden&&!e.target.closest("#mapSearchBar"))close()},true);
  return close;
}

/* ---- Bedienelemente ---- */
const ICONS={
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  locate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  follow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z"/></svg>',
  compass:'<svg viewBox="0 0 24 24"><path d="M12 3l4 9h-8z" fill="#d94e54"/><path d="M12 21l-4-9h8z" fill="currentColor" opacity=".55"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>'
};
function syncLocateButton(){
  const b=$("#mapLocate");if(!b)return;
  b.innerHTML=follow&&state.pos?ICONS.follow:ICONS.locate;b.classList.toggle("on",follow&&!!state.pos);
  b.setAttribute("aria-pressed",String(follow&&!!state.pos));
}
function buildControls(){
  const host=$("#v-karte");
  const ui=document.createElement("div");ui.id="mapUI";
  ui.innerHTML=`
    <div class="mui-top">
      <div class="mui-search" id="mapSearchBar" role="search">
        <label for="mapQ" class="mui-search-icon" aria-label="Suchen">${ICONS.search}</label>
        <input id="mapQ" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="90" placeholder="Gewässer, Revier oder Ort suchen" aria-controls="mapQResults">
        <button type="button" id="mapQClear" class="mui-clear" aria-label="Suche leeren" hidden>${XICON}</button>
        <div id="mapQResults" class="mui-results" hidden></div>
      </div>
    </div>
    <div class="mui-row">
      <div class="mseg" role="group" aria-label="Kartenhintergrund"><button type="button" data-b="luft">Luftbild</button><button type="button" data-b="topo">Karte</button></div>
      <button type="button" class="mui-chip shore-toggle" id="mapShore">Uferstellen</button>
    </div>
    <div class="mui-right">
      <div class="mui-zoom"><button type="button" id="mapZoomIn" aria-label="Vergrössern">${ICONS.plus}</button><button type="button" id="mapZoomOut" aria-label="Verkleinern">${ICONS.minus}</button></div>
      <button type="button" class="mui-round" id="mapLayersBtn" aria-label="Fänge und Spots" aria-controls="mapLayers">${ICONS.layers}</button>
      <button type="button" class="mui-round" id="mapCompass" aria-label="Karte nach Norden ausrichten" hidden>${ICONS.compass}</button>
    </div>
    <div class="mui-bottom-left"><button type="button" class="mui-chip" id="mapLegendBtn" aria-haspopup="dialog" aria-controls="legendDialog">Legende</button><button type="button" class="mui-credit" id="mapCreditBtn" aria-haspopup="dialog" aria-controls="legendDialog">© swisstopo u. a.</button></div>
    <button type="button" class="mui-round mui-locate" id="mapLocate" aria-label="Zu meinem Standort">${ICONS.locate}</button>
    <div id="mapLayers" class="mui-layers" hidden></div>`;
  host.append(ui);
  $("#mapZoomIn").onclick=()=>map.zoomIn({duration:250});
  $("#mapZoomOut").onclick=()=>map.zoomOut({duration:250});
  $("#mapCompass").onclick=()=>map.easeTo({bearing:0,pitch:0,duration:400});
  $("#mapLegendBtn").onclick=()=>{const d=$("#legendDialog");d.showModal();d.scrollTop=0};
  $("#mapCreditBtn").onclick=()=>{$("#legendDialog").showModal();$("#mapCreditTitle").focus()};
  $("#mapLocate").onclick=()=>{
    if(!state.pos){follow=true;startGeo();toast(state.geoErr||"Standort wird gesucht …");syncLocateButton();return}
    if(follow){follow=false;syncLocateButton();return}
    follow=true;syncLocateButton();
    map.easeTo({center:[state.pos.lon,state.pos.lat],zoom:Math.max(map.getZoom(),14.5),duration:600});
  };
  $("#mapShore").onclick=()=>{
    if(mapSel&&!pendingSelection){
      // Uferstellen für das auf der Karte markierte Gewässer.
      const key=hitShoreKey(mapSel),name=mapSel.t==="sec"?secById(mapSel.id).name:mapSel.name||"dieses Gewässer";
      if(restrictedHit(mapSel)){toast(name+" ist hier gesperrt oder geschützt.");return}
      if(!shoreSites[key]?.length){toast("Für "+name+" sind keine Uferstellen kartiert.");return}
      shoreView={key,fromMap:true,title:name};showShoreMarkers();return;
    }
    const sec=currentSec(),key=state.canton+"/"+sec.id;
    if(unknownWater()){show("hier");openWater();return}
    if(!shoreSites[key]?.length){toast("Für dieses Gewässer sind keine Uferstellen kartiert.");return}
    if(secStatus(sec).some(s=>s.lvl==="bad")){toast("Dieses Gewässer ist gesperrt.");return}
    shoreView={key};showShoreMarkers();
  };
  bindLayerPanel();
  const seg=ui.querySelector(".mseg");
  const drawSeg=()=>{const cur=store.get("base","luft")==="topo"?"topo":"luft";seg.querySelectorAll("button").forEach(b=>{b.classList.toggle("on",b.dataset.b===cur);b.setAttribute("aria-pressed",String(b.dataset.b===cur))})};
  drawSeg();
  seg.onclick=e=>{const b=e.target.closest("[data-b]");if(!b||b.classList.contains("on"))return;store.set("base",b.dataset.b);drawSeg();setBase(b.dataset.b)};
  ["pointerdown","dblclick","wheel","touchstart"].forEach(t=>ui.addEventListener(t,e=>{if(e.target.closest("button"))e.stopPropagation()},{passive:true}));
}

/* ---- Stil und Ebenen ---- */
const STYLE_URL={luft:"https://vectortiles.geo.admin.ch/styles/ch.swisstopo.imagerybasemap.vt/style.json",
  topo:"https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json"};
const styleCache={};
async function baseStyle(kind){
  const read=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(6500)});if(!response.ok)throw Error("Stil "+response.status);return response.json()};
  if(!styleCache[kind])styleCache[kind]=read("./data/basemaps/"+kind+".json").catch(()=>read(STYLE_URL[kind])).catch(e=>{delete styleCache[kind];throw e});
  const s=structuredClone(await styleCache[kind]);
  // Keep the aerial view calm: no hiking paths, points of interest or park outlines.
  const hide=new Set(["road_paths","road_via_ferrata","tunnel_pedestrian","park","park_label","aerialway","poi_rank1","poi_rank2","spot_elevation"]);
  if(kind==="luft")s.layers=s.layers.filter(l=>!hide.has(l.id));
  // Satellite overview below the Swiss imagery for low zoom levels.
  if(kind==="luft"){
    s.sources["fb-alpenraum"]={type:"image",url:new URL("./data/alpenraum.webp",document.baseURI).href,
      coordinates:[[-2.8125,54.16243397],[19.6875,54.16243397],[19.6875,36.59788913],[-2.8125,36.59788913]]};
    const firstNonBg=s.layers.findIndex(l=>l.type!=="background");
    s.layers.splice(firstNonBg<0?s.layers.length:firstNonBg,0,{id:"fb-alpenraum",type:"raster",source:"fb-alpenraum",maxzoom:8,paint:{"raster-fade-duration":0}});
  }
  return s;
}
function fontFrom(style){
  for(const l of style.layers){const f=l.layout?.["text-font"];if(Array.isArray(f)&&f.every(x=>typeof x==="string"))return f}
  return ["Frutiger Neue Regular"];
}
function addOverlays(){
  map.addSource("fb-hydro",{type:"raster",tiles:["https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-gewaessernetz/default/current/3857/{z}/{x}/{y}.png"],tileSize:256,minzoom:5,maxzoom:17,
    attribution:'Gewässer © <a href="https://www.swisstopo.admin.ch/de/landschaftsmodell-swisstlm3d">swisstopo</a>'});
  // The national water network is dense at country scale; show it once rivers become legible.
  map.addLayer({id:"fb-hydro",type:"raster",source:"fb-hydro",minzoom:9,paint:{"raster-opacity":hydroOpacity(),"raster-fade-duration":150,"raster-saturation":-.35}});
  for(const [c,url,layers,b] of eastWms){
    const id="fb-wms-"+c;
    map.addSource(id,{type:"raster",tileSize:256,minzoom:10,bounds:[b[0][1],b[0][0],b[1][1],b[1][0]],
      tiles:[`${url}?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layers)}&styles=&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true`]});
    map.addLayer({id,type:"raster",source:id,minzoom:10,paint:{"raster-fade-duration":150}});
  }
  for(const src of ZONE_SOURCES)map.addSource(src,{type:"geojson",data:zoneData[src],tolerance:.3,buffer:64});
  for(const img of coarseImages)addCoarse(img);
  addLakeLayers();
  for(const spec of zoneLayerSpecs()){const {meta,...layer}=spec;map.addLayer(layer)}
  addGroupLayers();
  map.addSource("fb-sel",{type:"geojson",data:selFC,tolerance:.2});
  map.addLayer({id:"fb-sel-fill",type:"fill",source:"fb-sel",filter:isArea,paint:{"fill-color":colorExpr(),"fill-opacity":["case",["in",["get","k"],["literal",RULE_MARKS]],.62,.25]}});
  map.addLayer({id:"fb-sel-dark",type:"line",source:"fb-sel",filter:["==",["get","fp"],0],layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#203038","line-width":selWidth(7.4),"line-opacity":.92}});
  map.addLayer({id:"fb-sel-edge",type:"line",source:"fb-sel",filter:["==",["get","fp"],0],layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":FishSections.highlight,"line-width":selWidth(5)}});
  map.addLayer({id:"fb-sel-ink",type:"line",source:"fb-sel",filter:["==",["get","fp"],0],layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":colorExpr(),"line-width":selWidth(0)}});
  map.addLayer({id:"fb-labels",type:"symbol",source:"fb-sec",minzoom:8,filter:["all",["!=",["get","n"],""],["==",["get","a"],0]],
    layout:{"symbol-placement":"line","text-field":["get","n"],"text-font":labelFont,"text-size":["interpolate",["linear"],["zoom"],8,11,14,13.5],
      "text-max-angle":35,"symbol-spacing":420,"text-padding":6,"text-letter-spacing":.02},
    paint:{"text-color":"#fff","text-halo-color":"rgba(20,40,46,.92)","text-halo-width":1.6}});
  map.addLayer({id:"fb-so-labels",type:"symbol",source:"fb-so",minzoom:12,filter:["!=",["get","lb"],""],
    layout:{"symbol-placement":"line-center","text-field":["get","lb"],"text-font":labelFont,"text-size":12,"text-padding":8,"text-allow-overlap":false},
    paint:{"text-color":["case",["==",["get","ls"],1],"#c93745","#12222a"],"text-halo-color":"#fff","text-halo-width":2.2}});
  map.addSource("fb-me",{type:"geojson",data:locationPoint(mePos||state.pos)});
  map.addLayer({id:"fb-me-acc",type:"circle",source:"fb-me",paint:{"circle-radius":state.pos?accuracyRadius(state.pos):0,"circle-color":"#1c7ed6","circle-opacity":.1,"circle-stroke-color":"#1c7ed6","circle-stroke-opacity":.45,"circle-stroke-width":1,"circle-pitch-alignment":"map"}});
  map.addLayer({id:"fb-me-dot",type:"circle",source:"fb-me",paint:{"circle-radius":8,"circle-color":"#1c7ed6","circle-stroke-color":"#fff","circle-stroke-width":2.5}});
  map.addSource("fb-pins",{type:"geojson",data:pinFC});
  map.addLayer({id:"fb-pins",type:"circle",source:"fb-pins",paint:{
    "circle-radius":["case",["==",["get","t"],"preview"],9,6.5],
    "circle-color":["case",["==",["get","t"],"preview"],"rgba(23,41,45,.65)",FishSections.highlight],
    "circle-stroke-color":["case",["==",["get","t"],"preview"],"#fff","#17292d"],"circle-stroke-width":2.5}});
  map.addLayer({id:"fb-district-label",type:"symbol",source:"fb-pins",filter:["has","name"],
    layout:{"text-field":["get","name"],"text-font":labelFont,"text-size":13,"text-anchor":"bottom","text-offset":[0,-.8],"text-padding":5},
    paint:{"text-color":FishSections.highlight,"text-halo-color":"#17292d","text-halo-width":2}});
  addReportLayers();addCatchLayers();
}
let coarseImages=[];
function addCoarse(img){
  const id="fb-coarse-"+img.id;
  if(map.getSource(id))return;
  map.addSource(id,{type:"canvas",canvas:img.canvas,coordinates:img.coordinates,animate:false});
  const before=map.getLayer("fb-sec-fill")?"fb-sec-fill":undefined;
  map.addLayer({id,type:"raster",source:id,paint:{"raster-opacity":zoneDim,"raster-fade-duration":0,"raster-resampling":"linear"}},before);
}
function setCoarse(list){
  const next=new Set(list.map(i=>"fb-coarse-"+i.id));
  if(mapReady)for(const img of coarseImages){const id="fb-coarse-"+img.id;if(!next.has(id)){if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id)}}
  coarseImages=list;
  if(mapReady)list.forEach(addCoarse);
}
let baseChange=0;
async function setBase(kind){
  if(!map)return;
  const change=++baseChange;
  try{
    const style=await baseStyle(kind);if(change!==baseChange)return;
    labelFont=fontFrom(style);
    mapReady=false;
    map.setStyle(style,{diff:false});
  }catch(e){if(change===baseChange)toast("Kartenhintergrund konnte nicht geladen werden.")}
}
function bindMapCredits(){
  const cantons=$("#permitCanton"),directory=$("#permitDirectory");
  cantons.replaceChildren(...CANTONS.map(([code,name])=>new Option(name,code)));
  const showOffice=()=>{
    const code=cantons.value,office=FishRights.offices[code];
    $("#permitOffice").innerHTML=office?rightsPanel({title:"",body:office[2],source:office}):"";
  };
  directory.ontoggle=()=>{if(directory.open){cantons.value=mapSel?.code||state.canton;showOffice()}};
  cantons.onchange=showOffice;
  updateCredits();
}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error(src))};
  if(src===MAPLIBRE.js){s.integrity=MAPLIBRE_SRI.js;s.fetchPriority="high"}document.head.append(s)})}
const MAPLIBRE={js:"./vendor/maplibre-gl/maplibre-gl.js",css:"./vendor/maplibre-gl/maplibre-gl.css"};
const MAPLIBRE_SRI={js:"sha384-Nvz6wITR4vEzcMz/FWUFgkrmKDhnaQbjYxIIbwwbAFha9kWiRhmR4QjJ3zhrlnR8",css:"sha384-mnM9NG1099tBMNxdDQNDKIxYcn/fmqQXFJvbT5l1MsrWvzfxBEffceBsw75/cW2R"};
function focusMapPlace(place,fitDistrict=false){
  cancelMapQuery();map.stop();follow=false;syncLocateButton();clearShore();mapSel=null;mapHits=[];renderSheet();drawSel();
  const seq=tapSeq,center=[place.lon,place.lat],zoom=(place.zone?15:place.zoom)-1;
  const inspect=async()=>{
    if(seq!==tapSeq||!$("#v-karte").classList.contains("on"))return;
    await mapTap({latlng:{lat:place.lat,lng:place.lon},point:map.project(center),preferred:place});
    if(fitDistrict&&mapSel?.wholeDistrict&&mapSel.rev===place.rev)await showMapExtent(mapSel);
  };
  if(fitDistrict){map.jumpTo({center,zoom});return inspect()}
  if(place.zone){
    const p=map.getCenter();
    if(Math.abs(p.lng-place.lon)+Math.abs(p.lat-place.lat)<.000001&&Math.abs(map.getZoom()-zoom)<.001)return inspect();
    map.once("moveend",inspect);
  }
  map.flyTo({center,zoom,duration:900,essential:true});
  if(!place.zone)flashHint(place.name,2600);
}
function initialMapView(){
  const oldView=store.get("mapView",null);
  const saved=store.get("mapViewGL",null)||(Array.isArray(oldView)&&oldView.length===3&&oldView.every(Number.isFinite)?[oldView[0],oldView[1],oldView[2]-1]:null);
  return Array.isArray(saved)&&saved.length===3&&saved.every(Number.isFinite)&&saved[0]>=45.6&&saved[0]<=48&&saved[1]>=5.7&&saved[1]<=10.7?
    {center:[saved[1],saved[0]],zoom:Math.max(5,Math.min(19,saved[2]))}:state.pos?{center:[state.pos.lon,state.pos.lat],zoom:13}:{bounds:[[5.95,45.81],[10.5,47.82]]};
}
function prepareSections(){
  if(sectionMap)return;
  sectionMap=new FishSections.Layer({getZoom:()=>lz(),getBounds:()=>map.getBounds()},updateHint,
    row=>sectionMark(row.code,row.meta[1],row.meta[5],row.meta[6],row.meta[2],row.meta[3]),{
      features:fc=>setZones("fb-sec",fc),coarse:list=>setCoarse(list),credits:set=>setCredits("sections",set)});
  const view=initialMapView();
  sectionMap.preload(view.center,(view.zoom??5)+1);
}
async function initMap(){
  if(map){refreshMapDate();requestAnimationFrame(()=>{map.resize();sectionMap.sync();scheduleWest();loadX();refreshReports()});renderSheet();drawSel();showShoreMarkers();if(mapReady)focusRequestedLU();return}
  if(initMap.loading)return;
  initMap.loading=true;
  const msg=$("#mapMsg");msg.className="";msg.textContent="Karte wird geladen …";
  if(!document.querySelector("#maplibreStyle")){
    const css=document.createElement("link");css.id="maplibreStyle";css.rel="stylesheet";css.href=MAPLIBRE.css;css.crossOrigin="anonymous";css.integrity=MAPLIBRE_SRI.css;document.head.append(css);
  }
  const kind=store.get("base","luft")==="topo"?"topo":"luft";
  const jobs=[baseStyle(kind)];
  if(!window.maplibregl)jobs.push(loadScript(MAPLIBRE.js));
  if(typeof FishSections==="undefined")jobs.push(loadScript("./beta/map-sections-gl.js").then(prepareSections));else prepareSections();
  if(typeof FishRights==="undefined")jobs.push(loadScript("./map-rights.js"));
  if(typeof FishRegisters==="undefined")jobs.push(loadScript("./map-rights-registers.js"));
  if(typeof FishMapSearch==="undefined")jobs.push(loadScript("./map-search.js"));
  if(typeof XSRC==="undefined")jobs.push(loadScript("./map-sources.js"));
  const results=await Promise.allSettled(jobs);
  initMap.loading=false;
  if(!$("#v-karte").classList.contains("on"))return;
  if(results.some(r=>r.status==="rejected")||!window.maplibregl){mapFailure(initMap);return}
  refreshMapDate();
  const style=results[0].value,view=initialMapView();
  labelFont=fontFrom(style);
  msg.className="hide";
  map=new maplibregl.Map({container:"map",style,...(view.bounds?{bounds:view.bounds,fitBoundsOptions:{padding:16}}:view),
    minZoom:5,maxZoom:19.5,maxBounds:[[3.5,44.6],[12.9,49.0]],attributionControl:false,dragRotate:true,pitchWithRotate:false,touchPitch:false,
    fadeDuration:180,cooperativeGestures:false,locale:{"NavigationControl.ZoomIn":"Vergrössern","NavigationControl.ZoomOut":"Verkleinern"}});
  map.touchZoomRotate.enableRotation();
  map.keyboard.enable();
  window.fbMap=map;
  new ResizeObserver(()=>map.resize()).observe($("#map"));
  bindMapCredits();
  sectionMap.sync();
  buildControls();
  bindInlineSearch(()=>{
    const places=[];
    for(const f of GEO.official?GEO.features:[]){
      const line=f.l[0],p=line[Math.floor(line.length/2)];
      places.push([secById(f.id).name,f.id,f.art,p[1],p[0],"SO"]);
    }
    for(const [code,group] of Object.entries(XGEO))for(const ids of group.zones.values()){
      const f=group.feats[ids.values().next().value],line=f.l[0],p=line[Math.floor(line.length/2)];
      places.push([f.name,"",f.art,p[1],p[0],code]);
    }
    return places;
  },focusMapPlace);
  const symbols=Object.values(FishSections.symbols);
  $("#zoneSymbols").innerHTML=symbols.map(s=>'<div><i style="background:'+(s.dash?'repeating-linear-gradient(90deg,'+s.color+' 0 5px,transparent 5px 8px)':s.color)+'"></i>'+esc(s.label)+'</div>').join("")+
    '<div><i style="background:'+FishSections.highlight+';height:7px"></i>Ausgewählte Zone</div>';
  bindSheetDrag();
  const sheet=$("#mapSheet");
  sheet.onclick=e=>{const b=e.target.closest("[data-sh]");if(b)sheetAction(b.dataset.sh)};
  bindLongPress();
  map.on("styleimagemissing",addCatchImage);
  map.on("style.load",()=>{if(mapReady)return;
    updateDetailBounds();drawGeo();drawX();addOverlays();mapReady=true;
    drawLakes();loadX();drawCatches();refreshSpots();updateMe();sectionMap.sync();renderSheet();drawSel();showShoreMarkers();updateHint();focusRequestedLU();refreshReports()});
  map.on("click",e=>{
    if(!mapReady)return;
    if(placeMode){applyPlace(e.lngLat);return}
    if(pressMarker){closePress();return}
    const box=[[e.point.x-12,e.point.y-12],[e.point.x+12,e.point.y+12]];
    if(catchMapClick(e.point,box))return;
    mapTap({latlng:{lat:e.lngLat.lat,lng:e.lngLat.lng},point:e.point});
  });
  map.on("dragstart",()=>{if(follow){follow=false;syncLocateButton()}});
  map.on("move",()=>{if(mapReady&&updateDetailBounds()){drawGeo();scheduleWest()}});
  map.on("movestart",e=>{if(!e.originalEvent)return;cancelMapQuery();if(hintMsg)flashHint("");$("#mapMsg").className="hide"});
  map.on("rotate",()=>{const b=$("#mapCompass");if(!b)return;const r=map.getBearing();b.hidden=Math.abs(r)<.5;b.firstElementChild.style.transform=`rotate(${-r}deg)`});
  let zoomLevel=Math.floor(lz());
  map.on("zoomend",()=>{const z=Math.floor(lz());if(z!==zoomLevel){zoomLevel=z;drawGeo();scheduleWest()}});
  map.on("moveend",()=>{
    if(!$("#v-karte").classList.contains("on")||!mapReady)return;
    loadX();sectionMap.sync();updateHint();refreshReports();
    const c=map.getCenter();store.set("mapViewGL",[c.lat,c.lng,map.getZoom()]);
  });
  map.on("error",e=>{
    const id=e.sourceId||e.source?.id||"";
    if(!id.startsWith("fb-wms-")&&e.error)console.warn("Karte",e.error.message||e.error);
    if(id.startsWith("fb-wms-")){const now=Date.now();if(now-(map._wmsWarn||0)>60000&&!mapSel){map._wmsWarn=now;flashHint("Fischereikarte "+cname(id.slice(7))+" teilweise nicht geladen.",4000)}}
  });
  syncLocateButton();
}
function onGeoChanged(){if(map){soFeatureCache.key="";drawGeo()}if(state.pos)updateHere();else renderAll()}
function onCantonChanged(){
  if(map){drawGeo();drawX();loadX();}
  updateHere();
}
