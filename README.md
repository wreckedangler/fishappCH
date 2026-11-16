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
- **Karte** (swisstopo Landeskarte/Luftbild) mit allen offiziellen
  Fischereigewässern des Kantons Solothurn: Patentstrecken (offen/gesperrt),
  Schonstrecken, Pacht- und Privatgewässer; Antippen zeigt Beschreibung und
  Regeln. Eigene Fangorte als Ebene.
- **Statusleiste:** zeigt jederzeit, ob am aktuellen Ort heute gefischt
  werden darf.
- **Fangerfassung** mit Schnellwahl der Art, sofortiger Prüfung von Mass,
  Schonzeit, Schutzstatus, Tages- und Jahreslimiten; Text zum Übertragen in
  die offizielle App.
- **Fische**: Übersicht aller Arten mit Erkennungsmerkmalen, Vorkommen, Ködern, Tipp und Status heute im gewählten Kanton
- **Statistik**, Angelzeit-Uhr, CSV-Export/Import.
- **Alle 26 Kantone:** Solothurn vollständig; übrige Kantone vorerst mit den
  nationalen Mindestvorgaben des Bundes (VBGF), klar gekennzeichnet.

## Installieren

Seite in Chrome (Android) bzw. Safari (iOS) öffnen → Menü →
**„Zum Startbildschirm hinzufügen"**. Standortzugriff erlauben.

## Woher die Daten kommen und wie sie aktuell bleiben

| Daten | Quelle | Aktualisierung |
|---|---|---|
| Gewässer, Schonstrecken SO | Kanton Solothurn, AWJF – `ch.so.awjf.gewaesser.patentgewaesser` (geo.so.ch, Open Data) | live vom Kanton, automatisch wöchentlich |
| Kantonserkennung, Gewässernamen (alle Kantone) | swisstopo / geo.admin.ch (swissBOUNDARIES3D, swissTLM3D Gewässernetz) | live |
| Karte | swisstopo WMTS | live, Kacheln werden zwischengespeichert |
| Regeln, Preise, Verfügungen | `data/updates.json` in diesem Repo | App lädt bei jedem Start; Inhalt wird regelmässig gegen die kantonalen Quellen geprüft |

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
| `manifest.webmanifest`, `icon.svg` | Installation als App |

Fotos der Fischarten: Wikimedia Commons, freie Lizenzen (Urheber und Lizenz in der App beim jeweiligen Foto).

Quellen Regeln SO: «Auszug aus den Fischereivorschriften ab 01.03.2026» und
«Neuerungen Fischereigesetzgebung SO 2026» (AWJF). National: Verordnung zum
Bundesgesetz über die Fischerei (VBGF).
