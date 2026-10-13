#!/usr/bin/env python3
"""retarget.py <spec.json> <scale> <ox_old> <oy_old> <ox_new> <oy_new> <new_pdf_name> <new_dpi> <new_page>
Map a spec traced on one render of a brochure page onto another render (similarity transform found by image registration)."""
import json, sys
f, k, ox, oy, nx, ny, pdf, dpi, page = sys.argv[1], float(sys.argv[2]), *map(float, sys.argv[3:7]), sys.argv[7], int(sys.argv[8]), int(sys.argv[9])
sp = json.load(open(f))
X = lambda x: round((x - ox) * k + nx, 1); Y = lambda y: round((y - oy) * k + ny, 1)
P = lambda p: [X(p[0]), Y(p[1])]
for r in sp["rooms"]:
    if "rect" in r: r["rect"] = [X(r["rect"][0]), Y(r["rect"][1]), X(r["rect"][2]), Y(r["rect"][3])]
    if "poly" in r: r["poly"] = [P(p) for p in r["poly"]]
    if "at" in r: r["at"] = P(r["at"])
for key in ("doors", "gaps", "wins", "slides"):
    for o in sp.get(key, []): o["x"], o["y"], o["w"] = X(o["x"]), Y(o["y"]), round(o["w"] * k, 1)
for fu in sp["furn"]: fu[2], fu[3] = X(fu[2]), Y(fu[3])
sp["scale"] = round(sp["scale"] / k, 4)
bx = [X(sp["crop"]["box"][0]), Y(sp["crop"]["box"][1])]
sp["crop"] = {"pdf": pdf, "page": page, "dpi": int(dpi), "px": True, "box": [int(bx[0]) - 20, int(bx[1]) - 60, int(bx[0] + (sp["crop"]["box"][2] - sp["crop"]["box"][0]) * k) + 20, int(bx[1] + (sp["crop"]["box"][3] - sp["crop"]["box"][1]) * k)]}
json.dump(sp, open(f, "w"), indent=1, ensure_ascii=False)
print("retargeted", f)
