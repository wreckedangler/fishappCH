const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname,"../beta/src/map-spots.part.js"),"utf8");
function fixture(globals) {
  const ctx = vm.createContext({store:{get:(_,fallback)=>fallback},...globals});
  vm.runInContext(source,ctx);
  return ctx;
}

test("personal map pins keep their coordinates and label measured and unmeasured catches",()=>{
  const ctx = fixture({map:{},mapReady:false,FC:features=>({features}),state:{log:[]}});
  for (const [len,kept] of [[46.5,true],["32,5",false],[null,true],[0,false]]) {
    ctx.state.log.push({id:ctx.state.log.length+1,len,kept,lat:47.37,lon:7.97});
  }
  ctx.state.log.push({id:5,len:64,lat:null,lon:null});
  ctx.drawCatches();
  const features = JSON.parse(JSON.stringify(ctx.catchData.features));
  assert.deepEqual(features.map(f=>f.properties.badge),[
    "fb-catch-pin/kept/46.5 cm","fb-catch-pin/released/32.5 cm","fb-catch-pin/kept/","fb-catch-pin/released/"
  ]);
  for (const f of features) assert.deepEqual(f.geometry.coordinates,[7.97,47.37]);
});

test("direct badge taps win over nearby markers and empty water passes through",()=>{
  const point={x:50,y:40},box=[[38,28],[62,52]];
  const fish={layer:{id:"fb-catches"},properties:{id:"one"}};
  const community={layer:{id:"fb-public-dots"},properties:{id:"SO:A4"}};
  const selections=[];
  let direct=[fish],near=[community];
  const ctx=fixture({map:{queryRenderedFeatures:geometry=>geometry===point?direct:near}});
  ctx.openCatch=id=>selections.push(id);
  ctx.openPublicMapFeature=f=>selections.push(f.properties.id);
  assert.equal(ctx.catchMapClick(point,box),true);
  direct=[community];near=[fish];
  assert.equal(ctx.catchMapClick(point,box),true);
  direct=[];
  assert.equal(ctx.catchMapClick(point,box),true);
  near=[];
  assert.equal(ctx.catchMapClick(point,box),false);
  assert.deepEqual(selections,["one","SO:A4","one"]);
});
