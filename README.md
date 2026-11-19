# Fischer-Begleiter 🎣

Begleit-App fürs Fischen in der Schweiz – läuft im Browser, installierbar aufs
Handy, ohne App Store.

**App öffnen:** https://wreckedangler.github.io/fishappCH/

> Inoffizielles Hilfsmittel, ohne Gewähr. Verbindlich sind die amtlichen
> Vorschriften. Die App ersetzt die offizielle Fangstatistik **nicht**.

## Funktionen

- **Automatische Standorterkennung:** Kanton (via geo.admin.ch) und – in
  Solothurn – der genaue Patentabschnitt, Pachtrevier oder die Schonstrecke.
  Liegen mehrere Gewässer nah beieinander, fragt die App nach und merkt sich
  die Wahl.
- **Karte und Suche** mit swisstopo-Luftbild und Landeskarte. Benannte Gewässer,
  Orte und Reviere lassen sich suchen. Antippen markiert den amtlich zugeordneten
  Abschnitt. Er lässt sich vollständig ins Bild holen. Für nummerierte Reviere in Aargau, Luzern, Zürich und St. Gallen zeigt die Revierübersicht auch zugehörige Nebengewässer. Schutzflächen bleiben über einer gewählten Strecke sichtbar.
- **Statusleiste** zeigt auf der Karte das angetippte Gewässer und auf «Hier» den
  Status des gewählten Gewässers.
- **Fangerfassung** mit Schnellwahl der Art, sofortiger Prüfung von Mass,
  Schonzeit, Schutzstatus, Tages- und Jahreslimiten; Text zum Übertragen in
  die offizielle App.
- **Öffentliche Fangkarte** mit freiwilliger Freigabe pro Fang. Die Kartenebene
  zeigt Meldungen der letzten 7 oder 30 Kalendertage. Ein Tipp auf einen Marker
  zeigt Fischart, Anzahl, gemeldete Längen und den letzten Fangtag am Abschnitt.
  Eine Meldung gibt keine Auskunft über die Fischereiberechtigung.
- **Fische**: Übersicht aller Arten mit Erkennungsmerkmalen, Vorkommen, Ködern, Tipp und Status heute im gewählten Kanton
- **Statistik**, Angelzeit-Uhr, CSV-Export/Import.
- **Alle 26 Kantone** zeigen das Gewässernetz beim Öffnen auf Luftbild und Landeskarte.
  Die Karte bietet amtliche Bewilligungsquellen für jeden Kanton. Bei einem
  Treffer zeigt sie die belegte Vorschrift für den Abschnitt oder das Gewässer.
  Für noch ungeklärte Abschnitte nennt sie die zuständige Stelle. Die Legende
  enthält das offline verfügbare Verzeichnis aller 26 Kantone.
  Gebündelte Fischereigeometrien liegen für 15 Kantone vor, in Nidwalden für
  die privaten Seefischenzen. Appenzell Innerrhoden und Jura liefern zusätzliche
  WMS-Auskünfte. Grün kennzeichnet eine belegte offene Fangsaison.

## Installieren

Seite in Chrome (Android) bzw. Safari (iOS) öffnen → Menü →
**„Zum Startbildschirm hinzufügen"**. Standortzugriff erlauben.

## Woher die Daten kommen und wie sie aktuell bleiben

