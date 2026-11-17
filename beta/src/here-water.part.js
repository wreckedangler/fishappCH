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
const hereSwissDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Zurich"});
const hereSwissTime=new Intl.DateTimeFormat("de-CH",{timeZone:"Europe/Zurich",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const hereFlowNumber=new Intl.NumberFormat("de-CH",{maximumSignificantDigits:3});
const hereLevelNumber=new Intl.NumberFormat("de-CH",{minimumFractionDigits:2,maximumFractionDigits:2});
const hereTempNumber=new Intl.NumberFormat("de-CH",{maximumFractionDigits:1});
function hereSelection(){
  if(unknownWater())return null;
  if(isSO()){
    const sec=currentSec();
    if(!sec.id||sec.kind==="schon"||state.secAuto&&state.here?.alts?.length&&!state.here.pinned)return null;
    return {section:"SO:"+sec.id};
  }
  // Outside SO automatic canton detection alone does not identify a stretch of water.
  if(state.cantonAuto)return null;
  const name=selectedWaterName(),c=state.canton,ref=store.get("publicWaterRef",null);
  if(name){
    if(ref?.canton===c&&ref.name===name)return {section:ref.id,station:ref.station};
    if(c==="LU"&&state.luRev)return {section:"LU:R"+state.luRev};
    return null;
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
  const {value,trend,time,temperature,tempTime}=reading;
  const title=station.lake?"Seepegel":"Abfluss";
  const parts=[station.lake?hereLevelNumber.format(value)+" m ü. M.":hereFlowNumber.format(value)+" m³/s"];
  if(trend)parts.push(trend);
  if(temperature!=null)parts.push(hereTempNumber.format(temperature)+" °C");
  let body="<p><strong>"+esc(station.water+" – "+station.place)+"</strong></p><p>Messung am "+esc(hereSwissTime.format(time))+" Uhr</p>";
  if(tempTime!=null&&tempTime!==time)body+="<p>Wassertemperatur gemessen am "+esc(hereSwissTime.format(tempTime))+" Uhr</p>";
  if(trend)body+="<p>Vergleich mit dem Abfluss vor rund drei Stunden. Bis 3 % Unterschied (mindestens 0.01 m³/s) gilt als stabil.</p>";
  body+='<a href="https://www.hydrodaten.admin.ch/de/seen-und-fluesse/stationen-und-daten/'+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">Messstation beim BAFU öffnen</a>';
  return {title,text:parts.join(" · "),body,expires:time+hydroFresh};
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
function updateHereRow(row,key,ttl,read){
  if(row.hereKey!==key){
    row.hereKey=key;row.hereTicket=null;row.hereDue=0;row.hereExpires=0;
    paintHereRow(row,null);
  }
  if(row.hereExpires&&row.hereExpires<=Date.now()&&!row.hidden)paintHereRow(row,null);
  if(!key||row.hereTicket||Date.now()<row.hereDue)return;
  const ticket={};row.hereTicket=ticket;
  Promise.resolve().then(read).then(content=>{
    if(row.hereTicket!==ticket)return;
    paintHereRow(row,content);
    row.hereExpires=content?.expires||0;
    row.hereDue=Math.min(Date.now()+ttl,content?.expires??Infinity);
  }).catch(()=>{
    if(row.hereTicket!==ticket)return;
    paintHereRow(row,null);
    row.hereDue=Date.now()+30000;
  }).finally(()=>{if(row.hereTicket===ticket)row.hereTicket=null;});
}
function renderHereWater(){
  const catches=$("#hereCatches"),hydro=$("#hereHydro");
  const visible=!document.hidden&&navigator.onLine&&route()==="hier"&&$("#v-hier").classList.contains("on");
  const choice=visible&&hereSelection();
  const section=choice?.section,picker=choice?.picker,station=choice?.station;
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
