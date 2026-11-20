const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const mapCode=read("beta/src/map-gl.part.js");
const locationCode=read("beta/src/location-water.part.js");
const rules=JSON.parse(read("data/updates.json")).rules;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function app(stubs={}){
  const ctx=vm.createContext({addEventListener(){},setTimeout,clearTimeout,AbortController,AbortSignal,
    state:{canton:"SO",pos:{lat:47,lon:8}},isAuto:()=>true,renderAll(){},renderTop(){},renderHier(){},
    clearReportSection(){},...stubs});
  vm.runInContext(read("beta/map-sections-gl.js")+"\n"+read("beta/src/here-hydro.part.js")+"\n"+locationCode,ctx);
  ctx.unclearHit=h=>h.kind==="Gewässer";
  ctx.auto=vm.runInContext("autoWater",ctx);
  ctx.api=vm.runInContext("FishSections",ctx);
  return ctx;
}
function localApp(){
  const ctx=app({fetch:async file=>({ok:true,json:()=>JSON.parse(read(file))})});
  const layer=new ctx.api.Layer({getZoom:()=>0},()=>{});
  return {ctx,layer};
}

test("location hits include the detailed water geometry while the map is zoomed out",async()=>{
  const {ctx,layer}=localApp();
  const hits=await layer.hits(47.08008085,8.11664650,300,Infinity);
  const result=ctx.rankNearbyWaters(hits,null);
  assert.equal(result.hit.rev,"6");assert.equal(result.hit.name,"Bihlbach, I. TS");
  assert.ok(result.hit.d>50&&result.hit.d<60);
});

test("Aargau footprints do not replace a river or borrow a nearby tributary's name",async()=>{
  const {ctx,layer}=localApp();
  const hits=await layer.hits(47.26539954,8.05135297,300,Infinity);
  const result=ctx.rankNearbyWaters(hits,null);
  assert.equal(result.hit.water,"Suhre");assert.equal(result.hit.area,false);
  assert.ok(result.hits.some(h=>h.kind==="Schongebiet"));
  assert.equal(ctx.rankNearbyWaters(hits.reverse(),null).hit.id,result.hit.id);
});

test("a genuinely closer federal water is selected even when its access is unknown",()=>{
  const ctx=app();
  const mapped={t:"zone",code:"ZH",id:"one",zoneId:"one",name:"Fluss",kind:"Fischereirevier",lat:47.002,lon:8,d:220};
  const water={name:"Bach",names:["Bach"],lat:47.0002,lon:8,d:22,zoneId:"federal"};
  const result=ctx.rankNearbyWaters([mapped],water);
  assert.equal(result.hit.t,"w");assert.equal(result.hit.name,"Bach");
  assert.equal(result.hit.code,undefined);
});

test("federal naming differences keep the precise local fishing section",()=>{
  const ctx=app();
  const local={t:"zone",code:"LU",id:"six",zoneId:"six",name:"Bihlbach, I. TS",kind:"Fischereirevier",lat:47,lon:8,d:56};
  const federal={name:"Bielbach",names:["Bielbach"],lat:47.00001,lon:8,d:58};
  assert.equal(ctx.rankNearbyWaters([local],federal).hit,local);
});

test("buried sections are excluded and closed sections remain selectable by location",()=>{
  const ctx=app();
  const closed={t:"sec",id:"D",zoneId:"SO/D",kind:"Patent",name:"Dünnern",lat:47,lon:8,d:180};
  const buried={...closed,id:"buried",zoneId:"buried",buried:true,d:0};
  assert.equal(ctx.rankNearbyWaters([buried,closed],null).hit,closed);
  assert.equal(ctx.rankNearbyWaters([buried],null),null);
});

test("stationary GPS updates reuse the active selection without another query",async()=>{
  const ctx=app();let calls=0;
  ctx.findNearestWater=async()=>{calls++;return {hit:{name:"Aare"}};};
  ctx.activateLocatedWater=(result,position)=>Object.assign(ctx.auto,result,{position,due:Date.now()+60000});
  ctx.locateNearestWater();ctx.locateNearestWater();await ctx.auto.pending;
  ctx.state.pos={lat:47.00002,lon:8};ctx.locateNearestWater();
  assert.equal(calls,1);assert.equal(ctx.auto.hit.name,"Aare");
});

