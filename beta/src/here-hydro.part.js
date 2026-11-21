/* BAFU observations and the geometry check shared with the station-index build. */
function hydroName(name) {
  const key=String(name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/^(?:la |le |l['’])/,"").trim();
  const aliases={"lac leman":"genfersee","leman":"genfersee","lac de neuchatel":"neuenburgersee",
    "lac de morat":"murtensee","lac de bienne":"bielersee","aegerisee":"agerisee",
    "bodensee, obersee":"bodensee-obersee","bodensee, untersee":"untersee",
    "luganersee":"lago di lugano","sarine":"saane","birse":"birs","suze":"schuss"};
  return aliases[key]||key;
}
function hydroNameIndex(stations) {
  const byName=new Map();
  for(const [id,station] of Object.entries(stations)){
    const key=hydroName(station.water);
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push([id,station]);
  }
  return byName;
}
function temperatureWaterName(label) {
  const name=hydroName(String(label||"").split(" · ")[0].split(":")[0].replace(/,\s*[IVX]+\.\s*TS\.?$/i,""));
  if(/^(?:aare(?: a[1-6]| interlaken|-kanal| \((?:hasliaare|hagneckkanal)\))?|hasliaare|aar|alte aare|neuer seitenarm aare)$/.test(name))return "aare";
  return name;
}
const aareCourse="CH0000370000";
function stationOnGeometry(byName,names,parts) {
  const candidates=new Map();
  for(const name of names)for(const [id,s] of byName.get(hydroName(name))||[])candidates.set(id,s);
  let best=null;
  for(const [id,s] of candidates){
    for(const part of parts){
      const geometries=(part.polygons||[]).map(rings=>[rings,true]);
      if(!s.lake&&part.lines?.length)geometries.push([part.lines,false]);
      for(const [paths,area] of geometries){
        if(!paths.length)continue;
        const {d}=FishSections.nearest(s.lat,s.lon,paths,area);
        // Stations can be on the bank. Never search farther up/downstream for a substitute.
        if(d<=100&&(!best||d<best.distance))best={id,distance:d};
      }
    }
  }
  return best;
}

const hydroMinute=60000,hydroFresh=90*hydroMinute;
const hydroShortWindow=180*hydroMinute,hydroDayWindow=24*60*hydroMinute;
function hydroHistory(live,archive,end,window,factor=1){
  const byTime=new Map();
  const startLive=live.reduce((earliest,row)=>Math.min(earliest,row.time),Infinity);
  for(const {time,value} of [...archive.filter(row=>row.time<startLive),...live]){
    if(time>=end-window&&time<=end)byTime.set(time,value*factor);
  }
  return [...byTime].sort(([a],[b])=>a-b);
}
const hydroQuery=`query HereWater($station:String!, $from:AWSDateTime!, $main:String!, $historyFrom:AWSDateTime!, $daily:Boolean!) {
  water { observations {
    data_live(where:{stationNo:{_eq:$station},parameterName:{_eq:$main},timestamp:{_gte:$from}}) {stationNo parameterName timestamp value}
    unit:data_10min_mean(where:{station:{no:{_eq:$station}},parameterName:{_eq:$main}},limit:1) {unitSymbol}
    history:data_10min_mean(where:{station:{no:{_eq:$station}},parameterName:{_eq:$main},timestamp:{_gte:$historyFrom}}) @include(if:$daily) {timestamp value unitSymbol}
  } }
}`;
async function hydroObservations(query,variables) {
  const response=await fetch("https://data.bafu.admin.ch/api",{method:"POST",credentials:"omit",referrerPolicy:"no-referrer",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("BAFU "+response.status);
  const {data}=await response.json(),observation=data?.water?.observations;
  if(!Array.isArray(observation?.data_live))throw Error("BAFU-Messwerte fehlen");
  return observation;
}
async function fetchHydro(id,station) {
  const now=Date.now(),main=station.lake?"W":"Q",daily=!station.lake;
  const observation=await hydroObservations(hydroQuery,{station:id,main,daily,
    from:new Date(now-(daily?hydroDayWindow:5*60*hydroMinute)).toISOString(),historyFrom:new Date(now-hydroDayWindow).toISOString()});
  return hydroReading(id,station.lake,observation.data_live,observation.unit?.[0]?.unitSymbol,Date.now(),observation.history);
}
const hydroUnit=unit=>String(unit||"").toLowerCase().replace(/\s|\./g,"").replace("³","3");
function hydroReading(id,lake,rows,unit,now,history=[]) {
  const u=hydroUnit(unit);
  let factor=1;
  if(lake&&u!=="müm")return null;
  if(!lake&&u!=="m3/s"){
    if(!["l/s","l/sec"].includes(u))return null;
    factor=.001;
  }
  const values=rows.filter(r=>r.stationNo===id&&Number.isFinite(r.value)).map(r=>({...r,time:Date.parse(r.timestamp)}))
    .filter(r=>r.time<=now&&r.time>=now-(lake?5*60*hydroMinute:hydroDayWindow)).sort((a,b)=>b.time-a.time);
  const main=values.filter(r=>r.parameterName===(lake?"W":"Q")&&(lake||r.value>=0));
  const current=main[0];
  if(!current||now-current.time>hydroFresh)return null;
  const target=current.time-3*60*hydroMinute;
  const prior=main.reduce((closest,row)=>!closest||Math.abs(row.time-target)<Math.abs(closest.time-target)?row:closest,null);
  let trend="";
  if(!lake&&prior&&Math.abs(prior.time-target)<=15*hydroMinute){
    const delta=(current.value-prior.value)*factor;
    const tolerance=Math.max(.01,Math.abs(prior.value*factor)*.03);
    trend=Math.abs(delta)<=tolerance?"stabil":delta>0?"steigend":"fallend";
  }
  const chartWindow=lake?hydroShortWindow:hydroDayWindow;
  const chartEnd=lake?current.time:now;
  const archive=(history||[]).filter(r=>hydroUnit(r.unitSymbol)===u&&Number.isFinite(r.value)&&r.value>=0)
    .map(r=>({time:Date.parse(r.timestamp),value:r.value}));
  return {value:current.value*factor,time:current.time,trend,chartEnd,chartWindow,history:hydroHistory(main,archive,chartEnd,chartWindow,factor)};
}

const temperatureQuery=`query WaterTemperature($stations:[String!]!,$from:AWSDateTime!) {
  water { observations {
    data_live(where:{stationNo:{_in:$stations},parameterName:{_eq:"WT"},timestamp:{_gte:$from}}) {stationNo timestamp value}
    history:data_10min_mean(where:{station:{no:{_in:$stations}},parameterName:{_eq:"WT"},timestamp:{_gte:$from}}) {station{no} timestamp value}
  } }
}`;
const temperatureFeedCache=new Map();
function waterTemperatures(ids) {
  const key=ids.join(","),now=Date.now(),cached=temperatureFeedCache.get(key);
  if(cached&&now<cached.expires)return cached.request;
  const entry={expires:Infinity};
  entry.request=hydroObservations(temperatureQuery,{stations:ids,from:new Date(now-hydroDayWindow).toISOString()}).then(observations=>{
    const latest=new Map(),series=new Map(),archive=new Map(),at=Date.now();
    for(const {stationNo,timestamp,value} of observations.data_live){
      const time=Date.parse(timestamp);
      if(!ids.includes(stationNo)||!Number.isFinite(value)||!Number.isFinite(time)||time>at)continue;
      if(!series.has(stationNo))series.set(stationNo,[]);
      series.get(stationNo).push({time,value});
      if(time+hydroFresh>at&&(!latest.has(stationNo)||latest.get(stationNo).time<time))latest.set(stationNo,{id:stationNo,value,time});
    }
    for(const {station,timestamp,value} of observations.history||[]){
      const id=station?.no,time=Date.parse(timestamp);
      if(!latest.has(id)||!Number.isFinite(value)||!Number.isFinite(time))continue;
      if(!archive.has(id))archive.set(id,[]);
      archive.get(id).push({time,value});
    }
    for(const [id,reading] of latest){
      reading.chartEnd=at;
      reading.chartWindow=hydroDayWindow;
      reading.history=hydroHistory(series.get(id),archive.get(id)||[],at,hydroDayWindow);
    }
    entry.expires=Math.min(at+10*hydroMinute,...[...latest.values()].map(r=>r.time+hydroFresh));
    return latest;
  }).catch(error=>{temperatureFeedCache.delete(key);throw error;});
  temperatureFeedCache.set(key,entry);
  return entry.request;
}
function nearestWaterTemperature(target,stations,readings,now) {
  let best=null,distance=Infinity;
  const scale=Math.cos(target.lat*Math.PI/180);
  for(const id of target.ids){
    const r=readings.get(id),s=stations[id];
    if(!s||!r||r.time>now||r.time+hydroFresh<=now)continue;
    if(id===target.local)return r;
    const d=((s.lon-target.lon)*scale)**2+(s.lat-target.lat)**2;
    if(d<distance){distance=d;best=r;}
  }
  return best;
}
