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
  assert.equal(m.value,65);assert.equal(m.trend,"steigend");
  assert.deepEqual(JSON.parse(JSON.stringify(m.history)),[[now-190*60000,50],[now-10*60000,65]]);
  assert.equal(hydroReading("2063",false,[row("Q",70,187),row("Q",60,8)],"m³/s",now).trend,"fallend");
  assert.equal(hydroReading("2063",false,[row("Q",70,187),row("Q",71,8)],"m³/s",now).trend,"stabil");
  const small=hydroReading("2063",false,[row("Q",250,1),row("Q",200,11)],"l/s",now);
  assert.equal(small.value,.25);assert.equal(small.history[0][1],.2);
});
test("no invented trends, no stale or future readings, no substituted river level or temperature",()=>{
  const {hydroReading}=app();
  const m=hydroReading("2063",false,[row("Q",0,9),row("Q",20,110),row("WT",12,44),row("Q",6,-5)],"m3/s",now);
  assert.equal(m.value,0);assert.equal(m.trend,"");
  for(const rows of [[row("Q",5,91)],[row("Q",1,-3)],[row("Q",null,1)],[row("Q",-1,2)],[row("W",400,4)]]){
    assert.equal(hydroReading("2063",false,rows,"m3/s",now),null);
  }
  assert.equal(hydroReading("2063",false,[row("Q",42,5)],"unknown",now),null);
  const lake=hydroReading("2063",true,[row("Q",250,3),row("W",412.25,8)],"m ü.M.",now);
  assert.equal(lake.value,412.25);assert.equal(lake.trend,"");
});
test("rolling discharge covers 24 hours using archive before live, omitting earlier or incompatible values",()=>{
  const {hydroReading}=app();
  const archived=(value,minutes,unitSymbol="m3/s")=>({...row("Q",value,minutes),unitSymbol});
  const m=hydroReading("2063",false,[row("Q",60,5),row("Q",50,700)],"m³/s",now,
    [archived(10,1441),archived(20,1440),archived(30,800,"l/s"),archived(999,700),archived(998,400)]);
  assert.equal(m.chartEnd,now);assert.equal(m.chartWindow,1440*60000);
  assert.deepEqual(JSON.parse(JSON.stringify(m.history)),[[now-1440*60000,20],[now-700*60000,50],[now-5*60000,60]]);
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

function temperatureData(){
  const index=JSON.parse(read("data/here-stations.json")),network=JSON.parse(read("data/temperature-waters.json"));
  network.byStation=new Map(Object.entries(network.courses).flatMap(([course,ids])=>ids.map(id=>[id,course])));
  return {index,network};
}
test("every named Aare fishing reach shares the river's stations, including side channels and protected reaches",()=>{
  const {index,network}=temperatureData(),{temperatureTarget}=app();
  const catalogue=JSON.parse(read("server/catalogue.json")).sections;
  const named=catalogue.filter(([,name])=>/^(?:Aare\b|Alte Aare\b|neuer Seitenarm Aare\b)/.test(name)).map(([id])=>id);
  assert.ok(["AG","SO","BE"].every(c=>named.some(id=>id.startsWith(c+":"))));
  for(const id of [...named,"SO:S4","SO:S5"]){
    const target=temperatureTarget({temperatureSection:id},index,network);
    assert.deepEqual(target.ids,network.courses.CH0000370000,id);
  }
  assert.deepEqual(temperatureTarget({picker:"BE:aare_bern"},index,network).ids,network.courses.CH0000370000);
  const tributary=catalogue.find(([,n])=>n.startsWith("Moosbach Büren an der Aare"));
  assert.equal(temperatureTarget({section:tributary[0]},index,network),null);
  assert.equal(temperatureTarget({picker:"AG:fluss"},index,network),null);
  assert.equal(temperatureTarget({picker:"BE:aare_ob"},index,network),null);
  assert.ok(!index.sections["SO:A4"]);
});
test("station preference, distance and freshness apply only within one watercourse",()=>{
  const {index,network}=temperatureData(),{temperatureTarget,nearestWaterTemperature}=app();
  const latest=new Map(["2016","2029","2063","2018"].map(id=>[id,{id,value:11,time:now-600000}]));
  const at=id=>temperatureTarget({section:id},index,network);
  assert.equal(nearestWaterTemperature(at("SO:A2"),index.stations,latest,now).id,"2063");
  latest.delete("2063");
  assert.equal(nearestWaterTemperature(at("SO:A1"),index.stations,latest,now).id,"2029");
  assert.equal(nearestWaterTemperature(at("SO:A6"),index.stations,latest,now).id,"2016");
  latest.get("2016").time=now-91*60000;
  assert.equal(nearestWaterTemperature(at("SO:A6"),index.stations,latest,now).id,"2029");
  latest.get("2029").time=now+1000;
  assert.equal(nearestWaterTemperature(at("SO:A6"),index.stations,latest,now),null);
  const glau=temperatureTarget({watercourse:{course:"CH0003860000",name:"Glatt",lon:9.25,lat:47.4}},index,network);
  assert.ok(glau.ids.includes("2305"));assert.ok(!glau.ids.includes("2415")); // Another Glatt in Zürich
  assert.deepEqual(temperatureTarget({temperatureSection:"SO:A4",nearbySections:["SO:S5"]},index,network).ids,network.courses.CH0000370000);
  assert.equal(temperatureTarget({temperatureSection:"SO:A4",nearbySections:["SO:D"]},index,network),null);
  assert.deepEqual(temperatureTarget({name:"Aare",canton:"BE"},index,network).ids,network.courses.CH0000370000);
});
test("one temperature-only query serves multiple sections, handles zero, and expires independently of discharge",async()=>{
  let clock=now,calls=0;
  const ctx=app({Date:class extends Date{static now(){return clock;}}});
  const ids=["2016","2029"];
  ctx.hydroObservations=async(query,variables)=>{
    calls++;
    assert.match(query,/parameterName:\{_eq:"WT"\}/);assert.deepEqual(variables.stations,ids);
    return {data_live:[row("WT",0,2,"2016"),row("WT",9,15,"2016"),row("WT",9,-2,"2029"),
      row("WT",null,10,"2029"),row("WT",8,95,"2029"),row("WT",4,1,"2018")],history:[
      {...row("WT",10,1430),station:{no:"2016"}}, {...row("WT",33,1430),station:{no:"2029"}},
      {...row("WT",99,1441),station:{no:"2016"}}, {...row("WT",99,15),station:{no:"2016"}}]};
  };
  const [first,second]=await Promise.all([ctx.waterTemperatures(ids),ctx.waterTemperatures(ids)]);
  assert.equal(first,second);assert.equal(calls,1);assert.equal(first.size,1);assert.equal(first.get("2016").value,0);
  assert.deepEqual(JSON.parse(JSON.stringify(first.get("2016").history)),[[now-1430*60000,10],[now-15*60000,9],[now-2*60000,0]]);
  await ctx.waterTemperatures(ids);assert.equal(calls,1);
  clock+=100*60000;
  assert.equal((await ctx.waterTemperatures(ids)).size,0);assert.equal(calls,2);
});
test("a water change or failed request clears the hero value and link, and late results cannot repaint it",async()=>{
  const ctx=app(),value={},source={};
  const link={querySelector:tag=>tag==="strong"?value:source,removeAttribute(){delete this.href;}};
  let finish;
  const apply=(key,fetch)=>ctx.updateHereRow(link,key,60000,fetch,ctx.paintHereTemperature);
  apply("SO:A4",async()=>({id:"2016",value:"11 °C",source:"Aare – Brugg"}));await tick();
  assert.equal(value.textContent,"11 °C");assert.match(link.href,/2016$/);
  apply("SO:A6",()=>new Promise(done=>{finish=done;}));await tick();
  assert.equal(link.hidden,true);assert.equal(value.textContent,"");assert.equal(link.href,undefined);
  apply("LU:R6",async()=>null);await tick();
  finish({id:"2016",value:"11 °C",source:"Aare – Brugg"});await tick();
  assert.equal(source.textContent,"");assert.equal(link.hidden,true);
  apply("SO:A1",async()=>{throw Error("offline");});await tick();
  assert.equal(link.hidden,true);
});
