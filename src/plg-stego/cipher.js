// Cipher garden: cryptographic and steganographic methods whose drawing IS the code. Eight methods, each
// decodable by eye with its "how to read" line and, for hidden layouts, the key under the drawing:
//   truchet   tile orientation carries bits (Truchet's 1704 triangles, quarter arcs, 10 PRINT diagonals, ribbons)
//   maze      a binary-tree maze: every cell's carve (north or east) is one bit
//   hilbert   one continuous space-filling line; a wiggle on a step is a 1
//   ridges    stacked ridgelines with hidden lines; a peak is a 1
//   pigpen    the Freemasons' grid cipher
//   stars     each word a constellation on a (keyed) Polybius square, among decoy stars
//   disk      rotor rings of arc code inside an Alberti cipher disk
//   grille    a Cardano grille: a field of letters, and the grille that finds them (a cut layer for the Cricut)
// Bits come from UNRAVEL THE PURLOINED's encoders; hiding uses its seeded scatter route. Shared drawing in core.js.
"use strict";
import { TAU, lerp, bbox, ellipse, rect, plen, simplify, inset, fillConvex, painter, textWidth, drawText, drawGlyphAt, wrap, svgOf, ADV } from "./core.js";
import * as fivebit from "@utp/fivebit";
import * as morse from "@utp/morse";
import * as bacon from "@utp/bacon";
import { encipher } from "@utp/ciphers";
import { rng } from "@utp/fabric";
import { scatterRoute } from "@utp/stego";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---------------- message to bits, bits to cells ----------------
const cipherOf = o => (o.cipher === "none" ? null : { kind: o.cipher, key: String(o.ckey || "") });
function source(o) {
  const cip = cipherOf(o), plain = morse.normalize(o.msg).text;
  if (o.enc === "bacon26") {
    const n = bacon.normalize(o.msg, "modern26"), t = cip ? encipher(n.text, cip) : n.text, bits = bacon.encode(t, "modern26");
    return { plain, text: t, bits, code: bacon.toAB(bits), dropped: n.dropped.filter(d => !/\s/.test(d.char)), read: b => bacon.decode(b, "modern26").text };
  }
  if (o.enc === "morse") {
    const n = morse.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
    return { plain, text: t, bits: morse.toUnits(morse.encode(t)), code: morse.transcribe(morse.encode(t)), dropped: n.dropped, read: b => morse.decodeUnits(b).text };
  }
  const n = fivebit.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
  return { plain, text: t, bits: fivebit.encode(t), code: [...t].map(c => fivebit.encode(c).join("")).join(" "), dropped: n.dropped, read: b => fivebit.decode(b).text };
}
// Letters-only text for the glyph methods (pigpen, stars, grille): the cipher runs first, anything but A-Z and space goes.
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
const norm = s => s.replace(/\s+/g, " ").trim();
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

// ---------------- the eight methods ----------------
// Each draws into L inside box B and returns { dims, feature (smallest drawn unit, mm), read (decoded text), want }.

