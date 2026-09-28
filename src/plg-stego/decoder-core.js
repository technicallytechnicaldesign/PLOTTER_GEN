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
import { MARK, PAGES, STEGO, DOT_R, finderCentres, stripSlots, unpackRecord } from "./marks.js";
import { readPlan, METHOD_LIST } from "./cipher-core.js";
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
    const tl = three.slice().sort((a, b) => Math.hypot(b.x - br.x, b.y - br.y) - Math.hypot(a.x - br.x, a.y - br.y))[0], [p, q] = three.filter(c => c !== tl);
    const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x), [tr, bl] = cross > 0 ? [p, q] : [q, p];
    const quad = [tl, tr, br, bl], a = area(quad);
    if (!best || a > best.a) best = { a, quad };
  }
  return best ? best.quad.map(c => [c.x, c.y]) : null;
}

// ---------------- strip and sampling ----------------
function sampler(I, Hm) {
  const [ax, ay] = project(Hm, [50, 50]), [bx, by] = project(Hm, [51, 50]), [cx, cy] = project(Hm, [50, 51]), ppm = (Math.hypot(bx - ax, by - ay) + Math.hypot(cx - ax, cy - ay)) / 2;
  return { ppm, px: p => project(Hm, p), dark: (p, rMm = 0.28) => { const [x, y] = project(Hm, p); return darkNear(I, x, y, Math.max(0.8, rMm * ppm)); }, area: p => { const [x, y] = project(Hm, p); return at(I, x, y); } };
}
export function readStrip(I, quad) {
  const tried = [];
  for (const page of PAGES) {
    const [W, H] = page.split("x").map(Number), Hm = homography(finderCentres(W, H), quad), sp = sampler(I, Hm), { slots } = stripSlots(W, H), q = DOT_R * 0.45;
    // each slot: the mean darkness of five points inside where a dot would be (one noisy pixel cannot fake a dot);
    // the cut between dot and paper comes from the strip's own two levels, not a fixed number
    const lv = slots.map(([x, y]) => [[0, 0], [q, 0], [-q, 0], [0, q], [0, -q]].reduce((s, [dx, dy]) => s + sp.area([x + dx, y + dy]), 0) / 5);
    let lo = Math.min(...lv), hi = Math.max(...lv);
    for (let k = 0; k < 20; k++) { const c = (lo + hi) / 2, a = lv.filter(v => v <= c), b = lv.filter(v => v > c); if (a.length) lo = a.reduce((s, v) => s + v, 0) / a.length; if (b.length) hi = b.reduce((s, v) => s + v, 0) / b.length; }
    const cut = (lo + hi) / 2, reads = lv.map(v => ({ bit: v > cut ? 1 : 0, margin: Math.abs(v - cut) }));
    const bits = reads.map(q => q.bit), ok = b => { const x = unpackRecord(b); return !x.error && PAGES[x.fields.page] === page ? x : null; };
    let rec = ok(bits);
    // the checksum failed: try flipping each of the six least certain bits (a flip only counts if the page matches too)
    if (!rec) for (const i of reads.map((q, i) => [q.margin, i]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(q => q[1])) { const b = bits.slice(); b[i] ^= 1; if ((rec = ok(b))) { rec.repaired = i; break; } }
    if (rec) return { page, W, H, Hm, sp, rec };
    rec = unpackRecord(bits);
    tried.push({ page, error: rec.error, bits: bits.join("") });
  }
  return { tried };
}

// ---------------- reading cells ----------------
// cands: one list of [points, closed] paths per possible value (an empty list is "nothing drawn").
// Work on a 0.3 mm grid of sample cells: every candidate claims the cells its strokes pass through (a bit mask per
// cell, so up to 31 candidates), and "near" means the 3 x 3 cells round a cell.
function pick(sp, cands) {
  const G = 0.3, K = (i, j) => i * 65536 + j, owner = new Map(), where = new Map();
  cands.forEach((ps, v) => ps.forEach(([p, c]) => (p.length > 1 ? densify(p, c, 0.35) : p).forEach(([x, y]) => {
    const i = Math.round(x / G), j = Math.round(y / G), k = K(i, j);
    owner.set(k, (owner.get(k) || 0) | (1 << v)); if (!where.has(k)) where.set(k, [x, y]);   // sample the stroke point itself
  })));
  const keys = [...owner.keys()], near = new Map(), dark = new Map();
  for (const k of keys) {
    const i = Math.floor(k / 65536), j = k - i * 65536; let m = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) m |= owner.get(K(i + a, j + b)) || 0;
    near.set(k, m); dark.set(k, sp.dark(where.get(k)));
  }
  const mean = ks => (ks.length ? ks.reduce((s, k) => s + dark.get(k), 0) / ks.length : null);
  const scores = cands.map((ps, v) => {
    const bit = 1 << v;
    if (!ps.length) return 0.4 - (mean(keys) ?? 0);
    const mine = keys.filter(k => owner.get(k) & bit), own = mine.filter(k => !(near.get(k) & ~bit)), inV = own.length >= 3 ? own : mine;
    const outV = keys.filter(k => !(near.get(k) & bit));
    return mean(inV) - (outV.length ? mean(outV) : 0.4);
  });
  const order = scores.map((s, v) => [s, v]).sort((a, b) => b[0] - a[0]);
  return { value: order[0][1], conf: order[0][0] - (order[1] ? order[1][0] : 0) };
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

// ---------------- the two studios ----------------
function readCipher(sp, fields, cipherKey) {
  const plan = readPlan(fields), picks = plan.cells.map(c => pick(sp, c.cands));
  const out = plan.finish(picks.map(p => p.value), cipherKey);
  return { studio: "cipher garden", method: METHOD_LIST[fields.method], ...out, cipher: plan.cipher, picks, cells: plan.cells, o: plan.o };
}
function readStego(sp, f, cipherKey) {
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
  // area cells: no fixed cut-off (empty paper measured 0.15, shaded 1.0 in the first test photo); split the
  // measured levels into two groups instead, and call the darker group 1
  const levels = cells.map(c => (Array.isArray(c.cands) ? null : c.cands.area.reduce((s, p) => s + sp.area(p), 0) / c.cands.area.length));
  const lv = levels.filter(v => v !== null);
  let lo = Math.min(...lv), hi = Math.max(...lv);
  for (let k = 0; k < 20 && lv.length; k++) { const cut = (lo + hi) / 2, a = lv.filter(v => v <= cut), b = lv.filter(v => v > cut); if (a.length) lo = a.reduce((s, v) => s + v, 0) / a.length; if (b.length) hi = b.reduce((s, v) => s + v, 0) / b.length; }
  const cut = hi - lo > 0.15 ? (lo + hi) / 2 : 0.35;   // one group only (all blank or all shaded): fall back to a fixed cut
  const picks = cells.map((c, i) => (Array.isArray(c.cands) ? pick(sp, c.cands) : { value: levels[i] > cut ? 1 : 0, conf: Math.min(1, Math.abs(levels[i] - cut) / Math.max(0.1, (hi - lo) / 2)) * 0.3 })), grid = Array.from({ length: R }, (_, rr) => Array.from({ length: C }, (_, c) => picks[rr * C + c].value));
  const bottomUp = grid.slice().reverse(), b = f.border ? 1 : 0;
  const encoding = enc === "morse" ? { alphabet: "morse" } : enc.startsWith("bacon") ? { alphabet: "bacon", variant: enc === "bacon24" ? "historical24" : "modern26" } : { alphabet: "fivebit", errorControl: [{ code: "plain", separator: false, checksum: false }, DEFAULT_OPTIONS, { code: "hamming", separator: true, checksum: true }][f.check] };
  let text;
  if (hide === "chart") {
    if (["pixel5", "geometric3", "geometric4"].includes(enc)) text = readGlyphs(unframe(bottomUp, b), enc).text;
    else {
      const bits = readGrid(bottomUp, b).bits;
      text = enc === "morse" ? morse.decodeUnits(bits).text : enc.startsWith("bacon") ? bacon.decode(bits, encoding.variant).text : decodeFrame(bits, encoding.errorControl).text;
    }
  } else {
    const motif = hide.startsWith("motif-") ? hide.slice(6) : null, m = motif ? MOTIFS[motif].size : 1;
    const key = { format: KEY_FORMAT, version: 1, hide: motif ? { mode: "motif", motif } : { mode: "scatter", seed: f.seed, filler: "texture", density: f.density + 2 }, encoding, carrier, border: b, width: (C - 2 * b) / m, height: (R - 2 * b) / m, ...(motif ? {} : { length: f.len }) };
    text = decodeWithKey(bottomUp, key).text;
  }
  const plain = cipher !== "none" && cipherKey ? decipher(text, { kind: cipher, key: cipherKey }) : null;
  return { studio: "purloined plot studio", method: `${hide}, ${look}`, text, plain, cipher, picks, cells };
}

// The whole read: image in, message out, plus everything the page needs to show its working.
export function decode(src, { cipherKey = "", quad = null } = {}) {
  const t0 = Date.now(), I = prepare(src);
  let q = quad ? quad.map(([x, y]) => [x * I.scale, y * I.scale]) : null, finders = [];
  if (!q) { finders = findFinders(I); q = orderFinders(finders); }
  if (!q) return { ok: false, stage: "finders", message: `Found ${finders.length} corner target${finders.length === 1 ? "" : "s"} (need four, one of them hollow). Get the whole page in, flat and in even light.`, finders, I };
  const S = readStrip(I, q);
  if (!S.rec) return { ok: false, stage: "strip", message: "Found the corners but could not read the key strip. Get closer, or hold the phone square to the page.", tried: S.tried, finders, quad: q, I };
  try {
    const res = S.rec.studio === 1 ? readCipher(S.sp, S.rec.fields, cipherKey) : readStego(S.sp, S.rec.fields, cipherKey);
    const confs = res.picks.map(p => p.conf), weak = confs.filter(c => c < 0.08).length;
    return { ok: true, ...res, page: S.page, record: S.rec, Hm: S.sp, quad: q, finders, I, weak, cellsRead: confs.length, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, stage: "cells", message: String(err && err.message || err), finders, quad: q, I, record: S.rec };
  }
}
