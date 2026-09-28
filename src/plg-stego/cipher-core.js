// Cipher garden core: cryptographic and steganographic methods whose drawing IS the code. No DOM, so the studio page,
// the plot decoder and the Node checks all run the same code. Each method decodes by eye (howToRead) and, with the machine
// marks on, by camera: in read mode every method reports, cell by cell, what each possible value would draw.
//   truchet    tile orientation carries bits (Truchet's 1704 triangles, quarter arcs, 10 PRINT diagonals, ribbons)
//   maze       a binary-tree maze: every cell's carve (north or east) is one bit
//   hilbert    one continuous space-filling line; a wiggle on a step is a 1
//   ridges     stacked ridgelines with hidden lines; a peak is a 1
//   pigpen     the Freemasons' grid cipher, one letter per grid cell
//   stars      each word a constellation on a (keyed) Polybius square, among decoy stars (by eye only)
//   disk       rotor rings of arc code inside an Alberti cipher disk
//   automaton  a reversible cellular automaton grown both ways from the two message rows in the middle
//   knots      Celtic interlace: every crossing's over or under is one bit
// Bits come from UNRAVEL THE PURLOINED's encoders; hiding uses its seeded scatter route. Drawing helpers in core.js.
"use strict";
import { TAU, lerp, bbox, ellipse, rect, simplify, inset, fillConvex, painter, drawText, drawGlyphAt, wrap, ADV } from "./core.js";
import { MARK, drawMarks, packRecord, PAGES } from "./marks.js";
import * as fivebit from "@utp/fivebit";
import * as morse from "@utp/morse";
import * as bacon from "@utp/bacon";
import { encipher, decipher } from "@utp/ciphers";
import { rng } from "@utp/fabric";
import { scatterRoute } from "@utp/stego";

const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const METHOD_LIST = ["truchet", "maze", "hilbert", "ridges", "pigpen", "stars", "disk", "automaton", "knots"];
export const VARIANTS = { truchet: ["tiles", ["arcs", "triangles", "diag", "ribbons"]], maze: ["walls", ["line", "bands"]], hilbert: ["mark", ["wave", "loop", "zigzag"]], automaton: ["cells", ["squares", "dots", "diamonds"]] };
export const ENCS = ["fivebit", "bacon26", "morse"];
export const CIPHER_KINDS = ["none", "caesar", "keyword", "vigenere", "railfence", "route"];
export const FILLS = ["contour", "lines", "cross", "zigzag", "wave", "stipple", "spiral", "none"];
export const DEFAULTS = { msg: "", enc: "fivebit", cipher: "none", ckey: "", method: "truchet", hide: "open", density: "2", seed: 7, size: 22, tiles: "arcs", walls: "line", mark: "wave", cells: "squares", rule: "30", noise: 0.5, pkey: "", fill: "contour", pitch: 0.7, angle: 45, caption: "key", tsize: 6, tpen: "#0b0f14", reveal: "off", rpen: "#c23b3b", page: "190x250", marks: "on" };

// ---------------- message to bits, bits to cells ----------------
const cipherOf = o => (o.cipher === "none" ? null : { kind: o.cipher, key: String(o.ckey || "") });
export function readerFor(enc) { return enc === "bacon26" ? b => bacon.decode(b, "modern26").text : enc === "morse" ? b => morse.decodeUnits(b).text : b => fivebit.decode(b).text; }
function source(o) {
  const cip = cipherOf(o), plain = morse.normalize(o.msg).text, read = readerFor(o.enc);
  if (o.enc === "bacon26") {
    const n = bacon.normalize(o.msg, "modern26"), t = cip ? encipher(n.text, cip) : n.text, bits = bacon.encode(t, "modern26");
    return { plain, text: t, bits, code: bacon.toAB(bits), dropped: n.dropped.filter(d => !/\s/.test(d.char)), read };
  }
  if (o.enc === "morse") {
    const n = morse.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
    return { plain, text: t, bits: morse.toUnits(morse.encode(t)), code: morse.transcribe(morse.encode(t)), dropped: n.dropped, read };
  }
  const n = fivebit.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
  return { plain, text: t, bits: fivebit.encode(t), code: [...t].map(c => fivebit.encode(c).join("")).join(" "), dropped: n.dropped, read };
}
// Letters-only text for the glyph methods (pigpen, stars): the cipher runs first, anything but A-Z and space goes.
function letterText(o) {
  const cip = cipherOf(o), n = morse.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
  return { plain: n.text, text: t.replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim(), dropped: [...n.dropped, ...[...t].filter(c => !/[A-Z ]/.test(c)).map(char => ({ char }))] };
}
const need = (L, o) => (o.hide === "scatter" ? Math.ceil(L * +o.density) : L);
// Message bits into `cap` cells: in reading order (open) or along UTP's seeded scatter route; the rest is seeded noise.
function place(bits, cap, o) {
  const r = rng(o.seed * 31 + 5), vals = Array.from({ length: cap }, () => (r() < 0.5 ? 1 : 0)), carry = new Array(cap).fill(false);
  const route = o.hide === "scatter" ? scatterRoute(o.seed, bits.length, cap) : bits.map((_, i) => i);
  route.forEach((p, i) => { vals[p] = bits[i]; carry[p] = true; });
  return { vals, carry, route };
}
export const norm = s => s.replace(/\s+/g, " ").trim();
const arcPts = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, k) => { const t = a0 + (a1 - a0) * k / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
// A ring sector cut into small convex pieces (outer arc, straight inner chord), so the global hatch can fill it.
function ringPieces(cx, cy, r0, r1, a0, a1) {
  const n = Math.max(2, Math.ceil((a1 - a0) * r1 / 2)), out = [];
  for (let k = 0; k < n; k++) { const b0 = a0 + (a1 - a0) * k / n, b1 = a0 + (a1 - a0) * (k + 1) / n; out.push([...arcPts(cx, cy, r1, b0, b1, 3), ...arcPts(cx, cy, r0, b1, b0, 1)]); }
  return out;
}
// A grid shaped like the box, at least minCols across and big enough for n cells; spare cells take seeded noise.
function gridFor(n, B, minCols) { const asp = B.w / B.h, cols = Math.max(minCols, Math.round(Math.sqrt(n * asp))); return [cols, Math.max(Math.ceil(n / cols), Math.round(cols / asp))]; }
const F = (o, P, f = 1) => fillConvex(P, o.fill, o.pitch * f, o.angle, o.seed);
const ringMark = (L, o, x, y, r) => { if (o.reveal === "on") L.reveal.push([ellipse(x, y, r, r, 0, 14), true]); };
const layers = () => ({ outline: [], fill: [], text: [], reveal: [] });
// Read mode: RD collects, in message-cell order, what every possible value of a cell would draw. { cands: [paths...], bits }.
let RD = null;
const offer = (cands, bits = 1) => { if (RD) RD.push({ cands, bits }); };
// The middle of a segment, so a sampled wall never picks up the corner it shares with its neighbours.
const mid = ([a, b], f = 0.6) => [lerp(a, b, (1 - f) / 2), lerp(a, b, (1 + f) / 2)];

// ---------------- the methods ----------------
// Each draws into L inside box B and returns { dims, feature (smallest drawn unit, mm), read, want, cap, route }.

function truchet(o, S, B, L) {
  const bpt = o.tiles === "triangles" ? 2 : 1, [cols, rows] = gridFor(Math.ceil(need(S.bits.length, o) / bpt), B, Math.max(3, o.size));
  const cap = rows * cols * bpt, P = place(S.bits, cap, o), s = Math.min(B.w / cols, B.h / rows), x0 = B.x + (B.w - cols * s) / 2, y0 = B.y + (B.h - rows * s) / 2;
  const state = Array.from({ length: rows * cols }, (_, i) => { let v = 0; for (let k = 0; k < bpt; k++) v = v * 2 + P.vals[i * bpt + k]; return v; });
  const tile = (v, x, y) => {
    const T = layers(), h = s / 2;
    if (o.tiles === "arcs" || o.tiles === "ribbons") {
      const corners = v ? [[x + s, y, Math.PI / 2, Math.PI], [x, y + s, -Math.PI / 2, 0]] : [[x, y, 0, Math.PI / 2], [x + s, y + s, Math.PI, 1.5 * Math.PI]];
      for (const [cx, cy, a0, a1] of corners) {
        if (o.tiles === "arcs") { T.outline.push([arcPts(cx, cy, h, a0, a1), false]); T.fill.push(...F(o, [[cx, cy], ...arcPts(cx, cy, h, a0, a1, 10)])); }
        else { const rw = 0.16 * s; T.outline.push([arcPts(cx, cy, h - rw, a0, a1), false], [arcPts(cx, cy, h + rw, a0, a1), false]); for (const q of ringPieces(cx, cy, h - rw, h + rw, a0, a1)) T.fill.push(...F(o, q)); }
      }
    } else if (o.tiles === "diag") {
      T.outline.push([v ? [[x, y + s], [x + s, y]] : [[x, y], [x + s, y + s]], false]);
      T.fill.push(...F(o, v ? [[x, y + s], [x + s, y], [x + s, y + s]] : [[x, y], [x + s, y + s], [x, y + s]]));
    } else {   // Truchet's own tile: a square split on its diagonal, the dark half in one of four corners (2 bits)
      const C4 = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]], tri = [C4[v], C4[(v + 1) % 4], C4[(v + 3) % 4]];
      T.outline.push([[C4[(v + 1) % 4], C4[(v + 3) % 4]], false]); T.fill.push(...F(o, tri));
    }
    return T;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, x = x0 + c * s, y = y0 + r * s, T = tile(state[i], x, y);
    L.outline.push(...T.outline); L.fill.push(...T.fill);
    if (P.carry.slice(i * bpt, i * bpt + bpt).some(Boolean)) ringMark(L, o, x + s / 2, y + s / 2, 0.12 * s);
    if (RD) offer(Array.from({ length: 2 ** bpt }, (_, v) => { const t = tile(v, x, y); return [...t.outline, ...t.fill]; }), bpt);
  }
  if (o.tiles === "diag" || o.tiles === "triangles") L.outline.push([rect(x0, y0, cols * s, rows * s), true]);
  const flat = state.flatMap(v => (bpt === 2 ? [v >> 1, v & 1] : [v]));
  return { dims: `${cols}X${rows}`, feature: s, read: S.read(P.route.map(p => flat[p])), want: S.text, cap, route: P.route };
}