function truchet(o, S, B, L) {
  const bpt = o.tiles === "triangles" ? 2 : 1, [cols, rows] = gridFor(Math.ceil(need(S.bits.length, o) / bpt), B, Math.max(3, o.size));
  const cap = rows * cols * bpt, P = place(S.bits, cap, o), s = Math.min(B.w / cols, B.h / rows), x0 = B.x + (B.w - cols * s) / 2, y0 = B.y + (B.h - rows * s) / 2;
  const state = Array.from({ length: rows * cols }, (_, i) => { let v = 0; for (let k = 0; k < bpt; k++) v = v * 2 + P.vals[i * bpt + k]; return v; });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, v = state[i], x = x0 + c * s, y = y0 + r * s, h = s / 2;
    if (P.carry.slice(i * bpt, i * bpt + bpt).some(Boolean)) ringMark(L, o, x + h, y + h, 0.12 * s);
    if (o.tiles === "arcs" || o.tiles === "ribbons") {
      const corners = v ? [[x + s, y, Math.PI / 2, Math.PI], [x, y + s, -Math.PI / 2, 0]] : [[x, y, 0, Math.PI / 2], [x + s, y + s, Math.PI, 1.5 * Math.PI]];
      for (const [cx, cy, a0, a1] of corners) {
        if (o.tiles === "arcs") { L.outline.push([arcPts(cx, cy, h, a0, a1), false]); L.fill.push(...F(o, [[cx, cy], ...arcPts(cx, cy, h, a0, a1, 10)])); }
        else { const rw = 0.16 * s; L.outline.push([arcPts(cx, cy, h - rw, a0, a1), false], [arcPts(cx, cy, h + rw, a0, a1), false]); for (const q of ringPieces(cx, cy, h - rw, h + rw, a0, a1)) L.fill.push(...F(o, q)); }
      }
    } else if (o.tiles === "diag") {
      L.outline.push([v ? [[x, y + s], [x + s, y]] : [[x, y], [x + s, y + s]], false]);
      L.fill.push(...F(o, v ? [[x, y + s], [x + s, y], [x + s, y + s]] : [[x, y], [x + s, y + s], [x, y + s]]));
    } else {
      // Truchet's own tile: a square split on its diagonal, the dark half in one of four corners (2 bits)
      const C4 = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]], k = v, tri = [C4[k], C4[(k + 1) % 4], C4[(k + 3) % 4]];
      L.outline.push([[C4[(k + 1) % 4], C4[(k + 3) % 4]], false]); L.fill.push(...F(o, tri));
    }
  }
  if (o.tiles === "diag" || o.tiles === "triangles") L.outline.push([rect(x0, y0, cols * s, rows * s), true]);
  const flat = state.flatMap(v => (bpt === 2 ? [v >> 1, v & 1] : [v]));
  return { dims: `${cols}X${rows}`, feature: s, read: S.read(P.route.map(p => flat[p])), want: S.text, cap };
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
  if (o.walls === "bands") {
    const bw = 0.11 * s;
    for (const [a, b] of segs) { const q = a[0] === b[0] ? rect(a[0] - bw, a[1] - bw, 2 * bw, b[1] - a[1] + 2 * bw) : rect(a[0] - bw, a[1] - bw, b[0] - a[0] + 2 * bw, 2 * bw); L.outline.push([q, true]); L.fill.push(...fillConvex(q, o.fill === "none" ? "lines" : o.fill, Math.min(o.pitch, bw * 0.9), o.angle, o.seed)); }
  } else {
    for (const sg of segs) L.outline.push([sg, false]);
    // dead ends (one way in) take the shading
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const open = (carve[r][c] === "N" ? 1 : 0) + (carve[r][c] === "E" ? 1 : 0) + (r < R - 1 && carve[r + 1][c] === "N" ? 1 : 0) + (c > 0 && carve[r][c - 1] === "E" ? 1 : 0) + (r === R - 1 && c === 0 ? 1 : 0) + (r === 0 && c === C - 1 ? 1 : 0);
      if (open === 1) L.fill.push(...F(o, rect(X(c) + 0.2 * s, Y(r) + 0.2 * s, 0.6 * s, 0.6 * s)));
    }
  }
  if (o.reveal === "on") {   // the way through, from the gap bottom left to the gap top right
    let r = R - 1, c = 0; const path = [[X(0) + s / 2, Y(R) + s * 0.4], [X(0) + s / 2, Y(R - 1) + s / 2]];
    while (!(r === 0 && c === C - 1)) { if (carve[r][c] === "N") r--; else c++; path.push([X(c) + s / 2, Y(r) + s / 2]); }
    path.push([X(C - 1) + s / 2, Y(0) - s * 0.4]); L.reveal.push([simplify(path, 0.01), false]);
  }
  const flat = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (idx[r][c] >= 0) flat[idx[r][c]] = carve[r][c] === "E" ? 1 : 0;
  return { dims: `${C}X${R}`, feature: s, read: S.read(P.route.map(p => flat[p])), want: S.text, cap };
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
  const path = [pts[0]], loops = [];
  for (let i = 0; i < cap; i++) {
    const a = pts[i], b = pts[i + 1], d = [(b[0] - a[0]) / s, (b[1] - a[1]) / s], nr = [-d[1], d[0]];
    if (P.carry[i]) ringMark(L, o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.1 * s);
    if (!P.vals[i]) { path.push(b); continue; }
    if (o.mark === "wave") for (let k = 1; k <= 16; k++) { const t = k / 16, w = 0.26 * s * Math.sin(TAU * t); path.push([a[0] + d[0] * s * t + nr[0] * w, a[1] + d[1] * s * t + nr[1] * w]); }
    else if (o.mark === "zigzag") for (const [t, w] of [[0.17, 1], [0.5, -1], [0.83, 1], [1, 0]]) path.push([a[0] + d[0] * s * t + nr[0] * w * 0.22 * s, a[1] + d[1] * s * t + nr[1] * w * 0.22 * s]);
    else {   // a small loop tied at the middle of the step
      const m = lerp(a, b, 0.5), rr = 0.2 * s, c = [m[0] + nr[0] * rr, m[1] + nr[1] * rr], a0 = Math.atan2(-nr[1], -nr[0]);
      path.push(m); for (let k = 1; k <= 20; k++) path.push([c[0] + rr * Math.cos(a0 + TAU * k / 20), c[1] + rr * Math.sin(a0 + TAU * k / 20)]); path.push(b);
      loops.push(ellipse(c[0], c[1], rr, rr, 0, 20));
    }
  }
  L.outline.push([simplify(path, 0.005), false], [ellipse(pts[0][0], pts[0][1], 0.3 * s, 0.3 * s, 0, 16), true]);
  for (const q of loops) L.fill.push(...F(o, q));
  const e = pts.at(-1); L.outline.push([rect(e[0] - 0.22 * s, e[1] - 0.22 * s, 0.44 * s, 0.44 * s), true]);
  return { dims: `H${n}`, feature: s, read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap };
}

