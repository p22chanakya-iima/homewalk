#!/usr/bin/env python3
"""overlay.py <plan-id> : draw the generated walls/doors/windows/rooms on top of the brochure crop to check the extraction.
Writes plans/debug/<id>.png"""
import json, sys, os, subprocess
from PIL import Image, ImageDraw
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pid = sys.argv[1]
p = json.load(open(f"{root}/plans/{pid}.json"))
c = p["px"]["crop"]; s = p["px"]["scale"]
pdf = os.path.expanduser("~/Downloads/" + c.get("pdf", p['brochure'] + ".pdf"))
tmp = f"{root}/plans/debug/_{pid}"
os.makedirs(f"{root}/plans/debug", exist_ok=True)
subprocess.run(["pdftoppm", "-r", str(c["dpi"]), "-png", "-f", str(c["page"]), "-l", str(c["page"]), pdf, tmp], stderr=subprocess.DEVNULL)
f = [x for x in os.listdir(f"{root}/plans/debug") if x.startswith(f"_{pid}")][0]
im = Image.open(f"{root}/plans/debug/{f}").convert("RGB"); os.remove(f"{root}/plans/debug/{f}")
w, h = im.size; b = c["box"]
if c.get("px"): im = im.crop(tuple(b)); ox = b[0]; oy = b[1]      # box in page pixels; plan coordinates are page pixels
else: im = im.crop((int(b[0]*w), int(b[1]*h), int(b[2]*w), int(b[3]*h))); ox = oy = 0
d = ImageDraw.Draw(im, "RGBA")
PX = lambda v: v / s - ox; PY = lambda v: v / s - oy
for x0, y0, x1, y1, k in p["walls"]: d.rectangle([PX(x0), PY(y0), PX(x1), PY(y1)], outline=(220,30,30,255) if k == 'e' else (30,90,220,255), fill=(220,30,30,70) if k == 'e' else (30,90,220,70))
for r in p["wins"]: d.rectangle([PX(r[0]), PY(r[1]), PX(r[2]), PY(r[3])], fill=(0,200,220,200))
for dr in p["doors"]: d.rectangle([PX(dr["rect"][0]), PY(dr["rect"][1]), PX(dr["rect"][2]), PY(dr["rect"][3])], fill=(255,160,0,200)); d.line([PX(dr["h"][0]), PY(dr["h"][1]), PX(dr["h"][0] + dr["o"][0]*dr["len"]), PY(dr["h"][1] + dr["o"][1]*dr["len"])], fill=(0,0,0,255), width=2)
for sl in p["slides"]: d.rectangle([PX(sl["rect"][0]), PY(sl["rect"][1]), PX(sl["rect"][2]), PY(sl["rect"][3])], fill=(0,160,0,200))
for r in p["rooms"]: d.text((PX(r["at"][0]) - 20, PY(r["at"][1])), r["id"], fill=(160,0,160,255))
for fu in p["furniture"]: d.ellipse([PX(fu["cx"]) - 3, PY(fu["cy"]) - 3, PX(fu["cx"]) + 3, PY(fu["cy"]) + 3], fill=(0,120,0,255))
zoom = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
if zoom != 1.0: im = im.resize((int(im.width*zoom), int(im.height*zoom)))
out = f"{root}/plans/debug/{pid}.png"; im.save(out); print(out)
