const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root,"map-sections.js"),"utf8");

function mapAt(zoom, unavailable=()=>false,engine=code) {
  const requests=[];
  const fetch=async url=>{
    requests.push(url);
    if(unavailable(url))throw Error("Offline");
    return {ok:true,json:()=>JSON.parse(fs.readFileSync(path.join(root,url),"utf8"))};
  };
  const api=vm.runInNewContext(engine+"\nFishSections",{fetch,AbortSignal,AbortController,setTimeout,clearTimeout});
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

test("the explicit SG district overview contains all and only its official source paths",async()=>{
  const {layer}=mapAt(16);
  const data=JSON.parse(fs.readFileSync(path.join(root,"data","zones-SG.json"),"utf8"));
  const districts=new Map();
  for(const row of data.features){
    const rev=row.kind.replace(/^Revier /,"");
    if(!/^\d+$/.test(rev))continue;
    if(!districts.has(rev))districts.set(rev,[[],[]]);
    const [lines,polygons]=districts.get(rev);
    lines.push(...row.lines);polygons.push(...row.polygons);
  }
  const {SG}=await layer.manifest(),seen=new Set();
  for(const file of Object.values(SG.districts)){
    const rows=JSON.parse(fs.readFileSync(path.join(root,"data","sections",file),"utf8"));
    for(const [rev,parts] of Object.entries(rows)){
      assert.ok(!seen.has(rev));seen.add(rev);assert.deepEqual(parts,[["Fischereirevier",0,...districts.get(rev)]]);
    }
  }
  assert.equal(seen.size,districts.size);
  const [overview]=await layer.district({code:"SG",rev:"1495"});
  assert.equal(overview.lines.length,146);
});

test("numbered district overviews preserve Aargau protection and Zürich's local water selection",async()=>{
  const {layer,api}=mapAt(16),ag=await layer.district({code:"AG",rev:"114"});
  assert.ok(ag.some(p=>p.symbol==="culvert"&&p.lines.length));
  const protectedAreas=ag.find(p=>p.symbol==="protected").polygons;
  assert.ok(protectedAreas.some(r=>api.nearest(47.258968,8.172046,r,true).d<2));
  const zh=(await layer.hits(47.3903922,8.62641163,10)).find(h=>h.water==="Glatt"&&h.rev==="203");
  assert.ok(zh.hasDistrict);
  const overview=await layer.district(zh);
  assert.ok(overview.some(p=>p.lines.length>1));
});

test("Luzern draws the lake basin and numbered districts during the first viewport sync",async()=>{
  const {layer,requests}=mapAt(10);
  const bounds={getWest:()=>7.84,getSouth:()=>46.96,getEast:()=>8.36,getNorth:()=>47.21,pad:()=>bounds};
  layer.map.getBounds=()=>bounds;
  const credits=new Set();
  layer.map.attributionControl={addAttribution:t=>credits.add(t)};
  let drawn=[];
  layer.paint=()=>{drawn=[...layer.visible.values()].filter(r=>r.code==="LU")};
  await layer.sync();
  assert.ok(drawn.some(r=>r.meta[0]==="Luzerner Seebecken und obere Reuss"&&r.poly));
  assert.ok(drawn.some(r=>r.meta[2]==="55"&&!r.poly));
  assert.ok(drawn.some(r=>r.meta[1]==="Ruhezone A"&&r.poly));
  assert.ok([...credits].some(c=>c.includes("Kanton Luzern")));
  assert.ok(requests.some(url=>url.includes("LU-overview-")));
  assert.ok(!requests.some(url=>url.includes("LU-groups-")||url.includes("LU-selection-")));
});

test("Luzern keeps private rights, patent areas and overlapping local conditions distinct",async()=>{
  const {layer,api}=mapAt(15);
  const at=async(lat,lon)=>(await layer.hits(lat,lon,6)).filter(h=>h.code==="LU"&&h.d<2);
  const city=(await at(47.0512807,8.3059275)).find(h=>h.name==="Luzerner Seebecken und obere Reuss");
  assert.equal(api.symbol(city.kind),"private");
  assert.equal(city.rule,"");
  const river=(await at(47.1030608,8.3481518)).find(h=>h.name==="Untere Reuss ab Reusszopf");
  assert.equal(river.lake,false);
  assert.equal(river.rule,"fluss");
  assert.equal(api.symbol(river.kind),"district");
  const zone=await at(47.1230234,8.1845128);
  assert.ok(zone.some(h=>h.kind==="Patentgebiet"&&h.rule==="sempach"));
  assert.ok(zone.some(h=>h.kind==="Ruhezone A"&&api.symbol(h.kind)==="condition"&&api.restriction(h.kind)));
  const noPatent=(await at(47.0032678,8.4206919)).find(h=>h.kind==="Keine Patentausgabe");
  assert.equal(api.symbol(noPatent.kind),"condition");
  assert.equal(noPatent.rule,"");
});

test("the GL startup shares its centre tile with viewport loads and retries a failed preload",async()=>{
  const gl=fs.readFileSync(path.join(root,"beta","map-sections-gl.js"),"utf8");
  let offline=true;
  const {layer,requests}=mapAt(18,url=>offline&&!url.endsWith("index.json"),gl);
  const point=[7.99492,46.93513];
  layer.map.getBounds=()=>({getWest:()=>7.994,getSouth:()=>46.934,getEast:()=>7.996,getNorth:()=>46.936});
  await layer.preload(point,18);
  assert.equal(layer.cache.size,0);
  offline=false;requests.length=0;
  const preload=layer.preload(point,18),first=layer.sync();
  await layer.sync();
  assert.ok([...layer.visible.values()].some(row=>row.code==="LU"&&row.meta[2]==="123"));
  await Promise.all([preload,first]);
  assert.ok(requests.some(url=>url.includes("LU-")));
  assert.equal(requests.length,new Set(requests).size);
  assert.ok(!requests.some(url=>url.includes("overview")||url.includes("groups")));
});

test("opening the country overview preloads just the shared atlas and index",async()=>{
  const gl=fs.readFileSync(path.join(root,"beta","map-sections-gl.js"),"utf8");
  const {layer,requests}=mapAt(7,()=>false,gl);
  await Promise.all([layer.preload(),layer.preload([8.2,46.8],7)]);
  assert.deepEqual(requests.sort(),["./data/map-overview.json","./data/sections/index.json"]);
});

test("Luzern preserves the full Uffikoner Weiher district and clips neutral lakes to the canton",async()=>{
  const {layer,api}=mapAt(15);
  const ponds=await Promise.all([[47.2066878,8.0245598],[47.205713,8.0240744],[47.2057042,8.0203227]].map(
    async([lat,lon])=>(await layer.hits(lat,lon,5)).find(h=>h.rev==="109"&&h.code==="LU")));
  assert.ok(ponds.every(h=>h.water==="Uffikoner Weiher"&&h.hasDistrict&&h.zoneId===ponds[0].zoneId));
  const [district]=await layer.district(ponds[0]);
  assert.equal(district.polygons.length,3);
  for(const [name,lat,lon] of [["Zugersee",47.1130976,8.4907194],["Mauensee",47.1715574,8.0752409],["Soppensee",47.0895132,8.0810811]]){
    const hit=(await layer.hits(lat,lon,3)).find(h=>h.name===name);
    assert.equal(hit.code,"LU");assert.equal(hit.d,0);
    assert.equal(api.symbol(hit.kind),"water");assert.equal(hit.lake,true);
  }
  assert.ok(!(await layer.hits(47.15,8.51,5)).some(h=>h.code==="LU"));
});

test("every published Luzern district resolves by exact number, name and map position",async()=>{
  const directory=require("../data/luzern-reviere.json");
  const index=require("../data/sections/index.json").LU;
  const search=require("../data/sections/"+index.search).filter(row=>row[2]==="Fischereirevier");
  const rank=vm.runInNewContext(fs.readFileSync(path.join(root,"map-search.js"),"utf8")+"\nFishMapSearch.rank");
  const gl=fs.readFileSync(path.join(root,"beta/map-sections-gl.js"),"utf8");
  const maps=[mapAt(15).layer,mapAt(15,undefined,gl).layer];
  assert.equal(Object.keys(directory).length,126);
  assert.equal(search.length,Object.keys(directory).length);
  assert.equal(Object.values(directory).reduce((sum,d)=>sum+(d.lines||0),0),127);
  assert.equal(Object.values(directory).reduce((sum,d)=>sum+(d.areas||0),0),10);
  const rows=search.map(r=>[...r,"LU",directory[r[1]].registerName]);
  assert.equal(rank(rows,"LU Kleine Sempacher-Aa",{lat:47,lng:8})[0].rev,"48");
  const browse=rank([...rows,["Andere Zone","6","Fischereirevier",47,8,"AG"],["Patentgebiet","","Patentgebiet",47,8,"LU"]],"Luzerner Reviere",{lat:47,lng:8});
  assert.deepEqual(Array.from(browse,r=>r.rev),Object.keys(directory));
  for(const [rev,d] of Object.entries(directory)){
    const result=rank(rows,"Luzern Revier-ID "+rev,{lat:47,lng:8});
    assert.equal(result.length,1,rev);
    assert.equal(result[0].name,d.name,rev);
    assert.equal(result[0].lat,d.lat);assert.equal(result[0].lon,d.lon);
    for(const layer of maps){
      const hit=(await layer.hits(d.lat,d.lon,55)).find(h=>h.code==="LU"&&h.kind==="Fischereirevier"&&h.rev===rev);
      assert.equal(hit?.water,d.name,rev);
      assert.equal(hit.wholeDistrict,true);
      assert.equal(hit.zoneId,"LU/revier/"+rev);
      const [whole]=await layer.wholeZone(hit);
      assert.equal(Boolean(whole.lines.length),!!d.lines,rev);
      assert.equal(Boolean(whole.polygons.length),!!d.areas,rev);
    }
  }
  assert.equal(directory[6].name,"Bihlbach, I. TS");assert.equal(directory[6].metres,4713.4);
  assert.equal(directory[7].name,"Bihlbach, II. TS");assert.equal(directory[7].metres,5597.7);
  assert.equal(directory[109].areas,3);assert.equal(directory[109].m2,27199.2);
  // LV95 2 651 490 / 1 214 563 is the parcel point in the cantonal viewer near Ruswil.
  const here=await mapAt(12).layer.hits(47.08008085,8.11664650,300);
  const nearest=here.filter(h=>h.code==="LU"&&h.kind==="Fischereirevier").sort((a,b)=>a.d-b.d)[0];
  assert.equal(nearest.rev,"6");assert.ok(nearest.d<60);
});

test("every above-ground fishery enters the overview and its category is drawn at every national scale",()=>{
  const dir=path.join(root,"data","sections"),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),"utf8"));
  const atlas=JSON.parse(fs.readFileSync(path.join(root,"data/map-overview.json"),"utf8"));
  for(const [code,entry] of Object.entries(read("index.json"))){
    const [meta,overview]=read(entry.overview),ids=new Set(overview.map(r=>r[0]));
    for(const [key,file] of Object.entries(entry)){
      if(!/^\d+_\d+$/.test(key))continue;
      const [attrs,rows]=read(file);
      for(const [id,m] of rows)if(!attrs[m][5]&&attrs[m][1]!=="Gewässer")assert.ok(ids.has(id),code+"-"+id);
    }
    const classes=new Set(meta.filter(m=>!m[5]).map(m=>[m[1],m[6]].join("|")));
    for(const z of [6,7,8,9]){
      const masks=atlas[z].filter(row=>row[0]===code);
      assert.deepEqual(new Set(masks.map(row=>[row[1],row[2]].join("|"))),classes);
      assert.ok(masks.every(r=>r[5]>0&&r[6]>0&&Buffer.from(r[7],"base64").readUInt32BE(0)===0x89504e47));
    }
  }
});

