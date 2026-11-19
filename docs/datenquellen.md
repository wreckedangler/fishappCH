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

### Tessin (vollständig, Vektor, aus dem Browser abrufbar)

WFS: `https://wfs.geo.ti.ch/service` (WFS 1.1.0, `OUTPUTFORMAT=application/json`, `SRSNAME=EPSG:4326`)

| Ebene | Inhalt | Umfang |
|---|---|---|
| `ti_035_1_v1_0_settori_pesca_fiumi` | Fischereisektoren der Fliessgewässer: `codice` (z.B. BN1A), `nome_fiume_dt_ucp`, `tlm_nome_fiume`, `tipo_asta` (Haupt-/Nebenarm) | 8242 Linien, 7 MB |
| `ti_035_1_v1_0_settori_pesca_settori` | Sektorflächen: `codice`, `nome`, `tipo_alias` (Fiume, Lago, Lago alpino, **Diritto privato**), `osservazioni` (z.B. kantonales Patent gilt nicht) | 139 Flächen, 2.2 MB |
| `ti_035_1_v1_0_settori_pesca_limitazioni` | Fangeinschränkungen an Brenno, Ticino, Maggia, Moesa | 4 Linien |
| `ac_064_1_v1_0_zone_protezione_ittica_linee` / `_poligoni` | **Schutzzonen** (Decreto 2025–2030): `nome_zona_protezione`, `descrizione`, `tipologia_corta` (permanent Fluss, permanent See, temporär Zander 1.4.–31.5., Netzverbot), `in_vigore_dal`, `url_decreto` | je 103 |

WMS für die Darstellung: `https://wms.geo.ti.ch/service`, Ebene `ti_035_1_v1_0_settori_pesca`.

### Jura

WMS `ju.env_04_33_secteurs_de_peche` (bereits als Bild). Der WFS `geoservices.jura.ch/wfs`
enthält keine Fischereiebene. Abfrage per GetFeatureInfo möglich.

### Appenzell Innerrhoden

WMS geoportal.ch `fischereikarte_kt_ai` (bereits als Bild). WFS `geoportal.ch/services/wfs/ktai`
blockiert Browser-Abfragen; Inhalt noch nicht geprüft.

## Keine Fischerei-Geodaten im kantonalen Dienst

| Kanton | Geprüft | Ergebnis |
|---|---|---|
| AR | geoportal.ch WMS `ktar` | keine Fischereiebene |
| BL | geowms.bl.ch | nur Verbreitungskarten einzelner Fischarten; Reviere vergeben die Gemeinden |
| BS | wms.geo.bs.ch, wfs.geo.bs.ch | nur Fischauf- und -abstiegsanlagen |
| UR | geo.ur.ch WMS | nur Gewässernetz und Gewässerraum |
| OW | gis-daten.ch Katalog | nur Nidwalden-Fischerei und Wildzählkreise |
| ZG | ZugMap | Fischatlas (Verbreitung, Bestände), keine Reviere; Dienstadresse noch offen |

## Noch zu prüfen (Dienst blockiert Browser-Abfragen)

- NE: `sitn.ne.ch/mapserv_proxy` (WMS/WFS) auf Réserves de pêche
- SZ: `map.geo.sz.ch/main/wsgi/mapserv_proxy` auf Fischgewässer, Schonstrecken, Fliegenstrecken
- AI: `geoportal.ch/services/wfs/ktai` auf Vektor der Fischereikarte
- ZG: Dienstadresse von ZugMap (Fischatlas)

## Rechtliche Grundlagen ohne Geodaten

Wo es keine Geodaten gibt, kommen Saison und Sperrzonen aus den Erlassen (`data/src/*.json`,
`data/updates.json`) und werden auf dem Gewässernetz der Grundkarte innerhalb der Kantonsgrenze
(`data/canton-areas.json`) dargestellt.
