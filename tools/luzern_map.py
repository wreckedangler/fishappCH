"""Public Luzern map sources. Keep fisheries, local conditions and physical water distinct."""
from collections import defaultdict
import json
from urllib.parse import urlencode
from urllib.request import urlopen

OGD = "https://public.geo.lu.ch/ogd/rest/services/managed/"
REVIERE = OGD + "FISCHREV_DS_V1_MP/MapServer/"
PATENTE = "https://svc.geo.lu.ch/geoshare2/rest/services/managed/WKFAUNAX_COL_V1_MP/MapServer/0"
RESERVATE = OGD + "SVOXXXXX_COL_V2_MP/MapServer/5"
GEWAESSER = OGD + "FLIESGEW_COL_V3_MP/MapServer/170"
FEDERAL = "https://api3.geo.admin.ch/rest/services/api/MapServer/"
BOUNDARY = FEDERAL + "ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/3?sr=4326&geometryFormat=geojson"
# Cantonal lake names and stable swissTLM3D water IDs for lakes outside the
# fishery layers. The federal geometries continue across cantonal borders.
LAKES = {"CH0091750000": ("Zugersee", "zugersee"), "CH0091640000": ("Mauensee", "see"),
         "CH0091650000": ("Soppensee", "see")}

# The polygon layer only contains FR_ID. These six districts have no row with
# FR_NAME in the line layer. Only water names from lawa's public register:
# https://lawa.lu.ch/-/media/LAWA/Dokumente/njf/Fischerei/angelfischerei/vz/vz_fischerei_obmaenner.pdf
PONDS = {102: "Torfweiher A (Grund)", 103: "Torfweiher B (Neuhugenhof)", 104: "Torfweiher C (Hugenhof)",
         105: "Torfweiher D", 107: "Tuetensee Menznau", 109: "Uffikoner Weiher"}


def read(url):
    with urlopen(url, timeout=90) as response:
        return json.load(response)