test("late results cannot override a manual choice or a newly started lookup",async()=>{
  const ctx=app();let resolveOld,activated=[];
  ctx.findNearestWater=()=>new Promise(resolve=>{resolveOld=resolve;});
  ctx.activateLocatedWater=result=>activated.push(result.hit.name);
  ctx.locateNearestWater();const old=ctx.auto.pending;
  ctx.isAuto=()=>false;resolveOld({hit:{name:"old"}});await old;
  assert.deepEqual(activated,[]);
  ctx.isAuto=()=>true;ctx.locateNearestWater();const abandoned=ctx.auto.pending;
  ctx.resetAutoWater();
  ctx.findNearestWater=async()=>({hit:{name:"new"}});ctx.locateNearestWater();await ctx.auto.pending;
  resolveOld({hit:{name:"stale"}});await abandoned;
  assert.deepEqual(activated,["new"]);
});

test("movement during a lookup discards the old position and starts at the current one",async()=>{
  const ctx=app();let done,positions=[];
  ctx.findNearestWater=p=>{positions.push(p.lat);return positions.length===1?new Promise(resolve=>{done=resolve;}):Promise.resolve({hit:{name:"new"}});};
  const accepted=[];ctx.activateLocatedWater=r=>accepted.push(r.hit.name);
  ctx.locateNearestWater();const pending=ctx.auto.pending;ctx.state.pos={lat:47.01,lon:8};
  done({hit:{name:"old"}});await pending;await tick();
  assert.deepEqual(positions,[47,47.01]);assert.deepEqual(accepted,["new"]);
});

test("failed lookups clear the previous water and permit a retry",async()=>{
  const ctx=app();ctx.auto.hit={name:"old"};
  ctx.findNearestWater=async()=>{throw Error("offline");};
  ctx.locateNearestWater();await ctx.auto.pending;
  assert.equal(ctx.auto.hit,null);assert.equal(ctx.auto.error,"offline");assert.equal(ctx.auto.pending,null);
  ctx.findNearestWater=async()=>({hit:{name:"retry"}});
  ctx.activateLocatedWater=r=>{ctx.auto.hit=r.hit;};ctx.locateNearestWater(true);await ctx.auto.pending;
  assert.equal(ctx.auto.hit.name,"retry");
});

function statusApp(){
  const ctx=app({RULES:rules,mapTime:{ordinal:1119},GEO:{official:true},mapRuleDate:()=>new Date(2026,10,19),
    withCanton:(_c,fn)=>fn(),secStatus:()=>[],fisheryPeriod:()=>null,xg:()=>({feats:{}}),
    cwLabel:(c,id)=>rules[c]?.w?.find(r=>r[0]===id)?.[1]||"",pickCW:()=>""});
  vm.runInContext(mapCode.slice(mapCode.indexOf("function knownOpenSeason("),mapCode.indexOf("function groupClosure("))+
    mapCode.slice(mapCode.indexOf("function westRuleGroup("),mapCode.indexOf("function hitRules(")),ctx);
  ctx.hitRuleContext=()=>({c:"SO",sec:{id:"A4",kind:"patent"}});
  ctx.mapRight=()=>({level:"section",title:"Patent erforderlich"});
  return ctx;
}

test("map status is available without activating a water and keeps unknown rights amber",()=>{
  const ctx=statusApp(),hit={t:"sec",code:"SO",id:"A4",kind:"Patent",name:"Aare A4"};
  const state=JSON.stringify(ctx.state);
  assert.equal(ctx.waterStatus(hit).cls,"ok");
  assert.match(ctx.waterStatus(hit).label,/Fangsaison offen/);
  ctx.mapRight=()=>({level:"unknown",title:"Zuordnung ungeklärt"});
  assert.equal(ctx.waterStatus(hit).cls,"warn");
  ctx.mapRight=()=>({level:"guide",title:"Kantonale Auskunft"});
  assert.equal(ctx.waterStatus(hit).cls,"warn");
  ctx.mapRight=()=>({level:"section",title:"Patent erforderlich"});
  assert.equal(ctx.waterStatus({...hit,kind:"Privat"}).cls,"warn");
  assert.equal(ctx.waterStatus(hit,[hit],true).cls,"warn");
  assert.equal(ctx.waterStatus({...hit,partial:true}).cls,"warn");
  assert.equal(JSON.stringify(ctx.state),state);
});

