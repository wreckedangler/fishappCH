/* Freiwillige Fangmeldungen. Nur der Server bestimmt die Position des Abschnitts. */
const reportApi="https://fishappch-fangmeldungen.felinesunflower4.chatgpt.site/v1/";
const sharePrefix="fb_publicCatch_";
const activeShares=new Set();
let draftSection=null,draftWaterKey="",sectionDialogSeq=0,reportTimer=null;
async function reportRequest(path, options={}) {
  const response=await fetch(reportApi+path,{credentials:"omit",referrerPolicy:"no-referrer",cache:"no-store",signal:AbortSignal.timeout(10000),...options});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error||"Fangmeldungen nicht erreichbar."),{status:response.status});
  return data;
}
function reportHint(f) {
  if(f.reportSection && /^[A-Z]{2}:[\w-]{1,32}$/.test(f.reportSection))return f.reportSection;
  const code=f.canton||"SO";
  if(code==="SO" && f.sec)return "SO:"+f.sec;
  if(code==="LU" && f.luRev)return "LU:R"+f.luRev;
  return "";
}
function formCatch() {
  const pinned=store.get("publicWaterRef",null),name=selectedWaterName(),code=state.canton;
  return {canton:code,sec:currentSec().id,waterName:name,luRev:code==="LU"&&name?state.luRev:"",
    reportSection:pinned?.canton===code&&pinned.name===name?pinned.id:"",day:dayKey(new Date())};
}
function shareState(id) { return store.get("publicCatch_"+id,null); }
function shareWrite(id,record) {
  if(!store.set("publicCatch_"+id,record)){toast("Freigabe konnte auf dem Gerät nicht gespeichert werden.");return false;}
  return true;
}
function shareIds(){
  try{return Object.keys(localStorage).filter(key=>key.startsWith(sharePrefix)).map(key=>key.slice(sharePrefix.length));}catch{return [];}
}
function reportFields(f,section) {
  return {section:section.id,day:f.day,species:f.art,len:f.len==null||f.len===""?null:Number(f.len),count:Number(f.n)||1};
}
function shareStatus(id) {
  const record=shareState(id);
  if(!record)return "";
  if(record.remove)return "Rückzug ausstehend";
  if(record.error)return record.error;
  if(!record.pending&&Date.parse(swissCalendar.format(new Date()))-Date.parse(record.body.day)>=30*86400000)return "Freigabe abgelaufen";
  return record.pending?"Freigabe ausstehend":"Öffentlich geteilt";
}
function shareButton(f) {
  const rec=shareState(f.id);
  const label=rec?.remove?"Rückzug erneut versuchen":rec?"Freigabe verwalten":"Auf der Fangkarte teilen";
  return '<button type="button" data-share="'+esc(f.id)+'">'+label+'</button>';
}
function updateShareUI(id) {
  const tag=document.getElementById("share-status-"+id);
  if(tag)tag.textContent=shareStatus(id);
  const row=document.getElementById("catch-"+id),button=row?.querySelector("[data-share]");
  if(button)button.outerHTML=shareButton({id});
}
function queueShare(f,section) {
  const prior=shareState(f.id);
  if(prior?.remove){toast("Der Rückzug wird noch übertragen.");return false;}
  const key=prior?.key||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  const rec={key,revision:(prior?.revision||0)+1,pending:true,section,body:reportFields(f,section)};
  if(!shareWrite(f.id,rec))return false;
  updateShareUI(f.id);void syncShare(f.id);return true;
}
function withdrawShare(id) {
  const old=shareState(id);
  if(!old)return true;
  if(!old.remove && !shareWrite(id,{key:old.key,revision:old.revision+1,remove:true,pending:true}))return false;
  updateShareUI(id);void syncShare(id);return true;
}
async function syncShare(id) {
  id=String(id);
  if(activeShares.has(id)||!navigator.onLine)return;
  activeShares.add(id);
  try{
    for(;;){
      const row=shareState(id);
      if(!row?.pending)return;
      const body={revision:row.revision,...(row.remove?{}:row.body)};
      try{
        const result=await reportRequest("report",{method:row.remove?"DELETE":"PUT",headers:{"Content-Type":"application/json","X-Report-Key":row.key},body:JSON.stringify(body)});
        const current=shareState(id);
        if(current?.revision!==row.revision || current.key!==row.key)continue;
        if(row.remove&&!result.shared)localStorage.removeItem(sharePrefix+id);
        else if(result.shared&&!row.remove)shareWrite(id,{...row,pending:false,error:""});
        else throw new Error("Freigabestatus unklar.");
        updateShareUI(id);refreshReports(true);invalidateHereCatches();return;
      }catch(error){
        const current=shareState(id);
        if(current?.revision!==row.revision||current.key!==row.key)continue;
        const permanent=[400,409,422].includes(error.status);
        shareWrite(id,{...row,pending:!permanent,error:permanent?error.message:"Übertragung ausstehend"});
        updateShareUI(id);
        if(!permanent&&navigator.onLine&&!reportTimer)reportTimer=setTimeout(()=>{reportTimer=null;retryShares();},60000);
        return;
      }
    }
  }finally{activeShares.delete(id);}
}
function retryShares() { for(const id of shareIds())if(shareState(id)?.pending)void syncShare(id); }
function resetShareDraft(){
  draftSection=null;$("#shareNew").checked=false;
  $("#shareSectionLabel").textContent="Abschnitt, Art, Länge, Anzahl und Fangdatum";
}
function updateShareContext(){
  const f=formCatch(),key=JSON.stringify([f.canton,f.sec,f.waterName,f.luRev]);
  if(key!==draftWaterKey){draftWaterKey=key;resetShareDraft();}
}
function chooseShareSection(f,done) {
  const dlg=$("#shareDialog"),search=$("#shareSearch"),list=$("#shareResults"),msg=$("#shareMessage"),confirm=$("#shareConfirm");
  const initialKey=draftWaterKey;
  const hint=reportHint(f),code=f.canton||"SO";
  let chosen=null,request=0,timer;
  const seq=++sectionDialogSeq;
  $("#sharePlace").textContent="Gewässerabschnitt · "+cname(code);
  search.value="";confirm.disabled=true;confirm.textContent=f.id?"Fang öffentlich teilen":"Abschnitt übernehmen";
  const initialQuery=String(f.waterName||"").split(" · ")[0];
  async function find(initial=false){
    const n=++request;
    chosen=null;confirm.disabled=true;list.replaceChildren();msg.textContent="Abschnitte werden geladen …";
    try{
      const q=new URLSearchParams({canton:code,q:search.value.trim()});
      if(initial&&hint)q.set("id",hint);
      const data=await reportRequest("sections?"+q);
      if(seq!==sectionDialogSeq||n!==request||!dlg.open)return;
      for(const place of data.sections){const option=new Option(place.name,place.id);list.add(option);}
      if(data.sections.length){
        const exact=initial&&data.sections.find(x=>x.id===hint);
        list.selectedIndex=exact?data.sections.indexOf(exact):-1;
        if(exact){chosen=exact;confirm.disabled=false;}
        msg.textContent=chosen?"Vorgeschlagener Abschnitt.":data.sections.length===30?"Suche mit Name oder Reviernummer eingrenzen.":"Abschnitt in der Liste antippen.";
      }else msg.textContent="Kein passender Abschnitt. Suche anpassen oder das Gewässer auf der Karte wählen.";
    }catch{if(n===request&&seq===sectionDialogSeq)msg.textContent="Abschnitte nicht erreichbar. Verbindung prüfen und erneut suchen.";}
  }
  search.oninput=()=>{++request;chosen=null;confirm.disabled=true;list.replaceChildren();clearTimeout(timer);timer=setTimeout(find,220);};
  list.onchange=()=>{const o=list.selectedOptions[0];chosen=o?{id:o.value,name:o.text}:null;confirm.disabled=!chosen;};
  $("#shareFindAgain").onclick=()=>find(!search.value);
  $("#shareCancel").onclick=()=>dlg.close();
  confirm.onclick=()=>{if(!chosen)return;const place=chosen;dlg.close();if(!f.id&&initialKey!==draftWaterKey)return;done(place);};
  dlg.onclose=()=>{clearTimeout(timer);++sectionDialogSeq;if(!f.id&&!draftSection)resetShareDraft();};
  search.value=hint?"":initialQuery;
  dlg.showModal();void find(true);
}
function bookShare(id) {
  const f=state.log.find(row=>String(row.id)===String(id));if(!f)return;
  const rec=shareState(id);
  if(rec?.remove){void syncShare(id);toast("Rückzug wird bei Verbindung übertragen.");return;}
  if(rec){
    ask('<h2>Öffentliche Fangmeldung</h2><p>'+esc(rec.section.name)+'</p><p>'+esc(shareStatus(id))+'</p><p>Freigabe für diesen Fang zurückziehen?</p>',()=>{if(withdrawShare(id))toast("Rückzug gespeichert.");});
  }else{
    const age=(Date.parse(swissCalendar.format(new Date()))-Date.parse(f.day))/86400000;
    if(!(age>=0&&age<30)){toast("Öffentlich teilbar sind Fänge der letzten 30 Tage.");return;}
    chooseShareSection(f,section=>{if(queueShare(f,section))toast("Freigabe gespeichert.");});
  }
}
$("#shareNew").onchange=e=>{
  if(!e.target.checked){resetShareDraft();return;}
  chooseShareSection(formCatch(),s=>{draftSection=s;$("#shareNew").checked=true;$("#shareSectionLabel").textContent=s.name;});
};
addEventListener("online",()=>{retryShares();refreshReports(true);});
addEventListener("storage",e=>{if(e.key?.startsWith(sharePrefix))updateShareUI(e.key.slice(sharePrefix.length));});
addEventListener("pageshow",retryShares);