function ridges(o, S, B, L) {
  const C = Math.max(3, o.size), R = Math.max(2, Math.ceil(need(S.bits.length, o) / C), Math.round(C * 0.95 * B.h / B.w)), cap = R * C, P = place(S.bits, cap, o);
  const dy = B.h / (R + 2.6), A = 2.1 * dy, sw = B.w / (C + 1), bw = 0.46 * sw, pn = painter(Math.max(2, sw));
  const nr = rng(o.seed * 13 + 3), waves = Array.from({ length: R }, () => [0, 1, 2].map(j => [nr() * 6.28, (0.08 + 0.1 * nr()) * (j + 1)]));
  for (let r = 0; r < R; r++) {
    const base = B.y + 2.6 * dy + r * dy, curve = [];
    for (let x = B.x; x <= B.x + B.w + 1e-9; x += 0.4) {
      let lift = 0; for (let k = 0; k < C; k++) if (P.vals[r * C + k]) lift += A * Math.exp(-(((x - (B.x + sw * (k + 1))) / bw) ** 2));
      const noise = o.noise * 0.32 * dy * (1 + waves[r].reduce((s, [ph, f]) => s + Math.sin(x * f + ph), 0) / 3) / 2;
      curve.push([x, base - lift - noise]);
    }
    const occ = [], fill = [];
    for (let i = 0; i + 1 < curve.length; i++) {
      const q = [curve[i], curve[i + 1], [curve[i + 1][0], base + 0.3], [curve[i][0], base + 0.3]]; occ.push(q);
      if (base - Math.min(curve[i][1], curve[i + 1][1]) > 0.18 * A) fill.push(...F(o, q));
    }
    pn.add({ outline: [[simplify(curve, 0.01), false]], fill }, occ);
    for (let k = 0; k < C; k++) if (P.carry[r * C + k]) ringMark(L, o, B.x + sw * (k + 1), base + 0.25 * dy, 0.12 * dy);
  }
  pn.resolve(L);
  return { dims: `${C}X${R}`, feature: dy, read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap };
}

