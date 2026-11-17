// Build section-to-water references from the public fishing catalogue and swissTLM3D.
// Run node tools/build_temperature_waters.cjs [path to a reusable lookup cache].
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const json=p=>JSON.parse(read(p));
const {temperatureWaterName,aareCourse}=vm.runInNewContext(read("beta/src/here-hydro.part.js")+"\n({temperatureWaterName,aareCourse})");
const local=json("data/here-stations.json"),catalogue=json("server/catalogue.json").sections;
const endpoint="https://api3.geo.admin.ch/rest/services/api/MapServer/identify";
const layer="ch.swisstopo.swisstlm3d-gewaessernetz";
const cacheFile=process.argv[2],cache=cacheFile&&fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,"utf8")):{};
const saveCache=()=>{if(cacheFile)fs.writeFileSync(cacheFile,JSON.stringify(cache));};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function courseAt(name,lon,lat){
  if(name==="aare")return aareCourse;
  const key=[name,lon,lat].join("|");
  if(Object.hasOwn(cache,key))return cache[key];
  // Stations and official reach anchors can lie on a bank. Only accept an unambiguous
  // same-name federal watercourse at that point, even when another station is close.
  const dy=1500/111320,dx=dy/Math.cos(lat*Math.PI/180);
  const params=new URLSearchParams({geometry:lon+","+lat,geometryType:"esriGeometryPoint",sr:"4326",
    layers:"all:"+layer,mapExtent:[lon-dx,lat-dy,lon+dx,lat+dy].join(","),imageDisplay:"200,200,96",
    tolerance:"10",returnGeometry:"false",lang:"de",limit:"50"});
  for(let attempt=0;;attempt++){
    try{
      const response=await fetch(endpoint+"?"+params,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error("swisstopo "+response.status);
      const {results}=await response.json();
      const codes=new Set(results.map(r=>r.attributes).filter(a=>a?.gwl_nr&&
        String(a.name||"").split("|").some(n=>temperatureWaterName(n)===name)).map(a=>a.gwl_nr));
      return cache[key]=codes.size===1?[...codes][0]:null;
    }catch(error){if(attempt===2)throw error;await pause(1000*(attempt+1));}
  }
}
async function visit(rows,fn){
  const queue=rows.values();
  await Promise.all(Array.from({length:4},async()=>{for(const row of queue)await fn(row);}));
}
async function build(){
  const courses={},stationCourse={},reaches={},pickers={},names=new Set(),lakes=new Set();
  await visit(Object.entries(local.stations),async([id,s])=>{
    const name=temperatureWaterName(s.water);
    const course=s.lake?"lake:"+name:await courseAt(name,s.lon,s.lat);
    names.add(name);
    if(s.lake)lakes.add(name);
    if(course){stationCourse[id]=course;(courses[course]??=[]).push(id);}
  });
  const namedSO={D:"Dünnern",E:"Emme",B:"Birs",LS:"Lüssel",LT:"Lützel",CH:"Chastelbach"};
  const source=catalogue.slice();
  for(const f of json("data/so-sections.json").features.filter(f=>f.art==="Schon")){
    const line=f.l[0],point=line[Math.floor(line.length/2)];
    source.push(["SO:"+f.id,f.t.split(/\s+Schonstrecke|-Schonstrecke/i)[0],...point]);
  }
  await visit(source,async([id,label,lon,lat])=>{
    const so=id.startsWith("SO:")&&namedSO[id.slice(3)];
    const name=temperatureWaterName(so||label);
    if(!names.has(name))return;
    // An on-section station is already geographically verified by build_hydro_sections.
    const course=stationCourse[local.sections[id]]||(lakes.has(name)?"lake:"+name:await courseAt(name,lon,lat));
    if(courses[course])reaches[id]=[course,lon,lat];
  });
  // Individual Bern Aare reaches whose picker entry has no on-section gauge.
  for(const [rule,section] of Object.entries({interlaken:"P202",aare_bern:"P208",aare_wohlen:"P211",altaare:"P218"})){
    const row=catalogue.find(([id,name])=>id.startsWith("BE:")&&name.endsWith(" · "+section));
    if(!reaches[row?.[0]])throw Error("Aare-Abschnitt fehlt: "+section);
    pickers["BE:"+rule]=reaches[row[0]];
  }
  // A single named river or lake in a cantonal picker can reuse its verified reaches.
  for(const [canton,rules] of Object.entries(json("data/updates.json").rules)){
    for(const [rule,label] of rules.w||[]){
      const k=canton+":"+rule,name=temperatureWaterName(label);
      if(local.rules[k]||pickers[k]||!names.has(name))continue;
      const matches=catalogue.filter(([id,title])=>id.startsWith(canton+":")&&reaches[id]&&temperatureWaterName(title)===name);
      if(matches.length&&new Set(matches.map(([id])=>reaches[id][0])).size===1)pickers[k]=reaches[matches[0][0]];
    }
  }
  const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b,"en")));
  for(const ids of Object.values(courses))ids.sort();
  for(const n of [1,2,3,4,5,6])if(reaches["SO:A"+n]?.[0]!==aareCourse)throw Error("Aare A"+n+" fehlt");
  fs.writeFileSync(path.join(root,"data/temperature-waters.json"),JSON.stringify({courses:sorted(courses),reaches:sorted(reaches),pickers:sorted(pickers)})+"\n");
  console.log(Object.keys(courses).length+" Gewässer mit Stationszuordnung, "+Object.keys(reaches).length+" kartierte Abschnitte");
}
build().catch(error=>{console.error(error);process.exitCode=1;}).finally(saveCache);
