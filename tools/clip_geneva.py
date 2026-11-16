"""Clip SITG fishing sector 100 to the Swiss cantonal boundary in the Léman."""
import json
from pathlib import Path
import sys
from urllib.request import urlopen

from shapely import get_parts, make_valid, union_all
from shapely.geometry import mapping, shape


def main():
    cache = Path(sys.argv[1]) / "geneva-boundary.json" if len(sys.argv) > 1 else None
    if cache and cache.exists():
        canton = json.loads(cache.read_bytes())
    else:
        url = ("https://api3.geo.admin.ch/rest/services/api/MapServer/"
               "ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/25?sr=4326&geometryFormat=geojson")
        with urlopen(url, timeout=45) as response:
            canton = json.load(response)["feature"]
        if cache:
            cache.write_text(json.dumps(canton), encoding="utf8")
    if canton["properties"]["ak"] != "GE":
        raise ValueError("Expected the Geneva canton polygon from swissBOUNDARIES3D")
    lake = make_valid(shape(json.load(sys.stdin)))
    clipped = lake.intersection(make_valid(shape(canton["geometry"])))
    sector = union_all([part for part in get_parts(clipped) if part.geom_type in ("Polygon", "MultiPolygon")])
    if sector.geom_type not in ("Polygon", "MultiPolygon") or sector.is_empty:
        raise ValueError("Missing lake sector geometry")
    json.dump(mapping(sector), sys.stdout)


if __name__ == "__main__":
    main()