function maze(o, S, B, L) {
  const n0 = need(S.bits.length, o); let [C, R] = gridFor(n0, B, Math.max(3, o.size)); R = Math.max(R, 3); while ((C - 1) * (R - 1) < n0) R++;
  const cap = (R - 1) * (C - 1), P = place(S.bits, cap, o);
  const s = Math.min(B.w / C, B.h / R), x0 = B.x + (B.w - C * s) / 2, y0 = B.y + (B.h - R * s) / 2, X = c => x0 + c * s, Y = r => y0 + r * s;
  // Binary-tree maze: every cell opens north (0) or east (1). The top row can only go east and the right column only north, so they carry nothing.
  const carve = [], idx = []; let k = 0;
  for (let r = 0; r < R; r++) { carve.push([]); idx.push([]); for (let c = 0; c < C; c++) { idx[r].push(-1); if (r === 0 && c === C - 1) carve[r].push(null); else if (r === 0) carve[r].push("E"); else if (c === C - 1) carve[r].push("N"); else { idx[r][c] = k; carve[r].push(P.vals[k++] ? "E" : "N"); } } }
  const segs = [];
  for (let j = 0; j <= R; j++) { let s0 = null; for (let c = 0; c <= C; c++) { const wall = c < C && !(j === 0 && c === C - 1) && !(j === R && c === 0) && (j === 0 || j === R || carve[j][c] !== "N"); if (wall && s0 === null) s0 = c; if (!wall && s0 !== null) { segs.push([[X(s0), Y(j)], [X(c), Y(j)]]); s0 = null; } } }
  for (let i = 0; i <= C; i++) { let s0 = null; for (let r = 0; r <= R; r++) { const wall = r < R && (i === 0 || i === C || carve[r][i - 1] !== "E"); if (wall && s0 === null) s0 = r; if (!wall && s0 !== null) { segs.push([[X(i), Y(s0)], [X(i), Y(r)]]); s0 = null; } } }
  const bw = 0.11 * s, band = ([a, b]) => (a[0] === b[0] ? rect(a[0] - bw, Math.min(a[1], b[1]) - bw, 2 * bw, Math.abs(b[1] - a[1]) + 2 * bw) : rect(Math.min(a[0], b[0]) - bw, a[1] - bw, Math.abs(b[0] - a[0]) + 2 * bw, 2 * bw));
  if (o.walls === "bands") {
    for (const sg of segs) { const q = band(sg); L.outline.push([q, true]); L.fill.push(...fillConvex(q, o.fill === "none" ? "lines" : o.fill, Math.min(o.pitch, bw * 0.9), o.angle, o.seed)); }
  } else {
    for (const sg of segs) L.outline.push([sg, false]);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {   // dead ends (one way in) take the shading
      const open = (carve[r][c] === "N" ? 1 : 0) + (carve[r][c] === "E" ? 1 : 0) + (r < R - 1 && carve[r + 1][c] === "N" ? 1 : 0) + (c > 0 && carve[r][c - 1] === "E" ? 1 : 0) + (r === R - 1 && c === 0 ? 1 : 0) + (r === 0 && c === C - 1 ? 1 : 0);
      if (open === 1) L.fill.push(...F(o, rect(X(c) + 0.2 * s, Y(r) + 0.2 * s, 0.6 * s, 0.6 * s)));
    }
  }
  // Reading a cell: a north carve leaves its east wall standing and its north wall open; an east carve the other way round.
  if (RD) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (idx[r][c] >= 0) {
    const north = mid([[X(c), Y(r)], [X(c + 1), Y(r)]]), east = mid([[X(c + 1), Y(r)], [X(c + 1), Y(r + 1)]]);
    offer([[[east, false]], [[north, false]]]);
  }
  if (o.reveal === "on") {   // the way through, from the gap bottom left to the gap top right
    let r = R - 1, c = 0; const path = [[X(0) + s / 2, Y(R) + s * 0.4], [X(0) + s / 2, Y(R - 1) + s / 2]];
    while (!(r === 0 && c === C - 1)) { if (carve[r][c] === "N") r--; else c++; path.push([X(c) + s / 2, Y(r) + s / 2]); }
    path.push([X(C - 1) + s / 2, Y(0) - s * 0.4]); L.reveal.push([simplify(path, 0.01), false]);
  }
  const flat = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (idx[r][c] >= 0) flat[idx[r][c]] = carve[r][c] === "E" ? 1 : 0;
  return { dims: `${C}X${R}`, feature: s, read: S.read(P.route.map(p => flat[p])), want: S.text, cap, route: P.route };
}

