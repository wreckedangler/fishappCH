/* ================= OFFENE GEWÄSSER UND REVIERE ================= */
// Large lakes (swisstopo VECTOR200, generalised). w lists canton and rule key of RULES.
let lakeData=null,lakeLoading=null,lakeFC=FC([]),lakeStamp="";
function decodeLakes(list){
  return list.map(l=>({type:"Feature",properties:{n:l.n,w:l.w},geometry:{type:"MultiPolygon",coordinates:l.p.map(poly=>poly.map(r=>{
    let x=0,y=0;const out=[];for(let i=0;i<r.length;i+=2){x+=r[i];y+=r[i+1];out.push([x/1000,y/1000])}return out}))}}));
}
// Only the Swiss part of Lago Maggiore counts for the Ticino patent.
function clipNorth(ring,lat){
  const out=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],ina=a[1]>=lat,inb=b[1]>=lat;
    if(ina)out.push(a);
    if(ina!==inb){const t=(lat-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),lat])}
  }
  if(out.length&&(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1]))out.push(out[0]);
  return out;
}
function lakeOpen(w){
  const d=mapRuleDate();let known=false;
  for(const [c,key] of w){
    const r=RULES[c];if(!r?.w?.some(([k])=>k===key))continue;known=true;
    if(!r.closed?.some(cl=>cl.w.includes(key)&&inRange(d,cl.from,cl.to)))return "open";
  }
  return known?"closed":"";
}
function loadLakes(){
  if(lakeData||lakeLoading)return lakeLoading;
  lakeLoading=fetch("./data/lakes.json").then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(list=>{
    lakeData=decodeLakes(list);
    for(const f of lakeData)if(f.properties.n==="Lago Maggiore")
      f.geometry.coordinates=f.geometry.coordinates.map(p=>p.map(r=>clipNorth(r,46.094)).filter(r=>r.length>=4)).filter(p=>p.length);
    lakeStamp="";drawLakes();
  }).catch(()=>{lakeLoading=null});
  return lakeLoading;
}
function drawLakes(){
  if(!mapReady)return;
  updateCantonNet();
  if(!lakeData){loadLakes();return}
  const stamp=mapDate+"|"+DATA_META.version;if(stamp===lakeStamp)return;lakeStamp=stamp;
  lakeFC=FC(lakeData.map(f=>({...f,properties:{n:f.properties.n,k:lakeOpen(f.properties.w)}})));
  map.getSource("fb-lakes")?.setData(lakeFC);
}
const lakeFillOpacity=()=>["interpolate",["linear"],["zoom"],5,.42*zoneDim,9,.34*zoneDim,11,.2*zoneDim,12.5,0];
const lakeLineOpacity=()=>["interpolate",["linear"],["zoom"],5,.95*zoneDim,10,.8*zoneDim,12,.35*zoneDim,13.5,0];
function addLakeLayers(){
  map.addSource("fb-lakes",{type:"geojson",data:lakeFC,tolerance:.4});
  map.addLayer({id:"fb-lakes-fill",type:"fill",source:"fb-lakes",filter:kIs("open"),paint:{"fill-color":"#0fb886","fill-opacity":lakeFillOpacity(),"fill-antialias":true}});
  map.addLayer({id:"fb-lakes-line",type:"line",source:"fb-lakes",filter:kIs("open"),layout:{"line-join":"round"},
    paint:{"line-color":"#039873","line-width":["interpolate",["linear"],["zoom"],5,1,10,2],"line-opacity":lakeLineOpacity()}});
}

/* ---- Zugehöriges Revier dezent mitmarkieren ---- */
let groupFC=FC([]),groupKey="";
function groupLines(parts){
  const features=[];
  for(const part of parts){
    for(const rings of part.polygons||[])features.push({type:"Feature",geometry:{type:"Polygon",coordinates:FishSections.orient(rings)},properties:{a:1}});
    if(part.lines?.length)features.push({type:"Feature",geometry:{type:"MultiLineString",coordinates:part.lines},properties:{a:0}});
  }
  return FC(features);
}
function setGroup(key,parts){
  if(key===groupKey)return;groupKey=key;groupFC=groupLines(parts||[]);
  if(mapReady)map.getSource("fb-group")?.setData(groupFC);
}
// Called from drawSel: decides what belongs to the same Revier as the tapped part.
function syncGroup(hit,parts){
  if(!hit||hit.districtView||hit.wholeDistrict||hit.t==="spot"||hit.t==="catch"){setGroup("",[]);return parts}
  if(hit.t==="x"){
    const g=xg(hit.code),f=g?.feats?.[hit.id];
    if(f){
      const ids=g.zones.get(f.zoneId)||[];
      if(ids.length>1){
        setGroup("x|"+hit.code+"|"+f.zoneId,parts);
        return [{symbol:parts[0]?.symbol,lines:f.poly?[]:f.l,polygons:f.poly?[f.l]:[]}];
      }
    }
    setGroup("",[]);return parts;
  }
  if(hit.t==="zone"&&hit.hasDistrict){
    if(hit.districtParts){setGroup("d|"+hit.code+"|"+hit.rev,hit.districtParts);return parts}
    if(!hit.districtLoading){
      hit.districtLoading=true;
      sectionMap.district(hit).then(all=>{hit.districtParts=all}).catch(()=>{hit.districtParts=[]}).finally(()=>{
        hit.districtLoading=false;if(mapSel===hit||(!mapSel&&chosenMapHit===hit))drawSel();
      });
    }
    return parts;
  }
  setGroup("",[]);return parts;
}
function addGroupLayers(){
  map.addSource("fb-group",{type:"geojson",data:groupFC,tolerance:.3});
  map.addLayer({id:"fb-group-fill",type:"fill",source:"fb-group",filter:["==",["get","a"],1],paint:{"fill-color":"#ffd43b","fill-opacity":.13}});
  map.addLayer({id:"fb-group-dark",type:"line",source:"fb-group",layout:{"line-cap":"round","line-join":"round"},
    paint:{"line-color":"#203038","line-width":selWidth(3.2),"line-opacity":.38}});
  map.addLayer({id:"fb-group-edge",type:"line",source:"fb-group",layout:{"line-cap":"round","line-join":"round"},
    paint:{"line-color":"#ffd43b","line-width":selWidth(1.6),"line-opacity":.62}});
}

