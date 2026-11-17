/* Build the initial mobile map from the same public layers used for live updates. */
const fs=require("node:fs/promises");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {XSRC,westFeatures}=require("../map-sources.js");
const output=path.join(__dirname,"../data/fisheries");

function encode(points){
  const previous=[0,0];
  let encoded="";
  for(const point of points)for(let axis=0;axis<2;axis++){
    const value=Math.round(point[axis]*1e5),delta=value-previous[axis];
    previous[axis]=value;
    let n=delta<0?-2*delta-1:2*delta;
    while(n>=32){encoded+=String.fromCharCode(95+n%32);n=Math.floor(n/32)}
    encoded+=String.fromCharCode(63+n);
  }
  return encoded;
}

async function build(code,cache){
  const layers=[],dates=[];
  for(const [index,layer] of XSRC[code].layers.entries()){
    const cached=cache&&path.join(cache,"fisheries-"+code+"-"+index+".json");
    let collection;
    try{if(cached)collection=JSON.parse(await fs.readFile(cached,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
    if(!collection){
      collection=await westFeatures(layer.url());
      if(cached)await fs.writeFile(cached,JSON.stringify(collection));
    }
    dates.push((cached?(await fs.stat(cached)).mtime:new Date()).toISOString().slice(0,10));
    if(code==="GE"){
      const lake=collection.features.find(f=>Number(f.properties?.no_secteur)===100);
      if(!lake)throw Error("Léman sector 100 is missing");
      const args=[path.join(__dirname,"clip_geneva.py")];
      if(cache)args.push(cache);
      lake.geometry=JSON.parse(execFileSync("python",args,{input:JSON.stringify(lake.geometry),encoding:"utf8"}));
    }
    const features=[];
    for(const [i,f] of collection.features.entries()){
      const g=f.geometry,p=f.properties||{},m=layer.map(p,f);
      if(!g||!m?.id||!["Polygon","MultiPolygon","LineString","MultiLineString"].includes(g.type))continue;
      const area=g.type.endsWith("Polygon"),parts=g.type.startsWith("Multi")?g.coordinates:[g.coordinates];
      features.push([f.id??p.OBJECTID??i,m,area?1:0,parts.map(part=>area?part.map(encode):encode(part))]);
    }
    layers.push(features);
  }
  const file=path.join(output,code+".json");
  await fs.writeFile(file,JSON.stringify({date:dates.sort()[0],layers}));
  console.log(code,layers.map(l=>l.length).join("+"),(await fs.stat(file)).size);
}
async function main(){
  await fs.mkdir(output,{recursive:true});
  const cache=process.argv[2];
  if(cache)await fs.mkdir(cache,{recursive:true});
  const requested=process.argv.slice(3);
  const codes=requested.length?requested:Object.keys(XSRC);
  for(const code of codes)if(!XSRC[code])throw Error("Unbekannter Kanton: "+code);
  const worker=async()=>{while(codes.length)await build(codes.shift(),cache)};
  await Promise.all([worker(),worker(),worker()]);
}
main().catch(e=>{console.error(e);process.exitCode=1});
