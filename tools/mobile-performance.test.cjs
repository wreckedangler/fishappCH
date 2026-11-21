const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const map=fs.readFileSync(path.join(root,"beta/src/map-gl.part.js"),"utf8");
const overview=vm.runInNewContext(map.slice(map.indexOf("const overviewLines="),map.indexOf("const soFeatureCache="))+";overviewLine");
test("overview lines keep their endpoints, original detail and existing selection geometry",()=>{
  const zones=JSON.parse(fs.readFileSync(path.join(root,"data/so-sections.json")));
  let full=0,short=0;
  for(const {l:lines} of zones.features)for(const line of lines){
    const simplified=overview(line,7);
    assert.equal(simplified[0],line[0]);
    assert.equal(simplified.at(-1),line.at(-1));
    assert.equal(overview(line,7),simplified);
    assert.equal(overview(line,13),line);
    full+=line.length;short+=simplified.length;
  }
  assert.ok(short<full/4);
});
test("selection changes persist only changed settings, including nested selections",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const writes=[],state={xsel:{},cw:{},sec:"A2",log:[{}]},store={set(key){writes.push(key);return true}};
  const save=vm.runInNewContext(html.slice(html.indexOf("const selectionKeys="),html.indexOf("/* ================= GEODATEN"))+";save",{state,store});
  save();assert.deepEqual(writes,[]);
  state.xsel.AG="Wyna";save();state.sec="A4";save();save();
  assert.deepEqual(writes,["xsel","sec"]);
});
