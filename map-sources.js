/* Public cantonal fishery services. Used by the map and the offline snapshot builder. */
const XBOX={TI:[8.38,45.81,9.16,46.64],BE:[6.86,46.32,8.46,47.35],FR:[6.62,46.43,7.38,47.03],GE:[5.94,46.12,6.33,46.39],
  GL:[8.87,46.79,9.26,47.18],SH:[8.4,47.55,8.88,47.81],TG:[8.66,47.37,9.5,47.7],
  VD:[6.06,46.18,7.26,46.99],VS:[6.77,45.85,8.48,46.66],NW:[8.30,46.96,8.57,47.03]};
function juraKind(right,area,management){
  const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const status=fold(area),use=fold(management);
  if(status==="secteurs interdits a la peche"||use==="reserve")return "Schongebiet";
  if(use||/hiver|alevin|repeuplement/.test(status))return "Besondere Vorschrift";
  const listedOpen=status==="secteurs ouvert a la peche"||status==="secteurs ouverts a la peche";
  return listedOpen&&fold(right)==="permis cantonal"?"Patent":"Unbekannt";
}
const TGW=n=>()=>`https://ows.geo.tg.ch/geofy_access_proxy/fischereiverbote?Service=WFS&Version=2.0.0&Request=GetFeature&outputFormat=geojson&srsName=EPSG:4326&typeNames=ms:${n}`;
const monthNames=["januar","februar","märz","april","mai","juni","juli","august","september","oktober","november","dezember"];
function annualDate(text){
  const match=/^(\d{1,2})\.\s*(\p{L}+)$/u.exec(String(text||"").trim().toLowerCase());
  const month=match?monthNames.indexOf(match[2])+1:0;
  return month&&+match[1]>=1&&+match[1]<=31?month*100+Number(match[1]):null;
}
function tgRule(p){
  const start=annualDate(p.gueltig_von),end=annualDate(p.gueltig_bis);
  return {id:"S"+p.objectid,art:"Besondere Vorschrift",name:p.gebietsname||"Schutzgebiet",t:p.gebietsbeschreibung||"",
    closedPeriod:start&&end&&/Fang aller Fischarten/i.test(p.fischereiregelung||"")?[start,end]:undefined,
    x:[p.gueltig_von?`Gilt vom ${p.gueltig_von} bis ${p.gueltig_bis}`:"",p.fischereiregelung||""].filter(Boolean)};
}
const XSRC={
 TG:{attr:"Fischerei-Geodaten © Kanton Thurgau",layers:[
  {url:TGW("schongebiete"),map:tgRule},
  {url:TGW("verbote"),map:p=>({id:"V"+p.objectid,art:"Besondere Vorschrift",name:p.gebietsname||"Lokale Einschränkung",t:p.fischereiregelung||p.gebietsbeschreibung,x:[p.gueltig_von&&p.gueltig_bis?`Gilt vom ${p.gueltig_von} bis ${p.gueltig_bis}`:""].filter(Boolean)})},
  {url:TGW("uferregeln"),map:p=>({id:"U"+p.objectid,art:"Besondere Vorschrift",
    name:p.hafenname||"Uferregel",t:p.beschreibung||"Bedingungen vor Ort prüfen."})},
  {url:TGW("fischenzen"),map:p=>({id:"F"+p.objectid,art:"Privat",name:"Fischenz "+(p.gebietsname||""),t:p.gebietsbeschreibung||"",x:[p.fischereiregelung||""].filter(Boolean)})},
  {url:TGW("freiangelrecht"),map:p=>({id:"A"+p.objectid,art:"Frei",name:p.gewaessername||"Freiangelrecht",t:p.beschreibung||"",x:["Freiangelrecht nach kantonaler Regelung."]})}]}
};
const AQ=(base,id,off)=>b=>`${base}${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&maxAllowableOffset=${off||0.00005}`+(b?`&geometry=${b.w},${b.s},${b.e},${b.n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`:"");
const xUrl=(u,host)=>{u=String(u||"").trim();return u.startsWith("https://"+host+"/")?u:null};
const BEB="https://www.geoservice.apps.be.ch/geoservice3/rest/services/a42geo/of_inlandwaters01_de_ms_wfs/MapServer/";
const BEP=p=>({id:"L"+p.PACHT_CODE,art:"Pacht",name:p.PACHT_NAME||"Pachtgewässer",t:"",x:["Fischen nur mit Bewilligung des Pächters."],url:xUrl(p.URL,"geofiles.be.ch")});
const VSB="https://services1.arcgis.com/rMlsWo8szOzlrpCq/arcgis/rest/services/Peche/FeatureServer/";
const FRB="https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_faune_chasse_peche/MapServer/";
Object.assign(XSRC,{
 BE:{attr:"Angelfischerei © Kanton Bern",layers:[
  {url:AQ(BEB,17187),map:p=>({id:"P"+p.GEW_CODE,art:"Patent",name:p.PATFLNT_NAME_DE||"Patentgewässer",t:p.PATFLBT_BESCHR_DE||"",url:xUrl(p.URL_DE,"geofiles.be.ch")})},
  {url:AQ(BEB,17188),map:p=>({id:"PS"+p.GEW_CODE,art:"Patent",name:p.PATSTNT_NAME_DE||"Patentgewässer",t:[p.PATSTYPT_TYP_DE,p.PATSTBT_BESCHR_DE].filter(Boolean).join(": "),url:xUrl(p.URL_DE,"geofiles.be.ch")})},
  {url:AQ(BEB,17184),map:BEP},{url:AQ(BEB,17185),map:BEP},
  {url:AQ(BEB,17189),map:p=>({id:"S"+p.SG_CODE,art:"Schon",name:"Schongebiet "+String(p.SCHONNT_NAME_DE||"").trim()+" "+(p.SG_CODE||""),t:p.SCHONBT_BESCHR_DE||"",url:xUrl(p.URL,"geofiles.be.ch")})}]},
 VS:{attr:"Fischereikarte © Kanton Wallis",layers:[
  {url:AQ(VSB,2,0.0001),map:p=>{const c=p.COULEUR,s=c===3||c===10;return{id:"R"+p.OBJECTID,art:s?"Schon":[5,7,8,9].includes(c)?"Besondere Vorschrift":[0,1,2,4].includes(c)?"Patent":"Unbekannt",name:p.NOM||"Fliessgewässer",t:p.TEXT_DE||"",cw:[2,5,7].includes(c)?"berg":"rhone",
    x:[{0:"Fluss der Ebene",1:"Rhône",2:"Bergfluss",3:"Reservat – Fischen verboten",4:"Kanal",5:"Obere Rhône",7:"Bergfluss mit Teilreservat – Sonderregeln beachten",8:"Kanal mit Teilreservat – Sonderregeln beachten",9:"Fluss der Ebene mit Teilreservat – Sonderregeln beachten",10:"Vorläufig für die Fischerei gesperrt"}[c]].filter(Boolean)}}},
  {url:AQ(VSB,3,0.0001),map:p=>{const c=p.TYPE;return{id:"L"+p.OBJECTID,art:c===8?"Schon":c===11?"Pacht":c===7?"Besondere Vorschrift":[0,9,10].includes(c)?"Patent":"Unbekannt",name:p.NOM||"See",t:p.TEXT_DE||"",cw:c===0||c===7?"bergsee":"",
    x:[{0:"Bergsee",7:"Bergsee mit Teilreservat – Sonderregeln beachten",8:"Reservat – Fischen verboten",9:"See der Ebene",10:"Tümpel (Gouille)",11:"Verpachteter See"}[c]].filter(Boolean)}}}]},
 FR:{attr:"Pêche à permis © Etat de Fribourg",layers:[
  {url:AQ(FRB,22),map:p=>{const v=String(p.TYPE_VALEUR||"");
    const art=/^Ouvert/.test(v)?"Patent":/temporaire/i.test(v)?"Besondere Vorschrift":/réserve totale/i.test(v)?"Schon":"Unbekannt";
    return{id:"C"+p.OBJECTID,art,name:p.NOM||"Fliessgewässer",t:"",
      x:[{Patent:"Im kantonalen Register als Patentgewässer geführt. Saison und Berechtigung prüfen.",
        "Besondere Vorschrift":"Zeitweiliges Schongebiet. Geltungszeit gemäss kantonaler Verordnung prüfen.",
        Schon:"Ganzjähriges Schongebiet (réserve totale).",Unbekannt:"Berechtigung ungeklärt."}[art]]}}},
  {url:AQ(FRB,23),map:p=>({id:"L"+p.OBJECTID,
    art:p.PECHE_VALEUR==="Ouvert à la pêche"?"Patent":p.PECHE_VALEUR==="Concordat intercantonal"?"Seekonkordat":"Unbekannt",
    name:p.NOM||"See",t:"",x:[]})},
  {url:AQ(FRB,29),map:p=>({id:"A"+p.OBJECTID,art:"Pacht",name:"Pachtlos "+(p.NOM||""),t:"",x:["Verpachtetes Gewässer – nicht mit dem Patent befischbar."]})}]},

});
const VDB="https://www.ogc.vd.ch/public/rest/services/OGC/wmsVD/MapServer/";
const genevaSectors="https://app2.ge.ch/tergeoservices/rest/services/Hosted/LCE_SECTEURS_PECHE/FeatureServer/";
const GLZ={"1mai_30sept":"1. Mai bis 30. September","1apr_30sept":"1. April bis 30. September","15mai_30sept":"15. Mai bis 30. September","1mai_31dez":"1. Mai bis 31. Dezember","1apr_31dez":"1. April bis 31. Dezember"};
const glSeason={"1mai_30sept":[501,930],"1apr_30sept":[401,930],"15mai_30sept":[515,930],
  "1mai_31dez":[501,1231],"1apr_31dez":[401,1231]};