// Pigpen: A-I in a noughts-and-crosses grid, J-R the same with a dot, S-V in an X, W-Z in an X with a dot.
function pigpenGlyph(ch, x, y, g, o, L) {
  const i = ALPH.indexOf(ch), cxy = [x + g / 2, y + g / 2];
  if (i < 18) {
    const k = i % 9, r = Math.floor(k / 3), c = k % 3, dot = i >= 9, C4 = [[x, y], [x + g, y], [x + g, y + g], [x, y + g]];
    const has = [r > 0, c < 2, r < 2, c > 0];   // top, right, bottom, left: the grid lines round this cell
    const start = has.indexOf(false) < 0 ? 0 : (has.indexOf(false) + 1) % 4; let cur = [];
    for (let e = 0; e < 4; e++) { const k2 = (start + e) % 4; if (has[k2]) { if (!cur.length) cur.push(C4[k2]); cur.push(C4[(k2 + 1) % 4]); } else if (cur.length) { L.outline.push([cur, false]); cur = []; } }
    if (cur.length) L.outline.push([cur, has.every(Boolean)]);
    if (dot) { const d = ellipse(cxy[0], cxy[1], 0.13 * g, 0.13 * g, 0, 20); L.outline.push([d, true]); L.fill.push(...F(o, d, 0.8)); }
    else L.fill.push(...F(o, rect(x + 0.2 * g, y + 0.2 * g, 0.6 * g, 0.6 * g)));
    return { t: "g", k, dot };
  }
  const k = (i - 18) % 4, dot = i >= 22, C4 = [[x, y], [x + g, y], [x + g, y + g], [x, y + g]];
  const pair = [[0, 1], [0, 3], [1, 2], [3, 2]][k], tri = [C4[pair[0]], cxy, C4[pair[1]]];
  L.outline.push([tri, false]);
  const cen = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
  if (dot) { const d = ellipse(cen[0], cen[1], 0.11 * g, 0.11 * g, 0, 18); L.outline.push([d, true]); L.fill.push(...F(o, d, 0.8)); }
  else { const q = inset(tri, 0.08 * g); if (q) L.fill.push(...F(o, q)); }
  return { t: "x", k, dot };
}
function pigpen(o, S, B, L) {
  const T = S.text, words = T.split(" ").filter(Boolean), per = Math.max(4, o.size), lines = [];
  let cur = ""; for (const w of words) { if (cur && cur.length + 1 + w.length > per) { lines.push(cur); cur = ""; } cur = cur ? cur + " " + w : w; } if (cur) lines.push(cur);
  const maxLen = Math.max(1, ...lines.map(l => l.length)), g = Math.min(B.w / (maxLen * 1.35), B.h / (lines.length * 1.5), 22), step = g * 1.35;
  let read = "";
  lines.forEach((line, li) => {
    const x0 = B.x + (B.w - (line.length * step - 0.35 * g)) / 2, y = B.y + (B.h - (lines.length * 1.5 * g - 0.5 * g)) / 2 + li * 1.5 * g;
    [...line].forEach((ch, i) => {
      if (ch === " ") { read += " "; return; }
      const id = pigpenGlyph(ch, x0 + i * step, y, g, o, L);
      read += id.t === "g" ? ALPH[id.k + (id.dot ? 9 : 0)] : ALPH[18 + id.k + (id.dot ? 4 : 0)];
    });
    read += " ";
  });
  return { dims: `${per}`, feature: g * 0.6, read: norm(read), want: norm(T), cap: T.length };
}

// Polybius square, keyed: the keyword's letters first, then the rest; I and J share a square.
function polybius(key) { const seq = [...(String(key || "").toUpperCase() + ALPH).replace(/J/g, "I")].filter(c => /[A-IK-Z]/.test(c)); return [...new Set(seq)].slice(0, 25); }
function stars(o, S, B, L) {
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
      if (i > 0) {
        const a = pos[i - 1];
        if (a[0] === p[0] && a[1] === p[1]) { L.outline.push([ellipse(p[0], p[1], 0.33 * q, 0.33 * q, 0, 20), true]); return; }   // a doubled letter: a ring round the star
        const d = Math.hypot(p[0] - a[0], p[1] - a[1]), u = [(p[0] - a[0]) / d, (p[1] - a[1]) / d], g0 = 0.34 * q;
        if (d > 2 * g0) {
          L.outline.push([[[a[0] + u[0] * g0, a[1] + u[1] * g0], [p[0] - u[0] * g0, p[1] - u[1] * g0]], false]);
          const mid = lerp(a, p, 0.5), hl = 0.12 * q;   // a chevron points the way along the line
          L.outline.push([[[mid[0] - u[0] * hl - u[1] * hl, mid[1] - u[1] * hl + u[0] * hl], mid, [mid[0] - u[0] * hl + u[1] * hl, mid[1] - u[1] * hl - u[0] * hl]], false]);
        }
      }
      ringMark(L, o, p[0], p[1], 0.5 * q);   // answer key: ring the real stars
    });
    // read it back: snap every star on the line to the grid
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
    if (!P.vals[k]) continue;
    L.outline.push([[...arcPts(cx, cy, r1, a0, a1, 10), ...arcPts(cx, cy, r0, a1, a0, 10)], true]);
    for (const q of ringPieces(cx, cy, r0, r1, a0, a1)) L.fill.push(...F(o, q));
  }
  // start mark at twelve o'clock (read clockwise, outer ring first), and the hub
  L.outline.push([[[cx - 0.02 * Rm, cy - rOut - 0.035 * Rm], [cx, cy - rOut - 0.005 * Rm], [cx + 0.02 * Rm, cy - rOut - 0.035 * Rm]], true]);
  L.outline.push([ellipse(cx, cy, rIn * 0.85, rIn * 0.85, 0, 72), true], [[[cx - 0.3 * rIn, cy], [cx + 0.3 * rIn, cy]], false], [[[cx, cy - 0.3 * rIn], [cx, cy + 0.3 * rIn]], false]);
  return { dims: `R${rings.length}.${shift}`, feature: Math.min(sl, rings[0].rw), read: S.read(P.route.map(p => P.vals[p])), want: S.text, cap };
}

