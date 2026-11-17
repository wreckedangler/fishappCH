"""Refresh the Luzern district directory after build_map_sections.py (requires pdfplumber).

Run without arguments to download both current GIS layers and the LAWA register.
--cache reuses original source files for a reproducible build.
"""
import argparse
from collections import defaultdict
import json
from math import isfinite
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

import pdfplumber

from luzern_map import district_features

DATA = Path(__file__).resolve().parents[1] / "data"
REGISTER = "https://lawa.lu.ch/-/media/LAWA/Dokumente/njf/Fischerei/angelfischerei/vz/vz_fischerei_obmaenner.pdf"


def listed_names(cache):
    pdf = cache / "lu-revierverzeichnis.pdf"
    if not pdf.exists():
        with urlopen(REGISTER, timeout=60) as response:
            pdf.write_bytes(response.read())
    names = {}
    with pdfplumber.open(pdf) as document:
        first = document.pages[0]
        if "2021 - 2028" not in first.extract_text():
            raise ValueError("Check the new lease period and its validity in map-rights.js")
        header = first.extract_words()
        number_column = next(w for w in header if w["text"] == "Nr")
        columns = sorted(w["x0"] for w in header if abs(w["top"] - number_column["top"]) < 2)
        left, name_x, right = columns[:3]
        for page in document.pages:
            # Only the two public district columns belong in the app.
            words = page.crop((left - 2, 0, right - 1, page.height)).extract_words()
            for w in words:
                if not (w["text"].isdigit() and w["x0"] < name_x - 3 and len(w["text"]) <= 3):
                    continue
                rev = int(w["text"])
                name = " ".join(v["text"] for v in words if v["x0"] >= name_x - 2 and abs(v["top"] - w["top"]) < 2)
                if rev in names or not name:
                    raise ValueError(f"Check register row {rev}")
                names[rev] = name
    return names


def build(cache):
    lines, areas = district_features(cache)
    listed = listed_names(cache)
    rows = defaultdict(dict)
    for features, count, measure, field in ((lines, "lines", "metres", "SHAPE_Length"),
                                            (areas, "areas", "m2", "SHAPE_Area")):
        for f in features:
            p = f["properties"]
            rev = int(p["FR_ID"])
            row = rows[rev]
            name = (p.get("FR_NAME") or "").strip()
            if name:
                if row.setdefault("name", name) != name:
                    raise ValueError(f"Conflicting GIS names in Revier {rev}")
            value = p[field]
            if not isfinite(value) or value <= 0:
                raise ValueError(f"Invalid {field} in Revier {rev}")
            row[count] = row.get(count, 0) + 1
            row[measure] = row.get(measure, 0) + value
    index = json.loads((DATA / "sections/index.json").read_text(encoding="utf8"))["LU"]
    places = json.loads((DATA / "sections" / index["search"]).read_text(encoding="utf8"))
    mapped = {int(rev): (name, lat, lon) for name, rev, kind, lat, lon in places if kind == "Fischereirevier"}
    if mapped.keys() != rows.keys() or listed.keys() - rows.keys():
        raise ValueError("The map, GIS and published register must be reconciled before release")
    for rev, row in rows.items():
        if "name" not in row:  # Polygon source supplies only FR_ID.
            row["name"] = listed[rev]
        name, row["lat"], row["lon"] = mapped[rev]
        if name != row["name"]:
            raise ValueError(f"Rebuild the map index for Revier {rev}: {row['name']}")
        for field in ("metres", "m2"):
            if field in row:
                row[field] = round(row[field], 1)
        if rev in listed:
            row["listed"] = True
            if listed[rev] != name:
                row["registerName"] = listed[rev]
    encoded = [f'  "{rev}": ' + json.dumps(rows[rev], ensure_ascii=False, separators=(",", ":"))
               for rev in sorted(rows)]
    output = "{\n" + ",\n".join(encoded) + "\n}\n"
    (DATA / "luzern-reviere.json").write_bytes(output.encode("utf8"))
    print(f"{len(rows)} Reviere, {len(lines)} Linien, {len(areas)} Flächen, {len(listed)} im Pachtverzeichnis")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    with TemporaryDirectory() as temp:
        cache = args.cache or Path(temp)
        cache.mkdir(parents=True, exist_ok=True)
        build(cache)
