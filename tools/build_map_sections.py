"""Build the mobile map from public cantonal geometries (Python, Shapely 2, pyproj).

Run after build_zone_index.py for an SG/GR refresh. An optional --cache directory
holds only the original AG GeoPackages and paginated ZH GeoJSON downloads.
The browser uses one overview per canton and requests detail cells on demand.
"""
import argparse
from collections import defaultdict
from datetime import date
from hashlib import sha256
from io import BytesIO
import json
from math import floor
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree
from zipfile import ZipFile

from pyproj import Transformer
import shapely
from shapely.geometry import LineString, MultiLineString, Polygon, shape

from build_zone_index import DATA, encode_path

TO_METRES = Transformer.from_crs(4326, 2056, always_xy=True).transform
TO_DEGREES = Transformer.from_crs(2056, 4326, always_xy=True).transform
AG = "https://api.geo.ag.ch/v1/data/downloads/ch.ag.geo.aw.{}/download/GeoPackage/kanton_aargau"
ZH = "https://maps.zh.ch/wfs/OGDZHWFS?"
SO = "https://geo.so.ch/api/wfs?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=ch.so.awjf.gewaesser.patentgewaesser&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326"


def transform(projection, geom):
    return shapely.transform(geom, projection, interleaved=False)


def compact_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def clean(value):
    return str(value or "").strip()


def paths(g):
    if g.geom_type.startswith("Multi"):
        yield from g.geoms
    elif not g.is_empty:
        yield g


def ag_rows(cache, key, fields):
    file = cache / (key + ".gpkg")
    if not file.exists():
        with ZipFile(BytesIO(urlopen(AG.format(key), timeout=120).read())) as archive:
            member, = [n for n in archive.namelist() if n.lower().endswith(".gpkg")]
            file.write_bytes(archive.read(member))
    with sqlite3.connect(file) as db:
        table, geom, sr = db.execute("SELECT table_name,column_name,srs_id FROM gpkg_geometry_columns").fetchone()
        assert sr == 2056
        for blob, *attrs in db.execute(f'SELECT "{geom}",{fields} FROM "{table}" ORDER BY OBJECTID'):
            offset = 8 + (0, 32, 48, 48, 64)[(blob[3] >> 1) & 7]
            yield shapely.from_wkb(blob[offset:]), attrs


def only(values):
    return next(iter(values)) if len(values) == 1 else ""


def solothurn(cache):
    file = cache / "solothurn-wfs.json"
    if not file.exists():
        file.write_bytes(urlopen(SO, timeout=60).read())
    zones = {}
    for feature in json.loads(file.read_text(encoding="utf8"))["features"]:
        p = feature["properties"]
        key = tuple(" ".join(clean(p.get(k)).split()) for k in ("revierid", "fischerei", "fischbestand", "beschreibung"))
        if not key[0]:
            continue
        row = zones.setdefault(key, dict(zip(("id", "art", "b", "t"), key), l=[]))
        for line in paths(shape(feature["geometry"])):
            if line.geom_type != "LineString":
                raise ValueError("Unexpected SO shape: " + line.geom_type)
            simplified = transform(TO_DEGREES, transform(TO_METRES, line).simplify(1))
            row["l"].append([[round(x,5), round(y,5)] for x,y,*_ in simplified.coords])
    if len(zones) < 10:
        raise ValueError("Incomplete Solothurn data")
    data = {"official": True, "precision": 1, "date": date.today().isoformat(), "features": list(zones.values())}
    (DATA / "so-sections.json").write_bytes(compact_json(data).encode("utf8"))


def aargau(cache):
    names, local_names, reaches = defaultdict(set), defaultdict(set), defaultdict(set)
    for layer in ("fish", "fisp"):
        for _, (num, name, rev, title) in ag_rows(cache, layer, "BNUM,BACHNAME,FNR,REVIERNAME"):
            if clean(num) and clean(name):
                names[clean(num)].add(clean(name))
                local_names[clean(num), rev].add(clean(name))
            if clean(title):
                reaches[rev].add(clean(title))
    for layer in ("fish", "fisp", "fschonp"):
        cols = {"fish": "BNUM,BACHNAME,FNR,REVIERNAME,DOLUNGEN,ART,TRNR",
                "fisp": "BNUM,BACHNAME,FNR,REVIERNAME,0,'',TRNR", "fschonp": "BNUM,'',FNR,'',0,'',0"}[layer]
        for g, (num, name, rev, title, buried, art, part) in ag_rows(cache, layer, cols):
            name = clean(name) or only(local_names[clean(num), rev]) or only(names[clean(num)])
            title = clean(title) or only(reaches[rev])
            kind = "Schongebiet" if layer == "fschonp" else "Fischereirevier"
            # Keep water and reach identifiers separate. No inference of fishing rights
            # from a name, the river width, the letter codes, or an adjacent shape.
            info = " · ".join(s for s in ("Bach-Nr. " + clean(num) if clean(num) else "",
                                          "Teilrevier " + str(part) if part else "") if s)
            meta = (name, kind, str(rev) if rev is not None else "", title, info, bool(buried), "")
            yield meta, (clean(num), art, part), g