const FREQ = "EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMMWWFFGGYYPPBVK";
function grille(o, S, B, L) {
  const T = S.text.replace(/ /g, ""), [C, R] = gridFor(Math.ceil(T.length * Math.max(2, +o.density)), { w: B.w, h: B.h * 0.7 }, Math.max(6, o.size));
  const holes = scatterRoute(o.seed, T.length, C * R).slice().sort((a, b) => a - b), rnd = rng(o.seed * 7 + 29), field = Array.from({ length: C * R }, () => FREQ[Math.floor(rnd() * FREQ.length)]);
  holes.forEach((p, i) => (field[p] = T[i]));
  const s = Math.min(B.w / (C + 2.7), B.h / (R + 2.7)), x0 = B.x + (B.w - C * s) / 2, y0 = B.y + (B.h - R * s) / 2, h = 0.58 * s;   // 2.7 cells kept for the corner crosses
  field.forEach((ch, p) => drawText(ch, x0 + (p % C + 0.5) * s, y0 + Math.floor(p / C) * s + (s - h) / 2, h, L.outline));
  // registration: the same frame and corner crosses on the page and on the grille, so the grille drops straight on
  const frame = rect(x0 - 0.3 * s, y0 - 0.3 * s, C * s + 0.6 * s, R * s + 0.6 * s), cr = 0.35 * s;
  const crosses = [[x0 - 0.9 * s, y0 - 0.9 * s], [x0 + C * s + 0.9 * s, y0 - 0.9 * s], [x0 + C * s + 0.9 * s, y0 + R * s + 0.9 * s], [x0 - 0.9 * s, y0 + R * s + 0.9 * s]].flatMap(([x, y]) => [[[[x - cr, y], [x + cr, y]], false], [[[x, y - cr], [x, y + cr]], false]]);
  L.outline.push([frame, true], ...crosses);
  if (o.reveal === "on") { L.reveal.push([frame, true], ...crosses); for (const p of holes) L.reveal.push([rect(x0 + (p % C + 0.1) * s, y0 + (Math.floor(p / C) + 0.1) * s, 0.8 * s, 0.8 * s), true]); }
  return { dims: `${C}X${R}`, feature: h, read: holes.map(p => field[p]).join(""), want: T, cap: C * R };
}

const METHODS = { truchet, maze, hilbert, ridges, pigpen, stars, disk, grille };
const GLYPH_METHODS = new Set(["pigpen", "stars", "grille"]);
const M_CODE = { truchet: "TR", maze: "MZ", hilbert: "HB", ridges: "RG", pigpen: "PP", stars: "ST", disk: "DK", grille: "GR" };
function keyOf(o, L, dims) {
  const e = GLYPH_METHODS.has(o.method) ? "LT" : { fivebit: "5B", bacon26: "BA", morse: "MR" }[o.enc];
  const h = o.hide === "scatter" || o.method === "grille" ? `S${o.seed.toString(36).toUpperCase()}.${o.density}` : "O";
  const c = o.cipher === "none" ? "NC" : `${o.cipher.slice(0, 2).toUpperCase()}.${String(o.ckey).toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
  const k = o.method === "stars" && o.pkey ? `-K.${String(o.pkey).toUpperCase().replace(/[^A-Z]/g, "")}` : "";
  return ["PLG1", M_CODE[o.method], e, h, "L" + L, dims, c].join("-") + k;
}
function howToRead(o) {
  const bits = { fivebit: "five-bit letters (A = 00000, T = 10011)", bacon26: "Bacon's A/B letters (1 is B)", morse: "Morse timing units (a run of 1s is a mark)" }[o.enc];
  const hidden = o.hide === "scatter" ? " The message bits are scattered among noise along a seeded route: the key under the drawing names the seed." : "";
  return {
    truchet: { arcs: `Each tile is one bit: arcs round the top-left and bottom-right corners are 0, round the other two corners 1. Read tiles left to right, top row first, as ${bits}.`, ribbons: `Each tile is one bit, ribbons round the top-left and bottom-right corners are 0, the other pair 1; read left to right, top row first, as ${bits}.`, diag: `10 PRINT: a diagonal falling to the right is 0, rising to the right is 1. Read left to right, top row first, as ${bits}.`, triangles: `Truchet's own 1704 tile: the dark half sits in one of four corners, two bits each (top left 00, top right 01, bottom right 10, bottom left 11). Read left to right, top row first, as ${bits}.` }[o.tiles] + hidden,
    maze: `A binary-tree maze: every cell opens either north (0) or east (1). The top row and right column are forced and carry nothing; read the rest left to right, top row first, as ${bits}.` + hidden,
    hilbert: `Follow the line from the ring to the square: every step of the space-filling curve is one bit, a straight step 0 and a ${o.mark === "loop" ? "looped" : o.mark === "zigzag" ? "zigzag" : "wavy"} step 1, as ${bits}.` + hidden,
    ridges: `Each ridgeline is a row of bits read left to right, back line first: a peak is 1, flat is 0, as ${bits}.` + hidden,
    pigpen: "Pigpen: A to I sit in a noughts-and-crosses grid, J to R in a second grid with a dot, S to V in an X, W to Z in an X with a dot. Each shape is the walls round its letter's place. A historical / puzzle cipher, not modern security.",
    stars: `Each constellation is a word on a 5 x 5 Polybius square${o.pkey ? ` keyed by ${String(o.pkey).toUpperCase()}` : " (A B C D E across the top)"}: start at the ringed star and follow the chevrons, reading each star's row and column. A ring round a star doubles its letter; the small stars are decoys.`,
    disk: `Read the rotor clockwise from the mark at twelve, outer ring first: a filled arc is 1, a gap 0, as ${bits}. The letter rim is Alberti's cipher disk${o.cipher === "caesar" ? `, turned to the Caesar shift ${o.ckey}` : ""}.` + hidden,
    grille: "A Cardano grille: lay the cut grille over the page, corner crosses on corner crosses, and read the letters showing through left to right, top row first. The answer key layer is the grille: cut it on the Cricut.",
  }[o.method];
}