function d2xy(n, d) {
  let x = 0, y = 0, t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
    if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } [x, y] = [y, x]; }
    x += s * rx; y += s * ry; t = Math.floor(t / 4);
  }
  return [x, y];
}
function hilbert(o, S, B, L) {
  const want = need(S.bits.length, o); let n = 1; while (4 ** n - 1 < want) n++;
  const N = 2 ** n, cap = N * N - 1, P = place(S.bits, cap, o), s = Math.min(B.w, B.h) / N, x0 = B.x + (B.w - N * s) / 2, y0 = B.y + (B.h - N * s) / 2;
  const pts = Array.from({ length: N * N }, (_, d) => { const [x, y] = d2xy(N, d); return [x0 + (x + 0.5) * s, y0 + (N - 1 - y + 0.5) * s]; });
  // the points one step draws after its start, as a straight step (0) or a marked one (1)
  const step = (i, v) => {
    const a = pts[i], b = pts[i + 1], d = [(b[0] - a[0]) / s, (b[1] - a[1]) / s], nr = [-d[1], d[0]], out = [];
    if (!v) return [b];
    if (o.mark === "wave") for (let k = 1; k <= 16; k++) { const t = k / 16, w = 0.26 * s * Math.sin(TAU * t); out.push([a[0] + d[0] * s * t + nr[0] * w, a[1] + d[1] * s * t + nr[1] * w]); }
    else if (o.mark === "zigzag") for (const [t, w] of [[0.17, 1], [0.5, -1], [0.83, 1], [1, 0]]) out.push([a[0] + d[0] * s * t + nr[0] * w * 0.22 * s, a[1] + d[1] * s * t + nr[1] * w * 0.22 * s]);
    else {   // a small loop tied at the middle of the step
      const m = lerp(a, b, 0.5), rr = 0.2 * s, c = [m[0] + nr[0] * rr, m[1] + nr[1] * rr], a0 = Math.atan2(-nr[1], -nr[0]);
      out.push(m); for (let k = 1; k <= 20; k++) out.push([c[0] + rr * Math.cos(a0 + TAU * k / 20), c[1] + rr * Math.sin(a0 + TAU * k / 20)]); out.push(b);
    }
    return out;
  };
  const path = [pts[0]], loops = [];
  for (let i = 0; i < cap; i++) {
    const a = pts[i], b = pts[i + 1];
    if (P.carry[i]) ringMark(L, o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.1 * s);
    path.push(...step(i, P.vals[i]));
    if (P.vals[i] && o.mark === "loop") { const d = [(b[0] - a[0]) / s, (b[1] - a[1]) / s], m = lerp(a, b, 0.5); loops.push(ellipse(m[0] - d[1] * 0.2 * s, m[1] + d[0] * 0.2 * s, 0.2 * s, 0.2 * s, 0, 20)); }
    // a loop hangs off a step that is drawn straight either way, so for loops a 0 is simply "no loop"
    if (RD) offer([o.mark === "loop" ? [] : [[mid([a, b], 0.5), false]], [[[a, ...step(i, 1)].slice(1, -1), false]]]);
  }
  L.outline.push([simplify(path, 0.005), false], [ellipse(pts[0][0], pts[0][1], 0.3 * s, 0.3 * s, 0, 16), true]);
  for (const q of loops) L.fill.push(...F(o, q));
  const e = pts.at(-1); L.outline.push([rect(e[0] - 0.22 * s, e[1] - 0.22 * s, 0.44 * s, 0.44 * s), true]);
  return { dims: `H${n}`, feature: s, read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap, route: P.route };
}

function ridges(o, S, B, L) {
  const C = Math.max(3, o.size), R = Math.max(2, Math.ceil(need(S.bits.length, o) / C), Math.round(C * 0.95 * B.h / B.w)), cap = R * C, P = place(S.bits, cap, o);
  // A = 2.5 line spacings: a peak's crown lands midway between the baselines behind it, never on one (at 2.1 it sat on
  // the baseline two rows back, and empty peak positions read as peaks)
  const dy = B.h / (R + 3), A = 2.5 * dy, sw = B.w / (C + 1), bw = 0.46 * sw, pn = painter(Math.max(2, sw));
  const nr = rng(o.seed * 13 + 3), waves = Array.from({ length: R }, () => [0, 1, 2].map(j => [nr() * 6.28, (0.08 + 0.1 * nr()) * (j + 1)]));
  const noiseAt = (r, x) => o.noise * 0.32 * dy * (1 + waves[r].reduce((s, [ph, f]) => s + Math.sin(x * f + ph), 0) / 3) / 2;
  for (let r = 0; r < R; r++) {
    const base = B.y + 3 * dy + r * dy, curve = [];
    for (let x = B.x; x <= B.x + B.w + 1e-9; x += 0.4) {
      let lift = 0; for (let k = 0; k < C; k++) if (P.vals[r * C + k]) lift += A * Math.exp(-(((x - (B.x + sw * (k + 1))) / bw) ** 2));
      curve.push([x, base - lift - noiseAt(r, x)]);
    }
    const occ = [], fill = [];
    for (let i = 0; i + 1 < curve.length; i++) {
      const q = [curve[i], curve[i + 1], [curve[i + 1][0], base + 0.3], [curve[i][0], base + 0.3]]; occ.push(q);
      if (base - Math.min(curve[i][1], curve[i + 1][1]) > 0.18 * A) fill.push(...F(o, q));
    }
    pn.add({ outline: [[simplify(curve, 0.01), false]], fill }, occ);
    for (let k = 0; k < C; k++) if (P.carry[r * C + k]) ringMark(L, o, B.x + sw * (k + 1), base + 0.25 * dy, 0.12 * dy);
    // a peak's crown stays in view above the lines in front of it, so that is where a reader looks
    if (RD) for (let k = 0; k < C; k++) { const cx = B.x + sw * (k + 1), crown = []; for (let x = cx - 0.3 * bw; x <= cx + 0.3 * bw; x += 0.3) crown.push([x, base - A * Math.exp(-(((x - cx) / bw) ** 2)) - noiseAt(r, x)]); offer([[], [[crown, false]]]); }
  }
  pn.resolve(L);
  return { dims: `${C}X${R}`, feature: dy, read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap, route: P.route };
}

