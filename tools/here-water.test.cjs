const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const source=read("beta/map-sections-gl.js")+read("beta/src/here-hydro.part.js")+read("beta/src/here-water.part.js");
function app(stubs={}){
  const ctx=vm.createContext({addEventListener(){},document:{addEventListener(){}},setInterval(){},...stubs});
  vm.runInContext(source,ctx);
  return ctx;
}
const now=Date.parse("2026-11-17T15:00:00Z");
const row=(parameterName,value,minutes,stationNo="2063")=>({stationNo,parameterName,value,timestamp:new Date(now-minutes*60000).toISOString()});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("discharge and trend use two real measurements at the same station, regardless of feed order",()=>{
  const {hydroReading}=app();
  const rows=[row("Q",5,4,"2434"),row("Q",50,190),row("WT",12.3,12),row("Q",65,10),row("Q",900,1,"2000")];
  const m=hydroReading("2063",false,rows,"m3/s",now);
  assert.equal(m.value,65);assert.equal(m.trend,"steigend");assert.equal(m.temperature,12.3);
  assert.equal(hydroReading("2063",false,[row("Q",70,187),row("Q",60,8)],"m³/s",now).trend,"fallend");
  assert.equal(hydroReading("2063",false,[row("Q",70,187),row("Q",71,8)],"m³/s",now).trend,"stabil");
  assert.equal(hydroReading("2063",false,[row("Q",250,1)],"l/s",now).value,.25);
});
test("no invented trends, no stale or future readings, no substituted river level or temperature",()=>{
  const {hydroReading}=app();
  const m=hydroReading("2063",false,[row("Q",0,9),row("Q",20,110),row("WT",12,44),row("Q",6,-5)],"m3/s",now);
  assert.equal(m.value,0);assert.equal(m.trend,"");assert.equal(m.temperature,null);
  for(const rows of [[row("Q",5,91)],[row("Q",1,-3)],[row("Q",null,1)],[row("Q",-1,2)],[row("W",400,4)]]){
    assert.equal(hydroReading("2063",false,rows,"m3/s",now),null);
  }
  assert.equal(hydroReading("2063",false,[row("Q",42,5)],"unknown",now),null);
  const lake=hydroReading("2063",true,[row("Q",250,3),row("W",412.25,8)],"m ü.M.",now);
  assert.equal(lake.value,412.25);assert.equal(lake.temperature,null);assert.equal(lake.trend,"");
});
test("the name and the geometry must agree, including polygon holes",()=>{
  const {stationOnGeometry,hydroNameIndex}=app();
  const stations={1:{water:"Aare",lat:47,lon:8,lake:false},2:{water:"See",lat:46,lon:8,lake:true}};
  const names=hydroNameIndex(stations),main=[[[7.99,47],[8.01,47]]];
  assert.equal(stationOnGeometry(names,["Aare"],[{lines:main}]).id,"1");
  assert.equal(stationOnGeometry(names,["Werkkanal"],[{lines:main}]),null);
  assert.equal(stationOnGeometry(names,["Aare"],[{lines:[[[7.99,47.1],[8.01,47.1]]]}]),null);
  const ring=d=>[[8-d,46-d],[8+d,46-d],[8+d,46+d],[8-d,46+d],[8-d,46-d]];
  assert.equal(stationOnGeometry(names,["See"],[{polygons:[[ring(.1),ring(.03)]]}]),null);
  assert.equal(stationOnGeometry(names,["See"],[{polygons:[[ring(.1)]]}]).id,"2");
});
test("index uses public section identities, withholds unverified branches and composite rule groups",()=>{
  const h=JSON.parse(read("data/here-stations.json")), sections=new Set(JSON.parse(read("server/catalogue.json")).sections.map(r=>r[0]));
  for(const [k,id] of Object.entries(h.sections)){assert.ok(sections.has(k),k);assert.ok(h.stations[id],id);}
  for(const [k,section] of Object.entries(h.pickerSections)){assert.ok(sections.has(section));assert.equal(h.rules[k],h.sections[section]);}
  assert.equal(h.sections["SO:A2"],"2063");
  assert.equal(h.stations[h.sections["LU:R42"]].place,"Werthenstein, Chappelboden");
  for(const k of ["SO:A3","SO:A4","SO:A5","SO:A6","SO:EK"])assert.equal(h.sections[k],undefined);
  for(const k of ["ZH:greifen","AG:fluss","LU:fluss","LU:see","BE:interlaken"])assert.equal(h.rules[k],undefined);
  assert.equal(h.rules["LU:sempach"],"2168");
});
test("section-wide queries require a precise selection, even after manual and GPS changes",()=>{
  const state={canton:"LU",cantonAuto:false,luRev:"6"},stubs={state,unknownWater:()=>false,isSO:()=>false,
    cwOf:()=> "fluss",store:{get:()=>null},selectedWaterName:()=> "Bihlbach, I. TS · Revier 6"};
  const ctx=app(stubs);
  assert.equal(ctx.hereSelection().section,"LU:R6");
  ctx.selectedWaterName=()=>"";assert.equal(ctx.hereSelection().picker,"LU:fluss");
  state.cantonAuto=true;assert.equal(ctx.hereSelection(),null);
  state.cantonAuto=false;ctx.isSO=()=>true;ctx.currentSec=()=>({id:"A2"});
  state.secAuto=true;state.here={alts:[{}],pinned:false};assert.equal(ctx.hereSelection(),null);
  state.here.pinned=true;assert.equal(ctx.hereSelection().section,"SO:A2");
  ctx.unknownWater=()=>true;assert.equal(ctx.hereSelection(),null);
});
test("GPS redraws share a pending request, while a response for a previous section is discarded",async()=>{
  const ctx=app(),painted=[];
  ctx.paintHereRow=(r,c)=>{r.hidden=!c;painted.push(c?.text??null);};
  const el={};let resolveOld,called=0;
  const old=()=>{called++;return new Promise(done=>{resolveOld=done;});};
  ctx.updateHereRow(el,"SO:A2",60000,old);ctx.updateHereRow(el,"SO:A2",60000,old);await tick();
  assert.equal(called,1);
  ctx.updateHereRow(el,"LU:R6",60000,async()=>({text:"Bihlbach"}));await tick();
  resolveOld({text:"Aare"});await tick();
  ctx.updateHereRow(el,"LU:R6",60000,()=>assert.fail("fresh data refetched"));await tick();
  assert.deepEqual(painted,[null,null,"Bihlbach"]);
  ctx.updateHereRow(el,"",60000,()=>assert.fail("empty lookup"));assert.equal(el.hidden,true);
});
