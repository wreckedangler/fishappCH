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


start = src.index("/* ================= KARTE ================= */")
end = src.index("/* ================= UPDATES (Regeln/Hinweise) ================= */")
out = src[:start] + part.rstrip() + "\n\n" + src[end:]

# Datumswechsel: Neuzeichnen über die MapLibre-Quellen.
out = replace_once(out,
    'if(!map?._loaded)return;\n  xStamp="";selKey="";sectionMap.stamp="";sectionMap.drawnBounds=null;',
    'if(!mapReady)return;\n  xStamp="";selKey="";soFeatureCache.key="";sectionMap.stamp="";sectionMap.drawnBounds=null;sectionMap.painted="";')

out = replace_once(out, "</style>", css.rstrip() + "\n</style>")

if not promote:
    # Testversion unter /beta/: alle relativen Pfade zeigen auf das Hauptverzeichnis.
    out = re.sub(r"<head>", '<head>\n<base href="../">', out, count=1)
    out = replace_once(out, "<title>", '<meta name="robots" content="noindex">\n<title>')
    # Mit <base> würden Hash-Links sonst auf die Hauptversion zeigen.
    out = replace_once(out, 'history.pushState(null,"","#"+(v==="stat"?"fangbuch":v));',
        'history.pushState(null,"",location.pathname+location.search+"#"+(v==="stat"?"fangbuch":v));')
    target = os.path.join(root, "beta", "index.html")
else:
    target = os.path.join(root, "index.html")

open(target, "w", encoding="utf-8").write(out)
print("geschrieben:", os.path.relpath(target, root), len(out), "Zeichen")
