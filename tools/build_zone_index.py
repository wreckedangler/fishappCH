"""Refresh the map hit-test geometries from SG and GR public WFS services."""
import json
from datetime import date
from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree as ET

DATA = Path(__file__).resolve().parents[1] / "data"
SG = "https://services.geo.sg.ch/wss/service/SG00021_WFS/guest?"
GR = "https://map.geo.gr.ch/mapserv_proxy?ogcserver=Kanton+Graub%C3%BCnden%2C+Fischerei&"
GR_LAYERS = {
    "Fischereigewaesser_Fliessgewaesser": "Fischgewässer",
    "Fischereigewaesser_See": "Fischgewässer",
    "Naturkoederverbot_Fluesse": "Naturköderverbot",
    "Naturkoederverbot_Seen": "Naturköderverbot",
    "Fluss_private_Rechte": "Privates Fischereirecht",
    "Seen_private_Rechte": "Privates Fischereirecht",
    "Uferfischerei_mit_kant_Bewilligung": "Uferfischerei mit Bewilligung",
    "Nationalpark": "Nationalpark",
    "Schongewaesser_Fluesse": "Schongewässer",
    "Schongewaesser_Seen": "Schongewässer",
}


def wgs84(east, north):
    # swisstopo LV95 -> WGS84 approximation (metre accuracy).
    y, x = (east - 2600000) / 1e6, (north - 1200000) / 1e6
    lon = 2.6779094 + 4.728982*y + 0.791484*y*x + 0.1306*y*x*x - 0.0436*y**3
    lat = 16.9023892 + 3.238272*x - 0.270978*y*y - 0.002528*x*x - 0.0447*y*y*x - 0.014*x**3
    return lon / 0.36, lat / 0.36


def compact(line):
    # Douglas-Peucker with a two-metre tolerance in local metric coordinates.
    keep = {0, len(line)-1}
    stack = [(0, len(line)-1)]
    while stack:
        first, last = stack.pop()
        ax, ay = line[first][:2]
        bx, by = line[last][:2]
        dx, dy = (bx-ax)*75000, (by-ay)*111000
        length = dx*dx + dy*dy
        maximum, split = 4, None
        for i in range(first+1,last):
            x, y = (line[i][0]-ax)*75000, (line[i][1]-ay)*111000
            t = max(0, min(1, (x*dx+y*dy)/length)) if length else 0
            distance = (x-t*dx)**2 + (y-t*dy)**2
            if distance > maximum:
                maximum, split = distance, i
        if split is not None:
            keep.add(split)
            stack.extend([(first,split),(split,last)])
    indices = sorted(keep)
    if line[0] == line[-1] and len(indices) < 4:
        indices = range(len(line))
    return [[round(line[i][0],5), round(line[i][1],5)] for i in indices]


def encode_path(points):
    # Delta encoding at five decimal places. The client decodes only matched bounding boxes.
    encoded = []
    previous = [0, 0]
    for point in points:
        for axis, coord in enumerate(point):
            value = round(coord * 100000)
            delta = value - previous[axis]
            previous[axis] = value
            number = delta * 2 if delta >= 0 else -delta * 2 - 1
            while number >= 32:
                encoded.append(chr((number % 32) + 95))
                number //= 32
            encoded.append(chr(number + 63))
    return "".join(encoded)


def row(name, kind, lines, polygons):
    points = [p for line in lines for p in line] + [p for rings in polygons for line in rings for p in line]
    xs, ys = zip(*points)
    return dict(name=name, kind=kind, bounds=[min(xs),min(ys),max(xs),max(ys)], lines=[encode_path(line) for line in lines],
                polygons=[[encode_path(ring) for ring in poly] for poly in polygons])


def st_gallen():
    rows = []
    for layer in ["Fliessgewaesser", "stehendeGewaesser"]:
        url = SG+"SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=SG00021:Pachtgewaesser_"+layer+"&SRSNAME=urn:ogc:def:crs:EPSG::2056&OUTPUTFORMAT=GEOJSON"
        # LV95 and our own conversion: the service's EPSG:4326 output omits the datum shift
        # and lies about 175 m off (91 m east, 150 m north).
        for f in json.load(urlopen(url, timeout=90))["features"]:
            g, p = f["geometry"], f["properties"]
            paths = g["coordinates"]
            paths = [[[wgs84(*pt[:2]) for pt in line] for line in part] if g["type"] == "MultiPolygon"
                     else [wgs84(*pt[:2]) for pt in part] for part in paths]
            if g["type"] == "MultiLineString":
                lines, polygons = [compact(line) for line in paths], []
            elif g["type"] == "MultiPolygon":
                lines, polygons = [], [[compact(ring) for ring in poly] for poly in paths]
            else:
                raise ValueError(g["type"])
            rows.append(row(p["Bezeichnung"], "Revier "+str(p["Kurzbezeichnung"]), lines, polygons))
    return rows


def graubuenden():
    rows = []
    for layer, kind in GR_LAYERS.items():
        url = GR+"service=WFS&version=1.1.0&request=GetFeature&typeName=FFS_"+layer
        root = ET.parse(urlopen(url, timeout=90))
        members = root.findall(".//{*}featureMember")
        if not members:
            raise ValueError(layer)
        for member in members:
            f = member[0]
            def coords(node):
                values = iter(map(float, node.find(".//{*}posList").text.split()))
                return compact([wgs84(e,n) for e,n in zip(values,values)])
            lines = [coords(line) for line in f.findall(".//{*}LineString")]
            polygons = [[coords(r) for r in poly.findall(".//{*}LinearRing")] for poly in f.findall(".//{*}Polygon")]
            name = f.findtext("{*}gi_name") or f.findtext("{*}gewaesser") or f.findtext("{*}name") or kind
            rows.append(row(name, kind, lines, polygons))
    return rows


if __name__ == "__main__":
    for canton, fetch, source in [("SG", st_gallen, SG), ("GR", graubuenden, GR)]:
        data = dict(source=source, date=date.today().isoformat(), features=fetch())
        (DATA / ("zones-"+canton+".json")).write_text(json.dumps(data, ensure_ascii=False, separators=(",",":")), encoding="utf8")
        print(canton, len(data["features"]))