Object.assign(XSRC,{
 NW:{attr:"Private Fischenzen © Kanton Nidwalden / GIS Daten AG",layers:[{
  url:()=>"https://www.gis-daten.ch/svc/rest/services/gis_fach/nw_natur_ls_jagd_fischerei/MapServer/1/query?where=1%3D1&outFields=Nr,Recht,Name_der_Fischenze,Gebiet,Ausdehnung_in_See,OBJECTID&outSR=4326&f=geojson",
  map:p=>({id:"NW"+p.Nr,art:p.Recht==="Ausschliessliches Fischereirecht zum Fischfang"?"Privat":"Besondere Vorschrift",
    name:p.Name_der_Fischenze||"Fischenz "+p.Nr,t:p.Recht||"Privates Sonderrecht",x:[p.Gebiet].filter(Boolean)})}]},
 GE:{attr:"Secteurs de pêche © Etat de Genève (SITG)",layers:[{url:AQ(genevaSectors,0),
  map:p=>{const name=(p.secteur||"").split(":")[0].trim(),pond=name==="Etang / biotope",n=Number(p.no_secteur);
    // The numbered sector layer also includes biotopes and unlisted tributaries.
    // Match the separate cantonal list of fishing waters and its active reserve.
    const river=n>=1&&n<=28||[31,32,33].includes(n)||name==="Le Rhône"&&[300,301,400,401].includes(n);
    const activeReserve=n===9&&/Allondon/i.test(name);
    const pondName=p.limite_amont||"";
    const listedPond=pond&&["Etang de Richelien","Etang de la Touvière","Etang des Bouvières"].includes(pondName);
    return {id:"GE"+p.objectid,art:activeReserve?"Besondere Vorschrift":"Revier",name:pond?(pondName||name):(name||"Fischereisektor"),
      t:"Secteur "+p.no_secteur,permitSector:activeReserve?"reserve":river?"river":listedPond?"pond":undefined,cantonalFootprint:n===100||undefined,
      x:[p.limite_amont,p.limite_aval].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i),
      url:"https://www.ge.ch/permis-peche/pecher-geneve-repeuplement-etangs"};}}]},
 GL:{attr:"Fischereigewässer © Kanton Glarus",layers:[{url:()=>"https://wfs.geo.gl.ch/?service=WFS&version=1.1.0&request=GetFeature&typeName=ch.gl.inlandwaters.fischereigewaesser&outputFormat=geojson&srsName=EPSG:4326",
  map:p=>{const z=p.fangzeiten;return{id:"G"+p.t_ili_tid,art:z==="verbot"?"Schon":GLZ[z]?"Patent":"Unbekannt",name:p.gewaesser_name||"Gewässer",t:"",season:glSeason[z],x:[z==="verbot"?"Fangverbot":GLZ[z]?"Fangzeit: "+GLZ[z]:""].filter(Boolean)}}}]},
 SH:{attr:"Fischereireviere © Kanton Schaffhausen",layers:[{url:()=>"https://wfs.geo.sh.ch/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=sh.administrative_einteilungen.fischereireviere&outputFormat=application/json&srsName=EPSG:4326",
  map:p=>{const v=/verbot/i.test(p.name||"");return{id:"R"+p.uuid,art:v?"Schon":"Revier",name:p.name||"Fischereirevier",t:p.bemerkung&&p.bemerkung!=="null"?p.bemerkung:"",x:[v?"Fischereiverbot":"Fischereirevier am Rhein – Berechtigung gemäss kantonaler Regelung."]}}}]},
 VD:{attr:"Carte de pêche © Etat de Vaud",layers:[
  {url:AQ(VDB,193),map:p=>({id:"C"+p.OBJECTID,art:"Unbekannt",name:p.NOM||"Fliessgewässer",t:p.NOMBV||"",x:["Fischgewässer gemäss kantonaler Fischereikarte"]})},
  {url:AQ(VDB,196),map:p=>({id:"E"+p.OBJECTID,art:"Unbekannt",name:p.NOM||"See oder Weiher",t:"",x:["Kleiner See oder Weiher gemäss kantonaler Fischereikarte"]})},
  {url:AQ(VDB,197),map:p=>({id:"F"+p.OBJECTID,art:"Frei",name:"Freie Strecke "+(p.NOMPARCOURSLIBRE||""),t:p.DEFINITION||"",x:["Parcours libre: Fischen ohne Patent nach kantonaler Regelung."]})},
  {url:AQ(VDB,194),map:p=>({id:"S"+p.OBJECTID,art:"Schon",name:"Schongebiet "+(p.NOMRIVIERE||"")+(p.NORESERVE?" (Nr. "+p.NORESERVE+")":""),t:p.DEFINITION||"",x:["Réserve de pêche – Fischen verboten"]})}]}
});

