"""Synthetic phone photos of an exported plot, for decoder-test.mjs.

  python synth_photo.py <plot.svg> <out.pgm> [--seed N] [--tilt 0.08] [--px 5]

Rasterises the SVG's pen paths (outline 0.4 mm, others 0.3 mm), lays the page on a darker table, then
tilts it in perspective, turns it a little, lights it unevenly, blurs it and adds sensor noise.
Writes greyscale PGM (the Node harness reads it without any image library) plus a JSON of what was done.
"""
import argparse, json, random, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("svg"); ap.add_argument("out")
ap.add_argument("--seed", type=int, default=1); ap.add_argument("--tilt", type=float, default=0.08); ap.add_argument("--px", type=float, default=5.0)
ap.add_argument("--turn", type=float, default=8.0); ap.add_argument("--blur", type=float, default=1.0); ap.add_argument("--noise", type=float, default=6.0)
# a retrofit: the marks were plotted in a second run on a sheet put back by hand, so they sit a little off (mm, "dx,dy")
ap.add_argument("--markshift", default="0,0")
a = ap.parse_args()
rnd = random.Random(a.seed)

s = open(a.svg, encoding="utf8").read()
W, H = [float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s).groups()]
k = a.px
page = Image.new("L", (int(W * k), int(H * k)), 238)
d = ImageDraw.Draw(page)
for g in re.finditer(r'<g id="pen-([\w-]+)" stroke="#(\w+)" stroke-width="([\d.]+)"(.*?)</g>', s, re.S):
    if g.group(1) == "reveal":
        continue   # the answer key is its own pen; a photo of the plain plot does not show it
    w = max(1, round(float(g.group(3)) * k))
    sx, sy = [float(v) for v in a.markshift.split(",")] if g.group(1) == "marks" else (0.0, 0.0)
    for m in re.finditer(r'd="M([^"]+?)( Z)?"', g.group(4)):
        pts = [tuple((float(v) + (sx if i == 0 else sy)) * k for i, v in enumerate(p.split(","))) for p in m.group(1).split(" L")]
        if m.group(2):
            pts.append(pts[0])
        if len(pts) > 1:
            d.line(pts, fill=35, width=w, joint="curve")

# the page on a table, then a perspective view of it
pad = int(0.18 * max(page.size))
table = Image.new("L", (page.width + 2 * pad, page.height + 2 * pad), 95)
table.paste(page, (pad, pad))
Tw, Th = table.size
jit = lambda: rnd.uniform(-a.tilt, a.tilt)
src = [(pad, pad), (pad + page.width, pad), (pad + page.width, pad + page.height), (pad, pad + page.height)]
ang = np.radians(rnd.uniform(-a.turn, a.turn)); cx, cy = Tw / 2, Th / 2
def turn(p): x, y = p[0] - cx, p[1] - cy; return (cx + x * np.cos(ang) - y * np.sin(ang), cy + x * np.sin(ang) + y * np.cos(ang))
dst = [turn((x + jit() * page.width, y + jit() * page.height)) for x, y in src]
# PIL wants the map from output pixels back to input pixels
A = []
for (x, y), (u, v) in zip(dst, src):
    A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
coef = np.linalg.solve(np.array(A, float), np.array([c for p in src for c in p], float))
photo = table.transform(table.size, Image.PERSPECTIVE, tuple(coef), Image.BILINEAR, fillcolor=95)

# uneven light, soft focus, sensor noise
arr = np.asarray(photo, float)
yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
gx, gy = rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25)
light = 1 + gx * (xx / arr.shape[1] - 0.5) + gy * (yy / arr.shape[0] - 0.5)
arr = arr * light
photo = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(a.blur))
arr = np.asarray(photo, float) + np.random.default_rng(a.seed).normal(0, a.noise, photo.size[::-1])
photo = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

with open(a.out, "wb") as f:
    f.write(f"P5 {photo.width} {photo.height} 255\n".encode()); f.write(photo.tobytes())
json.dump({"svg": a.svg, "px_per_mm": k, "corners": dst, "seed": a.seed, "tilt": a.tilt}, open(a.out[:-4] + ".json", "w"))
print(a.out, photo.size)
