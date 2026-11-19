# Datenquellen Gewässer und Fischerei

Stand der Recherche: 19.11.2026. Geprüft durch direktes Auslesen der Ebenenverzeichnisse
(GetCapabilities) und Probeabfragen aus dem Browser.

## Bereits eingebunden

| Kanton | Quelle | Form |
|---|---|---|
| AG, ZH, SG, GR, LU | kantonale WFS/Downloads, gebaut mit `tools/build_map_sections.py` | Vektor-Kacheln, bereinigt mit `tools/normalize_sections.py` |
| SO | geo.so.ch WFS `ch.so.awjf.gewaesser.patentgewaesser` | Vektor |
| BE, FR, GE, GL, NW, SH, TG, VD, VS | kantonale ArcGIS/WFS, `map-sources.js`, `tools/build_fisheries.cjs` | Vektor |
| AI | geoportal.ch WMS `ch.geoportal.wald_flora_fauna.146.0.fischereikarte_kt_ai` | nur Bild |
| JU | geoservices.jura.ch WMS `ju.env_04_33_secteurs_de_peche` | nur Bild |

## Neu gefunden

### Tessin (eingebunden 19.11.2026, live über `XSRC.TI` in `map-sources.js`)

WFS: `https://wfs.geo.ti.ch/service` (WFS 1.1.0, `OUTPUTFORMAT=application/json`, `SRSNAME=EPSG:4326`)

| Ebene | Inhalt | Umfang |
|---|---|---|
| `ti_035_1_v1_0_settori_pesca_fiumi` | Fischereisektoren der Fliessgewässer: `codice` (z.B. BN1A), `nome_fiume_dt_ucp`, `tlm_nome_fiume`, `tipo_asta` (Haupt-/Nebenarm) | 8242 Linien, 7 MB |
| `ti_035_1_v1_0_settori_pesca_settori` | Sektorflächen: `codice`, `nome`, `tipo_alias` (Fiume, Lago, Lago alpino, **Diritto privato**), `osservazioni` (z.B. kantonales Patent gilt nicht) | 139 Flächen, 2.2 MB |
| `ti_035_1_v1_0_settori_pesca_limitazioni` | Fangeinschränkungen an Brenno, Ticino, Maggia, Moesa | 4 Linien |
| `ac_064_1_v1_0_zone_protezione_ittica_linee` / `_poligoni` | **Schutzzonen** (Decreto 2025–2030): `nome_zona_protezione`, `descrizione`, `tipologia_corta` (permanent Fluss, permanent See, temporär Zander 1.4.–31.5., Netzverbot), `in_vigore_dal`, `url_decreto` | je 103 |

WMS für die Darstellung: `https://wms.geo.ti.ch/service`, Ebene `ti_035_1_v1_0_settori_pesca`.

In der App: Schutzzonen in Fliessgewässern (Linien) und in den Seen (Flächen), Zander-Schutzzonen
gesperrt vom 1.4. bis 31.5., Alpenseen mit Regelgruppe `alpin`, Privatgewässer. Netzverbote
(betreffen nur Berufsfischerei), Flusssektoren (8242 Linien, 7 MB) und die grossen Seen werden
nicht geladen. Rund 0,8 MB, höchstens einmal täglich und nur bei Sicht auf das Tessin.

### Jura

WMS `ju.env_04_33_secteurs_de_peche` (bereits als Bild). Der WFS `geoservices.jura.ch/wfs`
enthält keine Fischereiebene. Abfrage per GetFeatureInfo möglich.

### Appenzell Innerrhoden

WMS geoportal.ch `fischereikarte_kt_ai` (bereits als Bild). WFS `geoportal.ch/services/wfs/ktai`
blockiert Browser-Abfragen; Inhalt noch nicht geprüft.

### Schwyz (Vektor, ökologisch)

WFS: `https://map.geo.sz.ch/mapserv_proxy` (WFS 1.1.0, nur GML)

| Ebene | Inhalt | Umfang |
|---|---|---|
| `ms:ch.sz.a049a.fischerei.fischgewaesser` | Fischgewässer: `name_fliessgewaesser`, `eignung_fischgewaesser` (geeignet, potentiell geeignet) | 651 |
| `ms:ch.sz.a049a.fischerei.fischregionen` | Fischregion je Abschnitt: Forellen-, Äschen-, Barben-, Brachsmenregion | 2679 |

Keine Schonstrecken oder Fliegenstrecken als Geodaten. Diese stehen in den Ausführungsbestimmungen
für Fliessgewässer (gültig ab 1.1.2025) und in der kantonalen «Legende Fischerei» (PDF).

### Zug (Vektor, ökologisch)

WFS: `https://services.geo.zg.ch/ows/fischatlas` (WFS 1.1.0, GML). Je Art eine Ebene
(`zg_fischatlas_<art>`) plus Übersicht `zg_fischatlas_fischatlas` (253 Abschnitte): Abschnittsname,
Bestandsdichte, Erhebungsjahr, Methode, Besatz. Das Feld `t_fischereirecht` enthält teils Namen von
Privatpersonen und wird **nicht** übernommen. Keine Revier- oder Pachtgrenzen.

### Appenzell Innerrhoden

WMS `fischereikarte_kt_ai` ist abfragbar (GetFeatureInfo), aber ohne Vektordienst oder Download.

### Neuenburg

SITN (`sitn.ne.ch/services/wms`, 784 Ebenen) hat keine Fischereiebene. Reservate stehen nur im
jährlichen «Arrêté concernant la pêche dans les eaux de l'État» (Art. 26, 39, 49, 57).

## Keine Fischerei-Geodaten im kantonalen Dienst

| Kanton | Geprüft | Ergebnis |
|---|---|---|
| AR | geoportal.ch WMS `ktar` | keine Fischereiebene |
| BL | geowms.bl.ch | nur Verbreitungskarten einzelner Fischarten; Reviere vergeben die Gemeinden |
| BS | wms.geo.bs.ch, wfs.geo.bs.ch | nur Fischauf- und -abstiegsanlagen |
| UR | geo.ur.ch WMS | nur Gewässernetz und Gewässerraum |
| OW | gis-daten.ch Katalog | nur Nidwalden-Fischerei und Wildzählkreise |

## Kantone ohne eigene Bestimmungen

Wo ein Kanton für ein Gewässer keine eigenen Vorschriften erlässt, gilt die Bundesverordnung (VBGF):
Schonzeiten je Art und Mindestmasse. Sie kennt keine allgemeine Sperrzeit für ganze Gewässer; die
Karte färbt solche Gewässer deshalb nicht als gesperrt.

## Rechtliche Grundlagen ohne Geodaten

Wo es keine Geodaten gibt, kommen Saison und Sperrzonen aus den Erlassen (`data/src/*.json`,
`data/updates.json`) und werden auf dem Gewässernetz der Grundkarte innerhalb der Kantonsgrenze
(`data/canton-areas.json`) dargestellt.