def cached(cache, key, fetch):
    file = cache / ("luzern-" + key + ".json")
    if file.exists():
        return json.loads(file.read_text(encoding="utf8"))
    data = fetch()
    file.write_bytes(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf8"))
    return data


def features(cache, key, service, fields, where="1=1"):
    def fetch():
        url = service + "/query?"
        ids = sorted(read(url + urlencode({"where": where, "f": "json", "returnIdsOnly": "true"}))["objectIds"])
        if not ids:
            raise ValueError("Empty Luzern layer " + key)
        rows = []
        for offset in range(0, len(ids), 350):
            batch = ids[offset:offset + 350]
            params = dict(f="geojson", outSR=4326, outFields="OBJECTID," + fields, orderByFields="OBJECTID",
                          objectIds=",".join(map(str, batch)), returnGeometry="true")
            page = read(url + urlencode(params))["features"]
            if sorted(f["properties"]["OBJECTID"] for f in page) != batch:
                raise ValueError("Incomplete Luzern layer " + key)
            rows.extend(page)
        return {"type": "FeatureCollection", "features": rows}
    return cached(cache, key, fetch)["features"]


def lake_or_river_group(name):
    if name.startswith("Hallwilersee"):
        return "hallwil"
    if name.startswith(("Staatssee (Luzerner See)", "Fischenze Meggen", "Fischenze Greppen", "Fischenze Weggis",
                        "Fischenze Vitznau", "Fischenze Bürgenberg", "Horwerbucht", "Ballenherren Luzern")):
        return "vws"
    return {"Sempachersee": "sempach", "Baldeggersee": "see", "Rotsee": "see", "Kleine Emme": "fluss",
            "Untere Reuss ab Reusszopf": "fluss"}.get(name, "")


def lake_feature(cache, water_id):
    params = dict(layer="ch.swisstopo.swisstlm3d-gewaessernetz", searchField="gwl_nr", searchText=water_id,
                  contains="false", returnGeometry="true", geometryFormat="geojson", sr=4326)
    results = cached(cache, water_id, lambda: read(FEDERAL + "find?" + urlencode(params))["results"])
    lake, = [f for f in results if f["properties"]["gwl_nr"] == water_id and f["properties"]["objektart"] == 101]
    return lake


def district_features(cache):
    return (features(cache, "fischrev-1", REVIERE + "1", "FLUSS_ID,FR_ID,FR_NAME,SHAPE_Length"),
            features(cache, "fischrev-2", REVIERE + "2", "FR_ID,SHAPE_Area"))


def features_in_metres(cache, projection):
    import shapely
    from shapely.geometry import shape

    def geometry(f):
        return shapely.transform(shape(f["geometry"]), projection, interleaved=False)

    lines, areas = district_features(cache)
    names = dict(PONDS)
    areas_to_mask, routes_to_mask = [], defaultdict(list)
    for f in lines:
        p, g = f["properties"], geometry(f)
        name, rev = (p["FR_NAME"] or "").strip(), p["FR_ID"]
        if name:
            names[rev] = name
        routes_to_mask[p["FLUSS_ID"]].append(g)
        yield (name, "Fischereirevier", str(rev), "", "", False, "fluss"), ("Fluss", p["FLUSS_ID"]), g
    for f in areas:
        rev, g = f["properties"]["FR_ID"], geometry(f)
        areas_to_mask.append(g)
        yield (names.get(rev, ""), "Fischereirevier", str(rev), "", "", False, "see" if rev in PONDS else ""), ("Fläche", rev), g

    for f in features(cache, "patents", PATENTE, "PATENT_NAME"):
        p, g = f["properties"], geometry(f)
        name = (p["PATENT_NAME"] or "").strip()
        # The published field truncates the last word of this official legend entry.
        if name == "Staatssee (Luzerner See) ohne Seebecken und Uferzo":
            name = "Staatssee (Luzerner See) ohne Seebecken und Uferzonen"
        kind = "Patentgebiet"
        if name.casefold() == "keine patente":
            kind, name = "Keine Patentausgabe", "Gebiet ohne Patentausgabe"
        # LAWA's register of Patentausgabestellen distinguishes the private rights
        # from the cantonal patent waters (including Horwerbucht and Staatssee).
        elif "fischenz" in name.casefold() or name in {"Baldeggersee", "Rotsee", "Luzerner Seebecken und obere Reuss",
                                                       "Ballenherren Luzern (Halbinsel Horw)"}:
            kind = "Privates Fischereirecht"
        areas_to_mask.append(g)
        yield (name, kind, "", "", "", False, lake_or_river_group(name)), ("Patentgebiet", p["OBJECTID"]), g

    filter_zones = "SRL_NR='711c' AND RECHTSTAT=4 AND ZONE_SVO IN ('Reservatzone','Ruhezone A','Ruhezone B')"
    for f in features(cache, "sempach-schutzzonen", RESERVATE, "ZONE_SVO", filter_zones):
        p = f["properties"]
        yield ("Sempachersee", p["ZONE_SVO"], "", "", "", False, "sempach"), ("Schutzfläche", p["OBJECTID"]), geometry(f)

    # The public water network is a neutral backdrop in areas outside a mapped
    # fishery. Never extend a Revier number or right using these geometries.
    canton = cached(cache, "canton", lambda: read(BOUNDARY)["feature"])
    if canton["properties"]["ak"] != "LU":
        raise ValueError("Wrong canton in swissBOUNDARIES3D")
    boundary = geometry(canton)
    mask = shapely.STRtree(areas_to_mask)
    for water_id, (name, rule) in LAKES.items():
        lake = geometry(lake_feature(cache, water_id)).intersection(boundary)
        for index in mask.query(lake, predicate="intersects"):
            lake = lake.difference(areas_to_mask[index])
        for part in shapely.get_parts(lake):
            if part.geom_type == "Polygon" and not part.is_empty:
                yield (name, "Gewässer", "", "", "", False, rule), ("See", water_id), part
    route_masks = {route: shapely.union_all(parts).buffer(5) for route, parts in routes_to_mask.items()}
    for f in features(cache, "oberirdisch", GEWAESSER, "GEW_NAME,GEW_ID", "VERLAUF_QL=100"):
        p = f["properties"]
        g = geometry(f).intersection(boundary)
        if p["GEW_ID"] in route_masks:
            g = g.difference(route_masks[p["GEW_ID"]])
        for index in mask.query(g, predicate="intersects"):
            g = g.difference(areas_to_mask[index])
        name = (p["GEW_NAME"] or "").strip()
        if name.lower() in ("unbenannt", "namenlos", "unbekannt", "-"):
            name = ""
        for line in shapely.get_parts(g):
            if line.geom_type == "LineString" and line.length >= 2:
                yield (name, "Gewässer", "", "", "", False, "fluss"), ("Gewässer", p["GEW_ID"]), line