// Pigpen: A-I in a noughts-and-crosses grid, J-R the same with a dot, S-V in an X, W-Z in an X with a dot.
function pigpenGlyph(ch, x, y, g, o, L) {
  const i = ALPH.indexOf(ch), cxy = [x + g / 2, y + g / 2];
  if (i < 0) return;
  if (i < 18) {
    const k = i % 9, r = Math.floor(k / 3), c = k % 3, dot = i >= 9, C4 = [[x, y], [x + g, y], [x + g, y + g], [x, y + g]];
    const has = [r > 0, c < 2, r < 2, c > 0];   // top, right, bottom, left: the grid lines round this cell
    const start = has.indexOf(false) < 0 ? 0 : (has.indexOf(false) + 1) % 4; let cur = [];
    for (let e = 0; e < 4; e++) { const k2 = (start + e) % 4; if (has[k2]) { if (!cur.length) cur.push(C4[k2]); cur.push(C4[(k2 + 1) % 4]); } else if (cur.length) { L.outline.push([cur, false]); cur = []; } }
    if (cur.length) L.outline.push([cur, has.every(Boolean)]);
    if (dot) { const d = ellipse(cxy[0], cxy[1], 0.13 * g, 0.13 * g, 0, 20); L.outline.push([d, true]); L.fill.push(...F(o, d, 0.8)); }
    else L.fill.push(...F(o, rect(x + 0.2 * g, y + 0.2 * g, 0.6 * g, 0.6 * g)));
    return;
  }
  const k = (i - 18) % 4, dot = i >= 22, C4 = [[x, y], [x + g, y], [x + g, y + g], [x, y + g]];
  const pair = [[0, 1], [0, 3], [1, 2], [3, 2]][k], tri = [C4[pair[0]], cxy, C4[pair[1]]];
  L.outline.push([tri, false]);
  const cen = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
  if (dot) { const d = ellipse(cen[0], cen[1], 0.11 * g, 0.11 * g, 0, 18); L.outline.push([d, true]); L.fill.push(...F(o, d, 0.8)); }
  else { const q = inset(tri, 0.08 * g); if (q) L.fill.push(...F(o, q)); }
}
// Words wrapped onto a fixed grid of `per` letter cells a line, long words split; a blank cell is a space.
function gridLines(text, per) {
  const lines = []; let cur = "";
  for (let w of text.split(" ").filter(Boolean)) {
    while (w.length > per) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, per)); w = w.slice(per); }
    if (cur && cur.length + 1 + w.length > per) { lines.push(cur); cur = ""; }
    cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.map(l => l.padEnd(per, " "));
}
function pigpen(o, S, B, L) {
  const per = Math.max(4, o.size), lines = S.lines || gridLines(S.text, per), rows = lines.length;
  const g = Math.min(B.w / (per * 1.35), B.h / (rows * 1.5), 22), step = g * 1.35, x0 = B.x + (B.w - (per * step - 0.35 * g)) / 2, y0 = B.y + (B.h - (rows * 1.5 * g - 0.5 * g)) / 2;
  lines.forEach((line, li) => [...line].forEach((ch, i) => {
    const x = x0 + i * step, y = y0 + li * 1.5 * g;
    pigpenGlyph(ch, x, y, g, o, L);
    if (RD) offer([...ALPH, " "].map(c => { const T = layers(); pigpenGlyph(c, x, y, g, o, T); return [...T.outline, ...T.fill]; }), "letter");
  }));
  const read = lines.map(l => l.trimEnd()).join(" ");
  return { dims: `${per}X${rows}`, feature: g * 0.6, read: norm(read), want: norm(S.text), cap: per * rows, rows };
}

// Polybius square, keyed: the keyword's letters first, then the rest; I and J share a square.
function polybius(key) { const seq = [...(String(key || "").toUpperCase() + ALPH).replace(/J/g, "I")].filter(c => /[A-IK-Z]/.test(c)); return [...new Set(seq)].slice(0, 25); }
function stars(o, S, B, L) {
  if (RD) throw new Error("Constellations are read by eye: follow the chevrons from the ringed star.");
  const sq = polybius(o.pkey), words = S.text.replace(/J/g, "I").split(" ").filter(Boolean), W = Math.max(1, words.length);
  const pc = Math.max(1, Math.round(Math.sqrt(W * B.w / B.h))), pr = Math.ceil(W / pc), P = Math.min(B.w / pc, B.h / pr), m = 0.14 * P, q = (P - 2 * m) / 4;
  const ox = B.x + (B.w - pc * P) / 2, oy = B.y + (B.h - pr * P) / 2, rnd = rng(o.seed * 17 + 11);
  const sparkle = (x, y, r) => { const p = []; for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + Math.PI * k / 4, rr = k % 2 ? r * 0.28 : r; p.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]); } return p; };
  let read = "";
  words.forEach((w, wi) => {
    const px = ox + (wi % pc) * P, py = oy + Math.floor(wi / pc) * P, b = 0.07 * P, e = 0.06 * P;
    // corner brackets frame the square the stars sit on, so a reader can lay the 5 x 5 grid over it
    for (const [cx, cy, sx, sy] of [[px + e, py + e, 1, 1], [px + P - e, py + e, -1, 1], [px + P - e, py + P - e, -1, -1], [px + e, py + P - e, 1, -1]]) L.outline.push([[[cx, cy + sy * b], [cx, cy], [cx + sx * b, cy]], false]);
    const at = ch => { const i = sq.indexOf(ch); return [px + m + (i % 5) * q, py + m + Math.floor(i / 5) * q]; };
    const pos = [...w].map(at);
    // decoys: smaller stars off the grid points, so they never read as letters
    const nd = Math.round(w.length * (o.hide === "scatter" ? +o.density : 1.2));
    for (let d = 0, tries = 0; d < nd && tries < 400; tries++) {
      const x = px + m * 0.5 + rnd() * (P - m), y = py + m * 0.5 + rnd() * (P - m), gx = (x - px - m) / q, gy = (y - py - m) / q;
      if (Math.hypot(gx - Math.round(gx), gy - Math.round(gy)) < 0.35 && Math.round(gx) >= 0 && Math.round(gx) <= 4 && Math.round(gy) >= 0 && Math.round(gy) <= 4) continue;
      L.outline.push([sparkle(x, y, 0.1 * q), true]); d++;
    }
    const seen = new Set();
    pos.forEach((p, i) => {
      const key = p.join(",");
      if (!seen.has(key)) { seen.add(key); L.outline.push([sparkle(p[0], p[1], 0.26 * q), true]); const c = ellipse(p[0], p[1], 0.07 * q, 0.07 * q, 0, 12); L.fill.push(...F(o, c, 0.7)); L.outline.push([c, true]); }
      if (i === 0) L.outline.push([ellipse(p[0], p[1], 0.4 * q, 0.4 * q, 0, 24), true]);
      ringMark(L, o, p[0], p[1], 0.5 * q);   // answer key: ring the real stars
      if (i > 0) {
        const a = pos[i - 1];
        if (a[0] === p[0] && a[1] === p[1]) { L.outline.push([ellipse(p[0], p[1], 0.33 * q, 0.33 * q, 0, 20), true]); return; }   // a doubled letter: a ring round the star
        const d = Math.hypot(p[0] - a[0], p[1] - a[1]), u = [(p[0] - a[0]) / d, (p[1] - a[1]) / d], g0 = 0.34 * q;
        if (d > 2 * g0) {
          L.outline.push([[[a[0] + u[0] * g0, a[1] + u[1] * g0], [p[0] - u[0] * g0, p[1] - u[1] * g0]], false]);
          const mp = lerp(a, p, 0.5), hl = 0.12 * q;   // a chevron points the way along the line
          L.outline.push([[[mp[0] - u[0] * hl - u[1] * hl, mp[1] - u[1] * hl + u[0] * hl], mp, [mp[0] - u[0] * hl + u[1] * hl, mp[1] - u[1] * hl - u[0] * hl]], false]);
        }
      }
    });
    read += pos.map(([x, y]) => sq[Math.round((y - py - m) / q) * 5 + Math.round((x - px - m) / q)]).join("") + " ";
  });
  return { dims: `${pc}X${pr}`, feature: q * 0.5, read: norm(read), want: norm(S.text.replace(/J/g, "I")), cap: S.text.length };
}

