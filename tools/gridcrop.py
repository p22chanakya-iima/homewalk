#!/usr/bin/env python3
"""gridcrop.py <pdf> <page> <dpi> <x0> <y0> <x1> <y1> <out.png> [zoom]
Render a page region with a labelled pixel grid (in page-pixel coordinates at <dpi>) so plan coordinates can be read accurately."""
import sys, subprocess, os, tempfile
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
pdf, page, dpi, x0, y0, x1, y1, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), *map(int, sys.argv[4:8]), sys.argv[8]
zoom = float(sys.argv[9]) if len(sys.argv) > 9 else 1.5
with tempfile.TemporaryDirectory() as t:
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", str(page), "-l", str(page), pdf, f"{t}/p"], stderr=subprocess.DEVNULL)
    im = Image.open(os.path.join(t, os.listdir(t)[0])).convert("RGB")
im = im.crop((x0, y0, x1, y1)); im = im.resize((int((x1-x0)*zoom), int((y1-y0)*zoom)), Image.LANCZOS)
d = ImageDraw.Draw(im, "RGBA")
for x in range((x0 // 20 + 1) * 20, x1, 20):
    X = (x - x0) * zoom; major = x % 100 == 0
    d.line([X, 0, X, im.height], fill=(255, 0, 0, 110 if major else 40), width=1)
    if major: d.text((X + 2, 2), str(x), fill=(255, 0, 0, 255))
for y in range((y0 // 20 + 1) * 20, y1, 20):
    Y = (y - y0) * zoom; major = y % 100 == 0
    d.line([0, Y, im.width, Y], fill=(0, 0, 255, 110 if major else 40), width=1)
    if major: d.text((2, Y + 2), str(y), fill=(0, 0, 255, 255))
im.save(out); print(out, im.size)
