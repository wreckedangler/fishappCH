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
- **Fische**: Übersicht aller Arten mit Erkennungsmerkmalen, Vorkommen, Ködern, Tipp und Status heute im gewählten Kanton
- **Statistik**, Angelzeit-Uhr, CSV-Export/Import.
- **Alle 26 Kantone** zeigen das Gewässernetz beim Öffnen auf Luftbild und Landeskarte.
  Amtliche Reviere und Zonen aus 14 Kantonen sind vom Schweizüberblick bis zum
  einzelnen Abschnitt sichtbar. In Appenzell Innerrhoden ergänzt die amtliche
  Fischereikarte das Netz. In den übrigen 11 Kantonen liefert swisstopo die
  Gewässerauskunft. Grün kennzeichnet eine für den Abschnitt belegte offene
  Fangsaison. Das persönliche Patent, Schonzeiten für einzelne Arten und
  kurzfristige lokale Verfügungen sind vor Ort zu prüfen.

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
| Fischereikarte AI | Kantonaler WMS mit GetFeatureInfo | Amtliches Kartenbild und Punktauskunft |
| Kantonserkennung, Gewässernamen (alle Kantone) | swisstopo / geo.admin.ch (swissBOUNDARIES3D, swissTLM3D Gewässernetz) | live |
| Karte | swisstopo WMTS | live, Kacheln werden zwischengespeichert |
| Satellitenübersicht des Alpenraums | [NASA Blue Marble Next Generation, GIBS](https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:3857&BBOX=-313086.07,4383204.95,2191602.47,7200979.56&WIDTH=1024&HEIGHT=1152&FORMAT=image/jpeg) | Gebündeltes Hintergrundbild für die weitesten Luftbild-Zoomstufen |
| Regeln, Preise, Verfügungen | `data/updates.json` in diesem Repo | App lädt bei jedem Start; Inhalt wird regelmässig gegen die kantonalen Quellen geprüft |

### Gewässerabschnitte aktualisieren

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
