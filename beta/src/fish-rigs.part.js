/* Kurze Montagen: in die App eingebettet, auch ohne Netz verfügbar.
   Startwerte für die Ausrüstung, keine Bestätigung einer Fischereiberechtigung. */
const FISH_RIGS={
  "Bachforelle":{name:"Eine Nymphe an der Fliegenrute",type:"fly",hook:"12–16",line:"Fertiges, gezogenes Fliegenvorfach mit 0,18–0,22 mm Spitze",gear:"Fliegenrute mit passender Schnur; eine beschwerte Nymphe",bait:"Nymphe",use:"Kurze Würfe schräg stromauf. Die Nymphe ohne Zug in die tiefere Rinne treiben lassen; bei einem Stopp der Schnur kurz die Rute heben.",tip:"Zuerst die nahe Strömungskante befischen. Gewicht so wählen, dass die Nymphe sinkt und selten hängen bleibt."},
  "Regenbogenforelle":{name:"Kleiner Spoon am Einzelhaken",type:"spoon",hook:"6–8",line:"0,20–0,25 mm monofile Schnur",gear:"Spoon 2–5 g mit einem Einzelhaken; kleiner Wirbel mit Karabiner",bait:"Spoon",use:"Auswerfen, kurz absinken lassen und langsam einholen. Nach einigen Würfen die Absinkzeit ändern, um eine andere Tiefe abzusuchen.",tip:"Der Löffel soll seitlich spielen. Dreht er sich um die eigene Achse, langsamer kurbeln."},
  "Seeforelle":{name:"Schlanker Blinker vom Ufer",type:"spoon",hook:"1–2",line:"0,28–0,33 mm monofile Schnur",gear:"Schlanker Blinker 12–25 g; Wirbel mit Karabiner",bait:"Blinker",use:"Fächerförmig werfen, unterschiedlich lange absinken lassen und zügig mit kurzen Pausen führen. Freie, steinige Ufer und Kanten absuchen.",tip:"Zuerst den Uferbereich abfischen. Rute und Schnur müssen zum Wurfgewicht passen."},
  "Saibling":{name:"Kleiner Gummifisch am Jig",type:"jig",hook:"4–6",line:"0,22–0,25 mm monofile Schnur",gear:"3–5 cm Gummifisch; bleifreier Jigkopf 3–7 g",bait:"Gummifisch",use:"Absinken lassen, den Köder mit kleinen Hüben führen und wieder kontrolliert sinken lassen. Kühle, tiefere Kanten absuchen.",tip:"Nur so viel Gewicht wie nötig verwenden. Dauerndes Schleifen über Steine führt zu Hängern."},
  "Äsche":{name:"Eine kleine Nymphe",type:"fly",hook:"14–18",line:"Fertiges, gezogenes Fliegenvorfach mit 0,14–0,18 mm Spitze",gear:"Leichte Fliegenrute; eine kleine Nymphe mit Tungstenkopf",bait:"Nymphe",use:"Schräg stromauf werfen und die Nymphe mit der Strömung treiben lassen. Schnurkontakt halten; beim kurzen Stoppen sanft anheben.",tip:"Bei steigenden Fischen die Nymphe durch eine einzelne Trockenfliege ersetzen. Laichplätze nicht betreten."},
  "Hecht":{name:"Gummifisch mit Stahlvorfach",type:"pike",hook:"3/0–5/0",line:"Geflochtene Hauptschnur und fertiges Stahl- oder Titanvorfach, jeweils mindestens 12 kg Tragkraft",gear:"40–50 cm bissfestes Vorfach; 12–18 cm Gummifisch am passenden Einzel-Jighaken",bait:"Gummifisch",use:"An Krautkanten gleichmässig einholen, dazwischen kurz sinken lassen. Vor dem Ufer die Rutenspitze anheben und den Köder ausführen.",tip:"Stahl oder Titan schützt vor Hechtzähnen. Den Köder ohne zusätzlichen Stinger oder Drilling montieren; Vorfach nach jedem Fisch prüfen."},
  "Zander":{name:"Gummifisch über Grund",type:"zander",hook:"1/0–3/0",line:"Geflochtene Hauptschnur, etwa 7–10 kg; fertiges 60–80 cm Abriebvorfach mit Wirbel und Karabiner",gear:"8–12 cm Gummifisch; bleifreier Jigkopf 7–15 g. Bei Hechtvorkommen ein Stahlvorfach verwenden",bait:"Gummifisch",use:"Bis zum Grund sinken lassen. Mit ein bis zwei Kurbelumdrehungen anheben, an leicht gespannter Schnur wieder sinken lassen und auf ein kurzes Ticken achten.",tip:"Das Gewicht muss Grundkontakt erkennbar machen. Bei Strömung schwerer wählen, innerhalb des Wurfgewichts deiner Rute."},
  "Egli (Flussbarsch)":{name:"Dropshot mit kleinem Gummi",type:"drop",hook:"4–6",line:"0,22–0,28 mm monofile Schnur",gear:"5–8 cm Gummiköder; bleifreies Dropshotgewicht mit Klemmöse, etwa 5–12 g",bait:"Gummiköder",use:"Gewicht aufsetzen lassen und den Köder mit ganz kleinen Rutenspitzenbewegungen spielen lassen. Einige Sekunden pausieren, dann einen halben Meter versetzen.",tip:"30–50 cm zwischen Haken und Gewicht sind ein guter Start. Bei steilem Schnurwinkel schwebt der Köder höher über Grund als bei einem weiten Wurf."},
  "Felchen":{name:"Einzel-Nymphe am Laufzapfen",type:"nymph",hook:"14–16",line:"0,22–0,25 mm monofile Schnur",gear:"Klassischer Laufzapfen mit Stopper und Perle; eine Felchennymphe; passendes Endgewicht",bait:"Felchennymphe",use:"Tiefe ausloten und die einzelne Nymphe knapp über dem Boden anbieten. Den Zapfen ruhig stehen lassen; beim deutlichen Wegtauchen oder Anheben sanft anschlagen.",tip:"Eine einzelne Nymphe hält die Montage übersichtlich. Vor tiefen Würfen prüfen, ob der Stopper frei durch die Ringe läuft."},
  "Barbe":{name:"Grundmontage mit Laufgewicht",type:"bottom",hook:"6–8",line:"0,30–0,35 mm Mono; 60–80 cm Vorfach aus 0,25–0,28 mm Mono",gear:"Bleifreies Laufgewicht etwa 30–60 g; weiche Perle; Wirbel",bait:"Wurm",use:"Schräg stromab an eine kiesige Strömungsrinne werfen. Gewicht setzen lassen, Schnur leicht spannen und die Rutenspitze beobachten. Bei einem deutlichen Zug aufnehmen.",tip:"Nur so schwer fischen, dass die Montage liegen bleibt. Rute beaufsichtigen und Bremse auf den kräftigen ersten Zug einstellen."},
  "Alet":{name:"Wurm am Treibzapfen",type:"float",hook:"6–10",line:"0,22–0,25 mm monofile Schnur",gear:"Feststellzapfen 2–4 g; Silikonschläuche; bleifreie Klemmgewichte",bait:"Wurm",use:"Den Zapfen an der Strömungskante kontrolliert abtreiben lassen. Tiefe so einstellen, dass der Köder knapp über Grund zieht. Beim Wegtauchen kurz anheben.",tip:"Mit Abstand vom Ufer beginnen. Alet reagieren oft auf Schatten und Schritte."},
  "Rotauge":{name:"Feiner Zapfen mit Maden",type:"float",hook:"12–16",line:"0,16–0,20 mm monofile Schnur",gear:"Feststellzapfen 1–2 g; Silikonschläuche; kleine bleifreie Klemmgewichte",bait:"Ein bis zwei Maden",use:"Ruhige Uferzone ausloten und den Köder knapp über Grund anbieten. Bei seitlichem Wegziehen oder Abtauchen des Zapfens kurz anheben.",tip:"Nur die Zapfenspitze soll sichtbar bleiben. Kleine Köder zeigen vorsichtige Bisse besser."},
  "Brachsmen":{name:"Feine Grundmontage",type:"bottom",hook:"8–12",line:"0,25 mm Mono; 50–70 cm Vorfach aus 0,20–0,22 mm Mono",gear:"Bleifreies Laufgewicht etwa 15–30 g; weiche Perle; Wirbel",bait:"Kleiner Wurm",use:"Eine ruhige Kante neben tieferem Wasser befischen. Leicht gespannte Schnur und eine sensible Rutenspitze zeigen auch Bisse, bei denen die Schnur erschlafft.",tip:"Auf weichem Boden ein breites, leichtes Gewicht wählen. Der Köder soll erreichbar aufliegen."},
  "Karpfen":{name:"Einfache Laufmontage",type:"bottom",hook:"6–8",line:"0,30–0,35 mm Mono; 40–60 cm Vorfach aus 0,28–0,30 mm Mono",gear:"Bleifreies Laufgewicht etwa 20–40 g; weiche Perle; kräftiger Wirbel",bait:"Ein bis zwei weiche Maiskörner",corn:true,use:"Am Rand einer freien Bodenstelle ablegen. Schnur leicht spannen, Rute beaufsichtigen und beim anhaltenden Zug aufnehmen.",tip:"Keine feste Sperre oberhalb des Laufgewichts setzen: Bei Schnurbruch muss es abgleiten können. Einen ausreichend grossen Kescher bereitlegen."},
  "Schleie":{name:"Wurm am feinen Zapfen",type:"float",hook:"8–10",line:"0,22–0,28 mm monofile Schnur",gear:"Feststellzapfen 2–4 g; Silikonschläuche; bleifreie Klemmgewichte",bait:"Kleiner Wurm",use:"Eine Lücke am Pflanzenrand ausloten. Der Köder darf den Grund gerade berühren. Beim deutlichen Wandern oder Abtauchen des Zapfens aufnehmen.",tip:"Nah und ruhig fischen. Den Köder nicht tief in dichte Pflanzen werfen, damit der Fisch sicher gelandet werden kann."},
  "Wels":{name:"Kräftige Spinnmontage",type:"catfish",hook:"Passender, verstärkter Einzel-Jighaken",line:"Welsgeeignete geflochtene Hauptschnur und fertig montiertes Abriebvorfach mit mindestens 40 kg Tragkraft",gear:"Kräftige Welsrute und Rolle; 15–20 cm Gummifisch; belastbarer Karabiner",bait:"Gummifisch",use:"Tiefe Kanten mit langsamer, gleichmässiger Führung absuchen. Gewicht an Tiefe und Strömung anpassen; Schnurkontakt halten.",tip:"Vor dem ersten Wurf einen sicheren Landeplatz und passende Landeausrüstung festlegen. Die gesamte Montage muss für grosse Welse ausgelegt sein."}
};
const RIG_KNOTS={
  clinch:{name:"Verbesserter Clinch",for:"Für dünne monofile Schnur an Haken, Wirbel oder Öse.",steps:[
    "Etwa 15 cm Schnur durch das Hakenöhr oder die Öse des Wirbels stecken. Dieses freie Ende wird jetzt um die lange Schnur geführt.",
    "Das freie Ende fünfmal um die lange Schnur wickeln. Alle Windungen liegen in derselben Richtung nebeneinander.",
    "Das Ende durch die kleine Schlaufe direkt an der Öse zurückführen, danach durch die gerade entstandene grosse Schlaufe.",
    "Anfeuchten, die Windungen ordnen und langsam anziehen. Mit einem Zug prüfen; etwa 3 mm Ende stehen lassen."
  ],url:"https://www.animatedknots.com/improved-clinch-knot"},
  palomar:{name:"Palomar",for:"Für Hauptschnur an Wirbel oder Haken; auch für geflochtene Schnur.",steps:[
    "Schnur doppelt legen und die Schlaufe durch die Öse führen. Für Montagen mit Endgewicht ein langes Ende für den Abstand zum Gewicht lassen.",
    "Mit der doppelten Schnur einen lockeren Überhandknoten bilden: eine Schlaufe legen und die doppelte Schnur hindurchführen. Noch nicht zuziehen.",
    "Die grosse Schlaufe über den ganzen Haken oder Wirbel legen und bis über das Öhr führen.",
    "Anfeuchten, beide Stränge ordnen und gleichmässig festziehen. Mit einem Zug prüfen; etwa 3 mm Ende stehen lassen."
  ],url:"https://www.animatedknots.com/palomar-knot"},
  loop:{name:"Schlaufe in Schlaufe",for:"Für ein fertiges Fliegenvorfach und eine Fliegenschnur mit intakten Schlaufen.",steps:[
    "Die Schlaufe der Fliegenschnur durch die Schlaufe des Vorfachs schieben.",
    "Das ganze freie Vorfachende durch die Schlaufe der Fliegenschnur führen.",
    "Beide Schnüre auseinanderziehen, bis sich die Schlaufen sauber verschränken. Verbindung mit leichtem Zug prüfen."
  ],url:"https://www.netknots.com/fishing_knots/loop-to-loop-knot"}
};
const RIG_SOURCES={
  SO:["Fischereivorschriften Solothurn 2026","https://so.ch/fileadmin/internet/vwd/vwd-awjf-jagd/pdf/Fischerei/Broschuere_Auszug_aus_den_Fischereivorschriften__ab_01.03.2026.pdf"],
  SG:["St. Gallen · Art. 9–10","https://www.gesetzessammlung.sg.ch/api/de/versions/3883/pdf_file_with_annexes"],
  SH:["Schaffhausen · §§ 30–31","https://rechtsbuch.sh.ch/app/de/texts_of_law/923.101"],
  SZ:["Schwyz · §§ 5–7","https://www.sz.ch/public/upload/assets/63104/Ausfuehrungsbestimmungen_fuer_die_Angelfischerei_in_Fliessgewaessern.pdf"]
};
function rigTraits(rig){return {
  natural:["bottom","float"].includes(rig.type),
  moving:!["bottom","float"].includes(rig.type),
  fishLure:["spoon","jig","drop","pike","zander","catfish"].includes(rig.type),
  bottom:["bottom","drop","nymph"].includes(rig.type)
};}
// Pure assessment: missing data never becomes an affirmative permission.
function rigAssessment(rig,c){
  const t=rigTraits(rig),out={title:"Vor dem Auswerfen",level:"note",lines:[],hook:rig.hook,bait:rig.bait,blocked:false};
  const warn=text=>{out.lines.push(text);if(out.level==="note")out.level="warn";};
  const block=(title,text)=>{if(!out.blocked)out.title=title;out.level="bad";out.blocked=true;out.lines.push(text);};
  if(c.protected)block("Hier geschützt","Diese Art hier nicht gezielt befischen.");
  else if(c.closed)block("Gewässer aktuell gesperrt",c.closed);
  else if(c.season){out.title="Hier ist Schonzeit";out.level="bad";out.lines.push("Jetzt nur vorbereiten: "+c.season+". Während der Schonzeit diese Art nicht gezielt befischen.");}
  if(c.unknown)warn("Gewässer und Berechtigung noch prüfen. Die Anleitung allein bestätigt keine Erlaubnis.");
  else if(c.accessWarning)warn(c.accessWarning);
  const local=c.local||"",name=c.name||"",szStream=c.canton==="SZ"&&["sihl","fluss"].includes(c.water);
  if(t.natural&&/naturk[oö]derverbot|nur\s+(k[uü]nstliche|kunstk[oö]der)/i.test(local))
    block("Hier andere Köder wählen","Für diesen Abschnitt ist ein Naturköderverbot kartiert. Diese Naturködermontage hier nicht einsetzen.");
  if(rig.type!=="fly"&&/fliegenstrecke|nur\s+fliegenfisch/i.test(local))
    block("Hier nur Fliegenfischen","Diese Montage passt nicht zur kartierten Fliegenstrecke.");
  if(szStream){
    if(rig.type!=="fly"){
      if(["pike","zander","catfish"].includes(rig.type))
        block("Hakengrösse hier eingeschränkt","Diese Montage benötigt grössere Haken. Bei der Bachfischerei in Schwyz sind für diese Angelmethode nur die Grössen 1–6 gemäss Patent vorgesehen.");
      else if(rig.hook!=="1–2")out.hook="6 · gemäss Grössenabbildung auf dem SZ-Patent";
      if(rig.corn)out.bait="Wurm";
      warn("Bachfischerei SZ: Einzelhaken Grösse 1–6, ohne Widerhaken. Rute in der Hand behalten.");
    }
    if(c.water==="sihl"&&rig.type!=="fly")warn("Alp oberhalb der Brücke beim Bahnhof Einsiedeln und alte Sihl bis zur Alp: nur Fliegenfischen. Genaue Strecke vor dem Einsatz prüfen.");
  }
  if(c.canton==="AI"&&rig.type!=="fly"&&/schwende/i.test(name))
    warn("Schwendebach: Zwischen Brücke Blüemlisalp und Sitter liegt eine Fliegenstrecke. Diese Montage dort nicht verwenden.");
  if(c.canton==="SG"&&c.troutSeason&&(t.bottom||t.fishLure)){
    if(c.water==="alpenrhein"||c.water==="uebrige"&&c.flowing===true)
      block("Methode während der Schonzeit gesperrt","In diesem Fliessgewässer sind während der Forellenschonzeit Grundfischerei, Löffel, Spinner und künstliche oder natürliche Köderfische untersagt.");
    else if(!["bodensee","zuerichsee","walensee","linth"].includes(c.water))
      warn("In St. Galler Fliessgewässern während der Forellenschonzeit: keine Grundfischerei, Löffel, Spinner oder Köderfische. Gewässerart und Sonderregeln prüfen.");
  }
  if(c.canton==="SH"&&t.moving){
    if(c.patent)block("Für die Patentfischerei ungeeignet","In Schaffhausen sind bei der Patentfischerei bewegte Kunstköder und Spinnfischen untersagt.");
    else warn("Schaffhausen: Bewegte Kunstköder sind bei der Patentfischerei verboten. In Pachtgewässern während der Forellenschonzeit nur zum Hechtfang einsetzen.");
    if(c.troutSeason&&c.lease&&c.species!=="Hecht")block("Methode während der Schonzeit gesperrt","In Schaffhauser Pachtgewässern sind bewegte Kunstköder während der Forellenschonzeit dem Hechtfang vorbehalten.");
  }
  if(!out.lines.length)out.lines.push("Passendes Patent oder Reviererlaubnis und örtliche Köderregeln beachten.");
  return out;
}
function currentRigContext(sp){
  const sec=currentSec(),rule=ruleFor(sec,sp),trout=ruleFor(sec,"Bachforelle"),now=new Date(),hit=currentConfirmed();
  const activeSeason=r=>[r.schon,r.schon2].find(s=>s&&inRange(now,s[0],s[1]));
  const season=activeSeason(rule),closed=secStatus(sec,now).find(r=>r.lvl==="bad"),water=hereSummary();
  const hits=hit?[hit,...(isAuto()?autoWater.hits:hit.choiceHits||[])]:[];
  // Only the chosen section and truly overlapping conditions count; a nearby separate water does not.
  const local=hits.filter(h=>h===hit||Math.abs((h.d||0)-(hit.d||0))<=8).map(h=>h.kind||"").join(" · ");
  const name=selectedWaterName()||sec.name||cname(state.canton);
  const flowing=hit?.area===false||hit?.water?.lake===false?true:hit?.area===true||hit?.water?.lake===true?false:undefined;
  return {canton:state.canton,water:sec.id,name,label:ctxLabel(),species:sp,local,flowing,
    protected:!!rule.prot,season:season?fmtR(season):"",troutSeason:!!activeSeason(trout),
    closed:closed?.txt||(water.cls==="bad"?water.s:""),
    unknown:unknownWater()||!sec.id||!!(rule.chk||rule.national||rule.pickW)||!RULES[state.canton]?.updated,
    accessWarning:water.cls==="warn"?water.s:"",patent:/patent/i.test(local)||sec.kind==="patent",lease:/pacht/i.test(local)||sec.kind==="pacht"};
}
function rigBuild(rig,assessment){
  const bait=assessment.bait;
  if(rig.type==="bottom")return {chain:["Schnur","Laufgewicht","Perle","Wirbel","Vorfach","Haken"],knots:["clinch"],steps:[
    "Laufgewicht frei gleitend auf die Hauptschnur ziehen, danach die weiche Perle. Oberhalb des Gewichts keinen festen Stopper setzen.",
    "Wirbel an die Hauptschnur knoten. Das Vorfach am freien Wirbelöhr und den Einzelhaken am Vorfach befestigen.",
    bait+" aufziehen, Hakenspitze frei lassen. Prüfen, ob die Schnur ungehindert durch das Gewicht läuft."
  ]};
  if(rig.type==="float")return {chain:["Schnur","Feststellzapfen","Klemmgewichte","Haken"],knots:["clinch"],steps:[
    "Zapfen mit den passenden Silikonschläuchen verschiebbar auf der Schnur befestigen. Einzelhaken ans Schnurende knoten.",
    "Klemmgewichte schonend auf der Schnur verteilen, das letzte etwa 20 cm über dem Haken. So ausbalancieren, dass nur die Zapfenspitze herausragt.",
    "Mit einem Lotgewicht am Haken die Tiefe messen und es wieder entfernen. Zapfen einstellen, "+bait.toLowerCase()+" aufziehen und die Hakenspitze frei lassen."
  ]};
  if(["drop","nymph"].includes(rig.type))return {chain:rig.type==="drop"?["Schnur","Haken","30–50 cm","Gewicht"]:["Schnur","Stopper + Perle","Laufzapfen","Nymphe","Gewicht"],knots:["palomar"],steps:[
    (rig.type==="nymph"?"Stopper, Perle und Laufzapfen aufziehen. ":"")+"Haken mit Palomar binden und 30–50 cm Schnur zum Gewicht stehen lassen. Das lange Ende nicht abschneiden.",
    "Das lange Ende nochmals von oben durch das Hakenöhr führen: Die Hakenspitze zeigt nach oben. Am Ende das passende Gewicht anklemmen.",
    rig.type==="drop"?"Gummiköder nur durch die Nase haken, damit er frei spielt. Die Hakenspitze bleibt offen.":"Eine widerhakenlose Felchennymphe verwenden. Gewicht und Zapfentragkraft aufeinander abstimmen; die Tiefe über den Stopper einstellen."
  ]};
  if(rig.type==="fly")return {chain:["Fliegenschnur","Schlaufenverbindung","Vorfach","Nymphe"],knots:["loop","clinch"],steps:[
    "Fertiges Vorfach mit seiner Schlaufe an die Schlaufe der passenden Fliegenschnur anschliessen.",
    "Eine einzelne widerhakenlose Nymphe mit verbessertem Clinch an die Vorfachspitze binden.",
    "Verbindungen mit leichtem Zug prüfen. Die Nymphe zuerst im nahen Wasser treiben lassen und Sinkverhalten sowie Schnurkontakt prüfen."
  ]};
  const leader=["pike","zander","catfish"].includes(rig.type),spoon=rig.type==="spoon";
  return {chain:leader?["Hauptschnur","Wirbel","Fertiges Vorfach","Karabiner","Köder"]:spoon?["Schnur","Wirbel + Karabiner","Blinker / Spoon"]:["Schnur","Jigkopf + Gummi"],knots:leader?["palomar"]:["clinch"],steps:[
    leader?"Die Hauptschnur mit Palomar an den oberen Wirbel des fertig montierten Vorfachs knoten. Das Vorfach selbst und seine Verbindungen unverändert lassen.":spoon?"Den kleinen Wirbel mit Karabiner an die Hauptschnur knoten. Den Spoon oder Blinker einhängen und den Karabiner schliessen.":"Jigkopf direkt an die monofile Schnur knoten.",
    spoon?"Einen Köder mit genau einem widerhakenlosen Einzelhaken verwenden. Vorhandene Drillinge durch einen passenden Einzelhaken ersetzen.":"Den Gummifisch gerade auf den Einzel-Jighaken ziehen. Die Hakenspitze muss frei liegen. "+(leader?"Jigkopf in den Karabiner hängen und diesen vollständig schliessen.":""),
    "Knoten, Haken und Verschluss kontrollieren. Kurz im nahen Wasser testen, ob der Köder sauber läuft; bei verdrehtem Lauf neu ausrichten."
  ]};
}
function rigGuideMarkup(sp){
  const rig=FISH_RIGS[sp];if(!rig)return "";
  return '<details class="rig-guide" data-rig="'+esc(sp)+'"><summary><span><small>Montage &amp; Knoten</small><strong>'+esc(rig.name)+'</strong></span></summary><div class="rig-body"></div></details>';
}
function rigList(items,tag="ol"){return '<'+tag+'>'+items.map(s=>'<li>'+esc(s)+'</li>').join("")+'</'+tag+'>';}
function patchRigHTML(el,html){if(el.rigHTML!==html){el.innerHTML=html;el.rigHTML=html;}}
function refreshRigGuide(guide){
  if(!guide?.open||!guide.closest(".fish")?.open)return;
  const sp=guide.dataset.rig,rig=FISH_RIGS[sp];if(!rig)return;
  const c=currentRigContext(sp),a=rigAssessment(rig,c),build=rigBuild(rig,a),body=guide.querySelector(".rig-body");
  if(!body.children.length){
    body.innerHTML='<div class="rig-rule"></div><div class="rig-howto"><p class="rig-hook">1 Einzelhaken · ohne Widerhaken</p><div class="rig-sketch"></div><h4>Material</h4><dl class="rig-material"></dl><p class="rig-small">Startwerte: Gewicht an Strömung, Tiefe und Wurfgewicht der Rute anpassen. Mono = monofile Angelschnur.</p><h4>In 3 Schritten</h4><div class="rig-steps"></div><h4>So führst du den Köder</h4><p>'+esc(rig.use)+'</p><div class="rig-tip">'+esc(rig.tip)+'</div><div class="rig-knots">'+build.knots.map(id=>knotGuideMarkup(id,rig)).join("")+'</div></div><details class="rig-regulations"><summary>Geräte-Regeln &amp; Quellen</summary><div class="rig-canton"></div></details>';
  }
  const note=a.level==="note";
  patchRigHTML(body.querySelector(".rig-rule"),'<div class="rig-context">'+esc(c.label)+'</div>'+(note?"":'<strong>'+esc(a.title)+'</strong>'+rigList(a.lines,"ul"))+'<button type="button" data-rig-rules>'+(note?"Gewässerregeln":"Gewässerregeln ansehen")+'</button>');
  const notice=body.querySelector(".rig-rule"),howto=body.querySelector(".rig-howto");
  if(notice.dataset.level!==a.level)notice.dataset.level=a.level;
  if(howto.hidden!==a.blocked)howto.hidden=a.blocked;
  patchRigHTML(body.querySelector(".rig-material"),'<dt>Schnur</dt><dd>'+esc(rig.line)+'</dd><dt>Haken</dt><dd>'+esc(a.hook)+' · ohne Widerhaken</dd><dt>Dazu</dt><dd>'+esc(rig.gear)+'</dd><dt>Köder</dt><dd>'+esc(a.bait)+'</dd>');
  patchRigHTML(body.querySelector(".rig-sketch"),rigSketch(rig,a,build));
  patchRigHTML(body.querySelector(".rig-steps"),rigList(build.steps));
  const r=RULES[c.canton]||{},notes=(r.notes||[]).filter(n=>/widerhaken|einzelhaken|mehrfachhaken|fangger[aä]te|naturk[oö]der|kunstköder|fliegenstrecke|fliegenfisch|spinnfisch|grundfisch|anf[uü]tter|freiangel/i.test(n));
  const sources=r.src?.length?r.src:(RIG_SOURCES[c.canton]?[RIG_SOURCES[c.canton]]:[]);
  patchRigHTML(body.querySelector(".rig-canton"),'<p class="rig-small">'+esc(cname(c.canton))+(r.updated?' · Regelstand '+esc(fmtD(r.updated)):" · Regelstand unbekannt")+'</p><p>Alle Anleitungen verwenden eine Rute mit einem Einzelhaken ohne Widerhaken. Auch Köder und Methode müssen zum Abschnitt und zu deiner Bewilligung passen.</p>'+rigList(notes.length?notes:["Zusätzliche Geräte- und Ködervorschriften in der Gewässerbewilligung prüfen."],"ul")+sources.filter(s=>/^https:\/\//.test(s[1])).map(s=>'<a class="rig-link" href="'+esc(s[1])+'" target="_blank" rel="noopener noreferrer">'+esc(s[0])+' ↗</a>').join(""));
}
