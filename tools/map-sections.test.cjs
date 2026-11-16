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

test("Wyna 114 selects one full zone from four survey sections and preserves its culverts",async()=>{
  const {layer,requests}=mapAt(16);
  const points=[[47.261458,8.170796],[47.2825895,8.1509769],[47.2551293,8.1803474],[47.2487277,8.1846094]];
  const taps=await Promise.all(points.map(async([lat,lon])=>(await layer.hits(lat,lon,5)).find(h=>h.water==="Wyna"&&h.rev==="114"&&!h.area)));
  assert.equal(new Set(taps.map(h=>h.id)).size,4);
  assert.equal(new Set(taps.map(h=>h.zoneId)).size,1);
  const full=await layer.wholeZone(taps[0]);
  const [open,culvert]=full;
  assert.equal(open.symbol,"district");assert.equal(culvert.symbol,"culvert");
  const lats=open.lines.flat().map(p=>p[1]);
  assert.ok(Math.min(...lats)<47.25&&Math.max(...lats)>47.28);
  assert.ok(open.polygons.length&&culvert.lines.length);
  for(const hit of taps.slice(1))await layer.wholeZone(hit);
  assert.equal(requests.filter(u=>u.includes("selection-")).length,1);
  const canal=(await layer.hits(47.258968,8.172046,8)).filter(h=>h.water==="Mühlebachkanal");
  assert.ok(canal.some(h=>h.kind==="Schongebiet"));
  assert.ok(canal.some(h=>h.kind==="Fischereirevier"));
  assert.ok(canal.every(h=>h.zoneId!==taps[0].zoneId));
});

test("a missing group catalogue or geometry can be retried without granting rights",async()=>{
  let missing="-groups-";
  const {layer,api}=mapAt(16,url=>!!missing&&url.includes(missing));
  const at=async()=>(await layer.hits(47.261458,8.170796,5)).find(h=>h.water==="Wyna");
  assert.equal((await at()).partial,true);
  missing="-selection-";const hit=await at();assert.equal(hit.partial,false);
  await assert.rejects(layer.wholeZone(hit),/Offline/);
  missing="";assert.ok((await layer.wholeZone(hit)).length);
  assert.equal(api.symbol("Revier unbekannt"),"unknown");
  assert.equal(api.symbol("Gewässer"),"water");
  assert.equal(api.symbol("Schongebiet",true),"protected");
});

test("an unnamed St. Gallen tributary never inherits the entire catchment",async()=>{
  const {layer}=mapAt(15);
  const hit=(await layer.hits(47.2255225,8.87819524,20)).find(f=>f.rev==="1495");
  assert.ok(!hit.group);
  const [part]=await layer.wholeZone(hit);
  assert.equal(part.lines.length,1);
});

test("every selection group resolves to source features in one canton, Revier and legal category",()=>{
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,"data","sections",file),"utf8"));
  for(const [code,index] of Object.entries(read("index.json"))){
    const source=new Map(),used=new Set(),shards=new Map();
    for(const [cell,file] of Object.entries(index).filter(([key])=>/^\d+_\d+$/.test(key))){
      const [metadata,features]=read(file);
      for(const [id,m] of features)source.set(id,metadata[m]);
      assert.ok(features.length,code+cell);
    }
    for(const [members,shard] of read(index.groups)){
      const origin=source.get(members[0]);assert.ok(origin,code);
      for(const id of members){
        assert.ok(!used.has(id)&&source.has(id),code+" "+id);used.add(id);
        assert.deepEqual(source.get(id).slice(1,3),origin.slice(1,3));
      }
      if(!shards.has(shard))shards.set(shard,read(index.selections[shard]));
      const geometry=shards.get(shard)[members[0]];
      assert.ok(geometry?.length&&geometry.every(([,lines,areas])=>lines.length||areas.length));
    }
    assert.ok(read(index.search).every(([name,rev,kind,lat,lon])=>name&&kind&&lat>45&&lat<48&&lon>5&&lon<11));
  }
});

test("Solothurn's two Emme features belong to one patent section and retain both paths",()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,"data","so-sections.json"),"utf8"));
  const emme=data.features.filter(f=>f.id==="E");
  assert.ok(data.official);assert.equal(data.precision,1);
  assert.equal(emme.length,1);assert.equal(emme[0].art,"Patent");assert.equal(emme[0].l.length,2);
});
