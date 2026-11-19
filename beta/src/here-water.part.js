let hereStationIndex=null;
function loadHereStations(){
  if(!hereStationIndex)hereStationIndex=fetch("./data/here-stations.json",{signal:AbortSignal.timeout(10000)})
    .then(response=>{
      if(!response.ok)throw Error("Stationsverzeichnis "+response.status);
      return response.json();
    }).then(index=>({...index,byName:hydroNameIndex(index.stations)}))
    .catch(error=>{hereStationIndex=null;throw error;});
  return hereStationIndex;
}
let temperatureWaters=null;
function loadTemperatureWaters(){
  if(!temperatureWaters)temperatureWaters=fetch("./data/temperature-waters.json",{signal:AbortSignal.timeout(10000)})
    .then(response=>{
      if(!response.ok)throw Error("Gewässerläufe "+response.status);
      return response.json();
    }).then(index=>{
      const byStation=new Map();
      for(const [course,ids] of Object.entries(index.courses))for(const id of ids)byStation.set(id,course);
      return {...index,byStation};
    }).catch(error=>{temperatureWaters=null;throw error;});
  return temperatureWaters;
}
const hereSwissDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Zurich"});
const hereSwissTime=new Intl.DateTimeFormat("de-CH",{timeZone:"Europe/Zurich",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const hereSwissClock=new Intl.DateTimeFormat("de-CH",{timeZone:"Europe/Zurich",hour:"2-digit",minute:"2-digit"});
const hereFlowNumber=new Intl.NumberFormat("de-CH",{maximumSignificantDigits:3});
const hereLevelNumber=new Intl.NumberFormat("de-CH",{minimumFractionDigits:2,maximumFractionDigits:2});
const hereTempNumber=new Intl.NumberFormat("de-CH",{maximumFractionDigits:1});
function hereSelection(){
  if(unknownWater())return null;
  if(isSO()&&currentSec().id){
    const sec=currentSec();
    if(!sec.id)return null;
    if(state.secAuto&&state.here?.alts?.length&&!state.here.pinned){
      const others=state.here.alts.map(a=>a.f?.id);
      if(others.some(id=>!id))return null;
      return {temperatureSection:"SO:"+sec.id,nearbySections:others.map(id=>"SO:"+id)};
    }
    if(sec.kind==="schon")return {temperatureSection:"SO:"+sec.id};
    return {section:"SO:"+sec.id};
  }
  // Automatic choices provide a specific water identity.
  if(state.cantonAuto&&!selectedWaterName())return null;
  const name=selectedWaterName(),c=state.canton,ref=store.get("publicWaterRef",null);
  if(name){
    if(ref?.canton===c&&ref.name===name)return {section:ref.id,station:ref.station,watercourse:ref.watercourse,name,canton:c};
    if(c==="LU"&&state.luRev)return {section:"LU:R"+state.luRev};
    // Older saved choices can have the water name without a section identifier.
    return temperatureWaterName(name)==="aare"?{name,canton:c}:null;
  }
  const rule=cwOf(c);
  return rule?{picker:c+":"+rule}:null;
}
function hereCatchContent(rows){
  if(!rows?.length)return null;
  const count=rows.reduce((n,r)=>n+r.count,0),first=rows[0],length=reportLength(first);
  const species=first.species.replace(" (Flussbarsch)","");
  const others=rows.length>1?" + "+(rows.length-1)+(rows.length===2?" Art":" Arten"):"";
  return {text:"7 Tage · "+count+(count===1?" Fang":" Fänge")+" · "+species+(length?" "+length:"")+others,
    body:"<p>Öffentlich geteilt an diesem Gewässerabschnitt</p>"+publicSpeciesRows(rows)};
}
function hereHydroContent(id,station,reading){
  if(!reading||Date.now()-reading.time>hydroFresh)return null;
  const {value,trend,time}=reading;
  const title=station.lake?"Seepegel":"Abfluss";
  const parts=[station.lake?hereLevelNumber.format(value)+" m ü. M.":hereFlowNumber.format(value)+" m³/s"];
  if(trend)parts.push(trend);
  let body="<p><strong>"+esc(station.water+" – "+station.place)+"</strong></p><p>Messung am "+esc(hereSwissTime.format(time))+" Uhr</p>";
  if(trend)body+="<p>Vergleich mit dem Abfluss vor rund drei Stunden. Bis 3 % Unterschied (mindestens 0.01 m³/s) gilt als stabil.</p>";
  body+='<a href="https://www.hydrodaten.admin.ch/de/seen-und-fluesse/stationen-und-daten/'+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">Messstation beim BAFU öffnen</a>';
  return {title,text:parts.join(" · "),body,expires:time+hydroFresh};
}
function temperatureTarget(choice,index,network){
  const section=choice.temperatureSection||choice.section;
  const local=choice.nearbySections?undefined:choice.station||index.sections[section]||index.rules[choice.picker];
  const station=index.stations[local],water=choice.watercourse;
  let reach=network.reaches[section]||network.pickers[choice.picker];
  if(!reach&&water&&Number.isFinite(water.lon)&&Number.isFinite(water.lat)){
    const name=temperatureWaterName(water.name);
    const course=name==="aare"?aareCourse:water.lake?"lake:"+name:water.course;
    if(network.courses[course])reach=[course,water.lon,water.lat];
  }
  if(!reach&&station)reach=[network.byStation.get(local),station.lon,station.lat];
  if(!reach&&temperatureWaterName(choice.name)==="aare"){
    const anchor=index.stations[({AG:"2016",BE:"2135",SO:"2063"})[choice.canton]];
    if(anchor)reach=[aareCourse,anchor.lon,anchor.lat];
  }
  if(!reach)return null;
  if(choice.nearbySections?.some(id=>network.reaches[id]?.[0]!==reach[0]))return null;
  const [course,lon,lat]=reach,ids=network.courses[course]||(station?[local]:[]);
  return ids.length?{ids,lon,lat,local}:null;
}
async function restoreFederalWatercourse(id){
  const response=await fetch("https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swisstlm3d-gewaessernetz/"+
    id.slice(3)+"?sr=4326&geometryFormat=geojson&lang=de",{signal:AbortSignal.timeout(6500),referrerPolicy:"no-referrer"});
  if(!response.ok)return null;
  const {feature}=await response.json();
  if(String(feature?.featureId??feature?.id)!==id.slice(3))return null;
  const props=feature.attributes||feature.properties||{},g=feature.geometry;
  const paths=g?.type==="LineString"?[g.coordinates]:g?.type==="MultiLineString"?g.coordinates:
    g?.type==="Polygon"?[g.coordinates[0]]:g?.type==="MultiPolygon"?g.coordinates.map(rings=>rings[0]):[];
  const line=paths.reduce((best,p)=>p.length>best.length?p:best,[]),point=line[Math.floor(line.length/2)];
  if(!point||!Number.isFinite(point[0])||!Number.isFinite(point[1]))return null;
  return {course:props.gwl_nr,name:String(props.name||props.seename||props.seename_d||"").split("|")[0].trim(),
    lake:Number(props.objektart)===101,lon:point[0],lat:point[1]};
}
async function hereTemperatureContent(choice){
  const [index,network]=await Promise.all([loadHereStations(),loadTemperatureWaters()]);
  if(!choice.watercourse&&!choice.station&&/^CH:\d{1,12}$/.test(choice.section)){
    const watercourse=await restoreFederalWatercourse(choice.section).catch(()=>null);
    if(watercourse){
      const ref=store.get("publicWaterRef",null);
      if(ref?.id===choice.section&&!ref.watercourse)store.set("publicWaterRef",{...ref,watercourse});
      choice={...choice,watercourse};
    }
  }
  const target=temperatureTarget(choice,index,network);
  if(!target)return null;
  const readings=await waterTemperatures(target.ids);
  const r=nearestWaterTemperature(target,index.stations,readings,Date.now());
  if(!r)return null;
  const s=index.stations[r.id],clock=hereSwissDay.format(r.time)===hereSwissDay.format(Date.now())?hereSwissClock:hereSwissTime;
  return {value:hereTempNumber.format(r.value)+" °C",id:r.id,expires:r.time+hydroFresh,
    source:(target.local===r.id?"Messstation":"Referenzstation")+" · "+s.water+" – "+s.place+" · "+clock.format(r.time)+" Uhr"};
}
function paintHereTemperature(link,content){
  link.hidden=!content;
  link.querySelector("strong").textContent=content?.value||"";
  link.querySelector("small").textContent=content?.source||"";
  if(!content){link.removeAttribute("href");return;}
  link.href="https://www.hydrodaten.admin.ch/de/seen-und-fluesse/stationen-und-daten/"+encodeURIComponent(content.id);
}
function paintHereRow(row,content){
  row.hidden=!content;
  if(content){
    if(content.title)row.querySelector("strong").textContent=content.title;
    const small=row.querySelector("summary small");
    if(small.textContent!==content.text)small.textContent=content.text;
    if(row.hereBody!==content.body){
      row.querySelector(".water-info-detail").innerHTML=content.body;
      row.hereBody=content.body;
    }
  }else row.open=false;
  $("#hereWaterInfo").hidden=$("#hereCatches").hidden&&$("#hereHydro").hidden;
}
function updateHereRow(row,key,ttl,read,paint=paintHereRow){
  if(row.hereKey!==key){
    row.hereKey=key;row.hereTicket=null;row.hereDue=0;row.hereExpires=0;
    paint(row,null);
  }
  if(row.hereExpires&&row.hereExpires<=Date.now()&&!row.hidden)paint(row,null);
  if(!key||row.hereTicket||Date.now()<row.hereDue)return;
  const ticket={};row.hereTicket=ticket;
  Promise.resolve().then(read).then(content=>{
    if(row.hereTicket!==ticket)return;
    paint(row,content);
    row.hereExpires=content?.expires||0;
    row.hereDue=Math.min(Date.now()+ttl,content?.expires??Infinity);
  }).catch(()=>{
    if(row.hereTicket!==ticket)return;
    paint(row,null);
    row.hereDue=Date.now()+30000;
  }).finally(()=>{if(row.hereTicket===ticket)row.hereTicket=null;});
}
function renderHereWater(){
  const catches=$("#hereCatches"),hydro=$("#hereHydro");
  const visible=!document.hidden&&navigator.onLine&&route()==="hier"&&$("#v-hier").classList.contains("on");
  const choice=visible&&hereSelection();
  const section=choice?.section,picker=choice?.picker,station=choice?.station;
  updateHereRow($("#hereTemperature"),choice?JSON.stringify(choice):"",10*hydroMinute,()=>hereTemperatureContent(choice),paintHereTemperature);
  const reportKey=(section||picker||"");
  updateHereRow(catches,reportKey&&reportKey+"/"+hereSwissDay.format(new Date()),60000,async()=>{
    const id=section||(await loadHereStations()).pickerSections[picker];
    if(!id)return null;
    const data=await reportRequest("section?"+new URLSearchParams({id,days:7}));
    return hereCatchContent(data.species);
  });
  updateHereRow(hydro,station||section||picker||"",10*hydroMinute,async()=>{
    const index=await loadHereStations();
    const id=station||(section?index.sections[section]:index.rules[picker]);
    if(!id||!index.stations[id])return null;
    return hereHydroContent(id,index.stations[id],await fetchHydro(id,index.stations[id]));
  });
}
function invalidateHereCatches(){
  const row=$("#hereCatches");
  row.hereKey=null;
  renderHereWater();
}
addEventListener("online",renderHereWater);
addEventListener("offline",renderHereWater);
addEventListener("pageshow",renderHereWater);
document.addEventListener("visibilitychange",renderHereWater);
setInterval(()=>{if(!document.hidden&&route()==="hier")renderHereWater();},60000);
