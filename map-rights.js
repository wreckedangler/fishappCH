/* Fishery rights describe a water or a section. They never establish today's
   opening, a person's licence, bank access or the absence of local closures. */
const FishRights=(()=>{
  const offices={
    AG:["Angeln im Aargau","https://www.ag.ch/de/themen/landwirtschaft-tiere/wild-wassertiere/fischerei/informationen-fuer-fischerinnen-und-fischer/angeln-im-kanton-aargau","Fischerkarten geben Pächter oder Inhaber des Fischereirechts für ihr Revier aus. Die Freianglerkarte gilt nur auf bezeichneten Strecken."],
    AI:["Fischereikarte und Patente AI","https://www.ai.ch/themen/natur-und-umwelt/fischerei","Die kantonale Fischereikarte bezeichnet Patentgewässer, Schongebiete und Strecken mit besonderen Fangmethoden."],
    AR:["Revierliste und Kartenbezug AR","https://ar.ch/verwaltung/departement-bau-und-volkswirtschaft/amt-fuer-umwelt/fischerei/fischen-in-appenzell-ausserrhoden/","Tages- und Jahreskarten gibt der jeweilige Revierpächter aus. Vier Grenzreviere werden von Nachbarkantonen verwaltet."],
    BE:["Patent- und Pachtgewässer Bern","https://www.weu.be.ch/de/start/themen/jagd-fischerei/fischerei.html","Das Berner Patent gilt an bezeichneten Patentgewässern. Für Pachtgewässer ist der Pächter zuständig. An drei grossen Seen gibt es eine Uferfreifischerei."],
    BL:["Fischereigesetz Basel-Landschaft · §§ 3–9","https://bl.clex.ch/data/530/de","In natürlichen Gewässern steht das Fischereirecht grundsätzlich der Einwohnergemeinde zu, vorbehaltlich Rechten Dritter. Bei künstlichen Gewässern ist der Eigentümer zuständig."],
    BS:["Fischereikarten und Sperrgebiete Basel-Stadt","https://www.bs.ch/wsu/aue/abteilung-gewaesser-und-boden/fischen-basel","Die Rheinkarte gibt das Amt für Umwelt und Energie aus. Für Wiese und Birs ist der Kantonale Fischerei-Verband zuständig."],
    FR:["Patente und Pachtlose Freiburg","https://www.fr.ch/energie-agriculture-et-environnement/faune-aquatique-et-faune-terrestre/section-faune-chasse-et-peche/peche","Freiburg unterscheidet Kantonsgewässer, Pachtlose, private Rechte sowie eigene Patente für Murten- und Neuenburgersee."],
    GE:["Permis de pêche Genf","https://www.ge.ch/permis-peche","Für Flüsse, den Genfersee und einzelne Weiher gelten unterschiedliche Ausweise. Nur ausdrücklich bezeichnete Weiher sind für die Fischerei geöffnet."],
    GL:["Fischereipatente Glarus","https://www.gl.ch/verwaltung/bau-und-umwelt/umwelt-wald-und-energie/jagd-und-fischerei/fischerei/fischereipatente.html/799","Patentkategorie und Fangzeit richten sich nach dem Gewässer. Für die Uferfischerei an Klöntalersee und Walensee gelten eigene Bedingungen."],
    GR:["Fischereivorschriften Graubünden","https://www.gr-lex.gr.ch/app/de/texts_of_law/760.155","Massgebend sind das Gewässerverzeichnis und die Karte der Sonderrechte und Schongewässer. Private Rechte sind separat geregelt."],
    JU:["Patent, Reglement und Fischereikarte Jura","https://www.jura.ch/fr/Autorites/Administration/DEC/ENV/Peche-et-faune-aquatique/Exercice-de-la-peche/Exercice-de-la-peche.html","Das jurassische Patent gilt auf den bezeichneten Strecken der amtlichen Karte. Aufzuchtstrecken und Reservate haben eigene Vorschriften."],
    LU:["Fischereikarte Luzern","https://map.geo.lu.ch/fauna/fischerei/","Die amtliche Karte unterscheidet Patentgebiete, verpachtete Reviere, private Fischenzen und Abschnitte ohne Patentausgabe."],
    NE:["See- und Flusspatente Neuenburg","https://www.ne.ch/themes/energie-et-environnement/faune/peche","Der Kanton führt getrennte Patente für den Neuenburgersee und die übrigen Staatsgewässer. Am Doubs gelten zusätzlich Grenzbestimmungen."],
    NW:["Fischereigesetz Nidwalden · Art. 3 und 6","https://gesetze.nw.ch/app/de/texts_of_law/842.1","Am Nidwaldner Teil des Vierwaldstättersees gelten Seepatent und bedingtes Uferfreiangelrecht. Die übrigen Gewässer werden verpachtet. Private Rechte bleiben vorbehalten."],
    OW:["Patent und Merkblatt Obwalden","https://www.ow.ch/dienstleistungen/2051","Der Kanton gibt Patente für seine Patentgewässer aus. Mehrere Seen haben eigene Ausgabestellen oder sind gesperrt."],
    SG:["Fischereipatente und Pachtreviere St. Gallen","https://www.sg.ch/umwelt-natur/jagd-fischerei/fischerei/fischereipatente.html","Für Patentgewässer gelten gewässerspezifische Ausweise. In Pachtrevieren entscheidet die Pächterschaft über Gastkarten."],
    SH:["Uferpatent und Revierkarte Schaffhausen","https://sh.ch/CMS/Webseite/Kanton-Schaffhausen/Beh-rde/Verwaltung/Departement-des-Innern/Jagd-und-Fischerei/Fischerei-1238041-DE.html","Das Rhein-Uferpatent gilt nur auf den bezeichneten Strecken und Uferseiten. Andere Reviere haben eigene Fischereirechte."],
    SO:["Patent und Revierinformationen Solothurn","https://so.ch/verwaltung/volkswirtschaftsdepartement/amt-fuer-wald-jagd-und-fischerei/fischerei/fischen-im-kanton-solothurn/","Das Kantonalpatent gilt in den bezeichneten Patentstrecken. Pächter und private Berechtigte regeln den Zugang zu ihren Revieren."],
    SZ:["Seepatente, Bachpatent und private Ausgabestellen Schwyz","https://www.sz.ch/verwaltung/umweltdepartement/amt-fuer-gewaesser/fischerei/fischerpatente.html/8756-8758-8802-9447-9450-10713-10826","Für bezeichnete Bäche gibt es das Bachpatent, für Seen eigene Patente. Das Freiangelrecht setzt eine Freiangelkarte voraus."],
    TG:["Freiangelei, Fischenzen und Karte Thurgau","https://jfv.tg.ch/fischerei/freiangelei.html/8656","Thurgis zeigt Freiangelstrecken, Fischenzen und örtliche Verbote. Die bezeichnete Uferseite und entgegenstehende private Rechte sind massgebend."],
    TI:["Patente und Geltungsbereiche Tessin","https://www4.ti.ch/dt/da/ucp/temi/pesca/per-saperne-di-piu/domande-frequenti/","Für öffentliche Gewässer braucht es eine Tessiner Lizenz. Kategorie 1 umfasst auch Flüsse und Bergseen, Kategorie 2 nur die Ufer des Verbano und Ceresio."],
    UR:["Fischereiverwaltung Uri · Patente und Merkblätter","https://www.ur.ch/raumumwelt/1328","Für Urner Patentgewässer gelten je nach Gewässer unterschiedliche Patentdauern. Privatgewässer und Schonstrecken sind ausgenommen."],
    VD:["Gewässer, Vorschriften und Patente Waadt","https://www.vd.ch/environnement/biodiversite-et-paysage/peche-1","Für Flüsse, kleine Seen und die grossen Konkordatsseen gelten unterschiedliche Patente. Freie Strecken und Reservate sind eigens bezeichnet."],
    VS:["Patente und Vorschriften Wallis","https://www.vs.ch/web/scpf/informations-concernant-le-permis-de-peche","Das Kantonspatent gilt für bezeichnete Gewässer. Pachtseen, Reservate und der Genfersee haben eigene Bestimmungen."],
    ZG:["Patentstellen und Gewässer Zug","https://zg.ch/de/natur-umwelt-tiere/wasser-und-gewaesser/fischen","Für Zugersee und Ägerisee gibt es getrennte Ausgabestellen. Die Fliessgewässer sind verpachtet oder in privatem Besitz."],
    ZH:["Patente, Pachtgesellschaften und private Rechte Zürich","https://www.zh.ch/de/umwelt-tiere/tiere/fischerei/wie-und-wo-fischen-im-kanton-zuerich.html","Je nach Abschnitt ist der Kanton, eine Pachtgesellschaft oder ein privater Rechtsinhaber zuständig. Für die Freiangelei sind die Geräte eingeschränkt."]
  };
  const official={
    agFree:["Aargauer Freianglerkarte und Streckengrenzen","https://www.ag.ch/de/themen/landwirtschaft-tiere/wild-wassertiere/fischerei/fischerei-im-kanton-aargau/freianglerrecht"],
    agRhine:["Karten für die Rheinreviere 1–4","https://www.ag.ch/de/themen/landwirtschaft-tiere/wild-wassertiere/fischerei/fischerei-im-kanton-aargau/revierkarten"],
    arList:["Amtliche Reviergrenzen AR","https://ar.ch/fileadmin/user_upload/Departement_Bau_Volkswirtschaft/Amt_fuer_Umwelt/Umwelt/Publikationen/Formular/Fischerei/Fischerei_Fischereireviere.pdf"],
    beShore:["Uferfreiangelei und Schongebiete Bern","https://www.weu.be.ch/de/start/themen/jagd-fischerei/fischerei/fischen-kanton-bern/fischen-ohne-angelpatent.html"],
    geFree:["Ausnahmen von der Patentpflicht Genf","https://www.ge.ch/permis-peche/conditions-pecher-sans-permis"],
    juLaw:["Fischereireglement Jura 2026–2029, Art. 11 und 30","https://www.jura.ch/Htdocs/Files/v/f093b18670a9ac04fc43c641bc61dc50361b19dbcd58fa3ce54307ef628314e9.pdf/260129-Reglement_peche_2026-29_VD_All.pdf?download=1"],
    neLake:["Neuenburgersee · amtliches Merkblatt 2026","https://www.fr.ch/sites/default/files/2026-01/extrait-de-la-legislation-lac-de-neuchatel--2026.pdf"],
    morat:["Murtensee · amtliches Merkblatt 2026","https://www.fr.ch/sites/default/files/2026-01/extrait-de-la-legislation-lac-de-morat--2026.pdf"],
    neRiver:["Staatsgewässer Neuenburg · Vorschriften 2026","https://www.ne.ch/sites/default/files/2025-11/Arr%C3%AAt%C3%A9%20p%C3%AAche%20rivi%C3%A8re.pdf"],
    ow2026:["Obwaldner Merkblatt 2026","https://www.ow.ch/_doc/435695"],
    nwMap:["Amtliche Fischenzenkarte Nidwalden","https://www.gis-daten.ch/karte/jagd-und-fischerei-nw/"],
    luShore:["Freiangelrecht Sempachersee","https://lawa.lu.ch/fischerei/angelfischerei/Fragen_und_Antworten"],
    szFree:["Schwyzer Freiangelkarte und Gerätevorschriften","https://www.sz.ch/verwaltung/umweltdepartement/amt-fuer-gewaesser/fischerei/haeufig-gestellte-fragen.html/8756-8758-8802-9447-9450-10713-10821"],
    szStreams:["Bachpatent · Strecken und Grenzen","https://www.sz.ch/public/upload/assets/63104/Ausfuehrungsbestimmungen_fuer_die_Angelfischerei_in_Fliessgewaessern.pdf"],
    ur2026:["Urner Merkblatt für die Saison 2026","https://www.ur.ch/_docn/434654/Merkblatt_Angelfischerei_01-12-2025.pdf"],
    sgRules:["St. Galler Fischereivorschriften und Schongebietskarten","https://www.sg.ch/umwelt-natur/jagd-fischerei/fischerei/fischereipatente/ausfuehrungsbestimmungen-patentgewaesser.html"],
    leman:["Genfersee · amtliche Vorschriften 2026","https://www.vs.ch/documents/33024802/33028744/DGE_Reglement_2026_Leman_Def.pdf/e88eb1ba-f77f-a44b-1d2b-81dea346b513"],
    zhLease:["Zürcher Revierverzeichnis 2026–2034","https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/umwelt-tiere/tiere/fischerei-und-jagd/fischerei/fischereireviere/Fischereirevierverzeichnis_20261030.pdf"]
  };
  // ID of the water body in swissTLM3D, always qualified by canton and lake/stream.
  // A matching water can describe the licensing scheme, never an opening at the pin.
  const records=[];
  const water=(cantons,lake,ids,title,body,source,until="")=>
    records.push({cantons:cantons.split(" "),lake,ids:ids.split(" "),title,body,source,until});
  water("BE",true,"CH0090730000 CH0090890000 CH0091480000","Uferfreiangelei oder Patent","Vom Ufer mit einer Rute und einem einfachen Haken ohne Widerhaken. Köderfische sind ausgeschlossen. Besonders an Mündungen liegen Schongebiete.","beShore");
  water("ZH",true,"CH0090500000 CH0090400000 CH0090220000 CH0090120000","Bedingtes Freiangelrecht am Ufer","Am Zürcher Ufer gilt die Freiangelei mit eingeschränkten Geräten. Für weitere Fangarten gilt das Recht des jeweiligen Sees. Zuflüsse haben eigene Reviere.");
  water("LU",true,"CH0091630000","Sempachersee · Uferfreiangelei oder Patent","Vom öffentlich zugänglichen Ufer, Steg oder einer Brücke mit einfachem Haken ohne Widerhaken und natürlichem Köder. Köderfische sind ausgeschlossen. Reservat- und Ruhezonen beachten.","luShore");
  water("SZ",true,"CH0092260000 CH0090500000 CH0091750000 CH0091790000","Freiangelkarte oder Seepatent","Am Schwyzer Ufer ist für die Freiangelei die Freiangelkarte mit SaNa nötig. Eine Rute mit Zapfen, Einzelhaken ohne Widerhaken und Naturköder ohne Köderfisch. Fürs Boot gilt ein eigenes Patent.","szFree");
  water("SZ",true,"CH0092160000 CH0092230000","Eigenes Seepatent","Für diesen See gibt es eine eigene Ausgabestelle. Die Schwyzer Freiangelkarte gilt hier nicht.");
  water("SZ",false,"CH0007400000","Muota · Bachpatent II","Das Bachpatent gilt auf den bezeichneten Strecken. Für Revier 17, Schutzstrecken und einzelne Fangmethoden gelten besondere Grenzen.","szStreams");
  water("NW",true,"CH0091790000","Seepatent oder bedingte Uferfischerei","Am Nidwaldner Ufer ist die Uferfischerei ohne Patent unter den vorgeschriebenen Bedingungen möglich. Private Fischenzen, Schongebiete und Gerätevorschriften sind zu beachten.");
  water("NW",false,"CH0007200000","Pachtgewässer · Engelberger Aa","Für den Nidwaldner Abschnitt ist eine Karte des zuständigen Pächters nötig. Das Seepatent gilt hier nicht.");
  water("ZG",true,"CH0091750000","Zugersee · Seepatent oder Freiangelei","Das Zuger Seepatent gibt das Amt für Wald und Wild aus. Am Zuger Ufer gibt es eine eingeschränkte Freiangelei. Uferreviere und Sonderrechte beachten.");
  water("ZG",true,"CH0092700000","Eigenes Patent für den Ägerisee","Das Patent ist bei den Ausgabestellen im Ägerital oder im Ägerisee-Webshop erhältlich.");
  water("OW",true,"CH0092340000","Eigenes Patent für den Lungerersee","Die Gemeinde Lungern bzw. die Lungernsee AG gibt das Patent für diesen See aus.");
  water("OW",true,"CH0092390000 CH0091790000","Obwaldner Seepatent · saisonale Uferfreiangelei","Am Sarnersee und am Obwaldner Alpnachersee ist die Freiangelei vom 1. April bis 15. Oktober vorgesehen. Eine Handangel mit einfachem Haken ohne Widerhaken und natürlichem Köder, ohne Köderfisch.","ow2026","2026-12-31");
  water("OW",true,"CH0092350000 CH0092360000","Separates Fischereirecht","Melchsee und Tannensee sind vom Obwaldner Kantonalpatent ausgenommen. Ausgabestelle und örtliche Vorschriften separat prüfen.","ow2026","2026-12-31");
  water("OW",false,"CH0007120000","Sarneraa · kantonales Patent","Für die Patentstrecken der Sarneraa ist das Obwaldner Patent vorgesehen. Schonstrecken und saisonale Sperren im Merkblatt prüfen.","ow2026","2026-12-31");
  water("UR",true,"CH0092010000 CH0092100000","Privates Fischereirecht","Arnisee und Oberalpsee sind vom Urner Patent ausgenommen. Die Berechtigung muss beim privaten Rechtsinhaber geklärt werden.","ur2026","2026-12-31");
  water("UR",true,"CH0092070000","Urner Seepatent","Am Göscheneralpsee gilt auch das 1-Tagespatent. Schleppfischerei ist damit ausgeschlossen.","ur2026","2026-12-31");
  water("UR",true,"CH0091790000","Urnersee · Uferfreiangelei oder Patent","An öffentlichen Ufern mit einer einfachen Rute, Einzelhaken ohne Widerhaken und Naturköder ohne Köderfisch. Die kartierten Schonstrecken bleiben gesperrt.","ur2026","2026-12-31");
  water("UR",false,"CH0000380000","Reuss · Urner Patentstrecken","Für die Patentstrecken der Reuss kommen 3-Tages-, 7-Tages- und Jahrespatent infrage. Das 1-Tagespatent ist auf drei Seen beschränkt. Schonstrecken prüfen.","ur2026","2026-12-31");
  water("BS",false,"CH0000010000","Fischereikarte Rhein","Bezug beim Amt für Umwelt und Energie oder in myfish, mit Fischereiprüfung bzw. SaNa. In Häfen, Fischaufstiegshilfen und zeitweise bei Badeanstalten gelten Verbote.");
  water("BS",false,"CH0004430000 CH0005410000","Pachtkarte für Birs oder Wiese","Für den Basler Abschnitt erteilt der Kantonale Fischerei-Verband Auskunft und Karten. Signalisation und aktuelle Sperrmeldungen beachten.");
  water("AR",false,"CH0003390000","Urnäsch · Pachtkarte für Revier 1, 2 oder 3","Passhöhe bis Wissbachmündung, danach bis Hundwilertobelbrücke, danach bis Sittermündung: Für jede dieser drei Strecken ist ein anderer Pächter zuständig. Ausnahmen für Quellgebiet und Zuflüsse stehen in der Revierliste.","arList");
  water("AR",false,"CH0002960000 CH0003060000","Grenzgewässer · Revierkarte","An Sitter und Goldach bestimmt die Reviergrenze die Ausgabestelle. Die Grenzreviere 16, 18 und 22 werden durch Nachbarkantone verwaltet.","arList");
  water("AR",false,"CH0021830000","Pachtkarte · Revier 4","Der Murbach bildet ein eigenes Revier. Die Tages- oder Jahreskarte ist bei der Pächterschaft erhältlich.","arList");
  water("AR",false,"CH0003860000","Glatt · Pachtreviere 7 und 8","Die Zellersmüli trennt die beiden Reviere. Revier 8 reicht bis zur Einmündung des Wissenbachs. Karten beim Pächter des Abschnitts anfragen.","arList");
  water("AR",false,"CH0003260000","Rotbach · Reviere 10 bis 13","Die Vereinigung mit dem Zwislenbach, die Wissbachmündung und das Wuhr obere Lochmüli trennen die Reviere. Für Zuflüsse gelten eigene Grenzen.","arList");
  water("AR",false,"AR4503240000","Steigbach · Pachtkarte Revier 14","Wissbach und Steigbach sind zusammen als Revier 14 aufgeführt. Die Ausgabestelle ist die Pächterschaft.","arList");
  water("AR",false,"CH0021950000","Goldibach · Pachtkarte Revier 15","Die Revierliste führt den Goldibach als eigenes Pachtgewässer. Tages- oder Jahreskarte beim Pächter anfragen.","arList");
  water("AR",false,"CH0021940000","Wattbach · Pachtkarte Revier 19","Für den Wattbach ist der Pächter des Reviers 19 zuständig. An der Einmündung wechselt das Revier.","arList");
  water("AR",false,"CH0021260000","Bruederbach · Pachtkarte Revier 23","Der Bruederbach ist ein eigenes Pachtgewässer. Die Karte des angrenzenden Goldachreviers deckt ihn nicht ab.","arList");
  water("AR",false,"CH0021310000 CH0003950000","Pachtkarte · Revier 24","Gstaldenbach und Mattenbach bilden bis zur Kantonsgrenze das Revier 24.","arList");
  water("AR",false,"CH0021320000","Klusbach · Pachtkarte Revier 25","Der Revierbeschrieb reicht von der Kantonsgrenze bis zur Tobelmühle.","arList");
  water("AR",false,"CH0003170000","Necker · Grenzrevier 5","Der in der Liste bezeichnete Neckerabschnitt wird vom Nachbarkanton verwaltet. Für die Ausgabestelle die Grenzrevierliste heranziehen.","arList");
  water("TI",true,"CH0097100000 CH0097110000","Tessiner Seelizenz · Ufer oder Boot","Auf der Tessiner Seeseite gilt Kategorie 2 für die Uferfischerei, Kategorie 1 auch für das Boot. Schutzbereiche und die Bestimmungen für Grenzgewässer beachten.");
  water("TI",false,"CH0000560000","Ticino · Lizenz Kategorie 1","Für die öffentlichen Flussstrecken ist eine Jahres- oder Kurzzeitlizenz der Kategorie 1 vorgesehen. Das reine Uferpatent der beiden grossen Seen gilt hier nicht. Lokale Verbote beachten.");
  water("NE",false,"CH0002060000 CH0002600000 CH0001350000","Flusspatent Neuenburg","Am Doubs, an Areuse und Seyon regelt der jährliche Erlass die befischbaren Strecken. Permanente und befristete Reservate sind ausgenommen.","neRiver","2026-12-31");
  water("FR NE VD",true,"CH0091510000","Neuenburgersee · Seekonkordat","Die patentfreie Fischerei ist mit höchstens drei Schwimmschnüren mit festem Zapfen und einfachem Haken vorgesehen. Für andere Methoden das passende Seepatent und die örtlichen Schutzgebiete prüfen.","neLake","2026-12-31");
  water("FR VD",true,"CH0092940000","Murtensee · Seekonkordat","Die patentfreie Fischerei ist mit einer Schwimmschnur mit festem Zapfen und einfachem Haken vorgesehen. Für weitere Methoden und Schutzbereiche gilt das Seereglement.","morat","2026-12-31");
  water("GE VS VD",true,"CH0097570000","Genfersee · Seekonkordat","Auf der Schweizer Seite ist eine Schwimmschnur mit festem Zapfen und einfachem Haken ohne Patent vorgesehen. Weitere Methoden, Reservate und Hafenzonen richten sich nach dem Seereglement.","leman","2026-12-31");
  water("GL",true,"CH0092490000 CH0092670000","Uferfreiangelei oder Patent","Eine Rute, ein einfacher Haken ohne Widerhaken, Zapfen oder Blei und natürlicher Köder. Die kantonalen Merkblätter zeigen die zugelassenen Bereiche.");

  // Official LV95 reference points in Art. 30 transformed to WGS84. The radius
  // selects a nearby legal description only. It is not a reserve boundary.
  const juraReserves=[
    ["CH0000930000",47.426507,7.144462,650,"Alle–Charmoille","Von der Brücke oberhalb der Fischzucht Alle bis zur Quelle der Allaine."],
    ["CH0000930000",47.419472,7.074544,650,"Pruntrut","Zwischen der Rue Elsaesser und der Schwelle Vauches."],
    ["CH0000930000",47.438392,7.056757,250,"Courchavon","Vom Ausgang des Moulin-Kanals bis zur Schwelle rund 180 m flussaufwärts."],
    ["CH0001350000",47.364023,7.154723,230,"Saint-Ursanne","Ab der Brücke Saint-Jean Népomucène sind 150 m flussabwärts und 160 m flussaufwärts für die Fischerei gesperrt."],
    ["CH0001350000",47.323627,7.110030,430,"Saint-Brais","Rund 350 m zwischen Les Rosées und La Charbonnière sind gesperrt."],
    ["CH0004430000",47.323280,7.376958,900,"Choindez","Gesperrt ist die Strecke im Von-Roll-Areal zwischen Werkausgang und oberem Gewölbe."],
    ["CH0004430000",47.336445,7.371398,500,"Courrendlin","Von der gelben Gros-Go-Brücke bis zur Schwelle oberhalb der Prévôté-Brücke."]
  ];
  function juraFallback(hit,date){
    if(hit.code!=="JU"||hit.t!=="w"||date<"2026-01-01"||date>"2029-12-31")return null;
    const id=hit.water.hydroId;
    for(const [key,lat,lon,radius,place,description] of juraReserves){
      if(id!==key)continue;
      const dy=(hit.lat-lat)*111320,dx=(hit.lon-lon)*111320*Math.cos(lat*Math.PI/180);
      if(Math.hypot(dx,dy)<=radius)return {level:"restriction",title:"Schutzstrecke bei "+place,body:description+" Die Tafeln und der Reglementtext bestimmen die Grenze am Ufer.",source:official.juLaw};
    }
    const river={
      CH0001350000:"Die Patentstrecke des Doubs liegt zwischen den Landesgrenzen bei Clairbief und bei Brémoncourt. Im Winter ist nur der Abschnitt D2 für Hecht und Egli bezeichnet.",
      CH0000930000:"Die Allaine ist abschnittsweise von der Landesgrenze bei Boncourt bis oberhalb der Einmündung des Bachs von Fregiécourt aufgeführt.",
      CH0005290000:"Die Sorne ist im Reglement zwischen ihrer Einmündung in die Birs und der Grenze zu Bern aufgeführt.",
      CH0004430000:"Für die Birs sind die Grenzen in Art. 11 und die Abschnitte ohne Fangberechtigung in Art. 30 aufgeführt."
    }[id];
    return river?{level:"guide",title:"Patentstrecke im Reglement · Punkt ungeklärt",body:river+" Reservate sind ausgenommen.",source:official.juLaw}:null;
  }

  function registers(){
    return typeof FishRegisters!=="undefined"?FishRegisters:require("./map-rights-registers.js");
  }
  const sgProtectedReaches={681:"Goldach Schonstrecke SBB-Viadukt bis Bodensee",4925:"Linthkanal Schonstrecke Hänggelgiessen",1680:"Thur, Laad- bis Schneitbrücke (ab 2009 Schonstreck"};
  const sgPatentLakes={4000:"Bodensee - Obersee",4900:"Walensee",4950:"Zürich-Obersee"};
  const sgProtection=(rev,region)=>Object.hasOwn(sgProtectedReaches,rev)&&sgProtectedReaches[rev]===region;
  // Canonical lake names for cantonal features which carry no federal ID.
  // Only an actual lake geometry may use these, never a district name on a tributary.
  const mappedLakes=new Map(Object.entries({
    "Bielersee":"CH0091480000","Thunersee":"CH0090730000","Brienzersee":"CH0090890000",
    "Greifensee":"CH0090400000","Pfäffikersee":"CH0090220000","Zürichsee":"CH0090500000","Türlersee":"CH0090120000",
    "Sempachersee":"CH0091630000","Klöntalersee":"CH0092490000","Walensee":"CH0092670000",
    "Lac de Neuchâtel":"CH0091510000","Lac de Morat":"CH0092940000","Le Léman":"CH0097570000","Lac Léman":"CH0097570000","Léman":"CH0097570000"
  }));
  const atWater=(hit,feature,date)=>{
    const lake=hit.t==="w"?hit.water.lake:hit.t==="x"?feature.poly:hit.lake&&hit.area;
    const id=hit.t==="w"?hit.water.hydroId:lake&&mappedLakes.get(hit.t==="zone"?hit.water:feature.name);
    return records.find(r=>r.ids.includes(id)&&r.cantons.includes(hit.code)&&r.lake===lake&&(!r.until||date<=r.until&&date.slice(0,4)===r.until.slice(0,4)));
  };
  function resolve(hit,feature={},options={}){
    const c=hit.code||"SO",office=offices[c],kind=feature.art||hit.kind||"";
    if(!office)return null;
    const answer=(level,title,body,source)=>({level,title,body,source:official[source]||office.slice(0,2)});
    const section=(title,body,source)=>answer("section",title,body,source);
    const caution=(title,body,source)=>answer("restriction",title,body,source);
    const date=options.date||new Date().toISOString().slice(0,10);
    if(hit.districtView)return answer("guide","Revierübersicht","Die Berechtigung wird für den einzelnen angetippten Abschnitt bestimmt.");
    if(hit.buried)return caution("Eingedolter Abschnitt","Dieser Abschnitt verläuft unterirdisch. Eine Fischereiberechtigung lässt sich aus der Revierzuordnung hier nicht ableiten.");
    if(/naturköderverbot/i.test(kind))return caution("Naturköder verboten","Für die Wahl des Köders gilt hier eine örtliche Einschränkung. Patent und weitere Vorschriften in der kantonalen Karte prüfen.");
    if(kind==="Keine Patentausgabe")return caution(kind,"Für dieses Gebiet ist keine Patentausgabe eingetragen. Auskunft zum örtlichen Fischereirecht erteilt der Kanton.");
    if(options.closed)return caution(options.closed,"Die kartierte Sperre hat Vorrang vor einer Patent- oder Revierzuordnung.");
    if(c==="SG"&&sgProtection(hit.rev,hit.region))return caution("Kartierte Schonstrecke","Der kantonale Revierdatensatz bezeichnet diesen Abschnitt als Schonstrecke. Räumliche Grenzen und Geltungszeit in den Schutzvorschriften prüfen.","sgRules");
    if(/^(Schon|Schongewässer|Schongebiet|Schonstrecke|Nationalpark)$/.test(kind)||options.protected)
      return caution(options.protected?hit.name:kind==="Schon"?"Schongebiet":kind,"Schutzvorschrift am angetippten Abschnitt beachten. Eine Fischereikarte hebt sie nicht auf.");
    if(hit.border?.length>1)return answer("unknown","Kantonsgrenze · Abschnitt ungeklärt","Am Gewässerpunkt kommen "+hit.border.join(" und ")+" in Betracht. Für die Uferseite oder das Grenzrevier die kantonale Karte prüfen.");
    if(hit.water?.ambiguous)return answer("unknown","Mehrere Gewässer am Kartenpunkt","An dieser Stelle treffen unterschiedliche Gewässerkennungen zusammen. Für die richtige Zuordnung einen Punkt im gewünschten Abschnitt antippen.");
    const legalFallback=juraFallback(hit,date);
    if(legalFallback)return legalFallback;
    if(options.incomplete)return answer("unknown","Zonenabfrage unvollständig","Zusätzliche Schutz- oder Sonderrechte konnten an dieser Stelle nicht vollständig geprüft werden.");
    if(kind==="Privat"||kind==="Privates Fischereirecht")return section("Privates Fischereirecht","Die Ausgabestelle ist der Inhaber des Fischereirechts. Für diesen Abschnitt sind dessen Bedingungen massgebend.",c==="NW"?"nwMap":null);
    if(options.condition||/^(Reservatzone|Ruhezone [AB]|Besondere Vorschrift)$/.test(kind)){
      if(c==="GE"&&feature.permitSector==="reserve")return caution("Aktive Reserve · Allondon","Der Kanton bezeichnet den Abschnitt von der Rhônemündung bis zur Brücke von Russin als aktive Reserve. Vor Ort die Signalisation beachten.");
      if(c==="NW")return caution("Private Fischenz · Sonderrecht","Hier ist ein auf bestimmte Fische oder Fanggeräte beschränktes Sonderrecht eingetragen. Umfang und Grenzen stehen in der Fischenzenkarte.","nwMap");
      return caution("Örtliche Vorschrift","Am markierten Abschnitt gelten besondere Bestimmungen. Geltungszeit, Fangmethode und Ausnahmen stehen in der amtlichen Quelle.");
    }
    if(options.overlap)return answer("unknown","Überlagerte Fischereirechte","Am selben Ort liegt eine weitere Schutzvorschrift, Fischenz oder Zuständigkeit. Die einzelnen Treffer und ihre Grenzen unten prüfen.");
    const record=atWater(hit,feature,date);
    if(record){
      const day=date.slice(5);
      const title=c==="OW"&&record.source==="ow2026"&&record.title.includes("Uferfreiangelei")&&(day<"04-01"||day>"10-15")?
        "Seepatent · Uferfreiangelei ausser Saison":record.title;
      return answer("water",title,record.body,record.source);
    }
    if(kind==="Pacht")return section("Karte des Pächters","Für dieses Pachtgewässer ist die Bewilligung der zuständigen Pächterschaft erforderlich.");
    if(kind==="Frei")return section("Bedingtes Freiangelrecht","Der bezeichnete Abschnitt hat ein Freiangelrecht. Uferseite, Geräte, Schonzeiten und örtliche Ausnahmen in den kantonalen Bestimmungen prüfen.");
    if(kind==="Uferfischerei mit Bewilligung")return section("Bewilligung für die Uferfischerei","An dieser Strecke weist der Kanton eine gesonderte Bewilligung für das Angeln vom Ufer aus.");
    if(kind==="Patent"||kind==="Patentgebiet")return section("Patentgewässer","Für die patentpflichtige Fischerei ist das passende Patent für diesen Abschnitt erforderlich. Saison und Schutzvorschriften gelten zusätzlich.");
    if(kind==="Seekonkordat")return section("Interkantonales Seekonkordat","Der Kanton führt diesen See unter einem Konkordat. Massgebend sind das Patent und die Ausnahmen des jeweiligen Seereglements.");
    if(c==="LU"&&hit.t==="zone"&&kind==="Fischereirevier"&&hit.rev){
      if(options.luListed&&date>="2026-08-01"&&date<"2029-01-01"){
        const info=section("Fischereiberechtigung der Pachtgruppe","Mitglieder und zugelassene Gäste benötigen die jährliche Fischereiberechtigung für dieses Revier. Die zuständige Pachtgruppe findest du unter Revier "+hit.rev+" im kantonalen Verzeichnis.");
        info.source=["Pachtverzeichnis Luzern 2021–2028","https://lawa.lu.ch/-/media/LAWA/Dokumente/njf/Fischerei/angelfischerei/vz/vz_fischerei_obmaenner.pdf"];
        return info;
      }
      return answer("guide","Berechtigung für dieses Revier prüfen","Die Reviernummer bezeichnet das kartierte Gebiet. Für diesen Abschnitt ist hier keine aktuelle Bewilligung belegt. Patentgebiete und örtliche Rechte in der kantonalen Fischereikarte prüfen.");
    }
    if(c==="AG"&&kind==="Fischereirevier"&&hit.rev){
      if(["1","2","3","4"].includes(String(hit.rev)))return section("Rheinkarte für Reviere 1–4","Im kantonalen Shop gibt es Tages- und Wochenkarten für diese vier Rheinreviere. Kartierte Schutzstrecken sind ausgenommen.","agRhine");
      if(Object.hasOwn(registers().AG,hit.rev)&&date>="2026-01-01"&&date<"2034-01-01"){
        const info=section("Staatliches Pachtrevier "+hit.rev,"Die Revierkarte kommt vom Pächter. Befischbar sind ausschliesslich die im Revierbeschrieb aufgeführten Strecken. Weitere Abschnitte desselben Reviers sind Schongebiete.");
        info.source=["Revierbeschrieb und Karte "+hit.rev+" · Kanton Aargau","https://www.ag.ch"+registers().AG[hit.rev]];
        return info;
      }
      if(["Aare","Rhein","Reuss","Limmat","Hallwilersee"].includes(hit.water))
        return section("Revierkarte · Freianglersektoren prüfen","Die Revierkarte kommt vom Pächter oder Rechtsinhaber. Eine Aargauer Freianglerkarte gilt nur in amtlich abgegrenzten Sektoren, mit SaNa und vom 1. März bis 31. Oktober.","agFree");
      return section("Revierkarte für Revier "+hit.rev,"Für diesen Abschnitt geben Pächter oder Revierbesitzer Fischerkarten aus. Die Karte gilt im zugehörigen Revier.");
    }
    if(c==="ZH"&&kind==="Fischereirevier"&&Object.hasOwn(registers().ZH,hit.rev)&&date>="2026-10-30"&&date<"2034-01-01"){
      const info=section("Pachtkarte · Revier "+hit.rev,"Dieses Revier steht im kantonalen Pachtverzeichnis. Die dort aufgeführte Pachtgesellschaft ist für Gastkarten zuständig.");
      info.source=[official.zhLease[0],official.zhLease[1]+"#page="+registers().ZH[hit.rev]];
      return info;
    }
    if(c==="GR"&&kind==="Fischgewässer")return section("Kantonales Fischgewässer","Der Abschnitt ist im Bündner Fischgewässerregister geführt. Patentpflicht, private Sonderrechte und örtliche Vorschriften anhand der Gewässernummer prüfen.");
    if(c==="GE"&&kind==="Revier"&&feature.permitSector==="river")
      return section("Flusspatent Genf","Dieser Flusssektor ist im amtlichen Verzeichnis aufgeführt. Für Erwachsene ist das Genfer Flusspatent vorgesehen. Unter 14 Jahren gelten gesonderte Bedingungen.","geFree");
    if(c==="GE"&&kind==="Revier"&&feature.permitSector==="pond")
      return section("Genfer Fischereiweiher","Dieser Weiher ist amtlich für die Angelfischerei bezeichnet. Es gelten die Weiherbewilligung und örtlich ausgeschilderte Sperren.");
    if(c==="NW"&&hit.t==="w"&&!hit.water.lake)return answer("guide","Pachtfischerei · Abschnitt prüfen","Für die Nidwaldner Gewässer ausserhalb des Vierwaldstättersees sieht das Gesetz Pacht vor. Pachtkreis und allfällige private Rechte hier beim Kanton prüfen.");
    if(c==="ZG"&&hit.t==="w"&&!hit.water.lake)return answer("guide","Pacht- oder Privatrecht","Für Zuger Fliessgewässer ist der Pächter oder private Inhaber zuständig. Das Amt für Wald und Wild hilft bei der Zuordnung zum Abschnitt.");
    if(c==="BL"&&hit.municipality)return answer("guide","Revierauskunft · "+hit.municipality,"Die Einwohnergemeinde "+hit.municipality+" ist die Anlaufstelle für Reviergrenze, Pächter und Gastkarte an natürlichen Gewässern. Rechte Dritter bleiben vorbehalten.");
    if(c==="SH"&&kind==="Revier")return section("Rheinrevier · Uferseite prüfen",office[2]);
    if(c==="SG"&&kind==="Fischereirevier"&&hit.rev){
      if(Object.hasOwn(registers().SG,hit.rev)&&date>="2025-01-01"&&date<"2033-01-01"){
        const info=section("Pachtkarte · Revier "+hit.rev,"Für den markierten Abschnitt ist die Pächterschaft zuständig. Die amtliche Revierkarte zeigt die genauen Grenzen.");
        info.source=["Amtliche Karte für Revier "+hit.rev,"https://www.sg.ch"+registers().SG[hit.rev]];
        return info;
      }
      if(Object.hasOwn(sgPatentLakes,hit.rev)&&sgPatentLakes[hit.rev]===hit.region)
        return section("St. Galler Seepatent","Für diesen See gibt der Kanton ein gewässerspezifisches Patent aus. Für die Uferfreiangelei gelten eigene Geräte- und Gebietsgrenzen.");
      return answer("guide","Fischereirevier "+hit.rev+" · Kartenbezug prüfen","Die Reviernummer ist amtlich erfasst. Die konkrete Ausgabestelle ist für diesen Abschnitt ungeklärt.");
    }
    return answer("guide","Berechtigung am Abschnitt ungeklärt",office[2]);
  }
  return {resolve,offices,sgProtection};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FishRights;