function disk(o, S, B, L) {
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2, Rm = Math.min(B.w, B.h) / 2 - 0.5, hL = Math.min(0.065 * Rm, TAU * Rm * 0.6 / 26 * 0.55);
  const shift = o.cipher === "caesar" ? (((parseInt(o.ckey, 10) || 0) % 26) + 26) % 26 : 0;
  // Alberti's disk: plain letters outside, the cipher alphabet inside, turned by the Caesar shift (none for other ciphers)
  const rA = Rm - 0.85 * hL, rB = Rm - 2.55 * hL, rE = Rm - 3.4 * hL;
  for (const r of [Rm, Rm - 1.7 * hL, rE]) L.outline.push([ellipse(cx, cy, r, r, 0, 180), true]);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + TAU * (i + 0.5) / 26, t = -Math.PI / 2 + TAU * i / 26;
    L.outline.push([[[cx + rE * Math.cos(t), cy + rE * Math.sin(t)], [cx + Rm * Math.cos(t), cy + Rm * Math.sin(t)]], false]);
    drawGlyphAt(ALPH[i], cx + rA * Math.cos(a), cy + rA * Math.sin(a), hL, a + Math.PI / 2, L.text);
    drawGlyphAt(ALPH[(i + shift) % 26], cx + rB * Math.cos(a), cy + rB * Math.sin(a), hL, a + Math.PI / 2, L.text);
  }
  // rotor rings: slots of about equal arc length, as many rings as fit; a filled arc is 1
  const rOut = rE - 0.05 * Rm, rIn = 0.2 * Rm, want = need(S.bits.length, o);
  let sl = 16, rings = [];
  for (; sl > 1.5; sl *= 0.95) {
    const nr = Math.max(1, Math.floor((rOut - rIn) / (sl * 0.8))), rw = (rOut - rIn) / nr;
    rings = Array.from({ length: nr }, (_, j) => { const r = rOut - (j + 0.5) * rw; return { r, rw, n: Math.max(4, Math.floor(TAU * r / sl)) }; });
    if (rings.reduce((s, g) => s + g.n, 0) >= want) break;
  }
  const cap = rings.reduce((s, g) => s + g.n, 0), P = place(S.bits, cap, o); let k = 0;
  for (const g of rings) for (let j = 0; j < g.n; j++, k++) {
    const gap = 0.14 * sl / g.r, a0 = -Math.PI / 2 + TAU * j / g.n + gap, a1 = -Math.PI / 2 + TAU * (j + 1) / g.n - gap, r0 = g.r - 0.36 * g.rw, r1 = g.r + 0.36 * g.rw;
    if (P.carry[k]) ringMark(L, o, cx + g.r * Math.cos((a0 + a1) / 2), cy + g.r * Math.sin((a0 + a1) / 2), 0.15 * g.rw);
    const slot = [[[...arcPts(cx, cy, r1, a0, a1, 10), ...arcPts(cx, cy, r0, a1, a0, 10)], true]], fill = ringPieces(cx, cy, r0, r1, a0, a1).flatMap(q => F(o, q));
    if (RD) offer([[], [...slot, ...fill]]);
    if (!P.vals[k]) continue;
    L.outline.push(...slot); L.fill.push(...fill);
  }
  // start mark at twelve o'clock (read clockwise, outer ring first), and the hub
  L.outline.push([[[cx - 0.02 * Rm, cy - rOut - 0.035 * Rm], [cx, cy - rOut - 0.005 * Rm], [cx + 0.02 * Rm, cy - rOut - 0.035 * Rm]], true]);
  L.outline.push([ellipse(cx, cy, rIn * 0.85, rIn * 0.85, 0, 72), true], [[[cx - 0.3 * rIn, cy], [cx + 0.3 * rIn, cy]], false], [[[cx, cy - 0.3 * rIn], [cx, cy + 0.3 * rIn]], false]);
  return { dims: `R${rings.length}.${shift}`, feature: Math.min(sl, rings[0].rw), read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap, route: P.route };
}