test("closures, reserves, night breaks and local conditions have distinct visible status",()=>{
  const ctx=statusApp(),hit={t:"sec",kind:"Patent"};
  ctx.secStatus=()=>[{lvl:"bad",txt:"Wintersperre"}];
  assert.equal(ctx.waterStatus(hit).cls,"bad");assert.equal(ctx.waterStatus(hit).note,"Wintersperre");
  ctx.secStatus=()=>[];
  assert.equal(ctx.waterStatus({...hit,kind:"Schon"}).label,"Fischen verboten");
  ctx.mapRight=()=>({level:"restriction",title:"Naturköder verboten"});
  assert.equal(ctx.waterStatus({...hit,kind:"Naturköderverbot"}).cls,"warn");
  ctx.xg=()=>({feats:{night:{}}});ctx.fisheryPeriod=()=>"night";
  assert.equal(ctx.waterStatus({t:"x",id:"night"}).label,"Nächtliche Fangpause");
});

test("Bern Aare reaches activate the matching existing rule group",()=>{
  const ctx=statusApp(),rows=JSON.parse(read("data/fisheries/BE.json")).layers.flat().map(r=>r[1]);
  for(const [id,expected] of [["P201","aare_ob"],["P202","interlaken"],["P205","aare_thun"],["P208","aare_bern"],["P211","aare_wohlen"],["P218","altaare"],["P228","aare_biel"]]){
    const f=rows.find(r=>r.id===id);assert.ok(f,id);
    assert.equal(ctx.westRuleGroup("BE",{...f,zoneId:JSON.stringify(["BE",0,id])}),expected);
  }
});

test("the Kander's official reaches are green before selection, while the protected reach stays red",()=>{
  const ctx=statusApp();
  const {fisheryPeriod,swissFishingTime}=require("../map-sources.js");
  Object.assign(ctx,{FishRights:require("../map-rights.js"),DATA_META:{version:7},mapDate:"2026-11-20",
    mapTime:swissFishingTime(new Date("2026-11-20T12:00:00Z")),fisheryPeriod,
    temperatureWaterName:name=>name.toLowerCase(),pickCW:(c,[name])=>rules[c].w.find(([,label])=>label.includes(name))?.[0]||""});
  vm.runInContext(mapCode.slice(mapCode.indexOf("function mappedWaterRight("),mapCode.indexOf("function soSymbol(")),ctx);
  const rows=JSON.parse(read("data/fisheries/BE.json")).layers.flat().map(r=>r[1]);
  for(const id of ["P130","P131","S9a"]){
    const reach=rows.find(r=>r.id===id);
    ctx.xg=()=>({feats:{[id]:reach}});
    vm.runInContext(mapCode.slice(mapCode.indexOf("function hitRuleContext("),mapCode.indexOf("function hitRules(")),ctx);
    const hit={t:"x",id,code:"BE",kind:reach.art};
    ctx.mapRight=()=>ctx.mappedWaterRight(hit,reach,reach.art);
    assert.equal(ctx.westMark("BE",reach),id==="S9a"?"protected":"open",id);
    assert.equal(ctx.waterStatus(hit).cls,id==="S9a"?"bad":"ok",id);
  }
  const unknown={name:"Kander",art:"Gewässer"};
  assert.equal(ctx.westMark("BE",unknown),"water");
  const closed={name:"Kander",art:"Patent",closedPeriod:[1101,1130]};
  assert.equal(ctx.westMark("BE",closed),"closed");
});

test("a different section with the same river name can always be activated",()=>{
  const selected={t:"x",code:"BE",zoneId:"BE/205",name:"Aare"};
  const ctx=app({currentConfirmed:()=>selected,unknownWater:()=>false});
  vm.runInContext(mapCode.slice(mapCode.indexOf("function isActiveWaterHit("),mapCode.indexOf("function drawSel(")),ctx);
  assert.equal(ctx.isActiveWaterHit(selected),true);
  assert.equal(ctx.isActiveWaterHit({...selected,zoneId:"BE/208"}),false);
  assert.equal(ctx.isActiveWaterHit({...selected,code:"AG"}),false);
  ctx.unknownWater=()=>true;assert.equal(ctx.isActiveWaterHit(selected),false);
});
