const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function app(stubs={}){
  const ctx=vm.createContext({esc:s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]),...stubs});
  vm.runInContext(read("beta/src/fish-rigs.part.js"),ctx);
  vm.runInContext(read("beta/src/fish-sketches.part.js"),ctx);
  ctx.rigs=vm.runInContext("FISH_RIGS",ctx);
  return ctx;
}
const base={canton:"SO",water:"A4",name:"Aare A4"};
function assess(sp,changes={}){const ctx=app();return ctx.rigAssessment(ctx.rigs[sp],{...base,species:sp,...changes});}

test("guides cover fish with fishing tips, without adding target fishing for observation-only species",()=>{
  const html=read("index.html"),ctx=app();
  const start=html.indexOf("const FISH={"),end=html.indexOf("\n};",start)+3;
  vm.runInContext(html.slice(start,end),ctx);
  const eligible=vm.runInContext("Object.entries(FISH).filter(([,f])=>f.koeder).map(([sp])=>sp).sort()",ctx);
  assert.deepEqual(Object.keys(ctx.rigs).sort(),Array.from(eligible));
});

test("the inline drawing follows adapted bait and never invents a montage for an unknown type",()=>{
  const ctx=app(),rig=ctx.rigs.Karpfen;
  const normal=ctx.rigAssessment(rig,base),restricted=ctx.rigAssessment(rig,{canton:"SZ",water:"fluss"});
  const draw=a=>ctx.rigSketch(rig,a,ctx.rigBuild(rig,a));
  assert.match(draw(normal),/Köder: Ein bis zwei weiche Maiskörner/);
  assert.match(draw(restricted),/Köder: Wurm/);
  assert.doesNotMatch(draw(restricted),/Mais/);
  assert.notEqual(draw(normal),draw(restricted));
  assert.equal(ctx.rigSketch({...rig,type:"unknown"},normal,ctx.rigBuild(rig,normal)),"");
});

test("Palomar drawings retain the end only for end-weight rigs and include the second pass through the eye",()=>{
  const ctx=app(),normal=ctx.knotSketchSteps("palomar",false),drop=ctx.knotSketchSteps("palomar",true);
  assert.equal(normal.length,4);assert.match(normal.at(-1).text,/3 mm/);
  assert.equal(drop.length,5);assert.match(drop[3].text,/lange Ende.*behalten/);
  assert.match(drop[4].text,/nochmals von oben.*30–50 cm/);
  assert.doesNotMatch(drop.map(s=>s.text).join(" "),/3 mm/);
  for(const [sp,expected] of [["Hecht",4],["Wels",4],["Egli (Flussbarsch)",5],["Felchen",5]]){
    assert.match(ctx.knotGuideMarkup("palomar",ctx.rigs[sp]),new RegExp('1 / '+expected));
  }
  assert.deepEqual(Array.from(ctx.knotSketchSteps("unknown")),[]);
});

test("inline SVG titles do not interfere with the beta document title or indexing directive",()=>{
  const main=read("index.html"),beta=read("beta/index.html"),head=beta.split("</head>")[0];
  assert.equal(head.match(/<title>/g).length,1);
  assert.match(head,/<meta name="robots" content="noindex">/);
  assert.doesNotMatch(main.split("</head>")[0],/name="robots"/);
  const part=read("beta/src/fish-sketches.part.js").replace(/\r\n/g,"\n").trim();
  for(const html of [main,beta])assert.ok(html.replace(/\r\n/g,"\n").includes(part));
});

test("missing permissions or rule data never produce an affirmative permission",()=>{
  for(const canton of Object.keys(JSON.parse(read("data/updates.json")).rules)){
    const a=assess("Barbe",{canton,unknown:true});
    assert.equal(a.level,"warn",canton);assert.match(a.lines.join(" "),/keine Erlaubnis/);
  }
  const a=assess("Egli (Flussbarsch)",{accessWarning:"Berechtigung ungeklärt"});
  assert.equal(a.level,"warn");assert.ok(a.lines.includes("Berechtigung ungeklärt"));
  assert.equal(assess("Barbe").level,"note");
});

test("protected species and closed waters withhold the targeting instructions",()=>{
  for(const flag of [{protected:true},{closed:"Schonstrecke – Fischen verboten"}]){
    const a=assess("Äsche",flag);assert.equal(a.level,"bad");assert.equal(a.blocked,true);
  }
  const a=assess("Bachforelle",{season:"1.10.–15.3."});
  assert.equal(a.level,"bad");assert.match(a.lines.join(" "),/nur vorbereiten.*1\.10/);
});