async function idForReportHit(z) {
  if(!z)return "";
  if(z.t==="sec")return "SO:"+z.id;
  if(z.t==="w")return /^ch\.swisstopo\.swisstlm3d-gewaessernetz\/(\d{1,12})$/.test(z.zoneId)?"CH:"+z.zoneId.split("/")[1]:"";
  let parts;
  if(z.t==="zone"){
    if(z.code==="LU"&&z.kind==="Fischereirevier"&&z.rev)return "LU:R"+z.rev;
    if(!["AG","ZH","LU","SG","GR"].includes(z.code)||!(z.water||z.region))return "";
    parts=[z.water||z.region,z.rev||"",z.kind];
  }else if(z.t==="x"){
    const [code,layer,id,kind,name,description]=JSON.parse(z.zoneId);
    parts=[layer,id,name,description||""];
  }else return "";
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(parts)));
  return z.code+":"+Array.from(new Uint8Array(hash).slice(0,10),b=>b.toString(16).padStart(2,"0")).join("");
}
let reportSelectionVersion=0;
function clearReportSection(){
  ++reportSelectionVersion;
  store.set("publicWaterRef",null);
}
function rememberReportSection(hit,canton,name) {
  clearReportSection();
  if(!hit)return;
  const version=reportSelectionVersion;
  const current=()=>version===reportSelectionVersion&&state.canton===canton&&selectedWaterName()===name;
  void idForReportHit(hit).then(async id=>{
    if(!current())return;
    const ref={id,canton,name};
    if(hit.t==="w")ref.watercourse={course:hit.water.hydroId,name:hit.water.name,lake:hit.water.lake,lon:hit.lon,lat:hit.lat};
    if(id||ref.watercourse){store.set("publicWaterRef",ref);renderHereWater();}
    if(hit.t==="w"||hit.code==="JU"&&hit.t==="zone"){
      const index=await loadHereStations();
      if(!current())return;
      const names=hit.t==="w"?(hit.water.names||[name]):[hit.water];
      const station=stationOnGeometry(index.byName,names,hit.parts||[]);
      if(station)ref.station=station.id;
      else if(hit.code==="JU"&&hit.t==="zone"){
        const water=await waterAt(hit.lat,hit.lon,100);
        if(!current())return;
        if(water?.hydroId&&!water.ambiguous&&water.names.some(n=>temperatureWaterName(n)===temperatureWaterName(hit.water))){
          ref.watercourse={course:water.hydroId,name:hit.water,lon:hit.lon,lat:hit.lat};
        }
      }
      if(station||(!id&&ref.watercourse)){store.set("publicWaterRef",ref);renderHereWater();}
    }
  }).catch(()=>{});
}