test("Glarus uses the official season and Swiss summer and winter night hours",()=>{
  const {XSRC,swissFishingTime,fisheryPeriod}=require("../map-sources.js");
  const gl=id=>XSRC.GL.layers[0].map({fangzeiten:id});
  const status=(f,at)=>fisheryPeriod("GL",f,swissFishingTime(new Date(at)));
  const lake=gl("1apr_31dez");
  assert.equal(status(lake,"2026-11-16T18:59:00Z"),"open");
  assert.equal(status(lake,"2026-11-16T19:00:00Z"),"night");
  assert.equal(status(lake,"2026-06-15T21:00:00Z"),"night");
  assert.equal(status(lake,"2026-06-16T02:00:00Z"),"open");
  assert.equal(status(lake,"2026-12-31T23:10:00Z"),"closed");
  assert.equal(status(gl("1mai_30sept"),"2026-11-17T12:00:00Z"),"closed");
  assert.equal(status(gl("unbekannt"),"2026-11-17T12:00:00Z"),null);
  assert.equal(status(gl("verbot"),"2026-11-17T12:00:00Z"),null);
});

test("Thurgau distinguishes a species rule from a seasonal closure across New Year",()=>{
  const {XSRC,fisheryPeriod}=require("../map-sources.js"),mapper=XSRC.TG.layers[0].map;
  const p={gueltig_von:"1. November",gueltig_bis:"31. Januar"};
  const all=mapper({...p,fischereiregelung:"Fang aller Fischarten 1.Nov - 31. Januar verboten"});
  const one=mapper({...p,fischereiregelung:"Fang von Felchen mit der Angel verboten"});
  assert.equal(fisheryPeriod("TG",all,{ordinal:101}),"closed");
  assert.equal(fisheryPeriod("TG",all,{ordinal:201}),null);
  assert.equal(fisheryPeriod("TG",one,{ordinal:101}),null);
  const shore=XSRC.TG.layers[2].map({erlaubt:"true",beschreibung:"Fischen vom Ufer ganzjährig erlaubt"});
  assert.equal(fisheryPeriod("TG",shore,{ordinal:101}),null);
});

