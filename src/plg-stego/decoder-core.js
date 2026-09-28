// Plot decoder core: find a plot's machine marks in a photo, read its key strip, rebuild the drawing from the record,
// and read every message cell by checking which of its possible drawings is actually inked. No DOM: the decoder page
// and the Node checks (decoder-test.mjs) run the same code.
//
//   1. darkness   grey image against a paper-white map (block maxima), so shadows and uneven light cancel out
//   2. finders    dark components that are a ring round a core; the hollow core is bottom right
//   3. strip      a homography from page millimetres to photo pixels for each page size; the one whose strip passes
//                 its sync and checksum wins
//   4. cells      every candidate drawing of a cell is sampled along its strokes; the one inked most (against the
//                 strokes it does not have) is the value
"use strict";
import { homography, project } from "@utp/photo";
import { MARK, PAGES, STEGO, DOT_R, LAYOUTS, finderCentres, stripSlots, unpackRecord, borderTiles, tileWays, TILE_MASK } from "./marks.js";
import { readPlan, METHOD_LIST } from "./cipher-core.js";
import { readPlan as signalPlan } from "./signals-core.js";
import { ellipse, rect, densify, fillConvex } from "./core.js";
import { readGrid, unframe } from "@utp/grid";
import { decodeFrame, DEFAULT_OPTIONS } from "@utp/errorcontrol";
import * as morse from "@utp/morse";
import * as bacon from "@utp/bacon";
import { decodeWithKey } from "@utp/unhide";
import { KEY_FORMAT } from "@utp/key";
import { readGlyphs } from "@utp/glyphs";
import { decipher } from "@utp/ciphers";
import { MOTIFS } from "@utp/motifs";
import { rng } from "@utp/fabric";

// ---------------- image ----------------
// { width, height, data } as RGBA (canvas ImageData) or one byte per pixel (grey), scaled so the long side is at most maxSide.
export function prepare(src, maxSide = 2600) {   // 2600: a phone photo of a page keeps about 8 px per mm, enough for the strip dots
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  const ch = src.data.length / (src.width * src.height) >= 3 ? 4 : 1, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // box-average the source pixels that fall in this one, which also blurs hatching into tone
    const x0 = Math.floor(x / k), x1 = Math.max(x0 + 1, Math.floor((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.max(y0 + 1, Math.floor((y + 1) / k));
    let s = 0, n = 0;
    for (let yy = y0; yy < y1 && yy < src.height; yy++) for (let xx = x0; xx < x1 && xx < src.width; xx++) {
      const i = (yy * src.width + xx) * ch;
      s += ch === 4 ? 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2] : src.data[i]; n++;
    }
    g[y * w + x] = s / n / 255;
  }
  // paper white: the brightest of each 24 px block, smoothed over its neighbours
  const B = 24, bw = Math.ceil(w / B), bh = Math.ceil(h / B), bm = new Float32Array(bw * bh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = Math.floor(y / B) * bw + Math.floor(x / B); if (g[y * w + x] > bm[j]) bm[j] = g[y * w + x]; }
  const sm = new Float32Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < bw && b < bh) { s = Math.max(s, bm[b * bw + a]); n++; } } sm[j * bw + i] = s; }
  const dark = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1, Math.max(0, y / B - 0.5)), i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(bw - 1, i0 + 1), j1 = Math.min(bh - 1, j0 + 1), u = fx - i0, v = fy - j0;
    const paper = (sm[j0 * bw + i0] * (1 - u) + sm[j0 * bw + i1] * u) * (1 - v) + (sm[j1 * bw + i0] * (1 - u) + sm[j1 * bw + i1] * u) * v;
    dark[y * w + x] = Math.min(1, Math.max(0, (paper - g[y * w + x]) / Math.max(0.12, paper * 0.55)));
  }
  return { w, h, g, dark, scale: k };
}
const at = (I, x, y) => { const i = Math.round(x), j = Math.round(y); return i < 0 || j < 0 || i >= I.w || j >= I.h ? 0 : I.dark[j * I.w + i]; };
// Darkest pixel within r px: a pen line a pixel off where the model expects it still counts.
function darkNear(I, x, y, r) { let m = 0; const R = Math.max(1, Math.ceil(r)); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r + 0.5) { const d = at(I, x + dx, y + dy); if (d > m) m = d; } return m; }