let reportData=FC([]),reportQuery="",reportUpdated=0,reportAbort=null,reportDebounce=null;
let reportMapStatus="Freiwillig geteilte Fänge pro Gewässerabschnitt";
const reportDays=()=>mapFilter.publicDays===7?7:30;
function reportPanel(){
  return '<label class="ml-row"><span><b>Öffentliche Fänge</b><small data-report-status>'+esc(reportMapStatus)+'</small></span><input class="ios-switch" type="checkbox" data-ml="publicReports"'+(mapFilter.publicReports!==false?' checked':'')+'></label>'+
    '<button type="button" data-report-retry'+(mapFilter.publicReports!==false&&reportMapStatus==="Fangmeldungen nicht erreichbar"?'':' hidden')+'>Erneut laden</button>'+
    (mapFilter.publicReports!==false?'<div class="ml-seg report-period" role="group" aria-label="Zeitraum für öffentliche Fänge">'+[7,30].map(days=>'<button type="button" data-report-days="'+days+'" aria-pressed="'+(days===reportDays())+'" class="'+(days===reportDays()?'on':'')+'">'+days+' Tage</button>').join("")+'</div>':"");
}
function setReportStatus(s){
  reportMapStatus=s;
  const el=document.querySelector("[data-report-status]"),retry=document.querySelector("[data-report-retry]");
  if(el)el.textContent=s;if(retry)retry.hidden=s!=="Fangmeldungen nicht erreichbar";
}
function addReportLayers(){
  map.addSource("fb-public",{type:"geojson",data:reportData,cluster:true,clusterMaxZoom:12,clusterRadius:38,
    clusterProperties:{total:["+",["get","count"]]}});
  const number=["coalesce",["get","total"],["get","count"],1];
  map.addLayer({id:"fb-public-dots",source:"fb-public",type:"circle",paint:{"circle-radius":["step",number,12,10,15,100,18],"circle-color":"#077786","circle-stroke-color":"#fff","circle-stroke-width":2}});
  map.addLayer({id:"fb-public-count",source:"fb-public",type:"symbol",layout:{"text-field":["to-string",number],"text-font":labelFont,"text-size":12,"text-allow-overlap":true,"text-ignore-placement":true},paint:{"text-color":"#fff"}});
}
function refreshReports(force=false) {
  if(!mapReady||!map||!$("#v-karte").classList.contains("on"))return;
  if(mapFilter.publicReports===false){
    clearTimeout(reportDebounce);reportAbort?.abort();reportAbort=null;reportQuery="";reportData=FC([]);map.getSource("fb-public")?.setData(reportData);return;
  }
  const b=map.getBounds(),bounds=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].map((v,i)=>(i<2?Math.floor(v*10):Math.ceil(v*10))/10);
  const query=new URLSearchParams({days:reportDays(),bbox:bounds.join(",")}).toString();
  if(!force&&query===reportQuery&&(reportAbort||Date.now()-reportUpdated<45000))return;
  clearTimeout(reportDebounce);reportAbort?.abort();
  const controller=new AbortController();reportAbort=controller;reportQuery=query;
  reportDebounce=setTimeout(async()=>{
    if(controller.signal.aborted)return;
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      setReportStatus("Fangmeldungen werden geladen …");
      const data=await reportRequest("map?"+query,{signal:controller.signal});
      if(reportAbort!==controller)return;
      reportData=FC(data.sections.map(s=>({type:"Feature",geometry:{type:"Point",coordinates:[s.lon,s.lat]},properties:{id:s.id,name:s.name,count:s.count}})));
      map.getSource("fb-public")?.setData(reportData);reportUpdated=Date.now();
      setReportStatus(data.more?"Viele Abschnitte · zum Eingrenzen zoomen":data.sections.length?data.sections.length+" Abschnitte mit Meldungen":"Keine Meldungen im Kartenausschnitt");
    }catch{
      if(reportAbort!==controller)return;
      reportQuery="";reportData=FC([]);map.getSource("fb-public")?.setData(reportData);
      setReportStatus("Fangmeldungen nicht erreichbar");
    }finally{clearTimeout(timeout);if(reportAbort===controller)reportAbort=null;}
  },180);
}
function reportLength(row) {
  if(row.min==null)return "";
  return (row.min===row.max?row.min:row.min+"–"+row.max)+" cm";
}
function publicSpeciesRows(rows) {
  return rows.map(row=>'<div class="report-species"><b>'+esc(row.species)+'</b><span>'+esc(row.count)+' × · '+
    esc(reportLength(row)||"Länge nicht angegeben")+'</span><small>Letzter Fang am '+esc(fmtD(row.last))+'</small></div>').join("");
}
function publicSheet() {
  const z=mapSel;
  let body;
  if(z.error)body='<p class="sh-d">Fangmeldungen nicht erreichbar.</p><button type="button" data-sh="report-retry">Erneut laden</button>';
  else if(!z.rows)body='<p class="sh-d">Meldungen werden geladen …</p>';
  else if(!z.rows.length)body='<p class="sh-d">Für diesen Abschnitt wurden in diesem Zeitraum keine Fänge geteilt.</p>';
  else body=publicSpeciesRows(z.rows);
  return {title:z.name,pills:'<span class="pill p-mut">Öffentliche Fänge · '+z.days+' Tage</span>',body,actions:""};
}
async function openPublicSection(id,name,position) {
  if(!id){toast("Für diesen Abschnitt fehlt eine eindeutige Zuordnung.");return;}
  cancelMapQuery();closePress();
  const z={t:"public",id,name,days:reportDays(),lon:position[0],lat:position[1]};
  mapSel=z;mapHits=[];renderSheet();drawSel();placeSheet("half");
  try{z.rows=(await reportRequest("section?"+new URLSearchParams({id,days:z.days}))).species;}
  catch{z.error=true;}
  if(mapSel===z)renderSheet();
}
function openPublicMapFeature(f) {
  if(f.properties.cluster)map.getSource("fb-public").getClusterExpansionZoom(f.properties.cluster_id).then(zoom=>map.easeTo({center:f.geometry.coordinates,zoom:zoom+.2})).catch(()=>{});
  else void openPublicSection(f.properties.id,f.properties.name,f.geometry.coordinates);
}
addEventListener("focus",()=>refreshReports());