| Daten | Quelle | Aktualisierung |
|---|---|---|
| Gewässer, Schonstrecken SO | Kanton Solothurn, AWJF – `ch.so.awjf.gewaesser.patentgewaesser` (geo.so.ch, Open Data) | gebündelter amtlicher Stand, danach wöchentliche WFS-Aktualisierung |
| Reviere und Gewässernamen AG, ZH | AGIS-GeoPackages und GIS-ZH-Fischereireviere (WFS) | Amtliche Geometrien je Kartenausschnitt aus `data/sections` |
| Fischereireviere, Patentgebiete, private Fischereirechte, Reservat- und Ruhezonen am Sempachersee, oberirdische Gewässer LU | [Fischereikarte](https://map.geo.lu.ch/fauna/fischerei/) und [Geodaten des Kantons Luzern](https://download.geo.lu.ch/produkt/fischrev_ds_v1), © Geoinformation Kanton Luzern; Kantonsgrenze und Seegeometrien © swisstopo | Gebündelt pro Kartenausschnitt. Eine Gewässermarkierung bestätigt keine persönliche Fischereiberechtigung. |
| Fischereizonen SG, GR | Fischereigeodienste der beiden Kantone (WFS) | Amtliche Geometrien je Kartenausschnitt aus `data/sections` |
| Fischereizonen BE, FR, GE, GL, SH, TG, VD, VS | Kantonale WFS- und ArcGIS-Dienste, darunter [Fischereisektoren Genf](https://www.ge.ch/permis-peche/pecher-geneve-repeuplement-etangs) | Gebündelte Übersicht, beim Vergrössern Aktualisierung im Hintergrund. Der Genfer Léman-Sektor endet an der Kantonsgrenze von swisstopo. |
| Private Fischenzen im Vierwaldstättersee NW | [GIS Daten AG / Kanton Nidwalden](https://www.gis-daten.ch/karte/jagd-und-fischerei-nw/) | Sechs Flächen mit Umfang des jeweiligen Rechts, gebündelt und im Hintergrund aktualisiert |
| Fischereikarte AI und Patentstrecken JU | Öffentliche kantonale WMS mit GetFeatureInfo. [Géoservices du Jura](https://www.jura.ch/fr/Autorites/Administration/DEC/SDT/Cadastre-et-geoinformation/Liste-et-commande-de-geodonnees/Geoservices-de-consultation/Geoservices-de-consultation.html) | Im Jura haben die publizierten Reglementsgrenzen und die Signalisation Vorrang. Bei Dienstausfall zeigt die App den passenden Reglementhinweis, soweit verfügbar. |
| Rechtsauskunft für 26 Kantone | Amtliche Quellen und Gesetzesartikel in `map-rights.js`. Zuordnung über Reviernummer oder Gewässerkennung, Kanton und Gewässertyp | Stand 17.11.2026. Jahresmerkblätter werden nur im Gültigkeitsjahr angewendet. Tagesverfügungen, Uferzugang und persönliche Berechtigungen bleiben gesondert zu prüfen. |
| Aargauer und St. Galler Revierkarten, Zürcher Pachtverzeichnis | `tools/build_rights_registers.py` liest die Reviernummern, PDF-Links und Seitenzahlen aus den verlinkten kantonalen Originalen | Mit Python und `pdfplumber` neu erzeugen. Die gebündelte Zuordnung enthält ausschliesslich Nummern und Quellenverweise. |
| Kantonserkennung, Gewässernamen (alle Kantone) | swisstopo / geo.admin.ch (swissBOUNDARIES3D, swissTLM3D Gewässernetz) | live |
| Karte | swisstopo WMTS | live, Kacheln werden zwischengespeichert |
| Satellitenübersicht des Alpenraums | [NASA Blue Marble Next Generation, GIBS](https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:3857&BBOX=-313086.07,4383204.95,2191602.47,7200979.56&WIDTH=1024&HEIGHT=1152&FORMAT=image/jpeg) | Gebündeltes Hintergrundbild für die weitesten Luftbild-Zoomstufen |
| Regeln, Preise, Verfügungen | `data/updates.json` in diesem Repo | App lädt bei jedem Start; Inhalt wird regelmässig gegen die kantonalen Quellen geprüft |

### Karte (MapLibre)

Die [Karte in der Haupt-App](https://wreckedangler.github.io/fishappCH/#karte) verwendet
MapLibre GL mit swisstopo-Vektorkarte, Luftbild und verschiebbarem Infoblatt. Der bisherige
Einstieg unter `/beta/` bleibt erreichbar. Die Kartenlogik liegt in `beta/src/map-gl.part.js`,
`beta/src/map-gl.css` und `beta/map-sections-gl.js`. Nach Änderungen erzeugt
`python3 tools/build_beta.py` beide App-Einstiege. Die Karte lädt die swisstopo-Stile aus
`data/basemaps/` parallel zur Kartenbibliothek. Die Vektorquellen enthalten die Kacheladressen,
Zoomgrenzen und Ausdehnung aus dem jeweiligen versionierten swisstopo-TileJSON. Beim
Aktualisieren eines Stils diese Angaben mit der zugehörigen Kachelversion abgleichen.

### Gewässerabschnitte aktualisieren

Die öffentliche Fangkarte verwendet feste Positionen aus den amtlichen
Abschnittsdaten. Bei einer Gewässerwahl aus dem schweizweiten Gewässernetz
kann der Server die Geometrie über die swisstopo-Objektkennung beziehen.
Nach einem Kartenupdate erzeugt `node tools/build_catch_sections.cjs` den
Katalog für den Fangmeldungs-Server in `server/catalogue.json`.

Der Server ist separat von GitHub Pages auf Sites mit einer D1-Datenbank
veröffentlicht. Die API in `server/reports.mjs` nimmt Abschnittskennung,
Fischart, Anzahl, optionale Länge und Fangtag entgegen. Das Fangbuch speichert
den privaten Freigabeschlüssel auf dem Gerät. Unter **Fangbuch → Mehr →
Freigabe verwalten** lässt sich eine Meldung zurückziehen. Ausstehende
Übertragungen versucht die App bei erneuter Verbindung erneut.
`node --test tools/public-catches.test.mjs` prüft die API mit einer
lokalen SQLite-Datenbank (Node 22.13 oder neuer).

`python tools/build_zone_index.py` lädt die amtlichen Ausgangsdaten für SG und GR.
`python tools/build_map_sections.py` erstellt daraus und aus den Originaldaten
von AGIS, GIS-ZH, Kanton Luzern und swisstopo die Mobilkarte samt kompakter
Übersicht für niedrige Zoomstufen. Dafür werden Shapely ab 2.1, pyproj und
Pillow benötigt. `node tools/build_fisheries.cjs` aktualisiert die acht
weiteren kantonalen Datenpakete. Als optionales Argument kann ein Ordner für
die Originaldaten übergeben werden. `node --test tools/map-sections.test.cjs`
prüft unter anderem die Zonen, ihre Übersicht, geschützte Teilflächen und
datumsabhängige Fangzeiten.

### Regeln ändern

Kantonale Regeln liegen editierbar in `data/src/*.json` (ein Objekt pro Kanton).
SO, nationale Werte und `news` stehen direkt in `data/updates.json`.

1. Werte anpassen.
2. `python3 tools/build_data.py` – prüft die Daten, baut `data/updates.json`
   und erhöht `version` automatisch, wenn sich etwas geändert hat.
3. Committen.

Alle Handys übernehmen es beim nächsten Öffnen.

- `slot`: erlaubte Längen in cm, z. B. `[[38, null]]` = ab 38 cm,
  `[[32, 42], [55, null]]` = 32–42 cm oder ab 55 cm.
- `schon`: Schonzeit `[[Monat, Tag], [Monat, Tag]]`.
- `news[].secs`: Codes der betroffenen Strecken (A1–A6, E, EK, D, LS, LT, CH,
  B, S1–S8 oder Reviernummern).
- `rules.CH`: nationale Mindestvorgaben für Kantone ohne Detaildaten.
- Ein Kanton mit `"detailed": true` gilt als vollständig hinterlegt (SO).
- Kantone in `data/src`: `w` = Gewässergruppen zur Auswahl, `sp` = Regeln pro
  Art (erster passender Eintrag gilt, Eintrag ohne `w` = übrige Gewässer,
  `Forelle` = Bach- und Seeforelle), `prot` = geschützte Arten, `lim` =
  Fanglimiten (`per: "Jahr"` sonst pro Tag), `closed` = gesperrte Zeiten pro
  Gewässer, `src` = amtliche Quellen, `updated` = Stand der Quelle.

## Dateien

Bei den Fischarten öffnet «Montage & Knoten» eine kompakte Anleitung mit Material,
Montagereihenfolge, drei Aufbauschritten, Köderführung und Knoten. Die Inhalte stehen
in `beta/src/fish-rigs.part.js` und werden durch `python tools/build_beta.py` für beide
App-Einstiege eingebettet. Sie benötigen offline keine weiteren Dateien.
Die Gewässerauswahl aktualisiert nur die betroffenen Hinweise, Materialangaben und
Aufbauschritte; geöffnete Knoten und Fischfotos bleiben erhalten.

Die Vorschläge verwenden eine Rute und einen widerhakenlosen Einzelhaken. Sie sind
keine automatische Geräte- oder Berechtigungsfreigabe. Bestehende Schonzeiten,
Sperren und lokale Bedingungen haben Vorrang. Schwyzer Bachfischerei berücksichtigt
Hakengrössen und natürliche Köder; grosse Raubfischmontagen werden dort ausgeblendet.
Die Methodenverbote in SG und SH unterscheiden bekannte Gewässer- und
Berechtigungsarten; bei fehlender Zuordnung bleibt ein ausdrücklicher Prüfhinweis.

Grundlagen: [Clinch](https://www.animatedknots.com/improved-clinch-knot),
[Palomar](https://www.animatedknots.com/palomar-knot),
[Schlaufenverbindung](https://www.netknots.com/fishing_knots/loop-to-loop-knot),
[Dropshot](https://www.netknots.com/fishing_knots/drop-shot-rig),
[Laufmontage](https://www.drennantackle.com/products/tackle/bits-and-pieces/run-rig-kits/),
[Zapfenmontagen](https://www.fishandgame.org.nz/freshwater-fishing-in-new-zealand/fishing-knowledge-hub/coarse-fishing).
Die amtlichen Quellen stehen direkt bei der Anleitung. Regellogik und die Aktualisierung
der Auswahl: `node --test tools/fish-rigs.test.cjs`.

| Datei | Zweck |
|---|---|
| `index.html` | die ganze App |
| `data/updates.json` | Regeldaten je Kanton (wird gebaut) |
| `data/src/*.json` | kantonale Regeln, Quelle zum Bearbeiten |
| `tools/build_data.py` | prüft und baut `updates.json` |
| `sw.js` | Offline-Betrieb |
| `manifest.webmanifest`, `assets/` | Originalwappen, App-Symbole und Installation |

Fotos der Fischarten: Wikimedia Commons, freie Lizenzen (Urheber und Lizenz in der App beim jeweiligen Foto).

Quellen Regeln SO: «Auszug aus den Fischereivorschriften ab 01.03.2026» und
«Neuerungen Fischereigesetzgebung SO 2026» (AWJF). National: Verordnung zum
Bundesgesetz über die Fischerei (VBGF).
