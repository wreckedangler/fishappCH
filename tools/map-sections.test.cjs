const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root,"map-sections.js"),"utf8");

function mapAt(zoom, unavailable=()=>false) {
  const requests=[];
  const fetch=async url=>{
    requests.push(url);
    if(unavailable(url))throw Error("Offline");
    return {ok:true,json:()=>JSON.parse(fs.readFileSync(path.join(root,url),"utf8"))};
  };
  const api=vm.runInNewContext(code+"\nFishSections",{fetch,AbortSignal,AbortController,setTimeout,clearTimeout});
  const layer=new api.Layer({getZoom:()=>zoom},()=>{});
  return {api,layer,requests};
}

test("AGIS water name and Revier survive the overview and a second tap needs no request",async()=>{
  const {layer,requests}=mapAt(10);
  const point=[47.26539954,8.05135297,20];
  const first=(await layer.hits(...point)).find(f=>f.water==="Suhre");
  assert.equal(first.rev,"120");
  const count=requests.length;
  assert.ok((await layer.hits(...point)).some(f=>f.id===first.id));
  assert.equal(requests.length,count);
});

test("Aargau names also resolve for a protection polygon with only a Bachnummer",async()=>{
  const {layer}=mapAt(16);
  const hits=await layer.hits(47.4671,8.241102,30);
  assert.ok(hits.some(h=>h.kind==="Schongebiet" && h.rev==="23" && /Tiefegrabe/i.test(h.water)));
  assert.ok(hits.some(h=>h.kind==="Fischereirevier"));
});

test("Zürich uses the water name and selects a single branch in a Revier",async()=>{
  const {layer}=mapAt(15);
  const hit=(await layer.hits(47.39039220,8.62641163,20)).find(f=>f.water==="Glatt");
  assert.equal(hit.rev,"203");
  assert.equal(hit.l.length,1);
  assert.ok(hit.d<2);
});

test("Obersee tributaries do not highlight all the lines of Revier 1495",async()=>{
  const {layer}=mapAt(15);
  const hit=(await layer.hits(47.2255225,8.87819524,20)).find(f=>f.rev==="1495");
  assert.equal(hit.code,"SG");
  assert.equal(hit.l.length,1);
  assert.ok(hit.d<2);
});

test("a point in a polygon hole snaps to its edge and a point in the water stays put",()=>{
  const {api}=mapAt(15);
  const outer=[[7,47],[7.1,47],[7.1,47.1],[7,47.1],[7,47]];
  const hole=[[7.02,47.02],[7.08,47.02],[7.08,47.08],[7.02,47.08],[7.02,47.02]];
  const edge=api.nearest(47.05,7.049,[outer,hole],true);
  assert.ok(edge.d>1000);
  assert.equal(edge.lon,7.02);
  assert.equal(api.nearest(47.01,7.01,[outer,hole],true).d,0);
});

test("unavailable geometry raises an incomplete lookup and the same cell can retry",async()=>{
  let offline=true;
  const {layer}=mapAt(15,url=>offline&&!url.endsWith("index.json"));
  const point=[47.371317986,8.076054794,15];
  await assert.rejects(layer.hits(...point),/Offline/);
  offline=false;
  assert.ok((await layer.hits(...point)).some(f=>f.name==="Suhre"&&f.rev==="686"));
});
