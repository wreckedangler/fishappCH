/* Automatic water selection shares the map's geometry and access information. */
const autoWater={hit:null,hits:[],position:null,pending:null,version:0,due:0,error:"",incomplete:false};
const positionDistance=(a,b)=>Math.hypot((a.lat-b.lat)*111320,(a.lon-b.lon)*111320*Math.cos(a.lat*Math.PI/180));
function resetAutoWater(){
  ++autoWater.version;
  Object.assign(autoWater,{hit:null,hits:[],position:null,pending:null,due:0,error:"",incomplete:false});
  state.here=null;
}
async function loadWaterGeometry(){
  const jobs=[];
  if(typeof FishSections==="undefined")jobs.push(loadScript("./beta/map-sections-gl.js"));
  if(typeof FishRights==="undefined")jobs.push(loadScript("./map-rights.js"));
  if(typeof FishRegisters==="undefined")jobs.push(loadScript("./map-rights-registers.js"));
  if(typeof XSRC==="undefined")jobs.push(loadScript("./map-sources.js"));
  await Promise.all(jobs);
  prepareSections(false);refreshMapDate();
  await loadBundledSO();
}
async function nearbyMappedWaters(lat,lon,radius){
  const box=FishSections.tapBox(lat,lon,radius),hits=[],jobs=[];
  for(const f of GEO.official?GEO.features:[]){
    const point=FishSections.nearest(lat,lon,f.l);
    if(point.d<=radius)hits.push({...point,t:"sec",id:f.id,source:f,code:"SO",name:secById(f.id).name,
      kind:f.art,zoneId:JSON.stringify(["SO",f.id,f.art,f.t])});
  }
  // Location selection must be independent of the map's current viewport and zoom.
  jobs.push(sectionMap.hits(lat,lon,radius,Infinity));
  for(const code of Object.keys(XSRC).filter(c=>westIntersects(c,box))){
    jobs.push((async()=>{
      await startWest(code);
      const g=xg(code);if(!g.all)throw Error("Gewässerdaten "+code);
      const found=[];
      for(const f of Object.values(g.feats)){
        if(!FishSections.intersects(box,f.bounds))continue;
        const point=FishSections.nearest(lat,lon,f.l,f.poly);
        if(point.d<=radius)found.push({...point,t:"x",code,id:f.id,zoneId:f.zoneId,area:f.poly,name:f.name,kind:f.art});
      }
      return found;
    })());
  }
  const results=await Promise.allSettled(jobs);
  for(const result of results)if(result.status==="fulfilled")hits.push(...result.value);
  return {hits,incomplete:results.some(result=>result.status==="rejected")};
}
function rankNearbyWaters(hits,water){
  const byZone=new Map();
  for(const hit of hits){
    if(hit.buried||!Number.isFinite(hit.d)||!Number.isFinite(hit.lat)||!Number.isFinite(hit.lon))continue;
    const key=hit.zoneId||hit.code+"/"+hit.id,old=byZone.get(key);
    if(!old||(!!old.area!==!!hit.area?!hit.area:hit.d<old.d))byZone.set(key,hit);
  }
  const all=[...byZone.values()];
  // Select water geometry first, then evaluate overlapping restriction areas.
  const waters=all.filter(hit=>!FishSections.localCondition(hit.kind)&&(!hit.area||hit.lake||hit.t==="x"));
  waters.sort((a,b)=>a.d-b.d||Number(!!a.area)-Number(!!b.area));
  let hit=waters[0];
  if(water&&(!hit||unclearHit(hit)||water.d+5<hit.d)){
    const atWater=waters.filter(h=>positionDistance(h,water)<=25&&Math.abs(h.d-water.d)<=25&&
      (!h.water||typeof h.water!=="string"||water.names.some(name=>temperatureWaterName(name)===temperatureWaterName(h.water))));
    const described=atWater.find(h=>!unclearHit(h));
    if(!hit||water.d<=hit.d+25){
      hit=described||{...water,t:"w",water,name:water.name||(water.lake?"See ohne Namen":"Bach ohne Namen")};
    }
  }
  if(!hit)return null;
  const close=all.filter(other=>(waters.includes(other)||FishSections.restriction(other.kind))&&
    positionDistance(other,hit)<=8&&Math.abs(other.d-hit.d)<=8);
  const protectedHit=close.find(other=>!other.area&&FishSections.restriction(other.kind)&&other.d<=hit.d+2);
  if(protectedHit)hit=protectedHit;
  return {hit,hits:[hit,...close.filter(h=>h!==hit)]};
}
async function federalWaterCanton(hit){
  const params=new URLSearchParams({geometry:hit.lon+","+hit.lat,geometryType:"esriGeometryPoint",sr:"4326",
    layers:"all:ch.swisstopo.swissboundaries3d-kanton-flaeche.fill,ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill",
    tolerance:"0",returnGeometry:"false",lang:"de"});
  const data=await identifyJSON("https://api3.geo.admin.ch/rest/services/api/MapServer/identify?"+params);
  const border=[...new Set(data.results.filter(row=>row.layerBodId==="ch.swisstopo.swissboundaries3d-kanton-flaeche.fill")
    .map(row=>row.attributes?.ak).filter(code=>Object.hasOwn(FishRights.offices,code)))].sort();
  if(!border.length)throw Error("Für diesen Standort ist kein Schweizer Gewässer zugeordnet.");
  const municipalities=data.results.map(row=>row.attributes).filter(a=>a?.is_current_jahr===true&&a.kanton===border[0]);
  return {...hit,code:border[0],border,municipality:municipalities.length===1?municipalities[0].gemname:""};
}
async function findNearestWater(position){
  await loadWaterGeometry();
  let searchIncomplete=false;
  for(const radius of [300,1500,6000,24000]){
    const mappedJob=nearbyMappedWaters(position.lat,position.lon,radius).catch(()=>({hits:[],incomplete:true}));
    const additionalSearch=new AbortController();
    const federalJob=navigator.onLine?waterAt(position.lat,position.lon,radius,
      AbortSignal.any([additionalSearch.signal,AbortSignal.timeout(9000)])).catch(()=>{searchIncomplete=true;return null}):null;
    const mapped=await mappedJob;
    const candidate=rankNearbyWaters(mapped.hits,null);
    // A slow hydrography service must not hold up a known mapped reach for its full timeout.
    const timer=candidate&&federalJob?setTimeout(()=>additionalSearch.abort(),2500):null;
    const federal=await federalJob;
    if(timer!==null)clearTimeout(timer);
    const result=rankNearbyWaters(mapped.hits,federal);
    if(!result){searchIncomplete||=mapped.incomplete;continue}
    if(result.hit.t==="w"){
      result.hit=await federalWaterCanton(result.hit);
      result.hits[0]=result.hit;
    }
    await checkLocatedWater(result,position);
    if(result.hit.code==="LU"&&result.hit.rev)await loadLUDistricts();
    return result;
  }
  if(!navigator.onLine)throw Error("Gewässerdaten offline nicht verfügbar. Manuell wählen oder erneut verbinden.");
  throw Error(searchIncomplete?"Gewässersuche unvollständig. Erneut versuchen oder auf der Karte wählen.":"Kein Gewässer gefunden. Auf der Karte oder in der Liste wählen.");
}
async function checkLocatedWater(result,position){
  const selected=result.hit;
  const {lat,lon}=selected;
  const radius=12,box=FishSections.tapBox(lat,lon,radius);
  const services=eastWms.filter(([, , ,b])=>FishSections.intersects(box,[b[0][1],b[0][0],b[1][1],b[1][0]]));
  const [mapped,...local]=await Promise.allSettled([
    nearbyMappedWaters(lat,lon,radius),
    ...services.map(service=>cantonalWmsHits(service,lat,lon,radius,16))
  ]);
  result.incomplete=mapped.status==="rejected"||mapped.value.incomplete||local.some(entry=>entry.status==="rejected");
  const nearby=mapped.status==="fulfilled"?mapped.value.hits.slice():[];
  for(const entry of local)if(entry.status==="fulfilled")nearby.push(...entry.value);
  if(selected.t==="w"&&!selected.water.ambiguous&&!(selected.border?.length>1)){
    const official=rankNearbyWaters(nearby.filter(hit=>hit.code===selected.code),null)?.hit;
    if(official&&!unclearHit(official))result.hit={...official,d:positionDistance(position,official)};
  }
  const hit=result.hit;
  const overlaps=new Map();
  for(const other of nearby){
    if(other.zoneId===hit.zoneId||other.buried||positionDistance(other,hit)>8)continue;
    overlaps.set(other.zoneId||other.id,{...other,d:hit.d+positionDistance(other,hit)});
  }
  result.hits=[hit,...overlaps.values()];
}
function activateLocatedWater(result,position){
  const hit=result.hit,{c,sec}=hitRuleContext(hit),old=autoWater.hit;
  const changed=!old||old.code!==c||old.zoneId!==hit.zoneId||old.name!==hit.name||old.rule!==hit.rule;
  Object.assign(autoWater,result,{position,error:"",due:Date.now()+60000});
  state.canton=c;
  if(hit.t==="sec")state.sec=hit.id;
  else state.cw[c]=sec.id;
  const rev=c==="LU"&&hit.t==="zone"?hit.rev||"":"";
  if(c==="LU")state.luRev=rev;
  const name=rev?luWaterName(hit.name,rev):hit.name;
  state.xsel[c]=name;
  hit.choiceName=name;hit.choiceHits=result.hits.filter(h=>h!==hit);hit.choiceIncomplete=result.incomplete;
  chosenMapHit=hit;
  state.here={id:hit.t==="sec"?hit.id:"",kind:kindOf(hit.kind),d:hit.d};
  if(changed){save();rememberReportSection(hit,c,name)}
  renderAll();
  if(map){drawSel();renderSheet()}
}
function locateNearestWater(force=false){
  if(!isAuto()||!state.pos)return;
  if(autoWater.pending)return;
  if(!force&&autoWater.position&&positionDistance(state.pos,autoWater.position)<25&&Date.now()<autoWater.due)return;
  const position={...state.pos},version=++autoWater.version;
  if(!autoWater.position||positionDistance(position,autoWater.position)>250){autoWater.hit=null;state.here=null;clearReportSection()}
  autoWater.error="";
  autoWater.pending=findNearestWater(position).then(result=>{
    if(version!==autoWater.version||!isAuto())return;
    if(positionDistance(position,state.pos)>50)return;
    activateLocatedWater(result,position);
  }).catch(error=>{
    if(version!==autoWater.version||!isAuto())return;
    Object.assign(autoWater,{hit:null,error:error.message,position,due:Date.now()+15000});
    state.here=null;clearReportSection();
  }).finally(()=>{
    if(version!==autoWater.version)return;
    autoWater.pending=null;
    if(!isAuto())return;
    renderAll();
    if(state.pos&&positionDistance(position,state.pos)>50)locateNearestWater();
  });
  renderTop();renderHier();
}
addEventListener("online",()=>{if(isAuto())locateNearestWater(true)});