/* ---- Kantone ohne Streckendaten: Gewässernetz nach heutigem Status ---- */
// Group of the cantonal rules (RULES[c].w) for running waters; named exceptions first.
// "" means no reliable season in the rules: such waters stay uncoloured.
const CANTON_NET={
  AI:{d:"bach"},AR:{d:"pacht"},OW:{d:"fluss"},UR:{d:"fluss"},ZG:{d:"fluss"},
  BL:{d:"uebrige",x:{rhein:["Rhein"]}},
  BS:{d:"",x:{rhein:["Rhein"],wiese:["Wiese","Birs","Riehenteich"]}},
  JU:{d:"",x:{doubs:["Doubs","Le Doubs"],allaine:["Allaine","L'Allaine"],birse:["Birse","La Birse","Sorne","La Sorne"],scheulte:["Scheulte","La Scheulte"]}},
  NE:{d:"areuse",x:{thielle:["Thielle","La Thielle","Zihlkanal"],"":["Doubs","Le Doubs"]}},
  SZ:{d:"fluss",x:{sihl:["Sihl","Alp","Muota"],linth:["Linth","Linthkanal"]}},
  TI:{d:"fluss",x:{tresa:["Tresa"]}}
};
let cantonAreas=null,cantonNetStamp="",cantonNetIds=[];
function cantonGroupStatus(c,key){
  const R=RULES[c];if(!key||!R)return "";
  const entries=(R.closed||[]).filter(cl=>cl.w.includes(key));
  if(!entries.length)return "";       // season not in the rules: do not guess
  return entries.some(cl=>inRange(mapRuleDate(),cl.from,cl.to))?"closed":"open";
}
function decodeAreas(list){
  return {type:"MultiPolygon",coordinates:list.map(poly=>poly.map(r=>{let x=0,y=0;const out=[];for(let i=0;i<r.length;i+=2){x+=r[i];y+=r[i+1];out.push([x/1000,y/1000])}if(out.length&&(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1]))out.push(out[0]);return out}))};
}
function loadCantonAreas(){
  if(cantonAreas)return;
  cantonAreas={};
  fetch("./data/canton-areas.json").then(r=>r.json()).then(d=>{for(const [c,l] of Object.entries(d))cantonAreas[c]=decodeAreas(l);cantonNetStamp="";updateCantonNet()}).catch(()=>{cantonAreas=null});
}
function updateCantonNet(force){
  if(!mapReady||!map.getSource("base_v1.0.0"))return;
  if(!cantonAreas||!Object.keys(cantonAreas).length){loadCantonAreas();return}
  const stamp=mapDate+"|"+DATA_META.version+"|"+(mapFilter.openFocus!==false);
  if(stamp===cantonNetStamp&&!force&&cantonNetIds.every(id=>map.getLayer(id)))return;
  cantonNetStamp=stamp;
  for(const id of cantonNetIds)if(map.getLayer(id))map.removeLayer(id);
  cantonNetIds=[];
  const before=map.getLayer("fb-sec-fill")?"fb-sec-fill":undefined;
  const cls=["in",["get","class"],["literal",["river","stream","canal"]]];
  for(const [c,cfg] of Object.entries(CANTON_NET)){
    const area=cantonAreas[c];if(!area)continue;
    const named=Object.values(cfg.x||{}).flat();
    const groups=Object.entries(cfg.x||{}).map(([k,names])=>({k,f:["in",["get","name"],["literal",names]]}));
    groups.push({k:cfg.d,f:named.length?["!",["in",["get","name"],["literal",named]]]:true});
    groups.forEach(({k,f},i)=>{
      const st=cantonGroupStatus(c,k);if(!st)return;
      const id=`fb-net-${c}-${i}`,closed=st==="closed";
      map.addLayer({id,type:"line",source:"base_v1.0.0","source-layer":"waterway",minzoom:7,
        filter:["all",cls,["within",area],f],layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":closed?FishSections.symbols.closed.color:FishSections.symbols.open.color,
          "line-width":["interpolate",["linear"],["zoom"],8,["match",["get","class"],"river",1.6,.7],12,["match",["get","class"],"river",3.2,1.6],15,["match",["get","class"],"river",4.5,2.6]],
          // Rivers fade in first, streams one level later: same rhythm as the mapped reaches.
          "line-opacity":(o=>["interpolate",["linear"],["zoom"],7,0,8,["match",["get","class"],"river",o,0],9,["match",["get","class"],"stream",0,o],10,o])(closed?.8*zoneDim:(mapFilter.openFocus!==false?.9:.6)*zoneDim),
          ...(closed?{"line-dasharray":[1.6,1.4]}:{})}},before);
      cantonNetIds.push(id);
    });
  }
}
