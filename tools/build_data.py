#!/usr/bin/env python3
"""Fuegt data/src/*.json (kantonale Regeln) in data/updates.json ein und erhoeht die Version.
Aufruf: python3 tools/build_data.py [--bump]
Ohne --bump wird die Version nur erhoeht, wenn sich der Inhalt geaendert hat."""
import json, sys, glob, os, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
up_path = os.path.join(root, "data", "updates.json")
up = json.load(open(up_path, encoding="utf-8"))
old = json.dumps(up.get("rules", {}), sort_keys=True, ensure_ascii=False) + json.dumps(up.get("news", []), sort_keys=True, ensure_ascii=False)
rules = {k: v for k, v in up.get("rules", {}).items() if k in ("SO", "CH")}
SPEC = set("Bachforelle Regenbogenforelle Seeforelle Saibling Äsche Hecht Zander Felchen Barbe Alet Rotauge Brachsmen Karpfen Schleie Wels Aal Nase Lachs Strömer Bachneunauge Bitterling Forelle".split()) | {"Egli (Flussbarsch)", "andere Art"}
for f in sorted(glob.glob(os.path.join(root, "data", "src", "*.json"))):
    for c, v in json.load(open(f, encoding="utf-8")).items():
        ws = {w for w, _ in v["w"]}
        for sp, arr in v["sp"].items():
            assert sp in SPEC, (c, sp)
            for e in arr:
                assert set(e.get("w", [])) <= ws, (c, sp, e)
        for l in v.get("lim", []):
            assert set(l["sp"]) <= SPEC and set(l.get("w", [])) <= ws, (c, l)
        for cl in v.get("closed", []):
            assert set(cl["w"]) <= ws, (c, cl)
        assert set(v.get("prot", [])) <= SPEC, c
        rules[c] = v
up["rules"] = rules
new = json.dumps(rules, sort_keys=True, ensure_ascii=False) + json.dumps(up.get("news", []), sort_keys=True, ensure_ascii=False)
if new != old or "--bump" in sys.argv:
    up["version"] = int(up.get("version", 0)) + 1
    up["updated"] = datetime.date.today().isoformat()
    print("neue Version", up["version"])
else:
    print("unveraendert, Version", up["version"])
with open(up_path, "w", encoding="utf-8") as fh:
    json.dump(up, fh, ensure_ascii=False, separators=(",", ":"))
print(len(rules), "Regelsaetze:", ", ".join(sorted(rules)))