// ---------------- build ----------------
const $ = id => document.getElementById(id);
const IDS = ["msg", "enc", "cipher", "ckey", "method", "hide", "density", "seed", "size", "tiles", "walls", "mark", "noise", "pkey", "fill", "pitch", "angle", "caption", "tsize", "tpen", "reveal", "rpen", "page"];
const read = () => Object.fromEntries(IDS.map(k => [k, $(k).type === "range" ? +$(k).value : $(k).value]));
let last = null;
const shift = (L, dy) => { for (const k of Object.keys(L)) L[k] = L[k].map(([p, c]) => [p.map(([x, y]) => [x, y + dy]), c]); };

function build(o) {
  const t0 = performance.now(), [W, H] = o.page.split("x").map(Number), M = 10, L = { outline: [], fill: [], text: [], reveal: [] };
  let S, res;
  try {
    S = GLYPH_METHODS.has(o.method) ? letterText(o) : source(o);
    if (!S.text.trim()) throw new Error("Nothing left to draw: the message has no letters this method can carry.");
    // caption lines first, so the drawing gets the rest of the page
    const th = o.tsize, avail = W - 2 * M, len = S.bits ? S.bits.length : S.text.replace(/ /g, "").length;
    const lines = key => {
      const cap = [], add = (s, h) => wrap(s, Math.max(4, Math.floor((avail / h * 6 + 1.6) / ADV))).forEach(l => cap.push({ s: l, h }));
      if (/message/.test(o.caption)) add(S.plain, th);
      if (/code/.test(o.caption) && S.code) add(S.code, Math.max(2.5, th * 0.55));
      if (o.caption === "key") add("KEY " + key, Math.max(2.5, th * 0.5));
      return cap;
    };
    // size the caption with a stand-in key first, so the drawing gets the rest of the page; the real key needs the drawing's size
    const capH0 = lines(keyOf(o, len, "00X00")).reduce((s, c) => s + c.h * 1.55, 0) + th * 0.8;
    res = METHODS[o.method](o, S, { x: M, y: M, w: W - 2 * M, h: H - 2 * M - capH0 }, L);
    const key = keyOf(o, len, res.dims), cap = lines(key);
    // centre drawing plus caption on the page
    const all = [...L.outline, ...L.fill, ...L.text, ...L.reveal].flatMap(([p]) => p), bb = bbox(all.length ? all : [[W / 2, H / 2]]);
    const capH2 = cap.reduce((s, c) => s + c.h * 1.55, 0) + (cap.length ? th * 0.8 : 0), total = bb[3] - bb[1] + capH2, dy = Math.max(M, (H - total) / 2) - bb[1];
    shift(L, dy);
    let yy = bb[3] + dy + (cap.length ? th * 0.8 : 0);
    for (const c of cap) { drawText(c.s, W / 2, yy, c.h, L.text); yy += c.h * 1.55; }
    res.key = key;
  } catch (err) {
    return { W, H, ...L, o, error: err instanceof Error ? err.message : String(err), gates: [["the settings make a drawing", false, String(err && err.message || err)]], ms: performance.now() - t0, notes: [] };
  }
  const ok = norm(res.read) === norm(res.want), gates = [
    ["the drawing reads back to the message", ok, ok ? `"${norm(res.read).slice(0, 40)}"` : `read "${norm(res.read).slice(0, 30)}" want "${norm(res.want).slice(0, 30)}"`],
    ["smallest drawn unit at least 2 mm", res.feature >= 2 - 1e-9, `${res.feature.toFixed(2)} mm`],
    ["everything fits the page", [...L.outline, ...L.fill, ...L.text, ...L.reveal].every(([p]) => p.every(([x, y]) => x >= 0.5 && y >= 0.5 && x <= W - 0.5 && y <= H - 0.5)), ""],
  ];
  const notes = S.dropped && S.dropped.length ? [`Left out (this method cannot carry them): ${[...new Set(S.dropped.map(d => d.char))].join(" ")}`] : [];
  if (o.cipher !== "none") notes.push("Classical ciphers are historical / puzzle ciphers, not modern security.");
  return { W, H, ...L, o, res, key: res.key, how: howToRead(o), gates, notes, points: [...L.outline, ...L.fill, ...L.text, ...L.reveal].reduce((s, [p]) => s + p.length, 0), ms: performance.now() - t0 };
}

