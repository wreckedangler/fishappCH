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
