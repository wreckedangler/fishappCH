const test=require("node:test");
const assert=require("node:assert/strict");
const rights=require("../map-rights.js");
const registers=require("../map-rights-registers.js");
const {XSRC,juraKind}=require("../map-sources.js");

const day={date:"2026-11-17"};
const zone=(code,kind,rev,extra={})=>({t:"zone",code,kind,rev,...extra});
const water=(code,hydroId,lake,extra={})=>({t:"w",code,water:{name:"Test",hydroId,lake},...extra});
const resolve=(h,options={},f)=>rights.resolve(h,f,{...day,...options});

test("every canton provides an official destination for an unclassified or unnamed water",()=>{
  const cantons="AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH".split(" ");
  assert.deepEqual(Object.keys(rights.offices).sort(),cantons);
  for(const c of cantons){
    const result=resolve(water(c,"",false));
    assert.equal(result.level,"guide",c);
    assert.match(result.source[1],/^https:\/\//,c);
    assert.ok(result.body.length>30,c);
  }
});
test("exact canton, lake type and federal identifier are all required",()=>{
  const zug="CH0091750000";
  assert.match(resolve(water("ZG",zug,true)).title,/Zugersee/);
  assert.match(resolve(water("SZ",zug,true)).title,/Freiangelkarte/);
  assert.equal(resolve(water("AG",zug,true)).level,"guide");
  const stream=water("SZ",zug,false);stream.water.name="Zugersee";assert.equal(resolve(stream).level,"guide");
  const fake=water("SZ","",true);fake.water.name="Zugersee";assert.equal(resolve(fake).level,"guide");
  assert.equal(resolve(zone("ZH","Fischereirevier","5",{region:"Türlersee",water:"Allmändbächli",lake:false,area:false})).level,"section");
});
test("protected areas, closed seasons, private rights and culverts take precedence",()=>{
  const lake={lake:true,area:true,water:"Sempachersee"};
  for(const kind of ["Reservatzone","Ruhezone A","Keine Patentausgabe","Schongebiet","Naturköderverbot"]){
    assert.equal(resolve(zone("LU",kind,"",lake)).level,"restriction",kind);
  }
  assert.match(resolve(zone("LU","Privates Fischereirecht","",lake)).title,/Privates/);
  assert.match(resolve(zone("LU","Patentgebiet","",lake),{closed:"Fangzeit geschlossen"}).title,/geschlossen/);
  assert.match(resolve(zone("AG","Fischereirevier","114",{buried:true})).title,/Eingedolt/);
  assert.equal(resolve(zone("AI","Amtliche Karteninformation","",{name:"Fischen verboten"}),{protected:true}).title,"Fischen verboten");
});
test("a partial lookup, a conflicting right or two jurisdictions never confirms access",()=>{
  const h=water("BE","CH0090730000",true);
  for(const options of [{incomplete:true},{overlap:true}])assert.equal(resolve(h,options).level,"unknown");
  assert.equal(resolve({...h,border:["BE","FR"]}).level,"unknown");
  assert.equal(resolve({...h,water:{...h.water,ambiguous:true}}).level,"unknown");
  assert.equal(resolve(zone("ZH","Fischereirevier","203",{districtView:{}})).level,"guide");
});
test("lease numbers match official register rows and links, including water 114",()=>{
  assert.equal(Object.keys(registers.AG).length,130);assert.equal(Object.keys(registers.ZH).length,199);assert.equal(Object.keys(registers.SG).length,233);
  for(const [code,rev,pattern] of [["AG","114",/karte-114\.pdf$/],["ZH","203",/#page=5$/],["SG","820",/Pacht_820_/]]){
    const info=resolve(zone(code,"Fischereirevier",rev));assert.match(info.source[1],pattern);assert.equal(info.level,"section");
  }
  assert.equal(registers.ZH[120],undefined); // Part of a reach description: "120 m".
  assert.equal(resolve(zone("ZH","Revier unbekannt","203")).level,"guide");
  assert.equal(resolve(zone("SG","Fischereirevier","1495",{region:"Zürich-/Oberseezuflüsse"})).level,"guide");
  assert.equal(resolve(zone("SG","Fischereirevier","4925",{region:"Linthkanal Schonstrecke Hänggelgiessen"})).level,"restriction");
  assert.doesNotMatch(resolve(zone("AG","Fischereirevier","114"),{date:"2034-01-01"}).source[1],/karte-114/);
});
test("annual permissions expire and OW's shore exception ends before the lake patent",()=>{
  const ow=water("OW","CH0092390000",true);
  assert.match(resolve(ow).title,/ausser Saison/);
  assert.doesNotMatch(resolve(ow,{date:"2026-10-15"}).title,/ausser Saison/);
  assert.equal(resolve(ow,{date:"2027-01-01"}).level,"guide");
  assert.equal(resolve(water("OW","CH0092340000",true),{date:"2027-01-01"}).level,"water");
});
test("Jura GML status distinguishes permit areas, reserves and unconfirmed labels",()=>{
  assert.equal(juraKind("Permis cantonal","Secteurs ouvert à la pêche",""),"Patent");
  assert.equal(juraKind("Permis cantonal","Secteurs interdits à la pêche","Réserve"),"Schongebiet");
  assert.notEqual(juraKind("Permis cantonal","",""),"Patent");
  assert.notEqual(juraKind("Permis cantonal","Secteurs ouvert à la pêche","zone spéciale"),"Patent");
  const doubs=water("JU","CH0001350000",false,{lat:47.3632842,lon:7.1539113});
  assert.match(resolve(doubs,{incomplete:true}).title,/Schutzstrecke bei Saint-Ursanne/);
  assert.doesNotMatch(resolve({...doubs,lat:47.30}).title,/Saint-Ursanne/);
  assert.equal(resolve({...doubs,border:["JU","NE"]}).level,"unknown");
  assert.equal(resolve(doubs,{date:"2030-01-01"}).level,"guide");
});
test("Nidwalden rights can apply exclusively to a species or method and Freiburg lake classes are explicit",()=>{
  const rightsHere=XSRC.NW.layers[0].map;
  assert.equal(rightsHere({Nr:1,Recht:"Ausschliessliches Fischereirecht zum Balchenfischfang"}).art,"Besondere Vorschrift");
  assert.equal(rightsHere({Nr:2,Recht:"Ausschliessliches Fischereirecht zum Fischfang"}).art,"Privat");
  const lake=XSRC.FR.layers[1].map;
  for(const [input,type] of [["Ouvert à la pêche","Patent"],["Concordat intercantonal","Seekonkordat"],["","Unbekannt"]])assert.equal(lake({PECHE_VALEUR:input}).art,type);
});
test("Geneva park and tributary records do not inherit the listed rivers' permit",()=>{
  const feature=(n,name)=>XSRC.GE.layers[0].map({secteur:name+": Secteur "+n,no_secteur:n});
  assert.equal(feature(9,"L'Allondon").art,"Besondere Vorschrift");
  assert.equal(feature(301,"Le Rhône").permitSector,"river");
  assert.equal(feature(29,"Nant de Pry").permitSector,undefined);
  assert.equal(feature(102,"Etang / biotope").permitSector,undefined);
});
