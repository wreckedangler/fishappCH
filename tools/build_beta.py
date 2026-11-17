#!/usr/bin/env python3
"""Baut beta/index.html aus der aktuellen index.html und der neuen MapLibre-Karte.

Die Kartenlogik steht in beta/src/map-gl.part.js und beta/src/map-gl.css. Alles andere
(Regeln, Fang, Fische, Daten) kommt unverändert aus index.html, damit die Testversion
immer auf dem aktuellen Stand der App läuft.
Aufruf: python3 tools/build_beta.py [--promote]
  --promote schreibt das Ergebnis als index.html (neue Karte wird Standard).
"""
import os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, "index.html"), encoding="utf-8").read()
part = open(os.path.join(root, "beta", "src", "map-gl.part.js"), encoding="utf-8").read()
css = open(os.path.join(root, "beta", "src", "map-gl.css"), encoding="utf-8").read()
promote = "--promote" in sys.argv


def replace_once(text, old, new):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Erwartet genau einmal, gefunden {count}x: {old[:80]!r}")
    return text.replace(old, new)


old_marker = "/* ================= KARTE ================= */"
gl_marker = "/* ================= KARTE (MapLibre GL) ================= */"
already_live = gl_marker in src
start = src.index(gl_marker if already_live else old_marker)
end = src.index("/* ================= UPDATES (Regeln/Hinweise) ================= */")
out = src[:start] + part.rstrip() + "\n\n" + src[end:]

# Datumswechsel: Neuzeichnen über die MapLibre-Quellen.
if not already_live:
    out = replace_once(out,
        'if(!map?._loaded)return;\n  xStamp="";selKey="";sectionMap.stamp="";sectionMap.drawnBounds=null;',
        'if(!mapReady)return;\n  xStamp="";selKey="";soFeatureCache.key="";sectionMap.stamp="";sectionMap.drawnBounds=null;sectionMap.painted="";')

css_start = "/* ---- MapLibre-Karte ---- */"
if css_start in out:
    a = out.index(css_start)
    out = out[:a] + out[out.index("</style>", a):]
out = replace_once(out, "</style>", css.rstrip() + "\n</style>")

def write(target, html):
    with open(os.path.join(root, target), "w", encoding="utf-8", newline="\n") as dest:
        dest.write(html)
    print("geschrieben:", target, len(html), "Zeichen")

if promote or already_live:
    write("index.html", out)

# Der bisherige /beta/-Einstieg verwendet dieselben Dateien und behält seine Route.
out = re.sub(r"<head>", '<head>\n<base href="../">', out, count=1)
out = replace_once(out, "<title>", '<meta name="robots" content="noindex">\n<title>')
out = replace_once(out, 'history.pushState(null,"","#"+(v==="stat"?"fangbuch":v));',
    'history.pushState(null,"",location.pathname+location.search+"#"+(v==="stat"?"fangbuch":v));')
write("beta/index.html", out)
