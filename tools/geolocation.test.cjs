const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const code=html.slice(html.indexOf("/* ================= STANDORT ================= */"),html.indexOf("/* ================= RENDER: TOPBAR & HIER ================= */"));

function app({auto=false,onMap=false,hidden=false,supported=true}={}){
  const watches=[],cleared=[],active=new Set(),mode={auto,onMap};
  const document={hidden};
  const state={pos:null,geoErr:null};
  const geo={watchPosition(ok,error,options){const id=watches.length;watches.push({ok,error,options});active.add(id);return id;},clearWatch(id){cleared.push(id);active.delete(id);}};
  let lookups=0,resets=0;
  const ctx=vm.createContext({document,state,navigator:supported?{geolocation:geo}:{},map:null,
    $:()=>({classList:{contains:()=>mode.onMap}}),isAuto:()=>mode.auto,
    locateNearestWater(){lookups++;},resetAutoWater(){resets++;},renderTop(){},renderHier(){},
    renderAll(){ctx.syncGeo();}});
  vm.runInContext(code,ctx);
  const fix=(id,lat=47)=>watches[id].ok({coords:{latitude:lat,longitude:8,accuracy:5},timestamp:Date.now()});
  return {ctx,state,mode,document,watches,cleared,active,fix,get lookups(){return lookups;},get resets(){return resets;}};
}

test("manual mode outside the map never starts location tracking, including with a cached position",()=>{
  const a=app();a.state.pos={lat:47,lon:8,ts:Date.now()};
  a.ctx.startGeo();a.ctx.syncGeo();a.document.hidden=true;a.ctx.syncGeo();a.document.hidden=false;a.ctx.syncGeo();
  assert.equal(a.watches.length,0);
});

test("automatic selection uses one fresh fix and immediately releases the location watch",()=>{
  const a=app({auto:true});a.ctx.startGeo();a.ctx.syncGeo();
  assert.equal(a.watches.length,1);assert.equal(a.watches[0].options.maximumAge,0);
  a.fix(0);
  assert.equal(a.lookups,1);assert.equal(a.state.pos.lat,47);assert.equal(a.active.size,0);
  assert.deepEqual(a.cleared,[0]);
  a.fix(0,48);a.ctx.syncGeo();
  assert.equal(a.state.pos.lat,47);assert.equal(a.lookups,1);assert.equal(a.watches.length,1);
});

test("the map follows successive fixes without duplicate watches and stops on leaving",()=>{
  const a=app({onMap:true});a.ctx.syncGeo();a.ctx.syncGeo();a.fix(0);a.fix(0,48);
  assert.equal(a.state.pos.lat,48);assert.equal(a.active.size,1);assert.equal(a.lookups,0);
  a.mode.onMap=false;a.ctx.syncGeo();a.fix(0,49);
  assert.equal(a.active.size,0);assert.equal(a.state.pos.lat,48);
  a.mode.onMap=true;a.ctx.syncGeo();assert.equal(a.watches.length,2);
});

test("automatic mode also stops tracking when leaving the map after the fix",()=>{
  const a=app({auto:true,onMap:true});a.ctx.startGeo();a.fix(0);a.fix(0,48);
  assert.equal(a.lookups,2);a.mode.onMap=false;a.ctx.syncGeo();
  assert.equal(a.active.size,0);a.ctx.syncGeo();assert.equal(a.watches.length,1);
});

test("backgrounding stops the map; resuming the map starts exactly one new watch",()=>{
  const a=app({onMap:true});a.ctx.syncGeo();a.document.hidden=true;a.ctx.syncGeo();
  a.fix(0);assert.equal(a.state.pos,null);assert.equal(a.active.size,0);
  a.document.hidden=false;a.ctx.syncGeo();a.ctx.syncGeo();
  assert.equal(a.watches.length,2);assert.equal(a.active.size,1);
});

test("returning to another view does not remeasure an already located automatic water",()=>{
  const a=app({auto:true});a.ctx.startGeo();a.fix(0);
  a.document.hidden=true;a.ctx.syncGeo();a.document.hidden=false;a.ctx.syncGeo();
  assert.equal(a.watches.length,1);assert.equal(a.active.size,0);
  a.ctx.startGeo();assert.equal(a.watches.length,2);
});

test("an unfinished automatic lookup pauses while hidden and resumes until its first fix",()=>{
  const a=app({auto:true,hidden:true});a.ctx.startGeo();assert.equal(a.watches.length,0);
  a.document.hidden=false;a.ctx.syncGeo();a.document.hidden=true;a.ctx.syncGeo();
  a.document.hidden=false;a.ctx.syncGeo();a.fix(0,48);assert.equal(a.state.pos,null);
  a.fix(1);assert.equal(a.state.pos.lat,47);assert.equal(a.active.size,0);
});

test("manual selection cancels a pending automatic fix and rejects its late callback",()=>{
  const a=app({auto:true});a.ctx.startGeo();a.mode.auto=false;a.ctx.syncGeo();a.fix(0);
  assert.equal(a.active.size,0);assert.equal(a.state.pos,null);assert.equal(a.lookups,0);
});

test("permission denial does not loop requests; the location button permits a deliberate retry",()=>{
  const a=app({auto:true,onMap:true});a.ctx.startGeo();a.watches[0].error({code:1});
  assert.equal(a.active.size,0);assert.equal(a.resets,1);assert.match(a.state.geoErr,/verweigert/);
  a.ctx.syncGeo();a.ctx.syncGeo();assert.equal(a.watches.length,1);
  a.ctx.startGeo();assert.equal(a.watches.length,2);assert.equal(a.state.geoErr,null);
  a.fix(1);assert.equal(a.active.size,1);
});

test("failed single fixes stop the watch and allow an explicit retry",()=>{
  for(const code of [2,3]){
    const a=app({auto:true});a.ctx.startGeo();a.watches[0].error({code});
    a.ctx.syncGeo();assert.equal(a.active.size,0);assert.equal(a.watches.length,1);
    a.ctx.startGeo();a.fix(1);assert.equal(a.lookups,1);assert.equal(a.active.size,0);
  }
});

test("page suspension invalidates queued results even if visibility has not updated yet",()=>{
  const a=app({onMap:true});a.ctx.syncGeo();a.ctx.stopGeo();a.fix(0);
  assert.equal(a.state.pos,null);assert.equal(a.active.size,0);
  a.ctx.syncGeo();a.fix(0,48);assert.equal(a.state.pos,null);
  a.fix(1);assert.equal(a.state.pos.lat,47);
});

test("devices without geolocation remain usable without creating watches",()=>{
  const a=app({auto:true,supported:false});a.ctx.startGeo();a.ctx.syncGeo();
  assert.equal(a.watches.length,0);assert.match(a.state.geoErr,/unterstützt keine/);
});

test("old fixes are not reused as current catch coordinates",()=>{
  const a=app({auto:true});a.ctx.startGeo();a.fix(0);
  assert.equal(a.ctx.recentPosition(),a.state.pos);
  a.state.pos.ts=Date.now()-61000;assert.equal(a.ctx.recentPosition(),null);
  a.state.pos=null;assert.equal(a.ctx.recentPosition(),null);
});