// Ticino: Geobasisdaten TI-035.1 (settori di pesca) and AC-064.1 (zone di protezione ittica).
// River sectors (8000+ lines) are not loaded: running waters follow the cantonal season on the
// water network. Lakes Verbano and Ceresio are drawn by the national lake layer.
const TIW=(layer,filter)=>()=>"https://wfs.geo.ti.ch/service?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME="+layer+
  "&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json"+(filter?"&FILTER="+encodeURIComponent(filter):"");
const tiZone=(want)=>p=>{
  const type=String(p.tipologia_corta||"");
  const river=/corsi d'acqua/i.test(type),lake=/laghi/i.test(type),temp=/temporanee/i.test(type);
  if(!(want==="line"?river:(lake||temp)))return null;
  const since=String(p.in_vigore_dal||"").slice(0,10);
  return {id:"Z"+p.ogc_fid,art:temp?"Besondere Vorschrift":"Schon",name:p.nome_zona_protezione||"Zona di protezione",
    t:p.descrizione||"",closedPeriod:temp?[401,531]:undefined,
    x:[temp?"Zander-Schutzzone: Fischen vom 1.4. bis 31.5. verboten":"Fischen verboten (Schutzzone)",
       since?"In Kraft seit "+since.split("-").reverse().join("."):"",p.osservazioni||""].filter(Boolean),
    url:xUrl(p.url_decreto,"www3.ti.ch")};
};
Object.assign(XSRC,{
 TI:{attr:"Settori e zone di protezione pesca © Cantone Ticino",live:true,layers:[
  {url:TIW("ac_064_1_v1_0_zone_protezione_ittica_linee"),map:tiZone("line")},
  {url:TIW("ac_064_1_v1_0_zone_protezione_ittica_poligoni"),map:tiZone("area")},
  {url:TIW("ti_035_1_v1_0_settori_pesca_settori",'<Filter xmlns="http://www.opengis.net/ogc"><Or><PropertyIsEqualTo><PropertyName>tipo_alias</PropertyName><Literal>Lago alpino</Literal></PropertyIsEqualTo><PropertyIsEqualTo><PropertyName>tipo_alias</PropertyName><Literal>Diritto privato</Literal></PropertyIsEqualTo></Or></Filter>'),
   map:p=>{const priv=p.tipo_alias==="Diritto privato";const name=(p.alias&&p.alias!=="null"?p.alias:p.nome)||"Lago";
    return {id:"S"+p.ogc_fid,art:priv?"Privat":"Patent",name,t:"Settore "+(p.codice||""),cw:priv?undefined:"alpin",
      x:[priv?(p.osservazioni||"Privates Fischereirecht: kantonales Patent gilt hier nicht."):"Alpensee: Fangzeit gemäss kantonaler Saison für Seen über 1200 m"].filter(Boolean)}}}]}
});

