"""One-off: move the existing SG section assets onto the correct datum.

The SG WFS returned EPSG:4326 without the CH1903+ -> WGS84 datum shift (about 175 m off).
build_zone_index.py now fetches LV95 and converts itself; this script corrects the data
already built from the old download. Fit from 18 points across the canton, residual < 0.1 m.
"""
import json
from pathlib import Path
from normalize_sections import decode, write_asset, SECTIONS

CX = (-0.0012421348731500817, -0.00014835695871689977, -2.8111170307466577e-05)
CY = (-0.001335890210675493, 1.6716633561115613e-05, -0.00011221406376624401)


def fix(x, y):
    u, v = x - 9.3, y - 47.2
    return x + CX[0] + CX[1]*u + CX[2]*v, y + CY[0] + CY[1]*u + CY[2]*v


def encode(points):
    out, prev = [], [0, 0]
    for p in points:
        for axis in range(2):
            value = round(p[axis] * 1e5)
            d, prev[axis] = value - prev[axis], value
            n = d * 2 if d >= 0 else -d * 2 - 1
            while n >= 32:
                out.append(chr((n & 31 | 32) + 63))
                n >>= 5
            out.append(chr(n + 63))
    return "".join(out)


def path(s):
    return encode([fix(*p) for p in decode(s)])


def box(b):
    (w, s), (e, n) = fix(b[0], b[1]), fix(b[2], b[3])
    return [round(w, 5), round(s, 5), round(e, 5), round(n, 5)]


def main():
    index_path = SECTIONS / "index.json"
    index = json.loads(index_path.read_text(encoding="utf8"))
    entry, keep, old = index["SG"], set(), set()
    for key, file in list(entry.items()):
        if key[:1].isdigit() or key == "overview":
            meta, rows = json.loads((SECTIONS / file).read_text(encoding="utf8"))
            for r in rows:
                r[4] = box(r[4])
                r[5] = [path(p) for p in r[5]] if isinstance(r[5], list) else path(r[5])
            entry[key] = write_asset(f"SG-{key}", [meta, rows], keep)
            old.add(file)
    for shard, file in entry["districts"].items():
        data = json.loads((SECTIONS / file).read_text(encoding="utf8"))
        for parts in data.values():
            for part in parts:
                part[2] = [path(p) for p in part[2]]
                part[3] = [[path(r) for r in poly] if isinstance(poly, list) else path(poly) for poly in part[3]]
        entry["districts"][shard] = write_asset(f"SG-districts-{shard}", data, keep)
        old.add(file)
    search = json.loads((SECTIONS / entry["search"]).read_text(encoding="utf8"))
    for s in search:
        s[4], s[3] = (round(v, 5) for v in fix(s[4], s[3]))
    old.add(entry["search"])
    entry["search"] = write_asset("SG-search", search, keep)
    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    for f in old - keep:
        (SECTIONS / f).unlink()
    print("SG korrigiert:", len(keep), "Dateien")


if __name__ == "__main__":
    main()