// ---------------- finders ----------------
export function findFinders(I) {
  const { w, h } = I, lab = new Int32Array(w * h).fill(-1), parent = [];
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (I.dark[i] < 0.5) continue;
    const ns = [x > 0 ? lab[i - 1] : -1, y > 0 ? lab[i - w] : -1, y > 0 && x > 0 ? lab[i - w - 1] : -1, y > 0 && x < w - 1 ? lab[i - w + 1] : -1].filter(v => v >= 0);
    if (!ns.length) { lab[i] = parent.length; parent.push(parent.length); continue; }
    const r = Math.min(...ns.map(find)); lab[i] = r; for (const n of ns) parent[find(n)] = r;
  }
  const S = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = lab[y * w + x]; if (l < 0) continue; const r = find(l);
    let s = S.get(r); if (!s) S.set(r, (s = { n: 0, sx: 0, sy: 0, x0: x, y0: y, x1: x, y1: y }));
    s.n++; s.sx += x; s.sy += y; if (x < s.x0) s.x0 = x; if (x > s.x1) s.x1 = x; if (y < s.y0) s.y0 = y; if (y > s.y1) s.y1 = y;
  }
  const comps = [...S.values()].filter(s => s.n >= 12).map(s => ({ ...s, cx: s.sx / s.n, cy: s.sy / s.n, bw: s.x1 - s.x0 + 1, bh: s.y1 - s.y0 + 1 }));
  const out = [];
  for (const ring of comps) {
    const fill = ring.n / (ring.bw * ring.bh), asp = ring.bw / ring.bh;
    if (ring.bw < 10 || ring.bh < 10 || fill < 0.25 || fill > 0.8 || asp < 0.4 || asp > 2.5) continue;
    const mx = (ring.x0 + ring.x1) / 2, my = (ring.y0 + ring.y1) / 2;
    if (Math.abs(ring.cx - mx) > 0.12 * ring.bw || Math.abs(ring.cy - my) > 0.12 * ring.bh) continue;
    const core = comps.find(c => c !== ring && Math.abs(c.cx - mx) < 0.15 * ring.bw && Math.abs(c.cy - my) < 0.15 * ring.bh && c.bw / ring.bw > 0.22 && c.bw / ring.bw < 0.6 && c.bh / ring.bh > 0.22 && c.bh / ring.bh < 0.6);
    if (!core) continue;
    // hollow: the middle of the core, averaged over a small disk (a single pixel can land in a pen gap)
    const rr = Math.max(1, 0.12 * (core.bw + core.bh) / 2); let dsum = 0, dn = 0;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr) { dsum += at(I, core.cx + dx, core.cy + dy); dn++; }
    out.push({ x: (core.cx + mx) / 2, y: (core.cy + my) / 2, size: (ring.bw + ring.bh) / 2, hollow: dsum / dn < 0.4 });
  }
  return out;
}
// The four finders in page order TL, TR, BR, BL (bottom right is the hollow one).
export function orderFinders(cands) {
  const hol = cands.filter(c => c.hollow), sol = cands.filter(c => !c.hollow);
  if (!hol.length || sol.length < 3) return null;
  let best = null;
  const area = q => Math.abs(q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p.x * r.y - r.x * p.y; }, 0)) / 2;
  const top = sol.slice().sort((a, b) => b.size - a.size).slice(0, 10);
  for (const br of hol.slice(0, 4)) for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) for (let k = j + 1; k < top.length; k++) {
    const three = [top[i], top[j], top[k]], sizes = [br, ...three].map(c => c.size);
    if (Math.max(...sizes) / Math.min(...sizes) > 2.2) continue;
    // top left is the finder diagonal to the hollow one: the other two lie on opposite sides of the line between them.
    // (Farthest from the hollow one failed on the 170 x 60 label seen at a slant: bottom left looked farther.)
    const side = (c, d) => (c.x - br.x) * (d.y - br.y) - (c.y - br.y) * (d.x - br.x);
    const tl = three.find(c => { const [p, q] = three.filter(d => d !== c); return side(c, p) * side(c, q) < 0; }) || three.slice().sort((a, b) => Math.hypot(b.x - br.x, b.y - br.y) - Math.hypot(a.x - br.x, a.y - br.y))[0], [p, q] = three.filter(c => c !== tl);
    const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x), [tr, bl] = cross > 0 ? [p, q] : [q, p];
    const quad = [tl, tr, br, bl], a = area(quad);
    if (!best || a > best.a) best = { a, quad };
  }
  return best ? best.quad.map(c => [c.x, c.y]) : null;
}