// ---------------- draw + export ----------------
function draw(r) {
  const cv = $("cv"), maxW = Math.min(780, Math.max(200, cv.parentElement.clientWidth - 30)), k = Math.min(maxW / r.W, Math.max(1.2, (innerHeight - 90) / r.H));
  cv.width = Math.round(r.W * k * devicePixelRatio); cv.height = Math.round(r.H * k * devicePixelRatio); cv.style.width = Math.round(r.W * k) + "px";
  const c = cv.getContext("2d"); c.setTransform(k * devicePixelRatio, 0, 0, k * devicePixelRatio, 0, 0); paint(c, r);
  const len = ps => ps.reduce((a, [p, cl]) => a + plen(p, cl), 0) / 1000, esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (r.error) { $("stats").innerHTML = `<span class="fail">These settings do not make a drawing: ${esc(r.error)}</span>`; $("how").textContent = ""; return; }
  $("stats").innerHTML = `${esc(r.o.method)} · ${r.res.cap} cells · ${r.points} points · ${r.ms.toFixed(0)} ms<br>`
    + `<span class="sw" style="background:#0b0f14"></span>0.4 outline <b>${len(r.outline).toFixed(1)} m</b> · <span class="sw" style="background:#5c7080"></span>0.3 fill <b>${len(r.fill).toFixed(1)} m</b> · <span class="sw" style="background:${r.o.tpen}"></span>text <b>${len(r.text).toFixed(1)} m</b>`
    + (r.reveal.length ? ` · <span class="sw" style="background:${r.o.rpen}"></span>${r.o.method === "grille" ? "grille (cut)" : r.o.method === "maze" ? "way through" : "reveal"} <b>${len(r.reveal).toFixed(1)} m</b>` : "") + "<br>"
    + r.gates.map(([n, ok, v]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "pass" : "FAIL"}</span> ${esc(n)} ${esc(v)}`).join("<br>")
    + `<br>key <b>${esc(r.key)}</b>` + (r.notes.length ? `<br><span class="note">${r.notes.map(esc).join("<br>")}</span>` : "");
  $("how").textContent = r.how;
}
function paint(c, r) {
  c.fillStyle = "#fbfaf6"; c.fillRect(0, 0, r.W, r.H); c.lineJoin = c.lineCap = "round";
  const stroke = (paths, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (const [p, cl] of paths) { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cl) c.closePath(); } c.stroke(); };
  stroke(r.fill, "#5c7080", 0.3); stroke(r.outline, "#0b0f14", 0.4); stroke(r.text, r.o.tpen, 0.3);
  c.globalAlpha = 0.85; stroke(r.reveal, r.o.rpen, 0.35); c.globalAlpha = 1;
}
const penLayers = r => [
  { name: "outline", colour: "000000", w: 0.4, paths: r.outline },
  { name: "fill", colour: "555555", w: 0.3, paths: r.fill },
  { name: "text", colour: r.o.tpen.slice(1), w: 0.3, paths: r.text },
  { name: r.o.method === "grille" ? "grille-cut" : "reveal", colour: r.o.rpen.slice(1), w: 0.3, paths: r.reveal },
].filter(L => L.paths.length);
const toSVG = (r, only = null, ticks = false) => svgOf(r, penLayers(r), `PLG cipher garden (UTP ${UTP_REV})`, only, ticks);

function sync() { for (const k of IDS) { const out = $("o-" + k); if (out) out.textContent = $(k).value; } document.querySelectorAll("[data-for]").forEach(el => (el.hidden = !el.dataset.for.split(" ").includes($("method").value))); }
let pending = 0;
function run() { sync(); $("stats").textContent = "drawing"; clearTimeout(pending); pending = setTimeout(() => { last = build(read()); draw(last); }, 80); }

const PRESETS = {
  arcs: { method: "truchet", tiles: "arcs", msg: "NOTHING TO SEE HERE", enc: "fivebit", hide: "scatter", density: "2", size: 22, fill: "contour", pitch: 0.7, caption: "key" },
  truchet1704: { method: "truchet", tiles: "triangles", msg: "MEMOIRE SUR LES COMBINAISONS", enc: "fivebit", hide: "open", size: 16, fill: "lines", pitch: 0.6, angle: 45, caption: "message" },
  tenprint: { method: "truchet", tiles: "diag", msg: "GOTO TEN", enc: "fivebit", hide: "scatter", density: "3", size: 26, fill: "none", caption: "key" },
  ribbons: { method: "truchet", tiles: "ribbons", msg: "TIED IN KNOTS", enc: "fivebit", hide: "open", size: 14, fill: "lines", pitch: 0.55, angle: 30, caption: "message" },
  maze: { method: "maze", walls: "line", msg: "YOU FOUND THE WAY IN", enc: "fivebit", hide: "open", size: 24, fill: "lines", pitch: 0.6, caption: "message" },
  bold: { method: "maze", walls: "bands", msg: "NO WAY OUT", enc: "fivebit", hide: "scatter", density: "2", size: 16, fill: "cross", pitch: 0.55, caption: "key" },
  thread: { method: "hilbert", mark: "wave", msg: "FOLLOW THE THREAD", enc: "fivebit", hide: "open", fill: "none", caption: "message" },
  loops: { method: "hilbert", mark: "loop", msg: "KNOTTED", enc: "morse", hide: "open", fill: "spiral", pitch: 0.5, caption: "message code" },
  ridges: { method: "ridges", msg: "UNKNOWN PLEASURES", enc: "fivebit", hide: "open", size: 16, noise: 0.5, fill: "lines", pitch: 0.7, angle: 0, caption: "message" },
  pigpen: { method: "pigpen", msg: "THE LODGE MEETS AT MIDNIGHT", cipher: "none", size: 12, fill: "lines", pitch: 0.6, angle: 45, caption: "message" },
  stars: { method: "stars", msg: "ALL THE STARS ARE LETTERS", cipher: "none", pkey: "ORION", hide: "scatter", density: "3", fill: "spiral", pitch: 0.5, caption: "key" },
  disk: { method: "disk", msg: "ALBERTI SENDS HIS REGARDS", enc: "fivebit", cipher: "caesar", ckey: "3", hide: "open", fill: "lines", pitch: 0.6, angle: 60, caption: "message" },
  grille: { method: "grille", msg: "MEET ME BY THE OLD MILL", cipher: "none", size: 18, density: "4", reveal: "on", caption: "none" },
};
document.querySelectorAll("[data-preset]").forEach(b => (b.onclick = () => { for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) $(k).value = v; run(); }));
$("reroll").onclick = () => { $("seed").value = 1 + Math.floor(Math.random() * 999); run(); };
IDS.forEach(k => $(k).addEventListener("input", run));
const save = (text, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const stem = o => `plg-cipher-${o.method}-${o.method === "truchet" ? o.tiles + "-" : ""}${o.fill}-s${o.seed}-${o.msg.replace(/[^A-Z0-9]/gi, "").slice(0, 20)}`;
$("export").onclick = () => { if (last && !last.error) save(toSVG(last, null, $("ticks").value === "on"), stem(last.o) + ".svg"); };
$("split").onclick = () => {
  if (!last || last.error) return;
  const ls = penLayers(last), ticks = $("ticks").value !== "off";
  ls.forEach((L, i) => setTimeout(() => save(toSVG(last, L.name, ticks), `${stem(last.o)}-${i + 1}of${ls.length}-${L.name}.svg`), i * 500));
};
addEventListener("resize", () => last && draw(last));
if ($("rev")) $("rev").textContent = UTP_REV;
window.__studio = { build, read, PRESETS, penLayers, paint, toSVG };   // hooks for checking
run();