// Reversible second-order automaton (Fredkin's trick): next row = rule(this row) XOR the row before, so it runs both ways.
// The two message rows sit in the middle; the rows above are the past, the rows below the future, and either end undoes it.
function automaton(o, S, B, L) {
  const n0 = need(S.bits.length, o), C = Math.max(o.size, Math.ceil(n0 / 2)), R = Math.max(8, Math.round(C * B.h / B.w)), cap = 2 * C, P = place(S.bits, cap, o);
  const s = Math.min(B.w / C, B.h / R), x0 = B.x + (B.w - C * s) / 2, y0 = B.y + (B.h - R * s) / 2, rule = +o.rule || 30, m0 = Math.floor(R / 2) - 1;
  const f = (row, i) => (rule >> ((row[(i + C - 1) % C] << 2) | (row[i] << 1) | row[(i + 1) % C])) & 1;
  const g = Array.from({ length: R }, () => new Array(C).fill(0));
  for (let i = 0; i < C; i++) { g[m0][i] = P.vals[i]; g[m0 + 1][i] = P.vals[C + i]; }
  for (let t = m0 + 1; t + 1 < R; t++) for (let i = 0; i < C; i++) g[t + 1][i] = f(g[t], i) ^ g[t - 1][i];
  for (let t = m0; t > 0; t--) for (let i = 0; i < C; i++) g[t - 1][i] = f(g[t], i) ^ g[t + 1][i];
  const cell = (x, y) => {
    const h = s / 2, cx = x + h, cy = y + h;
    const P2 = o.cells === "dots" ? ellipse(cx, cy, 0.4 * s, 0.4 * s, 0, 20) : o.cells === "diamonds" ? [[cx, y + 0.04 * s], [x + s - 0.04 * s, cy], [cx, y + s - 0.04 * s], [x + 0.04 * s, cy]] : rect(x + 0.07 * s, y + 0.07 * s, 0.86 * s, 0.86 * s);
    return [[P2, true], ...F(o, P2)];
  };
  for (let t = 0; t < R; t++) for (let i = 0; i < C; i++) {
    const x = x0 + i * s, y = y0 + t * s, paths = cell(x, y);
    if (g[t][i]) { L.outline.push(paths[0]); L.fill.push(...paths.slice(1)); }
    // read only the middle of a cell: its outline sits half a millimetre from a neighbour's. The hatch is one page-wide
    // screen, so the middle's hatch lines are the drawn ones; with no fill, an inset outline stands in.
    if (RD && (t === m0 || t === m0 + 1)) offer([[], o.fill === "none" ? [[rect(x + 0.25 * s, y + 0.25 * s, 0.5 * s, 0.5 * s), true]] : F(o, rect(x + 0.22 * s, y + 0.22 * s, 0.56 * s, 0.56 * s))]);
    if ((t === m0 || t === m0 + 1) && P.carry[(t - m0) * C + i]) ringMark(L, o, x + s / 2, y + s / 2, 0.15 * s);
  }
  if (o.reveal === "on") for (const t of [m0, m0 + 1]) for (const x of [x0 - 0.8 * s, x0 + C * s + 0.3 * s]) L.reveal.push([[[x, y0 + (t + 0.5) * s], [x + 0.5 * s, y0 + (t + 0.5) * s]], false]);
  L.outline.push([rect(x0, y0, C * s, R * s), true]);
  const flat = [...g[m0], ...g[m0 + 1]];
  return { dims: `${C}X${R}.${rule}`, feature: s, read: S.read(P.route.map(p => flat[p])), want: S.text, cap, route: P.route };
}

// Celtic interlace: strands run on the diagonals and bounce off the frame; at every crossing inside, the bit picks
// which strand goes over (0: the one falling to the right, 1: the one rising). The under strand breaks either side.
function knots(o, S, B, L) {
  const n0 = need(S.bits.length, o), crossings = (C, R) => { const out = []; for (let v = 1; v < 2 * R; v++) for (let u = 1; u < 2 * C; u++) if ((u + v) % 2) out.push([u, v]); return out; };
  let [C, R] = gridFor(Math.ceil(n0 / 2), B, Math.max(3, Math.round(o.size / 2))); while (crossings(C, R).length < n0) R++;
  const X = crossings(C, R), cap = X.length, P = place(S.bits, cap, o), s = Math.min(B.w / (C + 0.6), B.h / (R + 0.6)), h = s / 2;   // 0.6 cells spare: the mitred bounces reach past the frame
  const x0 = B.x + (B.w - C * s) / 2, y0 = B.y + (B.h - R * s) / 2, at = (u, v) => [x0 + u * h, y0 + v * h];
  const w = 0.3 * h * Math.SQRT2 / 2 * 1.35, gap = 0.12 * h, pn = painter(h);
  // walk the strands: straight on through the crossings, bouncing off the frame, until each loop closes
  const used = new Set(), key = (a, b) => (a < b ? a + "|" + b : b + "|" + a), loops = [];
  for (let v = 0; v <= 2 * R; v++) for (let u = 0; u <= 2 * C; u++) {
    if ((u + v) % 2 === 0) continue;
    for (const d0 of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let [cu, cv] = [u, v], d = [...d0];
      const nu = cu + d[0], nv = cv + d[1];
      if (nu < 0 || nu > 2 * C || nv < 0 || nv > 2 * R || used.has(key(`${cu},${cv}`, `${nu},${nv}`))) continue;
      const loop = [[cu, cv]];
      for (let guard = 0; guard < 100000; guard++) {
        const a = `${cu},${cv}`, bu = cu + d[0], bv = cv + d[1], b = `${bu},${bv}`;
        if (used.has(key(a, b))) break;
        used.add(key(a, b)); cu = bu; cv = bv; loop.push([cu, cv]);
        if (cu === 0 || cu === 2 * C) d[0] = -d[0];
        if (cv === 0 || cv === 2 * R) d[1] = -d[1];
        let nx = cu + d[0], ny = cv + d[1];
        if (nx < 0 || nx > 2 * C) { d[0] = -d[0]; nx = cu + d[0]; }
        if (ny < 0 || ny > 2 * R) { d[1] = -d[1]; ny = cv + d[1]; }
      }
      loops.push(loop);
    }
  }
  // band edges: each loop offset both ways (mitred at the bounces), plus a hatch in every straight stretch
  const offset = (pts, sgn) => pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const n1 = (() => { const dx = p[0] - a[0], dy = p[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; })(), n2 = (() => { const dx = b[0] - p[0], dy = b[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; })();
    const m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...m) || 1, k = w / Math.max(0.3, (m[0] * n1[0] + m[1] * n1[1]) / ml);
    return [p[0] + sgn * m[0] / ml * k, p[1] + sgn * m[1] / ml * k];
  });
  const edges = [], fills = [];
  for (const lp of loops) {
    const pts = lp.map(([u, v]) => at(u, v)), closed = lp.length > 2 && lp[0][0] === lp.at(-1)[0] && lp[0][1] === lp.at(-1)[1], ring = closed ? pts.slice(0, -1) : pts;
    for (const sgn of [1, -1]) edges.push([offset(ring, sgn), closed]);
    for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], d = [(b[0] - a[0]) / (h * Math.SQRT2), (b[1] - a[1]) / (h * Math.SQRT2)], n = [-d[1] * w, d[0] * w]; fills.push(...F(o, [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]])); }
  }
  pn.add({ outline: edges, fill: fills });
  const over = (p, dir, len) => {   // the over strand's stretch across a crossing: its two edges, its fill, and what it hides
    const e = [dir[0] / Math.SQRT2, dir[1] / Math.SQRT2], n = [-e[1], e[0]], L2 = [];
    for (const sg of [1, -1]) L2.push([[[p[0] - e[0] * len + n[0] * w * sg, p[1] - e[1] * len + n[1] * w * sg], [p[0] + e[0] * len + n[0] * w * sg, p[1] + e[1] * len + n[1] * w * sg]], false]);
    const band = [[p[0] - e[0] * len + n[0] * w, p[1] - e[1] * len + n[1] * w], [p[0] + e[0] * len + n[0] * w, p[1] + e[1] * len + n[1] * w], [p[0] + e[0] * len - n[0] * w, p[1] + e[1] * len - n[1] * w], [p[0] - e[0] * len - n[0] * w, p[1] - e[1] * len - n[1] * w]];
    const cover = [[p[0] - e[0] * len + n[0] * (w + gap), p[1] - e[1] * len + n[1] * (w + gap)], [p[0] + e[0] * len + n[0] * (w + gap), p[1] + e[1] * len + n[1] * (w + gap)], [p[0] + e[0] * len - n[0] * (w + gap), p[1] + e[1] * len - n[1] * (w + gap)], [p[0] - e[0] * len - n[0] * (w + gap), p[1] - e[1] * len - n[1] * (w + gap)]];
    return { L2, band, cover };
  };
  X.forEach(([u, v], i) => {
    const p = at(u, v), dir = P.vals[i] ? [1, -1] : [1, 1], O = over(p, dir, w + gap);
    pn.add({ outline: O.L2, fill: F(o, O.band) }, [O.cover]);
    if (P.carry[i]) ringMark(L, o, p[0], p[1], 0.35 * w);
    // reading: the over strand's edges run across the crossing, and just beside it the under strand is cut to paper,
    // so each value also claims its own strand's axis in that gap (inked there only when it is the one on top)
    const axis = dir => { const e = [dir[0] / Math.SQRT2, dir[1] / Math.SQRT2], d0 = w + 0.25 * gap, d1 = w + 0.75 * gap; return [-1, 1].map(sg => [[[p[0] + e[0] * d0 * sg, p[1] + e[1] * d0 * sg], [p[0] + e[0] * d1 * sg, p[1] + e[1] * d1 * sg]], false]); };
    if (RD) offer([[...over(p, [1, 1], w * 0.8).L2, ...axis([1, 1])], [...over(p, [1, -1], w * 0.8).L2, ...axis([1, -1])]]);
  });
  pn.resolve(L);
  return { dims: `${C}X${R}`, feature: 2 * w, read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap, route: P.route };
}