// ---------------- strip and sampling ----------------
// off: a shift in page millimetres, for retrofit marks that sit a little off the drawing they were plotted round
function sampler(I, Hm, off = [0, 0]) {
  const [ax, ay] = project(Hm, [50, 50]), [bx, by] = project(Hm, [51, 50]), [cx, cy] = project(Hm, [50, 51]), ppm = (Math.hypot(bx - ax, by - ay) + Math.hypot(cx - ax, cy - ay)) / 2;
  const P = ([x, y]) => project(Hm, [x + off[0], y + off[1]]);
  return { ppm, Hm, off, px: P, dark: (p, rMm = 0.28) => { const [x, y] = P(p); return darkNear(I, x, y, Math.max(0.8, rMm * ppm)); }, area: p => { const [x, y] = P(p); return at(I, x, y); } };
}
// A dot strip: each slot is the mean darkness of five points inside where a dot would be (one noisy pixel cannot fake
// a dot); the cut between dot and paper comes from the strip's own two levels, not a fixed number.
function readDots(sp, W, H, lay) {
  const { slots } = stripSlots(W, H, lay), q = lay.dot * 0.45;
  const lv = slots.map(([x, y]) => [[0, 0], [q, 0], [-q, 0], [0, q], [0, -q]].reduce((s, [dx, dy]) => s + sp.area([x + dx, y + dy]), 0) / 5);
  let lo = Math.min(...lv), hi = Math.max(...lv);
  for (let k = 0; k < 20; k++) { const c = (lo + hi) / 2, a = lv.filter(v => v <= c), b = lv.filter(v => v > c); if (a.length) lo = a.reduce((s, v) => s + v, 0) / a.length; if (b.length) hi = b.reduce((s, v) => s + v, 0) / b.length; }
  const cut = (lo + hi) / 2;
  return lv.map(v => ({ bit: v > cut ? 1 : 0, margin: Math.abs(v - cut) }));
}
// A border: each tile is read like a message cell (which of its two drawings is inked), unscrambled, and every bit takes
// the more certain of the tiles that carry it (the border repeats the record where it is longer than 128 tiles).
function readTiles(sp, W, H, lay) {
  const N = MARK.slots * MARK.rows, best = Array.from({ length: N }, () => ({ bit: 0, margin: -1 }));
  borderTiles(W, H, lay).forEach((T, i) => { const p = pick(sp, tileWays(T, lay.tiles)), j = i % N; if (p.conf > best[j].margin) best[j] = { bit: p.value ^ TILE_MASK[i], margin: p.conf }; });
  return best;
}
// Every mark layout (normal, retrofit, the two borders, the settings label) and every page size is tried; the key that
// passes its sync and checksum says which it was. The label is its own 170 x 60 card, so its record's page is the front's.
export function readStrip(I, quad) {
  const tried = [];
  for (const lay of Object.values(LAYOUTS)) for (const page of lay.strip === false ? [] : lay.page ? [lay.page] : PAGES) {
    const [W, H] = page.split("x").map(Number), Hm = homography(finderCentres(W, H, lay), quad), sp = sampler(I, Hm);
    const reads = lay.tiles ? readTiles(sp, W, H, lay) : readDots(sp, W, H, lay);
    const bits = reads.map(q => q.bit), ok = b => { const x = unpackRecord(b); return !x.error && (lay.page || PAGES[x.fields.page] === page) ? x : null; };
    let rec = ok(bits);
    // the checksum failed: try flipping each of the six least certain bits (a flip only counts if the page matches too)
    if (!rec) for (const i of reads.map((q, i) => [q.margin, i]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(q => q[1])) { const b = bits.slice(); b[i] ^= 1; if ((rec = ok(b))) { rec.repaired = i; break; } }
    if (rec) return { page, W, H, Hm, sp, rec, lay };
    rec = unpackRecord(bits);
    tried.push({ page, lay: lay.name, error: rec.error, bits: bits.join("") });
  }
  return { tried };
}

// ---------------- reading cells ----------------
// cands: one list of [points, closed] paths per possible value (an empty list is "nothing drawn").
// Work on a 0.3 mm grid of sample cells: every candidate claims the cells its strokes pass through (a bit mask per
// cell), and "near" means the 3 x 3 cells round a cell. Masks are plain numbers up to 30 candidates, BigInts beyond
// (the signal flags offer 37: 26 letters, 10 pennants and a blank).
function pick(sp, cands, rMm = 0.28) {
  const big = cands.length > 30, Z = big ? 0n : 0, bitOf = v => (big ? 1n << BigInt(v) : 1 << v);
  const G = 0.3, K = (i, j) => i * 65536 + j, owner = new Map(), where = new Map();
  cands.forEach((ps, v) => ps.forEach(([p, c]) => (p.length > 1 ? densify(p, c, 0.35) : p).forEach(([x, y]) => {
    const i = Math.round(x / G), j = Math.round(y / G), k = K(i, j);
    owner.set(k, (owner.get(k) || Z) | bitOf(v)); if (!where.has(k)) where.set(k, [x, y]);   // sample the stroke point itself
  })));
  const keys = [...owner.keys()], near = new Map(), dark = new Map();
  for (const k of keys) {
    const i = Math.floor(k / 65536), j = k - i * 65536; let m = Z;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) m |= owner.get(K(i + a, j + b)) || Z;
    near.set(k, m); dark.set(k, sp.dark(where.get(k), rMm));
  }
  const mean = ks => (ks.length ? ks.reduce((s, k) => s + dark.get(k), 0) / ks.length : null);
  const scores = cands.map((ps, v) => {
    const bit = bitOf(v);
    if (!ps.length) return 0.4 - (mean(keys) ?? 0);
    const mine = keys.filter(k => (owner.get(k) & bit) !== Z), own = mine.filter(k => (near.get(k) & ~bit) === Z), inV = own.length >= 3 ? own : mine;
    const outV = keys.filter(k => (near.get(k) & bit) === Z);
    return mean(inV) - (outV.length ? mean(outV) : 0.4);
  });
  const order = scores.map((s, v) => [s, v]).sort((a, b) => b[0] - a[0]);
  // top: how well the winner's own strokes sit on ink, for fitting a hand-tapped anchor (a margin can be decisive and wrong)
  return { value: order[0][1], conf: order[0][0] - (order[1] ? order[1][0] : 0), top: order[0][0] };
}

