// Tap-the-corners check (PLG-0475): plots drawn with NO machine marks, read from known settings (a settings label) and four tapped
// paper corners. Each synthetic photo is read with the tapped corners wrong by exactly 0, 1, 2, 3 and 4 mm (random direction per corner),
// and the reading must return the message.
//   node 02_WORK/plg-stego/build.mjs && node 02_WORK/plg-stego/anchor-test.mjs [--levels 0,1,2,3,4] [--trials 3] [--tilt 0.05] [--filter name]
// The plot is the marks=off build; the settings label comes from the marks=corners build of the same settings (same 10 mm layout).
// Exit 0 when every photo at every level up to 3 mm reads (4 mm is reported, not gated).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load } from "./studio-vm.mjs";
import { decode } from "./_build/decoder-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(os.tmpdir(), "plg-anchor-test");
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const levels = opt("--levels", "0,1,2,3,4").split(",").map(Number), trials = +opt("--trials", 3), tilt = +opt("--tilt", 0.05), filter = opt("--filter", ""), PX = 5;
const readPGM = file => { const b = fs.readFileSync(file), head = b.subarray(0, 40).toString("latin1").split(/\s+/), w = +head[1], h = +head[2], off = b.indexOf(0x0a, b.indexOf("255")) + 1; return { width: w, height: h, data: b.subarray(off, off + w * h) }; };
const mulberry = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// page mm -> photo px from four correspondences (direct linear solve), to measure how far a fit is from the truth
function hom(from, to) {
  const A = []; from.forEach(([x, y], i) => { const [u, v] = to[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]); A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]); });
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < 8; r++) { if (r === c) continue; const k = A[r][c] / A[c][c]; for (let j = c; j < 9; j++) A[r][j] -= k * A[c][j]; } }
  const H = [...A.map((row, i) => row[8] / row[i]), 1]; return ([x, y]) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
}
const norm = s => String(s || "").replace(/\s+/g, " ").trim();

// name, studio page, preset, extra overrides. The message the plot carries is read back from the studio's own control.
const SLOW = ["hoist"];   // template-matched flags take half a minute a photo: --slow or --filter hoist
export const PLOTS = [
  ["stitches", "stego-plot-studio.html", "stitches", {}],
  ["truchet", "stego-plot-studio.html", "truchet", {}],
  ["punch", "stego-plot-studio.html", "punch", {}],
  ["maze", "cipher-garden-studio.html", "maze", {}],
  ["arcs", "cipher-garden-studio.html", "arcs", {}],
  ["hoist", "signal-book-studio.html", "hoist", {}],
].filter(p => p[0].includes(filter) && (filter || !SLOW.includes(p[0]) || args.includes("--slow")));

function make(page, preset, extra) {
  const { S, els, defaults } = load(page);
  const set = marks => { for (const [k, v] of defaults) if (els.get(k).type !== "div") els.get(k).value = v; for (const [k, v] of Object.entries({ ...S.PRESETS[preset], ...extra, marks })) els.get(k).value = String(v); };
  set("off"); const off = S.build(S.read()); const svgOff = S.toSVG(off), msg = els.get("msg").value;
  set("corners"); const cor = S.build(S.read());
  if (off.error || cor.error) throw new Error(`${preset}: ${off.error || cor.error}`);
  return { svgOff, svgLabel: S.labelSVG(cor), msg, W: off.W, H: off.H, gates: off.gates.filter(g => !g[1]).length };
}
const synth = (svg, name, seed, px) => {
  const f = path.join(out, name + ".svg"), p = path.join(out, name + ".pgm"); fs.writeFileSync(f, svg);
  execFileSync("python", [path.join(here, "synth_photo.py"), f, p, "--tilt", String(tilt), "--px", String(px), "--seed", String(seed)], { encoding: "utf8" });
  return { pgm: readPGM(p), corners: JSON.parse(fs.readFileSync(p.replace(/\.pgm$/, ".json"), "utf8")).corners };
};