def zurich(cache):
    for layer in ("gewaessernetz_l", "stillgewaesser_f"):
        file = cache / (layer + ".json")
        if not file.exists():
            query = dict(service="WFS", version="2.0.0", request="GetFeature",
                         typeNames="ms:ogd-0314_giszhpub_fischrevier_" + layer, srsName="EPSG:4326")
            hits = ElementTree.parse(urlopen(ZH + urlencode(dict(query, resultType="hits")), timeout=60))
            expected = int(hits.getroot().attrib["numberMatched"])
            features = []
            for offset in range(0, expected, 2500):
                page = dict(query, startIndex=offset, count=2500, sortBy="geodb_oid",
                            outputFormat="application/json; subtype=geojson")
                features.extend(json.load(urlopen(ZH + urlencode(page), timeout=120))["features"])
            assert len({f["properties"]["geodb_oid"] for f in features}) == len(features) == expected
            file.write_text(compact_json(features), encoding="utf8")
        for f in json.loads(file.read_text(encoding="utf8")):
            p = f["properties"]
            name = clean(p.get("gewaessername"))
            if name.lower() in ("unbekannt", "unbenannt", "ohne namen", "namenlos", "-"):
                name = ""
            rev = clean(p.get("reviernummer"))
            meta = (name, "Fischereirevier" if rev else "Revier unbekannt", rev, clean(p.get("fischrevier")),
                    clean(p.get("bemerk_beding")), p.get("eingedolt_ueber_20m") == "eingedolt",
                    clean(p.get("gewaessertyp")).lower())
            yield meta, (), transform(TO_METRES, shape(f["geometry"]))


def decode(encoded):
    it = iter(map(ord, encoded))
    point = [0, 0]
    while True:
        for axis in range(2):
            value, shift = 0, 0
            for char in it:
                number = char - 63
                value |= (number & 31) << shift
                if number < 32:
                    break
                shift += 5
            else:
                return
            point[axis] += ~(value >> 1) if value & 1 else value >> 1
        yield tuple(x / 100000 for x in point)


def eastern(canton):
    data = json.loads((DATA / f"zones-{canton}.json").read_text(encoding="utf8"))
    for f in data["features"]:
        kind, name = f["kind"], f["name"]
        if canton == "SG":
            # Bezeichnung names an entire Revier and can describe several streams.
            meta = ("", "Fischereirevier", kind.removeprefix("Revier "), name, "", False, "")
        else:
            meta = (name if name != kind else "", kind, "", "", "", False, "")
        for line in f["lines"]:
            yield meta, (), transform(TO_METRES, LineString(decode(line)))
        for rings in f["polygons"]:
            yield meta, (), transform(TO_METRES, Polygon(list(decode(rings[0])), [list(decode(r)) for r in rings[1:]]))


def sections(records):
    groups = defaultdict(dict)
    for meta, identity, geom in records:
        for g in paths(geom):
            if not g.is_empty and g.length > 0:
                groups[meta, identity, g.geom_type][g.wkb] = g
    for (meta, identity, typ), segments in groups.items():
        if typ == "LineString" and len(segments) > 1:
            # GEOS stops at branches. Revier, water ID, status and culverts are
            # separate groups; disjoint tributaries never share a selection.
            merged = shapely.line_merge(MultiLineString(list(segments.values())))
            for g in paths(merged):
                yield meta, identity, g
        else:
            for g in segments.values():
                yield meta, identity, g


