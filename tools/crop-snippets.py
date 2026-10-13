#!/usr/bin/env python3
"""crop-snippets.py : cut each plan out of its brochure page (the real drawing) -> plans/img/<id>.jpg
The crop box comes from the traced plan's own extent (so no neighbouring text or compass is included)."""
import json, os, subprocess, tempfile, glob
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f"{root}/plans/img", exist_ok=True)
cache = {}
def page(pdf, n, dpi):
    k = (pdf, n, dpi)
    if k not in cache:
        with tempfile.TemporaryDirectory() as t:
            subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", str(n), "-l", str(n), os.path.expanduser("~/Downloads/" + pdf), f"{t}/p"], stderr=subprocess.DEVNULL)
            im = Image.open(glob.glob(f"{t}/p*.png")[0]).convert("RGB").copy()
            from PIL import ImageDraw
            d = ImageDraw.Draw(im); z = dpi / 192                  # the small page compass sits at a fixed spot on each half page; blank it out
            for bx in ((190, 2400, 345, 2530), (3480, 2400, 3655, 2530)): d.rectangle([v * z for v in bx], fill="white")
            cache[k] = im
    return cache[k]
for f in sorted(glob.glob(f"{root}/plans/ira-type*.json")):
    p = json.load(open(f)); c = p["px"]["crop"]; s = p["px"]["scale"]
    ws = p["walls"]; x0 = min(w[0] for w in ws) / s; x1 = max(w[2] for w in ws) / s; y0 = min(w[1] for w in ws) / s; y1 = max(w[3] for w in ws) / s
    im = page(c["pdf"], c["page"], c["dpi"]); pad = 10; L = R = T = B = pad
    en = next((d for d in p["doors"] if d.get("entry")), None)
    if en:                                                              # leave room for the printed ENTRY marker on the entry side only
        cx = (en["rect"][0] + en["rect"][2]) / 2 / s; cy = (en["rect"][1] + en["rect"][3]) / 2 / s
        side = min((cx - x0, "L"), (x1 - cx, "R"), (cy - y0, "T"), (y1 - cy, "B"))[1]
        if side == "L": L += 110
        elif side == "R": R += 110
        elif side == "T": T += 110
        else: B += 110
    box = (int(x0 - L), int(y0 - T), int(x1 + R), int(y1 + B))
    box = (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))
    cut = im.crop(box); w = 900
    if cut.width > w: cut = cut.resize((w, round(cut.height * w / cut.width)), Image.LANCZOS)
    out = f"{root}/plans/img/{p['id']}.jpg"; cut.save(out, quality=86, optimize=True)
    print(p["id"], cut.size, os.path.getsize(out) // 1024, "KB")
