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
part += "\n" + open(os.path.join(root, "beta", "src", "map-spots.part.js"), encoding="utf-8").read()
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

# Uferstellen eines auf der Karte gewählten Gewässers nicht beim nächsten Neuzeichnen schliessen.
out = replace_once(out, 'if(shoreView&&(unknownWater()', 'if(shoreView&&!shoreView.fromMap&&(unknownWater()')

# Fang an einer auf der Karte markierten Stelle speichern.
out = replace_once(out, 'const now=new Date(),p=state.pos;', 'const now=new Date(),p=catchAt||state.pos;')
out = replace_once(out, '      state.log=log;\n    }catch(e){\n      $("#afterSave").textContent="Fang konnte nicht gespeichert werden.',
    '      state.log=log;catchAt=null;renderCatchAt();\n    }catch(e){\n      $("#afterSave").textContent="Fang konnte nicht gespeichert werden.')
# Fangbuch: Fang auf der Karte zeigen oder Ort setzen.
out = replace_once(out, '<details class="entry-menu"><summary>Mehr</summary><button type="button" data-edit="${f.id}">Bearbeiten</button>',
    '<details class="entry-menu"><summary>Mehr</summary><button type="button" data-map="${f.id}">${Number.isFinite(f.lat)?"Auf der Karte zeigen":"Ort auf der Karte setzen"}</button><button type="button" data-edit="${f.id}">Bearbeiten</button>')
out = replace_once(out, '$("#logList").onclick=e=>{\n', '$("#logList").onclick=e=>{\n  const onMap=e.target.closest("[data-map]");if(onMap){openCatchOnMap(onMap.dataset.map);return}\n')
# Statusleiste für eigene Spots und Fänge.
out = replace_once(out, 's=z?((z.code?cname(z.code):"Solothurn")', 's=z?.t==="spot"?"Mein Spot":z?.t==="catch"?"Mein Fang":z?((z.code?cname(z.code):"Solothurn")')
# Vollsicherung inklusive Spots.
out = replace_once(out, 'const data={format:"fangbuch-v1",log:state.log.slice(),', 'const data={format:"fangbuch-v1",spots:store.get("spots",[]),log:state.log.slice(),')
out = replace_once(out, '    state.log=log;state.sess=active;renderStats();',
    '    if(Array.isArray(data.spots)){const cur=store.get("spots",[]);const add=data.spots.filter(s=>s&&typeof s.id==="string"&&Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&typeof s.name==="string"&&!cur.some(c=>c.id===s.id));if(add.length){store.set("spots",cur.concat(add));refreshSpots()}}\n    state.log=log;state.sess=active;renderStats();')

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