test("the viewport covers every bundled reach and the Geneva sector stops at the cantonal boundary",()=>{
  const {api}=mapAt(6),{XBOX,XSRC}=require("../map-sources.js");
  for(const c of Object.keys(XSRC)){
    const all=JSON.parse(fs.readFileSync(path.join(root,"data/fisheries",c+".json"),"utf8"));
    const [w,s,e,n]=XBOX[c];
    const box=[Infinity,Infinity,-Infinity,-Infinity];
    let sectors=0;
    for(const [,meta,area,parts] of all.layers.flat()){
      const paths=parts.map(p=>(area?p:[p]).map(api.decode));
      if(meta.cantonalFootprint){
        sectors++;
        assert.ok(paths.some(r=>api.nearest(46.235,6.165,r,true).d===0),"lake in Geneva");
        assert.ok(paths.every(r=>api.nearest(46.49,6.60,r,true).d>10000),"lake near Lausanne");
      }
      for(const ring of paths.flat())for(const [x,y] of ring){
        box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);
        box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);
      }
    }
    assert.equal(sectors,c==="GE"?1:0);
    assert.ok(box[0]>=w&&box[1]>=s&&box[2]<=e&&box[3]<=n,c+" "+box);
  }
});

test("a canton abbreviation filters out similarly named tributaries across the border",()=>{
  const js=fs.readFileSync(path.join(root,"map-search.js"),"utf8");
  const search=vm.runInNewContext(js+"\nFishMapSearch");
  const rows=[["Zufluss Sembach","109","Fischereirevier",47,8,"AG"],["Uffikoner Weiher","109","Fischereirevier",47.2,8,"LU"]];
  assert.deepEqual(Array.from(search.rank(rows,"Revier 109 LU",{lat:47,lng:8}),r=>r.code),["LU"]);
});
