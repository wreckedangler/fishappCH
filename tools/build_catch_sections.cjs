// Fixed public map positions from the same source geometry as the fishing map.
// Run with node tools/build_catch_sections.cjs after updating the map data.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const key = require("./section-key.cjs");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const json = p => JSON.parse(read(p));
const { decode, restriction, localCondition } = vm.runInNewContext(read("beta/map-sections-gl.js") + "\nFishSections");
const html = read("index.html");
const species = JSON.parse(html.match(/const SPECIES=(\[[^;]+\]);/)[1]);
const soNames = new Map([...html.matchAll(/\{id:"([^"]+)",name:"([^"]+)",desc:"[^"]*",group:/g)].map(m => [m[1],m[2]]));
const sections = new Map();
function add(code, key, name, [lon,lat]) {
  if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
  const id = code + ":" + key;
  if (!sections.has(id)) sections.set(id, [id, name, +lon.toFixed(4), +lat.toFixed(4)]);
}
function anchor(lines) {
  const line = lines.reduce((best, l) => l.length > best.length ? l : best, []);
  return line[Math.floor(line.length/2)] || [];
}
for (const f of json("data/so-sections.json").features) {
  if (restriction(f.art)) continue;
  const name = soNames.get(f.id) || (f.art === "Privat" ? "Privatgewässer " : "Revier ") + f.id;
  add("SO",f.id,name,anchor(f.l));
}
const lucerne = json("data/luzern-reviere.json");
for (const [rev,f] of Object.entries(lucerne)) {
  add("LU","R"+rev,f.name+" · Revier "+rev,[f.lon,f.lat]);
}
for (const [code,entry] of Object.entries(json("data/sections/index.json"))) {
  for (const [water,rev,kind,lat,lon] of json("data/sections/"+entry.search)) {
    if (restriction(kind) || localCondition(kind) || code==="LU" && kind==="Fischereirevier" && lucerne[rev]) continue;
    add(code,key([water,rev,kind]),(water || kind)+(rev?" · Revier "+rev:""),[lon,lat]);
  }
}
for (const file of fs.readdirSync(path.join(root,"data/fisheries")).sort()) {
  const code = path.basename(file,".json");
  json("data/fisheries/"+file).layers.forEach((layer,index) => {
    for (const [fid,props,area,parts] of layer) {
      if (restriction(props.art) || localCondition(props.art)) continue;
      const paths = (area ? parts.map(p => p[0]) : parts).map(decode);
      const id = /null|undefined/i.test(props.id) ? fid : props.id;
      add(code,key([index,id,props.name,props.t||""]), props.name+" · "+id,anchor(paths));
    }
  });
}
const output = {species,sections:[...sections.values()].sort((a,b)=>a[0].localeCompare(b[0],"en"))};
const target = path.join(root,"server","catalogue.json");
fs.writeFileSync(target,JSON.stringify(output)+"\n");
console.log(output.sections.length+" kartierte Abschnitte");