async function westFeatures(url){
  const read=async u=>{
    const r=await fetch(u,{signal:AbortSignal.timeout(18000)});
    if(!r.ok)throw Error("Geodienst "+r.status);
    return r.json();
  };
  const data=await read(url);
  if(data.type!=="FeatureCollection"||!Array.isArray(data.features))throw Error("Ungültige Geodaten");
  if(!data.exceededTransferLimit&&!data.properties?.exceededTransferLimit)return data;
  const idsUrl=new URL(url);
  idsUrl.searchParams.set("returnIdsOnly","true");idsUrl.searchParams.set("f","json");
  const {objectIds}=await read(idsUrl);
  if(!Array.isArray(objectIds))throw Error("Teilantwort des Geodienstes");
  const result=[];
  for(let i=0;i<objectIds.length;i+=200){
    const page=new URL(url);
    page.searchParams.set("objectIds",objectIds.slice(i,i+200).join(","));
    const fc=await read(page);
    if(!Array.isArray(fc.features))throw Error("Unvollständige Geodaten");
    result.push(...fc.features);
  }
  if(result.length!==objectIds.length)throw Error("Unvollständige Geodaten");
  return {features:result};
}

const swissTimeFormat=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});
function swissFishingTime(instant){
  const o=Object.fromEntries(swissTimeFormat.formatToParts(instant).map(p=>[p.type,p.value]));
  const hour=Number(o.hour),summer=(hour-instant.getUTCHours()+24)%24===2;
  return {date:[o.year,o.month,o.day].join("-"),ordinal:Number(o.month)*100+Number(o.day),hour,summer,
    glNight:summer?hour<4||hour>=23:hour<6||hour>=20};
}
function periodContains(period,day){const [from,to]=period;return from<=to?day>=from&&day<=to:day>=from||day<=to}
function fisheryPeriod(c,f,time){
  if(f.closedPeriod&&periodContains(f.closedPeriod,time.ordinal))return "closed";
  if(!f.season||f.art!=="Patent")return null;
  if(!periodContains(f.season,time.ordinal))return "closed";
  if(c==="GL"&&time.glNight)return "night";
  return "open";
}
if(typeof module!=="undefined"&&module.exports)module.exports={XSRC,XBOX,westFeatures,swissFishingTime,fisheryPeriod,juraKind};