// Template matching, for glyphs dense with hatching (the signal flags): each candidate is rendered as the darkness it
// would leave on a 0.35 mm grid (pen width and a little blur included), the photo is sampled on the same grid, and the
// candidate that correlates best wins. Stroke scoring could not tell hatch directions apart: every hatched flag read as E.
// Candidates are the same shapes in every cell, only moved, so their renders are cached by shape and reused.
const TPL = new Map();
function templates(cands) {
  const pts = cands.flatMap(ps => ps.flatMap(([p]) => p)), b = pts.length ? pts.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [1e9, 1e9, -1e9, -1e9]) : [0, 0, 1, 1];
  const key = `${cands.length}:${(b[2] - b[0]).toFixed(1)}x${(b[3] - b[1]).toFixed(1)}:${pts.length}`;
  if (TPL.has(key)) return { ...TPL.get(key), ox: b[0], oy: b[1] };
  const S = 0.35, m = 0.6, nx = Math.ceil((b[2] - b[0] + 2 * m) / S), ny = Math.ceil((b[3] - b[1] + 2 * m) / S), sig = 0.22;
  const pred = cands.map(ps => {
    const r = new Float32Array(nx * ny);
    for (const [p, c] of ps) for (const [x, y] of p.length > 1 ? densify(p, c, 0.1) : p) {
      const fx = (x - b[0] + m) / S, fy = (y - b[1] + m) / S;
      for (let j = Math.floor(fy - 2); j <= fy + 2; j++) for (let i = Math.floor(fx - 2); i <= fx + 2; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const d = Math.hypot((i + 0.5 - fx) * S, (j + 0.5 - fy) * S), v = Math.exp(-((Math.max(0, d - 0.15) / sig) ** 2));
        if (v > r[j * nx + i]) r[j * nx + i] = v;
      }
    }
    return r;
  });
  const t = { pred, nx, ny, S, m };
  TPL.set(key, t);
  return { ...t, ox: b[0], oy: b[1] };
}
function observe(sp, cands) {
  const t = templates(cands), obs = new Float32Array(t.nx * t.ny);
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) obs[j * t.nx + i] = sp.dark([t.ox - t.m + (i + 0.5) * t.S, t.oy - t.m + (j + 0.5) * t.S], 0.06);
  return { t, obs, mo: obs.reduce((s, v) => s + v, 0) / obs.length };
}
// bareCut: the ink level under which a cell counts as blank, set from the page's own cells (see pickAll)
function pickTemplate(sp, cands, bareCut) {
  const { t: { pred }, obs, mo } = observe(sp, cands), n = obs.length, so = Math.sqrt(obs.reduce((s, v) => s + (v - mo) ** 2, 0) / n) || 1e-6;
  const means = pred.map(p => p.reduce((s, v) => s + v, 0) / n);
  const ncc = pred.map((p, v) => {
    if (!means[v]) return -Infinity;
    // a glyph is only a candidate if its own strokes are inked: a sparse glyph (one ogham notch, a stick figure) can
    // correlate with bare-paper noise, but its stroke points then sit near the noise level (about 0.2), not the ink (0.9)
    let si = 0, sn = 0; for (let k = 0; k < n; k++) if (p[k] > 0.6) { si += obs[k]; sn++; }
    if (sn && si / sn < 0.5) return -1;
    const mp = means[v], sd = Math.sqrt(p.reduce((s, x) => s + (x - mp) ** 2, 0) / n) || 1e-6;
    let c = 0; for (let k = 0; k < n; k++) c += (obs[k] - mo) * (p[k] - mp);
    return c / (n * so * sd);
  });
  // blank takes both tests: little ink (by the page's own levels) and no glyph that fits. Ink alone called the mostly
  // white flags (A, S, X) blank; correlation alone let bare-paper noise match a template.
  // also blank when no glyph's strokes are inked at all (then every candidate scored -1 and the first one won by default)
  const bestFit = Math.max(...ncc), bare = (mo < bareCut && bestFit < 0.35) || bestFit <= -1;
  const scores = ncc.map((s, v) => (!means[v] ? (bare ? 10 : -10) : bare ? -1 : s));
  const order = scores.map((s, v) => [s, v]).sort((a, b) => b[0] - a[0]);
  // fit: how well the best glyph matches, what the retrofit shift search maximises (the winning margin let a badly
  // shifted template win with confidence, and the hoist read as a column of B flags)
  return { value: order[0][1], conf: order[0][0] - (order[1] ? order[1][0] : 0), fit: bare ? 0.5 : bestFit };
}