def encoded(g, tolerance):
    simplified = transform(TO_DEGREES, g.simplify(tolerance, preserve_topology=True))
    def path(ring):
        return encode_path([(x, y) for x, y, *_ in ring.coords])
    if simplified.geom_type == "Polygon":
        return [path(simplified.exterior)] + [path(r) for r in simplified.interiors]
    return path(simplified)


class Cell:
    def __init__(self):
        self.metadata = {}
        self.rows = []

    def add(self, meta, fid, zoom, size, bounds, geometry):
        index = self.metadata.setdefault(meta, len(self.metadata))
        self.rows.append([fid, index, zoom, size, bounds, geometry])

    def write(self, root, key):
        return write_asset(root, key, [list(self.metadata), self.rows])


def write_asset(root, key, payload):
    content = compact_json(payload).encode("utf8")
    name = key + "-" + sha256(content).hexdigest()[:10] + ".json"
    (root / name).write_bytes(content)
    return name


def connected(ids, records):
    """Partition matching water names by actual contact, never by proximity."""
    geometries = [records[i][2] for i in ids]
    tree = shapely.STRtree(geometries)
    remaining = set(range(len(ids)))
    while remaining:
        stack = [remaining.pop()]
        component = []
        while stack:
            pos = stack.pop()
            component.append(ids[pos])
            neighbours = remaining.intersection(tree.query(geometries[pos], predicate="intersects"))
            remaining.difference_update(neighbours)
            stack.extend(neighbours)
        yield sorted(component)


def zone_groups(code, records):
    kinds = defaultdict(set)
    if code == "AG":
        for meta, (number, art, part), _ in records:
            if number and art:
                kinds[meta[2], number, part].add(art)
    official, touching = defaultdict(list), defaultdict(list)
    for fid, (meta, identity, geom) in enumerate(records):
        name, kind, rev, region, detail, _, rule = meta
        if code == "AG":
            number, art, part = identity
            if not (number and rev):
                continue
            if kind == "Schongebiet":
                touching[kind, rev, number].append(fid)
            else:
                # Water footprints have no ART. Attach them only if their
                # water number, Revier and Teilrevier identify a single class.
                klass = art or only(kinds[rev, number, part])
                target = official if klass else touching
                target[kind, rev, number, part, klass].append(fid)
        elif name and (code == "GR" or rev) and not any(word in name.lower() for word in ("zuflüsse", "inkl.", "einzugsgebiet")):
            touching[kind, rev, name, region, detail, rule].append(fid)
        elif code == "SG" and geom.geom_type == "Polygon":
            touching[kind, rev, region].append(fid)
        # SG supplies catchment names for many tributaries. The Revier number
        # alone cannot identify individual watercourses at their confluence.
    yield from (members for members in official.values() if len(members) > 1)
    for members in touching.values():
        if len(members) > 1:
            yield from (part for part in connected(members, records) if len(part) > 1)


def polygon_parts(geom):
    if geom.geom_type == "Polygon" and not geom.is_empty:
        yield geom
    elif hasattr(geom, "geoms"):
        for part in geom.geoms:
            yield from polygon_parts(part)


def selection_geometry(records, members):
    parts = []
    for buried in (False, True):
        geoms = [records[i][2] for i in members if records[i][0][5] == buried]
        lines = [g for g in geoms if g.geom_type == "LineString"]
        areas = [p for g in geoms if g.geom_type == "Polygon" for p in polygon_parts(shapely.make_valid(g))]
        if lines or areas:
            linework = shapely.line_merge(shapely.union_all(lines))
            parts.append([int(buried), [encoded(g, 1) for g in paths(linework) if g.geom_type == "LineString"],
                          [encoded(g, 1) for g in polygon_parts(shapely.union_all(areas))]])
    return parts


