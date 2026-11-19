#!/usr/bin/env python3
"""Normalise the tiled water sections after build_map_sections.py.

Why: the cantonal sources split one water into many short pieces (culverts, bridges,
branches, slightly different digitising). Tapping such a piece showed a fragment
with little or no information. This step makes every reach of one water and one
fishery zone a single selectable zone and removes duplicate slivers.

What it does (pure Python, no GIS libraries, idempotent):
  1. LU: drop pieces of the neutral water network that lie completely on a Revier or
     Patent line (left over from masking with a 5 m buffer). They duplicate a line
     that already carries the right information. The LU source omits culverts, so
     network pieces of one stream join across gaps up to 80 m, and standalone
     open bits under 60 m between long culverts are dropped.
  2. All cantons: join pieces of the same water and zone into one zone group.
     Same zone = same name, kind, Revier, region, detail and rule (culvert flag ignored).
     Pieces join when an end touches the other line (3 m) or two ends lie within
     25 m (culverts and bridges missing in the source). Existing groups are kept.
  3. Rewrite cells, overview, groups and selection files in the same format and
     update data/sections/index.json. Unreferenced old files are removed.

Run:  python3 tools/normalize_sections.py [--dry-run]
"""
import argparse, json, math, re, sys
from collections import defaultdict
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = ROOT / "data" / "sections"
TOUCH_M = 3.0      # end of a piece on the other line
GAP_M = 25.0       # end to end across a missing culvert or bridge
SLIVER_M = 20.0    # LU network piece completely within this distance of a Revier line
SHORT_SLIVER = (150.0, 35.0)  # LU: short network piece (m) completely within (m) of a Revier line
LU_CRUMB_M = 60.0  # LU: standalone network piece shorter than this is dropped
LU_GAP_M = 80.0    # LU: the source omits culverts entirely, streams break at every one


def decode(path):
    out, x, y, i = [], 0, 0, 0
    n = len(path)
    while i < n:
        vals = []
        for _ in range(2):
            v = s = 0
            while True:
                c = ord(path[i]) - 63
                i += 1
                v |= (c & 31) << s
                s += 5
                if c < 32:
                    break
            vals.append(~(v >> 1) if v & 1 else v >> 1)
        x += vals[0]
        y += vals[1]
        out.append((x / 1e5, y / 1e5))
    return out


def metres(lat):
    return 111320 * math.cos(math.radians(lat)), 111132


def dist(a, b):
    mx, my = metres(a[1])
    return math.hypot((a[0] - b[0]) * mx, (a[1] - b[1]) * my)


def seg_dist(p, a, b):
    mx, my = metres(p[1])
    ax, ay = (a[0] - p[0]) * mx, (a[1] - p[1]) * my
    bx, by = (b[0] - p[0]) * mx, (b[1] - p[1]) * my
    dx, dy = bx - ax, by - ay
    ll = dx * dx + dy * dy
    t = 0 if ll == 0 else max(0, min(1, -(ax * dx + ay * dy) / ll))
    return math.hypot(ax + t * dx, ay + t * dy)


class Grid:
    """Spatial hash of line segments, cell about 30 m."""
    def __init__(self, size=0.0004):
        self.size = size
        self.cells = defaultdict(list)

    def key(self, p):
        return int(p[0] / self.size), int(p[1] / self.size)

    def add_line(self, ident, pts):
        for a, b in zip(pts, pts[1:]):
            k1, k2 = self.key(a), self.key(b)
            for gx in range(min(k1[0], k2[0]), max(k1[0], k2[0]) + 1):
                for gy in range(min(k1[1], k2[1]), max(k1[1], k2[1]) + 1):
                    self.cells[gx, gy].append((ident, a, b))

    def near(self, p, radius_cells=1):
        gx, gy = self.key(p)
        for dx in range(-radius_cells, radius_cells + 1):
            for dy in range(-radius_cells, radius_cells + 1):
                yield from self.cells.get((gx + dx, gy + dy), ())


def densify(pts, step=8.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(dist(a, b) / step))
        for k in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    return out


