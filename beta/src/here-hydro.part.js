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
const hydroQuery=`query HereWater($station:String!, $from:AWSDateTime!, $main:String!) {
  water { observations {
    data_live(where:{stationNo:{_eq:$station},timestamp:{_gte:$from}}) {stationNo parameterName timestamp value}
    unit:data_10min_mean(where:{station:{no:{_eq:$station}},parameterName:{_eq:$main}},limit:1) {unitSymbol}
  } }
}`;
async function fetchHydro(id,station) {
  const main=station.lake?"W":"Q";
  const variables={station:id,main,from:new Date(Date.now()-5*60*hydroMinute).toISOString()};
  const response=await fetch("https://data.bafu.admin.ch/api",{method:"POST",credentials:"omit",referrerPolicy:"no-referrer",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({query:hydroQuery,variables}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("BAFU "+response.status);
  const {data,errors}=await response.json(),observation=data?.water?.observations;
  if(errors?.length||!Array.isArray(observation?.data_live))throw Error("BAFU-Messwerte fehlen");
  return hydroReading(id,station.lake,observation.data_live,observation.unit?.[0]?.unitSymbol,Date.now());
}
function hydroReading(id,lake,rows,unit,now) {
  const u=String(unit||"").toLowerCase().replace(/\s|\./g,"");
  let factor=1;
  if(lake&&u!=="müm")return null;
  if(!lake&&!["m3/s","m³/s"].includes(u)){
    if(!["l/s","l/sec"].includes(u))return null;
    factor=.001;
  }
  const values=rows.filter(r=>r.stationNo===id&&Number.isFinite(r.value)).map(r=>({...r,time:Date.parse(r.timestamp)}))
    .filter(r=>r.time<=now&&r.time>=now-5*60*hydroMinute).sort((a,b)=>b.time-a.time);
  const main=values.filter(r=>r.parameterName===(lake?"W":"Q")&&(lake||r.value>=0));
  const current=main[0];
  if(!current||now-current.time>hydroFresh)return null;
  const temp=values.find(r=>r.parameterName==="WT"&&now-r.time<=hydroFresh&&Math.abs(current.time-r.time)<=20*hydroMinute);
  const target=current.time-3*60*hydroMinute;
  const prior=main.reduce((closest,row)=>!closest||Math.abs(row.time-target)<Math.abs(closest.time-target)?row:closest,null);
  let trend="";
  if(!lake&&prior&&Math.abs(prior.time-target)<=15*hydroMinute){
    const delta=(current.value-prior.value)*factor;
    const tolerance=Math.max(.01,Math.abs(prior.value*factor)*.03);
    trend=Math.abs(delta)<=tolerance?"stabil":delta>0?"steigend":"fallend";
  }
  return {value:current.value*factor,time:current.time,temperature:temp?.value??null,tempTime:temp?.time??null,trend};
}
