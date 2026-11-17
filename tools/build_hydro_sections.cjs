// node tools/build_hydro_sections.cjs [a saved LINDAS SPARQL JSON response]
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const key=require("./section-key.cjs");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const json=file=>JSON.parse(read(file));
const {FishSections,hydroName,hydroNameIndex,stationOnGeometry}=vm.runInNewContext(
  read("beta/map-sections-gl.js")+"\n"+read("beta/src/here-hydro.part.js")+
  "\n({FishSections,hydroName,hydroNameIndex,stationOnGeometry})");
const query=`PREFIX s: <http://schema.org/>
PREFIX d: <https://environment.ld.admin.ch/foen/hydro/dimension/>
PREFIX g: <http://www.opengis.net/ont/geosparql#>
SELECT DISTINCT ?id ?place ?water ?point ?type FROM <https://lindas.admin.ch/foen/hydro>
WHERE { ?st s:identifier ?id; s:name ?place; s:containedInPlace/s:name ?water; g:hasGeometry/g:asWKT ?point .
  ?obs d:station ?st . ?set <https://cube.link/observation> ?obs . ?type <https://cube.link/observationSet> ?set .
} ORDER BY ?id`;

async function build() {
  let catalogue;
  if(process.argv[2])catalogue=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  else{
    const response=await fetch("https://lindas.admin.ch/query?"+new URLSearchParams({query}),
      {headers:{Accept:"application/sparql-results+json"}});
    if(!response.ok)throw Error("LINDAS "+response.status);
    catalogue=await response.json();
  }
  const stations={};
  for(const row of catalogue.results.bindings){
    const point=/^POINT\s*\(([\d.]+) ([\d.]+)\)$/i.exec(row.point.value);
    if(!point)throw Error("Unexpected station geometry: "+row.point.value);
    stations[row.id.value]={water:row.water.value.trim(),place:row.place.value.trim(),lake:row.type.value.endsWith("/lake"),
      lon:+Number(point[1]).toFixed(5),lat:+Number(point[2]).toFixed(5)};
  }
  const byName=hydroNameIndex(stations),matches=new Map();
  function match(id,name,geometry){
    if(!byName.has(hydroName(name)))return;
    const found=stationOnGeometry(byName,[name],[geometry()]);
    if(found&&(!matches.has(id)||matches.get(id).distance>found.distance))matches.set(id,found);
  }
  for(const f of json("data/so-sections.json").features){
    const water={A1:"Aare",A2:"Aare",D:"Dünnern",E:"Emme",B:"Birs",LS:"Lüssel",LT:"Lützel",CH:"Chastelbach"}[f.id];
    if(water)match("SO:"+f.id,water,()=>({lines:f.l}));
  }
  const lu=json("data/luzern-reviere.json");
  for(const [code,index] of Object.entries(json("data/sections/index.json"))){
    const seen=new Set();
    for(const [tile,file] of Object.entries(index)){
      if(!/^\d+_\d+$/.test(tile))continue;
      const [meta,rows]=json("data/sections/"+file);
      for(const [fid,m,,,,raw] of rows){
        if(seen.has(fid))continue;
        seen.add(fid);
        const [water,kind,rev,region,,buried]=meta[m],name=water||region;
        if(!name||buried||FishSections.restriction(kind))continue;
        const district=code==="LU"&&kind==="Fischereirevier"&&lu[rev];
        // Mixed-water Lucerne districts are selectable only as a whole.
        const clean=s=>s.split(/\s*:\s*/)[0].replace(/,\s*[IVX]+\.\s*TS\.?$/i,"").trim();
        if(district&&clean(district.name)!==clean(name))continue;
        const id=code+":"+(district?"R"+rev:key([name,rev,kind]));
        match(id,clean(name),()=>Array.isArray(raw)?{polygons:[raw.map(FishSections.decode)]}:{lines:[FishSections.decode(raw)]});
      }
    }
  }
  for(const file of fs.readdirSync(path.join(root,"data/fisheries")).sort()){
    const code=path.basename(file,".json");
    json("data/fisheries/"+file).layers.forEach((layer,index)=>{
      for(const [fid,p,area,parts] of layer){
        if(FishSections.restriction(p.art))continue;
        const id=/null|undefined/i.test(p.id)?fid:p.id;
        match(code+":"+key([index,id,p.name,p.t||""]),p.name,()=>area?
          {polygons:parts.map(rings=>rings.map(FishSections.decode))}:{lines:parts.map(FishSections.decode)});
      }
    });
  }
  // These picker entries identify a single lake or named reach. Composite rule groups are excluded.
  const rules={
    "AG:hallwil":"2097","AG:aare_so":"2063","BE:biel":"2208","BE:brienz":"2023","BE:thun":"2093",
    "BE:aare_thun":"2135","FR:morat":"2004","FR:neuch":"2642",
    "GE:leman":"2028","GL:walensee":"2118","LU:hallwil":"2097","LU:sempach":"2168","LU:vws":"2207",
    "LU:zugersee":"2017","NE:neuch":"2642","NW:vws":"2025","OW:sarnersee":"2088",
    "SG:bodensee":"2032","SG:walensee":"2118","SZ:vws":"2025","SZ:zugersee":"2017",
    "TG:obersee":"2032","TI:verbano":"2022","VD:leman":"2027","VD:morat":"2004","VD:neuch":"2154",
    "VS:leman":"2026","ZG:aegeri":"2031","ZG:zugersee":"2017"
  };
  // Retired or unavailable stations disappear on regeneration.
  for(const k of Object.keys(rules))if(!stations[rules[k]])delete rules[k];
  const sections=Object.fromEntries([...matches].sort(([a],[b])=>a.localeCompare(b,"en")).map(([k,m])=>[k,m.id]));
  // In Bern these three lake picker entries each designate one whole official patent section.
  const pickerSections={"BE:biel":"BE:23f0cc05e8339c41b027","BE:brienz":"BE:69bbd2c8e06260876780","BE:thun":"BE:f804407ed63c6feb8c7c"};
  fs.writeFileSync(path.join(root,"data/here-stations.json"),JSON.stringify({stations,sections,rules,pickerSections})+"\n");
  console.log(Object.keys(stations).length+" BAFU stations, "+matches.size+" geometry matches, "+Object.keys(rules).length+" picker entries");
}
build().catch(error=>{console.error(error);process.exitCode=1;});