def write_asset(key, payload, keep):
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    name = key + "-" + sha256(content).hexdigest()[:10] + ".json"
    (SECTIONS / name).write_bytes(content)
    keep.add(name)
    return name


class UF:
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


RESTRICTED = ("schon", "privat", "verbot", "reservat", "keine patent")


def bind_rule(code, meta, poly):
    """Attach the cantonal rule group (data/updates.json, RULES[c].w) where the source has none.

    Only where the assignment is unambiguous from official names and numbers:
      AG (AFV): Rhein, Aare, Reuss, Limmat = fluss; Aare Revier 20 and 612 =
          Grenzstrecke AG/SO Murgenthal-Aarburg; Suhre, Aabach = suhre;
          Hallwilersee = hallwil; other lakes and ponds = weiher; all other
          running waters = bach.
      GR: lakes = see; Moesa and Inn = moesa_inn; Alpenrhein = alpenrhein;
          other running waters = fluss (same closed season as fenster).
    """
    name, kind, rev, region, detail, buried, rule = meta
    if rule or any(w in kind.lower() for w in RESTRICTED):
        return meta
    n = (name or region).casefold()
    if code == "AG":
        if poly and "hallwil" in n:
            rule = "hallwil"
        elif name == "Aare" and rev in ("20", "612"):
            rule = "aare_so"
        elif name in ("Rhein", "Aare", "Reuss", "Limmat") or (poly and region in ("Rhein", "Aare", "Reuss", "Limmat")):
            rule = "fluss"
        elif name in ("Suhre", "Aabach"):
            rule = "suhre"
        elif poly or any(w in n for w in ("weiher", "teich")) or n.endswith("see"):
            rule = "weiher"
        else:
            rule = "bach"
    elif code == "GR" and kind == "Fischgewässer":
        if poly or n.startswith(("lai ", "lej ", "lag ", "lago ", "lac ")) or n.endswith("see"):
            rule = "see"
        elif n.startswith(("moesa", "inn", "en ", "en:")):
            rule = "moesa_inn"
        elif "alpenrhein" in n or n.startswith("rhein"):
            rule = "alpenrhein"
        else:
            rule = "fluss"
    return (name, kind, rev, region, detail, buried, rule)


RESTRICTED_RE = re.compile(r"schon|verbot|nationalpark|reservat|ruhezone|vorschrift", re.I)
MINOR_M = (300.0, 800.0)  # unnamed end branch shorter than this: shown from zoom 14 / 13 only
MINOR_ROUNDS = 2
MINOR_NAMED_M = 400.0  # a named twig (Graben, Dorfbach) shorter than this
SNAP_M = 4.0