// Hatch-filled or not: the mean darkness over the inside (a hatch at 0.5 to 1 mm pitch covers roughly 30 to 60 per cent);
// an outline-only block counts through its edge instead.
function pickArea(sp, { area, edge }) {
  const a = area.reduce((s, p) => s + sp.area(p), 0) / area.length, e = edge ? densify(edge[0][0], true, 0.4).reduce((s, p) => s + sp.dark(p), 0) / densify(edge[0][0], true, 0.4).length : 0;
  const score = Math.max((a - 0.12) / 0.2, edge ? (e - 0.35) / 0.3 : -1);
  return { value: score > 0 ? 1 : 0, conf: Math.min(1, Math.abs(score)) * 0.3 };
}
const gridPts = (x, y, w, h, n = 7) => Array.from({ length: n * n }, (_, i) => [x + w * ((i % n) + 0.5) / n, y + h * (Math.floor(i / n) + 0.5) / n]);
const ellipsePts = (cx, cy, rx, ry, rot) => { const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const u = i / 2.5 * rx, v = j / 2.5 * ry; if ((u / rx) ** 2 + (v / ry) ** 2 <= 1) out.push([cx + u * c - v * s, cy + u * s + v * c]); } return out; };

// ---------------- the studios ----------------
// Each studio's plan: its cells (candidates per cell, or an area to measure) and how to turn the picked values into text.
function cipherPlan(fields, studio) {
  const plan = readPlan(fields, studio);
  return { cells: plan.cells, finish: (picks, key) => ({ studio: "cipher garden", method: METHOD_LIST[fields.method], cipher: plan.cipher, o: plan.o, ...plan.finish(picks.map(p => p.value), key) }) };
}
function signalBookPlan(fields) {
  const plan = signalPlan(fields);
  return { cells: plan.cells, finish: (picks, key) => ({ studio: "signal book", method: plan.o.alpha, cipher: plan.cipher, ...plan.finish(picks.map(p => p.value), key) }) };
}
function stegoPlan(f) {
  const look = STEGO.LOOKS[f.look], carrier = STEGO.CARRIERS[f.carrier], enc = STEGO.ENCS[f.enc], hide = STEGO.HIDES[f.hide], cipher = STEGO.CIPHERS[f.cipher];
  const cw = f.cw / 100, x0 = f.x0 / 10, y0 = f.y0 / 10, R = f.rows, C = f.cols, aspect = look === "stitches" ? 0.78 : 1, ch = cw * aspect, wob = f.wobble / 20;
  // cell geometry, rebuilt the way studio.js drew it (stitches replay its seeded wobble call for call)
  const cells = [], ys = [], jit = [];
  if (look === "stitches") {
    const r = rng(f.seed * 7 + 1), hs = Array.from({ length: R }, () => ch * (1 + (r() - 0.5) * 0.12 * wob)), k = ch * R / hs.reduce((a, b) => a + b, 0);
    let yy = y0; for (let i = 0; i < R; i++) { ys.push([yy, hs[i] * k]); yy += hs[i] * k; }
    for (let i = 0; i < R; i++) { const drift = (r() - 0.5) * 2 * wob, row = []; for (let c = 0; c < C; c++) row.push([(r() - 0.5) * 0.08 * cw * wob, (r() - 0.5) * 0.07 * ys[i][1] * wob, (r() - 0.5) * 8 * wob + drift]); jit.push(row); }
  }
  const twoColour = carrier === "two-colour" || carrier === "stripes";
  for (let rr = 0; rr < R; rr++) for (let c = 0; c < C; c++) {
    const x = x0 + c * cw, y = y0 + rr * ch, cx = x + cw / 2, cy = y + cw / 2;
    let cands;
    if (look === "dots") cands = [[], [[ellipse(cx, cy, 0.3 * cw, 0.3 * cw, 0, 28), true]]];
    else if (look === "punch") cands = [[], [[ellipse(cx, cy, 0.32 * cw, 0.32 * cw, 0, 24), true]]];
    else if (look === "cross") { const e = 0.16 * cw; cands = [[], [[[[x + e, y + e], [x + cw - e, y + cw - e]], false], [[[x + cw - e, y + e], [x + e, y + cw - e]], false]]]; }
    // a shaded block reads by its inside; an outline-only block (fill "none") by its inner square instead
    else if (look === "blocks") cands = STEGO.FILLS[f.fill] === "none" ? [[], [[rect(x + 0.1 * cw, y + 0.1 * cw, 0.8 * cw, 0.8 * cw), true]]] : { area: gridPts(x + 0.18 * cw, y + 0.18 * cw, 0.64 * cw, 0.64 * cw) };
    else if (look === "truchet") {
      const h = cw / 2, arc = (px, py, a0, a1) => [Array.from({ length: 13 }, (_, k) => [px + h * Math.cos(a0 + (a1 - a0) * k / 12), py + h * Math.sin(a0 + (a1 - a0) * k / 12)]), false];
      cands = [[arc(x, y, 0, Math.PI / 2), arc(x + cw, y + cw, Math.PI, 1.5 * Math.PI)], [arc(x + cw, y, Math.PI / 2, Math.PI), arc(x, y + cw, -Math.PI / 2, 0)]];
    } else {
      const [jx, jy, tilt] = jit[rr][c], [sy, sh] = ys[rr], sx = x + jx, syy = sy + jy, scx = sx + cw / 2, scy = syy + sh / 2;
      const legs = [[ellipse(scx - 0.21 * cw, scy, 0.23 * cw, 0.54 * sh, -26 + tilt, 24), true], [ellipse(scx + 0.21 * cw, scy, 0.23 * cw, 0.54 * sh, 26 + tilt, 24), true]];
      // two colours: the same legs either way, colour B hatched inside them; purl relief: legs or a bump
      cands = twoColour ? { area: [-1, 1].flatMap(sg => ellipsePts(scx + sg * 0.21 * cw, scy, 0.13 * cw, 0.34 * sh, sg * 26 + tilt)) } : [legs, [[ellipse(scx, scy, 0.52 * cw, 0.36 * sh, tilt, 28), true]]];
    }
    cells.push({ cands, r: rr, c });
  }
  const finish = (picks, cipherKey) => {
    const grid = Array.from({ length: R }, (_, rr) => Array.from({ length: C }, (_, c) => picks[rr * C + c].value)), bottomUp = grid.slice().reverse(), b = f.border ? 1 : 0;
    const encoding = enc === "morse" ? { alphabet: "morse" } : enc.startsWith("bacon") ? { alphabet: "bacon", variant: enc === "bacon24" ? "historical24" : "modern26" } : { alphabet: "fivebit", errorControl: [{ code: "plain", separator: false, checksum: false }, DEFAULT_OPTIONS, { code: "hamming", separator: true, checksum: true }][f.check] };
    let text;
    if (hide === "chart") {
      if (["pixel5", "geometric3", "geometric4"].includes(enc)) text = readGlyphs(unframe(bottomUp, b), enc).text;
      else { const bits = readGrid(bottomUp, b).bits; text = enc === "morse" ? morse.decodeUnits(bits).text : enc.startsWith("bacon") ? bacon.decode(bits, encoding.variant).text : decodeFrame(bits, encoding.errorControl).text; }
    } else {
      const motif = hide.startsWith("motif-") ? hide.slice(6) : null, m = motif ? MOTIFS[motif].size : 1;
      const key = { format: KEY_FORMAT, version: 1, hide: motif ? { mode: "motif", motif } : { mode: "scatter", seed: f.seed, filler: "texture", density: f.density + 2 }, encoding, carrier, border: b, width: (C - 2 * b) / m, height: (R - 2 * b) / m, ...(motif ? {} : { length: f.len }) };
      text = decodeWithKey(bottomUp, key).text;
    }
    return { studio: "purloined plot studio", method: `${hide}, ${look}`, text, plain: cipher !== "none" && cipherKey ? decipher(text, { kind: cipher, key: cipherKey }) : null, cipher };
  };
  return { cells, finish };
}
// Pick every cell. Area cells have no fixed cut-off (empty paper measured 0.15, shaded 1.0 in the first test photo):
// their measured levels split into two groups and the darker group is 1.
// rMm: how far round a stroke point to look for ink. 0.28 mm forgives a little misplacement; the signal flags need
// 0.1, or their hatching (0.7 mm apart) reads as ink whichever way it runs and every flag looks like E.
function pickAll(sp, cells, rMm = 0.28) {
  const levels = cells.map(c => (Array.isArray(c.cands) ? null : c.cands.area.reduce((s, p) => s + sp.area(p), 0) / c.cands.area.length));
  const lv = levels.filter(v => v !== null);
  let lo = lv.length ? Math.min(...lv) : 0, hi = lv.length ? Math.max(...lv) : 1;
  for (let k = 0; k < 20 && lv.length; k++) { const cut = (lo + hi) / 2, a = lv.filter(v => v <= cut), b = lv.filter(v => v > cut); if (a.length) lo = a.reduce((s, v) => s + v, 0) / a.length; if (b.length) hi = b.reduce((s, v) => s + v, 0) / b.length; }
  const cut = hi - lo > 0.15 ? (lo + hi) / 2 : 0.35;   // one group only (all blank or all shaded): fall back to a fixed cut
  // template cells: blank against inked by the page's own two ink levels (bare paper read about 0.2 through sensor noise,
  // glyphs 0.7 to 0.95 in the first test photos, so no fixed cut works everywhere)
  let bareCut = 0;
  if (rMm === "template") {
    const mos = cells.filter(c => Array.isArray(c.cands)).map(c => observe(sp, c.cands).mo);
    let a = Math.min(...mos), z = Math.max(...mos);
    for (let k = 0; k < 20; k++) { const m = (a + z) / 2, lo2 = mos.filter(v => v <= m), hi2 = mos.filter(v => v > m); if (lo2.length) a = lo2.reduce((s, v) => s + v, 0) / lo2.length; if (hi2.length) z = hi2.reduce((s, v) => s + v, 0) / hi2.length; }
    bareCut = z - a > 0.15 ? (a + z) / 2 : a * 0.5;   // one level only: every cell holds a glyph
  }
  return cells.map((c, i) => (Array.isArray(c.cands) ? (rMm === "template" ? pickTemplate(sp, c.cands, bareCut) : pick(sp, c.cands, rMm)) : { value: levels[i] > cut ? 1 : 0, conf: Math.min(1, Math.abs(levels[i] - cut) / Math.max(0.1, (hi - lo) / 2)) * 0.3 }));
}
// Retrofit marks were plotted onto a sheet put back on the mat by hand, so they may sit a millimetre or two off the
// drawing. Try shifts on a sample of cells and keep the one whose cells read most decisively.
function findShift(I, Hm, cells, how = 0.28, span0 = 2) {
  const sample = cells.filter((_, i) => i % Math.max(1, Math.floor(cells.length / 50)) === 0), score = off => { const ps = pickAll(sampler(I, Hm, off), sample, how); return ps.reduce((s, p) => s + (p.fit ?? Math.max(0, p.conf)), 0) / ps.length; };
  let best = [0, 0], bs = score(best);
  for (const [span, step] of [[span0, 0.5], [0.5, 0.125]]) {
    const [cx, cy] = best;
    for (let dx = -span; dx <= span + 1e-9; dx += step) for (let dy = -span; dy <= span + 1e-9; dy += step) { const s = score([cx + dx, cy + dy]); if (s > bs) { bs = s; best = [cx + dx, cy + dy]; } }
  }
  return best;
}

