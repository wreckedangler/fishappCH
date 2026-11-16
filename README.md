# Fischer-Begleiter 🎣

Eine Begleit-App fürs Fischen in der Schweiz. Standorterkennung, Mindestmasse,
Schonzeiten, geschützte Arten, Fangerfassung und Statistik – offline nutzbar,
ohne App Store. Kanton **Solothurn** ist vollständig hinterlegt; weitere Kantone
folgen.

> Inoffizielles Hilfsmittel, ohne Gewähr. Verbindlich sind die amtlichen
> Vorschriften (z. B. so.ch/fischerei). Die App ersetzt die offizielle
> Fangstatistik **nicht**.

## Auf dem Handy installieren

1. Diese Seite über GitHub Pages öffnen (siehe unten).
2. In Chrome (Android) bzw. Safari (iOS) das Menü öffnen → **„Zum
   Startbildschirm hinzufügen"**.
3. Fertig – die App startet mit eigenem Icon und funktioniert offline.

## Als Website bereitstellen (GitHub Pages)

1. Repository auf GitHub anlegen und diese Dateien pushen (siehe `PUSH.md`).
2. Im Repo: **Settings → Pages → Branch: `main`, Ordner `/ (root)` → Save**.
3. Nach ein paar Minuten ist die App erreichbar unter
   `https://<dein-name>.github.io/<repo>/`.

## Regeln aktualisieren (ohne Neu-Installation)

Die Regelwerte liegen in **`data/updates.json`**. Die App lädt diese Datei bei
jedem Start (sobald online) und übernimmt neue Werte automatisch – inklusive
Mindestmasse, Schonzeiten und geschützte Arten je Kanton.

So änderst du etwas:

1. `data/updates.json` bearbeiten.
2. Feld **`version`** um 1 erhöhen und **`updated`** auf das neue Datum setzen.
3. Werte unter `rules` / `news` anpassen und committen.

Alle Handys ziehen die Änderung beim nächsten Öffnen nach. Offline gilt die
zuletzt geladene Version.

### Format

- `slot`: erlaubte Längenbereiche in cm, z. B. `[[38, null]]` = ab 38 cm,
  `[[32, 42], [55, null]]` = 32–42 cm oder ab 55 cm.
- `schon`: Schonzeit `[[Monat, Tag], [Monat, Tag]]`.
- `secs` (bei `news`): Abschnittscodes `A1`–`A6`, `E`, `EK`, `D`, `LS`, `LT`,
  `CH`, `B`.

## Weitere Kantone

In `index.html` steht die Liste `CANTONS`. Ein Kanton wird aktiv, sobald sein
Regelwerk unter `rules` (in `data/updates.json`) und – falls nötig – seine
Gewässer-Abschnitte im Code hinterlegt sind. Diese werden Runde für Runde aus
den offiziellen Vorschriften ergänzt.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die ganze App (HTML, CSS, Logik) |
| `data/updates.json` | lebende Regeldaten je Kanton |
| `manifest.webmanifest` | macht sie installierbar (PWA) |
| `sw.js` | Service Worker für Offline-Betrieb |
| `icon.svg` | App-Icon |

## Quellen (Kanton SO, Stand 01.03.2026)

- Auszug aus den Fischereivorschriften ab 01.03.2026 (AWJF)
- Neuerungen Fischereigesetzgebung SO 2026 (AWJF)
- so.ch/fischerei