def minor_streams(rows, lines, removed):
    """Unnamed headwaters, drainages and ditches: end branches of the water network that are
    short. They stay tappable close up but no longer clutter the map from afar. Pruned in
    rounds, so a short fork whose twigs were pruned counts as an end branch next."""
    # Ends within SNAP_M of each other are one node (sources differ by a few metres).
    cells, nodes = defaultdict(list), []
    def key(p):
        cx, cy = int(p[0] // 0.0001), int(p[1] // 0.0001)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for n in cells[cx + dx, cy + dy]:
                    if dist(nodes[n], p) <= SNAP_M:
                        return n
        nodes.append(p)
        cells[cx, cy].append(len(nodes) - 1)
        return len(nodes) - 1
    ends, at = {}, defaultdict(set)
    for fid, pts in lines.items():
        if fid in removed or rows[fid][0][5]:
            continue
        a, b = key(pts[0]), key(pts[-1])
        ends[fid] = (a, b)
        at[a].add(fid)
        at[b].add(fid)
    alive = set(ends)
    deg = lambda n: sum(1 for f in at[n] if f in alive)
    minor = {}
    def small(f):
        return not RESTRICTED_RE.search(rows[f][0][1])
    for _ in range(MINOR_ROUNDS):
        prune = {}
        for node in [n for n in at if deg(n) == 1]:
            chain, cur, here = [], next(f for f in at[node] if f in alive), node
            while cur is not None and cur not in chain:
                chain.append(cur)
                a, b = ends[cur]
                there = b if a == here else a
                if deg(there) != 2:
                    break
                cur = next((f for f in at[there] if f in alive and f != cur), None)
                here = there
            if not all(small(f) for f in chain):
                continue
            total = sum(rows[f][2] for f in chain)
            named = any(rows[f][0][0] for f in chain)
            if total < (MINOR_NAMED_M if named else MINOR_M[1]):
                z = 14 if total < MINOR_M[0] else 13
                for f in chain:
                    prune[f] = min(prune.get(f, 99), z)
        if not prune:
            break
        minor.update(prune)
        alive -= set(prune)
    return minor


STROKE_DEFLECTION = 60.0  # degrees: at a junction a stream continues into the straightest branch


def stroke_zoom(rows, lines, removed, skip):
    """Unnamed reaches have no name to join them into a stream. Build cartographic strokes
    instead: at every node the two branches that continue most straight are one stream.
    The stroke length then sets the zoom with the same thresholds as named zones."""
    cells, nodes = defaultdict(list), []
    def key(p):
        cx, cy = int(p[0] // 0.0001), int(p[1] // 0.0001)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for n in cells[cx + dx, cy + dy]:
                    if dist(nodes[n], p) <= SNAP_M:
                        return n
        nodes.append(p)
        cells[cx, cy].append(len(nodes) - 1)
        return len(nodes) - 1
    def heading(a, b):
        mx, my = metres(a[1])
        return math.atan2((b[1] - a[1]) * my, (b[0] - a[0]) * mx)
    at = defaultdict(list)
    for fid, pts in lines.items():
        if fid in removed or fid in skip or rows[fid][0][5] or len(pts) < 2:
            continue
        k = min(3, len(pts) - 1)
        at[key(pts[0])].append((fid, heading(pts[0], pts[k])))
        at[key(pts[-1])].append((fid, heading(pts[-1], pts[-1 - k])))
    uf = UF()
    for edges in at.values():
        pairs = []
        for i in range(len(edges)):
            for j in range(i + 1, len(edges)):
                if edges[i][0] == edges[j][0]:
                    continue
                turn = abs((edges[i][1] - edges[j][1]) % (2 * math.pi) - math.pi)
                if math.degrees(turn) <= STROKE_DEFLECTION:
                    pairs.append((turn, i, j))
        used = set()
        for _, i, j in sorted(pairs):
            if i not in used and j not in used:
                used |= {i, j}
                uf.union(edges[i][0], edges[j][0])
    total = defaultdict(float)
    members = [f for f in lines if f not in removed and f not in skip and not rows[f][0][5]]
    for f in members:
        total[uf.find(f)] += rows[f][2]
    out = {}
    for f in members:
        t = total[uf.find(f)]
        z = 8 if t >= 6000 else 9 if t >= 2300 else 10 if t >= 850 else 11 if t >= 330 else 12
        if z < rows[f][1]:
            out[f] = z
    return out


def zone_key(meta):
    name, kind, rev, region, detail, _buried, rule = meta
    return (name, kind, rev, region, detail, rule)


def normalise(code, entry, keep, stats):
    cells = {k: v for k, v in entry.items() if k[:1].isdigit()}
    rows, cell_rows = {}, {}
    for key, file in cells.items():
        meta, rr = json.loads((SECTIONS / file).read_text(encoding="utf8"))
        cell_rows[key] = (meta, rr)
        for fid, mi, zoom, size, bounds, raw in rr:
            rows.setdefault(fid, (bind_rule(code, tuple(meta[mi]), isinstance(raw, list)), zoom, size, bounds, raw))
    lines = {fid: decode(r[4]) for fid, r in rows.items() if isinstance(r[4], str)}
    s = stats[code] = {"Linien vorher": len(lines), "Flächen": len(rows) - len(lines)}

    # 1. LU slivers on Revier and Patent lines.
    removed = set()
    if code == "LU":
        grid = Grid()
        for fid, pts in lines.items():
            if rows[fid][0][1] != "Gewässer":
                grid.add_line(fid, pts)
        for fid, pts in lines.items():
            meta = rows[fid][0]
            if meta[1] != "Gewässer":
                continue
            limit = SHORT_SLIVER[1] if rows[fid][2] < SHORT_SLIVER[0] else SLIVER_M
            if all(any(seg_dist(q, a, b) <= limit for _, a, b in grid.near(q, 2)) for q in densify(pts)):
                removed.add(fid)
        s["Splitter entfernt"] = len(removed)
        s["Splitter-Länge km"] = round(sum(rows[f][2] for f in removed) / 1000, 1)

    # 2. Zone groups.
    old_groups = json.loads((SECTIONS / entry["groups"]).read_text(encoding="utf8")) if entry.get("groups") else []
    old_sel = {}
    for shard, file in (entry.get("selections") or {}).items():
        old_sel[shard] = json.loads((SECTIONS / file).read_text(encoding="utf8"))
    uf = UF()
    for members, _ in old_groups:
        for m in members[1:]:
            uf.union(members[0], m)
    by_key = defaultdict(list)
    for fid, pts in lines.items():
        if fid in removed:
            continue
        meta = rows[fid][0]
        if not meta[0] and not (code == "LU" and meta[1] == "Gewässer"):
            continue  # no water name: a catchment or Revier title does not identify one stream
                      # (LU network pieces carry the same neutral information and may join)
        by_key[zone_key(meta)].append(fid)
    joined = 0
    for key, fids in by_key.items():
        if len(fids) < 2:
            continue
        gap = LU_GAP_M if code == "LU" and key[1] == "Gewässer" else GAP_M
        grid, ends = Grid(), Grid(size=0.0004 if gap <= 30 else 0.0012)
        for fid in fids:
            grid.add_line(fid, lines[fid])
            p = lines[fid]
            ends.cells[ends.key(p[0])].append((fid, p[0], p[0]))
            ends.cells[ends.key(p[-1])].append((fid, p[-1], p[-1]))
        for fid in fids:
            p = lines[fid]
            for e in (p[0], p[-1]):
                for other, a, b in grid.near(e):
                    if other != fid and uf.find(other) != uf.find(fid) and seg_dist(e, a, b) <= TOUCH_M:
                        uf.union(fid, other)
                        joined += 1
                for other, q, _ in ends.near(e):
                    if other != fid and uf.find(other) != uf.find(fid) and dist(e, q) <= gap:
                        uf.union(fid, other)
                        joined += 1
    comps = defaultdict(list)
    for fid in rows:
        if fid in removed:
            continue
        if fid in uf.p:
            comps[uf.find(fid)].append(fid)
    groups = [sorted(c) for c in comps.values() if len(c) > 1]
    if code == "LU":
        # Short open pieces of the neutral network between long culverts: nothing to fish.
        grouped = {f for g in groups for f in g}
        crumbs = {f for f in lines if f not in removed and f not in grouped
                  and rows[f][0][1] == "Gewässer" and rows[f][2] < LU_CRUMB_M}
        removed |= crumbs
        s["Kleinststücke entfernt"] = len(crumbs)
    s["Verbindungen neu"] = joined
    s["Zonen"] = len(groups)
    in_group = {f for g in groups for f in g}
    named = [f for f in lines if f not in removed and rows[f][0][0]]
    s["benannte Linien in Zone %"] = round(100 * sum(f in in_group for f in named) / max(1, len(named)))
    # Pieces a tap can land on that still stand alone and carry no Revier.
    s["Einzelstücke ohne Revier"] = sum(1 for f in lines if f not in removed and f not in in_group and not rows[f][0][2])

    # Selection geometry: reuse the encoded paths of every member.
    shards = defaultdict(dict)
    index = []
    for members in sorted(groups):
        gid = members[0]
        parts = []
        for buried in (False, True):
            ls = [rows[f][4] for f in members if bool(rows[f][0][5]) == buried and isinstance(rows[f][4], str)]
            ps = [rows[f][4] for f in members if bool(rows[f][0][5]) == buried and isinstance(rows[f][4], list)]
            if ls or ps:
                parts.append([int(buried), ls, ps])
        shard = str(gid // 512)
        shards[shard][gid] = parts
        index.append([members, shard])

    # 2b. One level of detail per zone: every open piece of a zone appears at the zoom its whole
    # length earns, so a river split by bridges or culverts does not show up piece by piece.
    zone_zoom = {}
    for members in groups:
        open_ = [f for f in members if not rows[f][0][5]]
        if not open_:
            continue
        total = sum(rows[f][2] for f in open_)
        lu_net = code == "LU" and rows[open_[0]][0][1] == "Gewässer"
        z = min(rows[f][1] for f in open_)
        if not lu_net:
            z = min(z, 8 if total >= 6000 else 9 if total >= 2300 else 10 if total >= 850 else 11 if total >= 330 else 12)
        for f in open_:
            if z < rows[f][1]:
                zone_zoom[f] = z
    s["Zoomstufe angeglichen"] = len(zone_zoom)
    minor = minor_streams(rows, lines, removed)
    for f, z in minor.items():
        if f not in in_group:
            zone_zoom[f] = max(z, rows[f][1])
    s["Kleinstgewässer erst nah"] = sum(1 for f in minor if f not in in_group)
    if code != "LU":  # LU network pieces keep their own close-up zoom
        strokes = stroke_zoom(rows, lines, removed, set(minor))
        for f, z in strokes.items():
            if f not in in_group and not rows[f][0][0]:
                zone_zoom[f] = min(z, zone_zoom.get(f, 99))
        s["Bachläufe verbunden"] = sum(1 for f in strokes if f not in in_group and not rows[f][0][0])

    # 3. Rewrite.
    new = dict(entry)
    def repack(meta, rr, extra=()):
        table, out = {}, []
        for r in [*rr, *extra]:
            if r[0] in removed:
                continue
            m = rows[r[0]][0] if r[0] in rows else bind_rule(code, tuple(meta[r[1]]), isinstance(r[5], list))
            out.append([r[0], table.setdefault(m, len(table)), zone_zoom.get(r[0], r[2]), *r[3:]])
        return [[list(m) for m in table], out]
    for key, (meta, rr) in cell_rows.items():
        new[key] = write_asset(f"{code}-{key}", repack(meta, rr), keep)
    if entry.get("overview"):
        meta, rr = json.loads((SECTIONS / entry["overview"]).read_text(encoding="utf8"))
        have = {r[0] for r in rr}
        # Pieces that now appear at zoom 11 or lower belong in the overview too.
        extra = {}
        for cmeta, crr in cell_rows.values():
            for r in crr:
                if r[0] in zone_zoom and zone_zoom[r[0]] <= 11 and r[0] not in have and r[0] not in extra:
                    extra[r[0]] = [r[0], -1, *r[2:]]
        new["overview"] = write_asset(f"{code}-overview", repack(meta, rr, extra.values()), keep)
    new["selections"] = {sh: write_asset(f"{code}-selection-{sh}", data, keep) for sh, data in shards.items()}
    new["groups"] = write_asset(f"{code}-groups", index, keep)
    for k in ("districts",):
        if isinstance(entry.get(k), dict):
            keep.update(entry[k].values())
    if entry.get("search"):
        keep.add(entry["search"])
    s["Linien nachher"] = len(lines) - len(removed)
    return new


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    manifest = json.loads((SECTIONS / "index.json").read_text(encoding="utf8"))
    keep, stats, out = set(), {}, {}
    for code, entry in manifest.items():
        out[code] = normalise(code, entry, keep, stats)
        print(code, json.dumps(stats[code], ensure_ascii=False), flush=True)
    if args.dry_run:
        for f in SECTIONS.glob("*.json"):
            if f.name != "index.json" and f.name not in {v for e in manifest.values() for v in json.dumps(e)}:
                pass
        return
    (SECTIONS / "index.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    referenced = set(keep)
    for e in out.values():
        for v in e.values():
            if isinstance(v, str) and v.endswith(".json"):
                referenced.add(v)
            elif isinstance(v, dict):
                referenced.update(x for x in v.values() if isinstance(x, str))
    gone = [f for f in SECTIONS.glob("*.json") if f.name != "index.json" and f.name not in referenced]
    for f in gone:
        f.unlink()
    print("entfernte alte Dateien:", len(gone))


if __name__ == "__main__":
    main()