const STUDIO_NAMES = { 1: "cipher garden", 2: "purloined plot", 3: "signal book", 4: "cipher garden", 5: "cipher garden" };
// Tapped corners miss by a few millimetres each, and independently, which warps the fit as well as shifting it. Nudge each
// corner in turn (8 px down to 1 px steps) and keep a move when the sample cells read more decisively.
function refineAnchor(I, mm, quad, cells, how) {
  const sample = cells.filter((_, i) => i % Math.max(1, Math.floor(cells.length / 60)) === 0);
  const score = q => { const ps = pickAll(sampler(I, homography(mm, q)), sample, how); return ps.reduce((s, p) => s + (p.fit ?? p.top ?? 0), 0) / ps.length; };
  let q = quad.map(p => [...p]), best = score(q);
  // first the whole quad together (the taps' shared error), on a grid a quarter cell apart and wide enough for a cell
  const span = Math.round(Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) * 0.04), st0 = Math.max(2, Math.round(span / 6));
  const q0 = q;
  for (let dx = -span; dx <= span; dx += st0) for (let dy = -span; dy <= span; dy += st0) { const tq = q0.map(([x, y]) => [x + dx, y + dy]), s = score(tq); if (s > best) { best = s; q = tq; } }
  for (const step of [8, 4, 2, 1]) {
    for (let pass = 0, moved = true; pass < 8 && moved; pass++) {
      moved = false;
      for (let i = 0; i < 4; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const tq = q.map((p, k) => (k === i ? [p[0] + dx, p[1] + dy] : p)), s = score(tq);
        if (s > best) { best = s; q = tq; moved = true; }
      }
    }
  }
  return q;
}
// The whole read: image in, message out, plus everything the page needs to show its working.
// label: a record read earlier off a settings label, for a front that carries only its four corner finders.
// anchor (with label): no marks at all, four points tapped on the photo (px) that sit at known page millimetres (mm),
// usually the corners of the drawing; a wider shift search then pulls the rebuilt drawing onto the ink.
export function decode(src, { cipherKey = "", quad = null, label = null, anchor = null } = {}) {
  const t0 = Date.now(), I = prepare(src);
  let q = quad ? quad.map(([x, y]) => [x * I.scale, y * I.scale]) : null, finders = [];
  if (anchor && label) q = anchor.px.map(([x, y]) => [x * I.scale, y * I.scale]);
  if (!q) { finders = findFinders(I); q = orderFinders(finders); }
  if (!q) return { ok: false, stage: "finders", message: `Found ${finders.length} corner target${finders.length === 1 ? "" : "s"} (need four, one of them hollow). Get the whole page in, flat and in even light.`, finders, I };
  let S = anchor && label ? { tried: [] } : readStrip(I, q);
  if (anchor && label && PAGES[label.fields.page]) { const page = PAGES[label.fields.page], [W, H] = page.split("x").map(Number), Hm = homography(anchor.mm, q); S = { page, W, H, Hm, sp: sampler(I, Hm), rec: label, lay: { name: "hand" } }; }
  if (S.rec && S.lay.name === "label") return { ok: true, label: true, record: S.rec, studio: STUDIO_NAMES[S.rec.studio] || "unknown", method: "settings label", text: "", cells: [], picks: [], page: S.page, marks: "label", finders, quad: q, I, Hm: S.sp, weak: 0, cellsRead: 0, ms: Date.now() - t0,
    message: `Settings label read (${STUDIO_NAMES[S.rec.studio] || "unknown"}, ${PAGES[S.rec.fields.page]} mm page). Now scan the front of the piece.` };
  // no key on the page: the corners-only front, with its settings from a label read before
  if (!S.rec && label && PAGES[label.fields.page]) { const page = PAGES[label.fields.page], [W, H] = page.split("x").map(Number), Hm = homography(finderCentres(W, H, LAYOUTS.corners), q); S = { page, W, H, Hm, sp: sampler(I, Hm), rec: label, lay: LAYOUTS.corners }; }
  if (!S.rec) return { ok: false, stage: "strip", message: "Found the corners but could not read the key strip. Get closer, or hold the phone square to the page. A piece with corner targets only needs its settings label scanned first.", tried: S.tried, finders, quad: q, I };
  try {
    const st = S.rec.studio, plan = st === 1 || st === 4 || st === 5 ? cipherPlan(S.rec.fields, st) : st === 3 ? signalBookPlan(S.rec.fields) : stegoPlan(S.rec.fields);
    if (S.lay.name === "hand") { q = refineAnchor(I, anchor.mm, q, plan.cells, st === 3 ? "template" : 0.28); S.Hm = homography(anchor.mm, q); }
    const shift = S.lay.name === "retro" || S.lay.name === "corners" ? findShift(I, S.Hm, plan.cells, st === 3 ? "template" : 0.28) : [0, 0], sp = sampler(I, S.Hm, shift);
    const how = st === 3 ? "template" : 0.28, picks = pickAll(sp, plan.cells, how), res = plan.finish(picks, cipherKey);
    const confs = picks.map(p => p.conf), weak = confs.filter(c => c < 0.08).length;
    return { ok: true, ...res, picks, cells: plan.cells, page: S.page, marks: S.lay.name, fromLabel: S.lay.name === "corners", shift, record: S.rec, Hm: sp, quad: q, finders, I, weak, cellsRead: confs.length, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, stage: "cells", message: String(err && err.message || err), finders, quad: q, I, record: S.rec };
  }
}