export const METHODS = { truchet, maze, hilbert, ridges, pigpen, stars, disk, automaton, knots };
export const GLYPH_METHODS = new Set(["pigpen", "stars"]);
const M_CODE = { truchet: "TR", maze: "MZ", hilbert: "HB", ridges: "RG", pigpen: "PP", stars: "ST", disk: "DK", automaton: "CA", knots: "KN" };
export function keyOf(o, len, dims) {
  const e = GLYPH_METHODS.has(o.method) ? "LT" : { fivebit: "5B", bacon26: "BA", morse: "MR" }[o.enc];
  const h = o.hide === "scatter" ? `S${o.seed.toString(36).toUpperCase()}.${o.density}` : "O";
  const c = o.cipher === "none" ? "NC" : `${o.cipher.slice(0, 2).toUpperCase()}.${String(o.ckey).toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
  const k = o.method === "stars" && o.pkey ? `-K.${String(o.pkey).toUpperCase().replace(/[^A-Z]/g, "")}` : "";
  return ["PLG1", M_CODE[o.method], e, h, "L" + len, dims, c].join("-") + k;
}
export function howToRead(o) {
  const bits = { fivebit: "five-bit letters (A = 00000, T = 10011)", bacon26: "Bacon's A/B letters (1 is B)", morse: "Morse timing units (a run of 1s is a mark)" }[o.enc];
  const hidden = o.hide === "scatter" ? " The message bits are scattered among noise along a seeded route: the key under the drawing names the seed." : "";
  return {
    truchet: { arcs: `Each tile is one bit: arcs round the top-left and bottom-right corners are 0, round the other two corners 1. Read tiles left to right, top row first, as ${bits}.`, ribbons: `Each tile is one bit, ribbons round the top-left and bottom-right corners are 0, the other pair 1; read left to right, top row first, as ${bits}.`, diag: `10 PRINT: a diagonal falling to the right is 0, rising to the right is 1. Read left to right, top row first, as ${bits}.`, triangles: `Truchet's own 1704 tile: the dark half sits in one of four corners, two bits each (top left 00, top right 01, bottom right 10, bottom left 11). Read left to right, top row first, as ${bits}.` }[o.tiles] + hidden,
    maze: `A binary-tree maze: every cell opens either north (0) or east (1). The top row and right column are forced and carry nothing; read the rest left to right, top row first, as ${bits}.` + hidden,
    hilbert: `Follow the line from the ring to the square: every step of the space-filling curve is one bit, a straight step 0 and a ${o.mark === "loop" ? "looped" : o.mark === "zigzag" ? "zigzag" : "wavy"} step 1, as ${bits}.` + hidden,
    ridges: `Each ridgeline is a row of bits read left to right, back line first: a peak is 1, flat is 0, as ${bits}.` + hidden,
    pigpen: "Pigpen: A to I sit in a noughts-and-crosses grid, J to R in a second grid with a dot, S to V in an X, W to Z in an X with a dot. Each shape is the walls round its letter's place; a blank cell is a space. A historical / puzzle cipher, not modern security.",
    stars: `Each constellation is a word on a 5 x 5 Polybius square${o.pkey ? ` keyed by ${String(o.pkey).toUpperCase()}` : " (A B C D E across the top)"}: start at the ringed star and follow the chevrons, reading each star's row and column. A ring round a star doubles its letter; the small stars are decoys.`,
    disk: `Read the rotor clockwise from the mark at twelve, outer ring first: a filled arc is 1, a gap 0, as ${bits}. The letter rim is Alberti's cipher disk${o.cipher === "caesar" ? `, turned to the Caesar shift ${o.ckey}` : ""}.` + hidden,
    automaton: `A reversible automaton (rule ${o.rule}) grown up and down from the two rows in the middle: those two rows are the message, left to right, as ${bits}. Every other row follows from any two neighbours, so the whole picture can be run back to them.` + hidden,
    knots: `Interlace: at every crossing inside the frame one strand goes over. Falling to the right on top is 0, rising to the right on top is 1; read the crossings left to right, top row first, as ${bits}.` + hidden,
  }[o.method];
}

// ---------------- build ----------------
const shift = (L, dy) => { for (const k of Object.keys(L)) L[k] = L[k].map(([p, c]) => [p.map(([x, y]) => [x, y + dy]), c]); };
function variantIndex(o) { const v = VARIANTS[o.method]; return v ? Math.max(0, v[1].indexOf(o[v[0]])) : 0; }

