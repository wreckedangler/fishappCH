"""Rasterise every mapped fishery for small phone scales, keeping legal classes separate."""
from base64 import b64encode
from collections import defaultdict
from io import BytesIO
import json
import re
from math import asinh, floor, pi, radians, tan
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

DATA = Path(__file__).resolve().parents[1] / "data"


def decode(encoded):
    position = [0, 0]
    i = 0
    while i < len(encoded):
        for axis in (0, 1):
            value = shift = 0
            while True:
                char = ord(encoded[i]) - 63
                i += 1
                value |= (char & 31) << shift
                if char < 32:
                    break
                shift += 5
            position[axis] += ~(value >> 1) if value & 1 else value >> 1
        lon, lat = (v / 1e5 for v in position)
        yield (lon + 180) / 360, (1 - asinh(tan(radians(lat))) / pi) / 2


def build():
    directory = DATA / "sections"
    manifest = json.loads((directory / "index.json").read_bytes())
    atlas = defaultdict(list)
    for code, files in manifest.items():
        metadata, rows = json.loads((directory / files["overview"]).read_bytes())
        groups = defaultdict(list)
        for _, index, zoom, _, _, raw in rows:
            _, kind, _, _, _, buried, rule = metadata[index]
            if buried:
                continue
            area = isinstance(raw, list)
            rings = [list(decode(p)) for p in (raw if area else [raw])]
            # Same level of detail as the vector map: a reach is in the image of zoom z once it
            # starts fading in there (its zoom at most z+1); restrictions from zoom 10 at the latest.
            lod = min(zoom, 10) if re.search(r"schon|verbot|nationalpark", kind, re.I) else zoom
            groups[kind, rule].append((area, rings, lod))
        for (kind, rule), every in groups.items():
          for z in range(6, 10):
            shapes = [(a, r) for a, r, lod in every if lod <= z + 1]
            if not shapes:
                continue
            vertices = [p for _, rings in shapes for ring in rings for p in ring]
            xs, ys = zip(*vertices)
            if True:
                world = 256 << z
                x, y = floor(min(xs)*world)-2, floor(min(ys)*world)-2
                size = (floor(max(xs)*world)-x+3, floor(max(ys)*world)-y+3)
                mask = Image.new("L", size)
                draw = ImageDraw.Draw(mask)
                for area, rings in shapes:
                    paths = [[(floor(px*world)-x, floor(py*world)-y) for px, py in ring] for ring in rings]
                    if area:
                        feature = Image.new("L", size)
                        ink = ImageDraw.Draw(feature)
                        for i, path in enumerate(paths):
                            ink.polygon(path, fill=95 if i == 0 else 0, outline=255)
                        mask = ImageChops.lighter(mask, feature)
                        draw = ImageDraw.Draw(mask)
                    else:
                        draw.line(paths[0], fill=255)
                        draw.point(paths[0][0], fill=255)
                # Four-level grayscale PNG, decoded only for visible cantons.
                image = Image.frombytes("P", size, mask.point(lambda a: 2 if a == 255 else 1 if a else 0).tobytes())
                image.putpalette([0, 0, 0, 0, 0, 0, 0, 0, 0])
                output = BytesIO()
                image.save(output, format="PNG", bits=2, transparency=bytes([0, 95, 255]), optimize=True)
                atlas[z].append([code, kind, rule, x, y, *size, b64encode(output.getvalue()).decode("ascii")])
    for z in range(6, 10):
        atlas.setdefault(z, [])
    packed = json.dumps(atlas, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    (DATA / "map-overview.json").write_bytes(packed)
    print("National overview", len(packed), "bytes")


if __name__ == "__main__":
    build()
