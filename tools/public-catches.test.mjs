import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createReports} from "../server/reports.mjs";

const read=name=>readFileSync(new URL("../server/"+name,import.meta.url),"utf8");
const catalogue=JSON.parse(read("catalogue.json")),today="2026-11-17";
const fields={revision:1,section:"SO:A4",species:"Hecht",len:61.5,count:1,day:today};
function fixture() {
  const db=new DatabaseSync(":memory:");db.exec(read("schema.sql"));
  const DB={prepare(sql){return {bind(...args){const stmt=db.prepare(sql);return {all:()=>({results:stmt.all(...args)})};}};},
    batch(statements){db.exec("BEGIN");try{const result=statements.map(s=>s.all());db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}}};
  const handler=createReports(catalogue,{now:()=>new Date("2026-11-16T23:30:00Z")});
  const req=(path,method="GET",body,key="a".repeat(64),origin="https://wreckedangler.github.io")=>
    handler(new Request("https://example.test/v1/"+path,{method,headers:{Origin:origin,"Content-Type":"application/json","X-Report-Key":key},
      ...(body?{body:JSON.stringify(body)}:{})}),{DB});
  const get=async path=>(await req(path)).json();
  return {req,get,db};
}
const mapQuery="map?days=30&bbox=5,45,11,48", detail="section?days=30&id=SO:A4";
test("Die Karte startet leer und erhält nur gewollte, validierte Angaben",async()=>{
  const {req,get}=fixture();
  assert.deepEqual((await get(mapQuery)).sections,[]);
  assert.equal((await req("report","PUT",{...fields,note:"Notiz"})).status,400);
  assert.equal((await req("report","PUT",{...fields,lat:47,lon:8})).status,400);
  for(const bad of [{section:"SO:unbekannt"},{species:"Unbekannt"},{day:"2026-11-18"},{day:"2026-10-18"},{len:0},{count:0}])
    assert.equal((await req("report","PUT",{...fields,...bad})).status,422);
  assert.equal((await req("report","PUT",fields,"short")).status,401);
  assert.equal((await req("report","PUT",fields,"a".repeat(64),"https://example.org")).status,403);
  assert.deepEqual((await get(mapQuery)).sections,[]);
  const preflight=await req("report","OPTIONS");
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"),"https://wreckedangler.github.io");
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"),/X-Report-Key/);
});
test("Echte Freigaben gruppieren sich am amtlichen Abschnitt, mit Zeitfilter und gemeldeten Längen",async()=>{
  const {req,get}=fixture();
  await req("report","PUT",fields);
  await req("report","PUT",{...fields,day:"2026-10-19",len:82,count:2},"b".repeat(64));
  await req("report","PUT",{...fields,day:"2026-11-11",len:null,species:"Zander"},"c".repeat(64));
  const map=await get(mapQuery),ref=catalogue.sections.find(s=>s[0]==="SO:A4");
  assert.deepEqual(map.sections,[{id:"SO:A4",name:ref[1],lon:ref[2],lat:ref[3],count:4,last:today}]);
  assert.deepEqual((await get(detail)).species,[{species:"Hecht",count:3,min:61.5,max:82,last:today},{species:"Zander",count:1,min:null,max:null,last:"2026-11-11"}]);
  assert.equal((await get(mapQuery.replace("days=30","days=7"))).sections[0].count,2);
  assert.deepEqual((await get("map?days=7&bbox=8.8,46,9,46.5")).sections,[]);
  assert.equal((await req("map?days=8&bbox=5,45,11,48")).status,400);
  assert.equal((await req("map?bbox=5,,11,48")).status,400);
});
test("Wiederholungen, Änderungen und ein nachträglich eintreffender Upload respektieren den Rückzug",async()=>{
  const {req,get}=fixture();
  for(let i=0;i<2;i++)assert.equal((await req("report","PUT",fields)).status,200);
  assert.equal((await get(mapQuery)).sections[0].count,1);
  await req("report","PUT",{...fields,revision:2,len:66});
  await req("report","PUT",fields);
  assert.equal((await get(detail)).species[0].max,66);
  await req("report","DELETE",{revision:3},"b".repeat(64));
  assert.equal((await get(detail)).species.length,1);
  await req("report","DELETE",{revision:3});
  assert.deepEqual((await get(detail)).species,[]);
  assert.equal((await req("report","PUT",{...fields,revision:4})).status,409);
  assert.deepEqual((await get(mapQuery)).sections,[]);
});
test("Die Abschnittsauswahl schickt nur Kennung und amtlichen Namen ans Formular",async()=>{
  const {get}=fixture();
  const items=(await get("sections?canton=AG&q=Wyna%20114")).sections;
  assert.ok(items.some(r=>r.name.includes("Wyna")&&r.name.includes("114")));
  assert.deepEqual(Object.keys(items[0]).sort(),["id","name"]);
  assert.match((await get("sections?canton=LU&id=LU:R6")).sections[0].name,/Bihlbach|Bihlbäch|Bihlb/i);
  assert.deepEqual((await get("sections?canton=SO&id=SO:A4")).sections[0],{id:"SO:A4",name:"Aare A4"});
});