const LOG = args.includes("--log") ? [] : undefined;
const tally = Object.fromEntries(levels.map(l => [l, { ok: 0, n: 0, ms: 0, res: [] }])), rows = [];
for (const [name, page, preset, extra] of PLOTS) {
  const P = make(page, preset, extra);
  const lab = synth(P.svgLabel, `${name}-label`, 99, 8), lr = decode(lab.pgm);
  if (!lr.label) { console.log(`FAIL  ${name}: settings label not read (${lr.message})`); for (const l of levels) tally[l].n += 2 * trials; continue; }
  const want = norm(P.msg).toUpperCase().replace(/[^A-Z0-9 .?]/g, "");
  for (const photoSeed of [11, 12]) {
    const ph = synth(P.svgOff, `${name}-${photoSeed}`, photoSeed, PX);
    for (const level of levels) for (let t = 0; t < trials; t++) {
      const rnd = mulberry(photoSeed * 1000 + level * 10 + t + 1);
      const px = ph.corners.map(([x, y]) => { const a = rnd() * 2 * Math.PI, e = level * PX; return [x + e * Math.cos(a), y + e * Math.sin(a)]; });
      const t0 = Date.now(), r = decode(ph.pgm, { label: lr.record, anchor: { mm: [[0, 0], [P.W, 0], [P.W, P.H], [0, P.H]], px, log: LOG } }), dt = Date.now() - t0;
      const got = norm(r.plain ?? r.text ?? "").toUpperCase(), ok = r.ok && got.replace(/[^A-Z0-9 .?]/g, "") === want;
      // how far the fitted drawing sits from the true one, over a spread of page points (mm, at the photo's scale)
      let res = NaN; if (r.Hm && r.I) { const truth = hom([[0, 0], [P.W, 0], [P.W, P.H], [0, P.H]], ph.corners); let m = 0; for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.15, 0.5, 0.85]) { const p = [P.W * fx, P.H * fy], a = r.Hm.px(p), b = truth(p); m = Math.max(m, Math.hypot(a[0] / r.I.scale - b[0], a[1] / r.I.scale - b[1]) / PX); } res = m; }
      tally[level].n++; tally[level].ok += ok; tally[level].ms += dt; tally[level].res.push(res);
      if (LOG) { console.log(name, photoSeed, level, LOG.map(([a, b]) => a + " " + b.toFixed(3)).join(" | ")); LOG.length = 0; }
      rows.push(`${ok ? "pass" : "FAIL"}  ${name.padEnd(9)} photo ${photoSeed} ${level} mm try ${t}  ${r.ok ? `"${got.slice(0, 32)}" weak ${r.weak}/${r.cellsRead}` : r.message.slice(0, 60)}  off ${res.toFixed(2)} mm  ${dt} ms`);
    }
  }
}
if (args.includes("--verbose") || args.includes("-v")) console.log(rows.join("\n"));
else console.log(rows.filter(r => r.startsWith("FAIL")).join("\n"));
console.log("tap error   read / photos   mean ms   fit off truth (mm, worst of 9 points): median, max");
for (const l of levels) console.log(`${String(l).padStart(4)} mm     ${String(tally[l].ok).padStart(3)} / ${String(tally[l].n).padEnd(3)}      ${String(Math.round(tally[l].ms / Math.max(1, tally[l].n))).padEnd(8)}  ${(() => { const a = tally[l].res.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? `${a[a.length >> 1].toFixed(2)}, ${a.at(-1).toFixed(2)}` : "-"; })()}`);
const gated = levels.filter(l => l <= 3), bad = gated.filter(l => tally[l].ok < tally[l].n);
console.log(bad.length ? `ANCHOR TEST FAIL at ${bad.join(", ")} mm` : `ANCHOR TEST PASS up to ${Math.max(...gated)} mm (${gated.reduce((s, l) => s + tally[l].ok, 0)} of ${gated.reduce((s, l) => s + tally[l].n, 0)})`);
process.exit(bad.length ? 1 : 0);