def selection_files(code, records, root):
    shards, index = defaultdict(dict), []
    for members in zone_groups(code, records):
        group_id = min(members)
        shard = str(group_id // 512)
        shards[shard][group_id] = selection_geometry(records, members)
        index.append([members, shard])
    files = {shard: write_asset(root, f"{code}-selection-{shard}", data) for shard, data in shards.items()}
    return write_asset(root, code + "-groups", index), files


def sg_districts(root):
    # The source identifies a complete fishery district, sometimes containing
    # many separate streams. Keep each original path and all polygon holes.
    districts = defaultdict(lambda: defaultdict(lambda: [[], []]))
    data = json.loads((DATA / "zones-SG.json").read_text(encoding="utf8"))
    for feature in data["features"]:
        rev = feature["kind"].removeprefix("Revier ")
        if not rev.isdigit():
            continue
        lines, polygons = districts[rev[:-2] or "0"][rev]
        lines.extend(feature["lines"])
        polygons.extend(feature["polygons"])
    return {key: write_asset(root, "SG-districts-" + key,
                             {rev: [["Fischereirevier", 0, *paths]] for rev, paths in values.items()})
            for key, values in districts.items()}


def numbered_districts(canton, records, root):
    districts = defaultdict(lambda: defaultdict(lambda: [[], []]))
    for meta, _, geom in records:
        _, kind, rev, _, _, buried, _ = meta
        if not rev.isdigit():
            continue
        lines, polygons = districts[rev][kind, int(buried)]
        (polygons if geom.geom_type == "Polygon" else lines).append(encoded(geom, 3))
    shards = defaultdict(dict)
    for rev, parts in districts.items():
        shards[rev[:-1] or "0"][rev] = [[kind, buried, *shapes] for (kind, buried), shapes in parts.items()]
    return {key: write_asset(root, canton + "-districts-" + key, rows) for key, rows in shards.items()}


def build(canton, records, root):
    cells, overview, places = defaultdict(Cell), Cell(), {}
    records = list(sections(records))
    for fid, (meta, _, g) in enumerate(records):
        poly = g.geom_type == "Polygon"
        size = round(max(g.bounds[2] - g.bounds[0], g.bounds[3] - g.bounds[1])) if poly else round(g.length)
        name, kind, rev, region, _, buried, _ = meta
        hydronym = name or (region if canton == "SG" else "")
        major = hydronym.casefold() in {"aare", "rhein", "reuss", "limmat", "glatt", "thur", "sitter", "linth", "wigger", "suhre", "vorderrhein", "hinterrhein", "zürich-obersee"}
        zoom = 8 if size >= 6000 or major else 9 if size >= 2300 else 10 if size >= 850 else 11 if size >= 330 else 12
        if buried:
            zoom = 14
        geom = encoded(g, 1)
        w, s, e, n = transform(TO_DEGREES, g).bounds
        assert 5.5 < w <= e < 11 and 45 < s <= n < 48, (canton, meta, (w, s, e, n))
        bounds = [round(v, 5) for v in (w, s, e, n)]
        for x in range(floor(w * 5), floor(e * 5) + 1):
            for y in range(floor(s * 8), floor(n * 8) + 1):
                cells[f"{x}_{y}"].add(meta, fid, zoom, size, bounds, geom)
        if zoom <= 11:
            overview.add(meta, fid, zoom, size, bounds, encoded(g, 12))
        title = name or region
        if title:
            key = (title, rev, kind)
            rank = (not buried, not poly, size)
            if key not in places or rank > places[key][0]:
                point = g.representative_point() if poly else g.interpolate(.5, normalized=True)
                lon, lat = TO_DEGREES(point.x, point.y)
                places[key] = (rank, [title, rev, kind, round(lat, 5), round(lon, 5)])
    result = {key: cell.write(root, canton + "-" + key) for key, cell in sorted(cells.items())}
    result["overview"] = overview.write(root, canton + "-overview")
    result["groups"], result["selections"] = selection_files(canton, records, root)
    if canton == "SG":
        result["districts"] = sg_districts(root)
    elif canton in ("AG", "ZH"):
        result["districts"] = numbered_districts(canton, records, root)
    result["search"] = write_asset(root, canton + "-search", [v[1] for v in places.values()])
    result["built"] = date.today().isoformat()
    print(canton, len(cells), "cells,", len(overview.rows), "overview reaches", flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    root = DATA / "sections"
    root.mkdir(exist_ok=True)
    with TemporaryDirectory() as temp:
        cache = args.cache or Path(temp)
        cache.mkdir(exist_ok=True, parents=True)
        solothurn(cache)
        manifest = {code: build(code, records, root) for code, records in
                    (("AG", aargau(cache)), ("ZH", zurich(cache)), ("SG", eastern("SG")), ("GR", eastern("GR")))}
    (root / "index.json").write_text(compact_json(manifest), encoding="utf8")
    current = {name for cells in manifest.values() for v in cells.values()
               for name in (v.values() if isinstance(v, dict) else [v])}
    for f in root.glob("*-*.json"):
        if f.name not in current:
            f.unlink()


if __name__ == "__main__":
    main()