test("local natural-bait and fly-only restrictions override the generic rig",()=>{
  for(const local of ["Naturköderverbot","Nur künstliche Köder"]){
    assert.equal(assess("Barbe",{local}).blocked,true);
    assert.equal(assess("Egli (Flussbarsch)",{local}).blocked,false);
  }
  assert.equal(assess("Egli (Flussbarsch)",{local:"Fliegenstrecke"}).blocked,true);
  assert.equal(assess("Bachforelle",{local:"Fliegenstrecke"}).blocked,false);
});

test("SZ stream tackle adapts hook and bait, preserves the fly exception and does not undersize predator rigs",()=>{
  const c={canton:"SZ",water:"fluss"};
  const carp=assess("Karpfen",c);assert.match(carp.hook,/^6 ·/);assert.equal(carp.bait,"Wurm");
  const ctx=app(),steps=ctx.rigBuild(ctx.rigs.Karpfen,carp).steps.join(" ");
  assert.match(steps,/Wurm/);assert.doesNotMatch(steps,/Mais/);
  assert.equal(assess("Äsche",c).hook,"14–18");
  assert.equal(assess("Seeforelle",c).hook,"1–2");
  for(const sp of ["Hecht","Zander","Wels"])assert.equal(assess(sp,c).blocked,true,sp);
  assert.match(assess("Barbe",{...c,water:"sihl"}).lines.join(" "),/nur Fliegenfischen/);
  assert.equal(assess("Karpfen",{...c,water:"see"}).bait,"Ein bis zwei weiche Maiskörner");
});

test("SG trout-season method ban uses the selected water, without applying stream rules to lakes",()=>{
  for(const sp of ["Barbe","Hecht","Egli (Flussbarsch)"]){
    assert.equal(assess(sp,{canton:"SG",water:"alpenrhein",troutSeason:true}).blocked,true);
    assert.equal(assess(sp,{canton:"SG",water:"bodensee",troutSeason:true}).blocked,false);
    assert.equal(assess(sp,{canton:"SG",water:"alpenrhein",troutSeason:false}).blocked,false);
  }
  assert.equal(assess("Barbe",{canton:"SG",water:"uebrige",flowing:true,troutSeason:true}).blocked,true);
  assert.equal(assess("Barbe",{canton:"SG",water:"uebrige",troutSeason:true}).level,"warn");
  assert.equal(assess("Äsche",{canton:"SG",water:"alpenrhein",troutSeason:true}).blocked,false);
});

test("SH differentiates patent, lease and unknown access, including the trout-season pike exception",()=>{
  assert.equal(assess("Egli (Flussbarsch)",{canton:"SH",patent:true}).blocked,true);
  assert.equal(assess("Egli (Flussbarsch)",{canton:"SH",lease:true,troutSeason:true}).blocked,true);
  assert.equal(assess("Hecht",{canton:"SH",lease:true,troutSeason:true}).blocked,false);
  assert.equal(assess("Egli (Flussbarsch)",{canton:"SH"}).level,"warn");
});

test("active choice and overlapping map conditions are re-read, not another nearby water",()=>{
  const hit={d:5,kind:"Fischereirevier",area:false,choiceHits:[{d:6,kind:"Naturköderverbot"},{d:40,kind:"Nur Fliegenfischen"}]};
  const ctx=app({state:{canton:"SO"},currentSec:()=>({id:"A4",name:"Aare A4",kind:"patent"}),
    ruleFor:()=>({}),currentConfirmed:()=>hit,secStatus:()=>[],hereSummary:()=>({cls:"warn",s:"Reviererlaubnis prüfen"}),
    isAuto:()=>false,selectedWaterName:()=>"Aare A4",ctxLabel:()=>"Aare A4",unknownWater:()=>false,
    RULES:JSON.parse(read("data/updates.json")).rules});
  let c=ctx.currentRigContext("Barbe");
  assert.match(c.local,/Naturköderverbot/);assert.doesNotMatch(c.local,/Fliegenfischen/);
  assert.equal(c.flowing,true);assert.equal(ctx.rigAssessment(ctx.rigs.Barbe,c).blocked,true);
  hit.choiceHits=[];
  c=ctx.currentRigContext("Barbe");
  assert.equal(ctx.rigAssessment(ctx.rigs.Barbe,c).blocked,false);
  ctx.unknownWater=()=>true;
  assert.equal(ctx.currentRigContext("Barbe").unknown,true);
  ctx.ruleFor=()=>({schon:[[10,1],[3,15]]});ctx.inRange=()=>true;ctx.fmtR=()=>"1.10.–15.3.";
  ctx.hereSummary=()=>({cls:"bad",s:"Kartiertes Schutzgebiet"});
  c=ctx.currentRigContext("Bachforelle");
  assert.equal(c.closed,"Kartiertes Schutzgebiet");
  assert.equal(ctx.rigAssessment(ctx.rigs.Bachforelle,c).blocked,true);
});
