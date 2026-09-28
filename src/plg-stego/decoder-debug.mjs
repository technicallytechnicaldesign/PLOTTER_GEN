// Decoder instrument: paints what the reader looks at onto the photo it read.
//   node decoder-debug.mjs <photo name from decoder-test.mjs, no extension> [first cell] [cell count]
// Reads and writes in the system temp folder (plg-decoder-test). Writes <name>-debug.ppm: the photo in grey; for each cell in range, value 0's strokes in blue and value 1's in
// red (more values: green, yellow, ...), the chosen one drawn thicker; finders in magenta. Convert with any viewer.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decode } from "./_build/decoder-core.mjs";
import { densify } from "./core.js";

const [name, first = "0", count = "40"] = process.argv.slice(2);
const T = path.join(os.tmpdir(), "plg-decoder-test"), b = fs.readFileSync(path.join(T, `${name}.pgm`)), head = b.subarray(0, 40).toString("latin1").split(/\s+/), w = +head[1], h = +head[2], off = b.indexOf(0x0a, b.indexOf("255")) + 1;
const r = decode({ width: w, height: h, data: b.subarray(off, off + w * h) });
if (!r.ok) { console.log(r.stage, r.message); process.exit(1); }
const I = r.I, img = new Uint8Array(I.w * I.h * 3);
for (let i = 0; i < I.w * I.h; i++) img[i * 3] = img[i * 3 + 1] = img[i * 3 + 2] = Math.round(I.g[i] * 255);
const COL = [[40, 90, 255], [255, 40, 40], [30, 190, 60], [230, 200, 0]];
const dot = ([x, y], c, rad) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < I.w && Y < I.h) img.set(c, (Y * I.w + X) * 3); } };
const from = +first, to = Math.min(r.cells.length, from + +count);
for (let i = from; i < to; i++) {
  const cell = r.cells[i], cands = Array.isArray(cell.cands) ? cell.cands : [[], cell.cands.edge || []];
  cands.forEach((paths, v) => paths.forEach(([p, cl]) => densify(p, cl, 0.4).forEach(q => dot(r.Hm.px(q), COL[v % 4], v === r.picks[i].value ? 1 : 0))));
  console.log(`cell ${i}: value ${r.picks[i].value}  confidence ${r.picks[i].conf.toFixed(3)}`);
}
for (const f of r.finders) dot([f.x, f.y], [255, 0, 255], 3);
fs.writeFileSync(path.join(T, `${name}-debug.ppm`), Buffer.concat([Buffer.from(`P6 ${I.w} ${I.h} 255\n`), Buffer.from(img)]));
console.log(`read "${r.text}"  wrote ${path.join(T, name + "-debug.ppm")}`);