// o: every setting. readRec (decoder only): { len, capH, dy, rows } from a key strip; the drawing is rebuilt around blank bits.
export function build(o, readRec = null) {
  const t0 = performance.now(), [W, H] = o.page.split("x").map(Number), marks = o.marks === "on", M = marks ? MARK.margin : 10, L = layers();
  let S, res, capH0, dy, key = "";
  RD = readRec ? [] : null;
  try {
    if (readRec) {
      const lines = o.method === "pigpen" ? Array.from({ length: readRec.len }, () => " ".repeat(Math.max(4, o.size))) : null;
      S = { bits: new Array(readRec.len).fill(0), text: "", lines, read: readerFor(o.enc) };
      res = METHODS[o.method](o, S, { x: M, y: M, w: W - 2 * M, h: H - 2 * M - readRec.capH / 10 }, L);
      shift(L, readRec.dy / 10);
      if (RD) for (const e of RD) e.cands = e.cands.map(ps => ps.map(([p, c]) => [p.map(([x, y]) => [x, y + readRec.dy / 10]), c]));
      return { W, H, o, res, cells: RD, ms: performance.now() - t0 };
    }
    S = GLYPH_METHODS.has(o.method) ? letterText(o) : source(o);
    if (!S.text.trim()) throw new Error("Nothing left to draw: the message has no letters this method can carry.");
    const th = o.tsize, avail = W - 2 * M, len = S.bits ? S.bits.length : S.text.replace(/ /g, "").length;
    const lines = k => {
      const cap = [], add = (s, h) => wrap(s, Math.max(4, Math.floor((avail / h * 6 + 1.6) / ADV))).forEach(l => cap.push({ s: l, h }));
      if (/message/.test(o.caption)) add(S.plain, th);
      if (/code/.test(o.caption) && S.code) add(S.code, Math.max(2.5, th * 0.55));
      if (o.caption === "key") add("KEY " + k, Math.max(2.5, th * 0.5));
      return cap;
    };
    // size the caption with a stand-in key first, so the drawing gets the rest of the page; the real key needs the drawing's size
    capH0 = Math.round((lines(keyOf(o, len, "00X00")).reduce((s, c) => s + c.h * 1.55, 0) + th * 0.8) * 10) / 10;
    res = METHODS[o.method](o, S, { x: M, y: M, w: W - 2 * M, h: H - 2 * M - capH0 }, L);
    key = keyOf(o, len, res.dims);
    const cap = lines(key);
    // centre drawing plus caption inside the margins (a round 0.1 mm shift, so the key strip can carry it exactly)
    const all = [...L.outline, ...L.fill, ...L.text, ...L.reveal].flatMap(([p]) => p), bb = bbox(all.length ? all : [[W / 2, H / 2]]);
    const capH2 = cap.reduce((s, c) => s + c.h * 1.55, 0) + (cap.length ? th * 0.8 : 0), total = bb[3] - bb[1] + capH2;
    dy = Math.round((Math.max(M, (H - total) / 2) - bb[1]) * 10) / 10;
    shift(L, dy);
    let yy = bb[3] + dy + (cap.length ? th * 0.8 : 0);
    for (const c of cap) { drawText(c.s, W / 2, yy, c.h, L.text); yy += c.h * 1.55; }
    if (marks) {
      if (o.method === "stars") throw new Error("Constellations are read by eye, so they take no machine marks: switch the marks off.");
      drawMarks(W, H, packRecord(1, {
        method: METHOD_LIST.indexOf(o.method), variant: variantIndex(o), enc: ENCS.indexOf(o.enc), hide: o.hide === "scatter" ? 1 : 0, density: +o.density - 2, seed: o.seed,
        len: o.method === "pigpen" ? res.rows : len, size: o.size, page: PAGES.indexOf(o.page), cipher: CIPHER_KINDS.indexOf(o.cipher), capH: Math.round(capH0 * 10), dy: Math.round(dy * 10), noise: Math.round(o.noise * 20),
        fill: FILLS.indexOf(o.fill), pitch: Math.round((o.pitch - 0.5) / 0.05), angle: Math.round(o.angle),
      }), L);
    }
  } catch (err) {
    RD = null;
    return { W, H, ...L, o, error: err instanceof Error ? err.message : String(err), gates: [["the settings make a drawing", false, String(err && err.message || err)]], ms: performance.now() - t0, notes: [] };
  }
  RD = null;
  const ok = norm(res.read) === norm(res.want), inPage = [...L.outline, ...L.fill, ...L.text, ...L.reveal].every(([p]) => p.every(([x, y]) => x >= 0.5 && y >= 0.5 && x <= W - 0.5 && y <= H - 0.5));
  let bottom = 0; for (const [p] of [...L.outline, ...L.fill, ...L.text, ...L.reveal]) for (const q of p) if (q[1] > bottom && (!marks || q[1] < H - MARK.inset - MARK.size - 1)) bottom = q[1];   // a loop: spreading this many points into Math.max overflows the stack
  const gates = [
    ["the drawing reads back to the message", ok, ok ? `"${norm(res.read).slice(0, 40)}"` : `read "${norm(res.read).slice(0, 30)}" want "${norm(res.want).slice(0, 30)}"`],
    ["smallest drawn unit at least 2 mm", res.feature >= 2 - 1e-9, `${res.feature.toFixed(2)} mm`],
    ["everything fits the page", inPage, ""],
  ];
  if (marks) gates.push(["the drawing clears the key strip", bottom <= H - MARK.margin + 1, `${(H - bottom).toFixed(1)} mm from the bottom edge`]);
  const notes = S.dropped && S.dropped.length ? [`Left out (this method cannot carry them): ${[...new Set(S.dropped.map(d => d.char))].join(" ")}`] : [];
  if (o.cipher !== "none") notes.push("Classical ciphers are historical / puzzle ciphers, not modern security.");
  return { W, H, ...L, o, res, key, how: howToRead(o), gates, notes, points: [...L.outline, ...L.fill, ...L.text, ...L.reveal].reduce((s, [p]) => s + p.length, 0), ms: performance.now() - t0 };
}

// Key strip fields back to settings, the rebuilt drawing, and how to turn read cell values into the message.
export function readPlan(f) {
  const method = METHOD_LIST[f.method];
  if (!method) throw new Error(`unknown method ${f.method}`);
  const o = { ...DEFAULTS, method, enc: ENCS[f.enc] || "fivebit", hide: f.hide ? "scatter" : "open", density: String(f.density + 2), seed: f.seed, size: f.size, page: PAGES[f.page], cipher: CIPHER_KINDS[f.cipher] || "none", noise: f.noise / 20, marks: "on",
    fill: FILLS[f.fill] || "lines", pitch: Math.round((0.5 + f.pitch * 0.05) * 100) / 100, angle: f.angle };
  const v = VARIANTS[method]; if (v) o[v[0]] = v[1][f.variant] || v[1][0];
  const r = build(o, { len: f.len, capH: f.capH, dy: f.dy });
  return {
    o, cells: r.cells, W: r.W, H: r.H, cipher: o.cipher,
    finish(values, cipherKey = "") {
      let text;
      if (method === "pigpen") {
        const per = Math.max(4, o.size), chars = values.map(v => (v >= 26 ? " " : ALPH[v]));
        text = norm(Array.from({ length: f.len }, (_, i) => chars.slice(i * per, (i + 1) * per).join("").trimEnd()).join(" "));
      } else {
        const flat = r.cells.flatMap((c, i) => (c.bits === 2 ? [values[i] >> 1, values[i] & 1] : [values[i]]));
        text = readerFor(o.enc)(r.res.route.map(p => flat[p]));
      }
      const plain = o.cipher !== "none" && cipherKey ? decipher(text, { kind: o.cipher, key: cipherKey }) : null;
      return { text, plain };
    },
  };
}
