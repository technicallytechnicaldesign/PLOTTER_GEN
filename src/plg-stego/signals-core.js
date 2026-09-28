// Signal book core (no DOM, shared with the plot decoder): alphabets where every letter is a picture. Substitution, not concealment: anyone with the chart reads it,
// the pleasure is in the drawing.
//   flags      International Code of Signals: 26 letter flags and 10 numeral pennants
//   semaphore  flag semaphore, drawn as a little signaller with two flags (as the reader sees them)
//   ogham      the early medieval Irish script: strokes on a stem line
//   braille    braille cell shapes, drawn (not tactile: a pen line is no raised dot)
//   tap        tap code: knocks as two groups of dots on a 5 x 5 square
// Colour in black ink uses heraldry's Petra Sancta hatching (red vertical, blue horizontal, yellow dotted, black
// crosshatched); "coloured pens" gives every colour its own pen layer instead.
"use strict";
import { rect, ellipse, plen, fillConvex, painter, drawText, wrap, svgOf, ADV } from "./core.js";
import * as morse from "@utp/morse";
import { encipher, decipher } from "@utp/ciphers";
import { MARK, LAYOUTS, drawMarks, packRecord, PAGES, marksClear } from "./marks.js";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";

// ---------------- colour ----------------
const HERALDIC = { red: ["lines", 90, 1], blue: ["lines", 0, 1], yellow: ["stipple", 0, 1.3], black: ["cross", 0, 0.9], green: ["lines", 45, 1] };
export const PEN = { red: "c23b3b", blue: "1f4e8c", yellow: "e0a800", black: "111111", green: "2f7a4f" };
function colourFill(o, poly, colour) {
  if (colour === "white" || o.ink === "outline") return {};
  // each colour also turns its hatch, so a grey photo (the camera decoder) can still tell E from D: with one shared angle
  // a flag's colours only differed by pen, and those two read the same
  if (o.ink === "pens") return { [colour]: fillConvex(poly, "lines", o.pitch, o.angle + ({ red: 0, blue: 90, yellow: 45, black: -45, green: 22 })[colour], 1) };
  const [style, ang, k] = HERALDIC[colour];
  return { hatch: fillConvex(poly, style, o.pitch * k, ang, 1) };
}
// Clip a convex polygon by another (Sutherland-Hodgman).
function clip(P, C) {
  let out = P; const s = Math.sign(C.reduce((a, p, i) => { const q = C[(i + 1) % C.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
  for (let i = 0; i < C.length && out.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], f = p => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), inp = out; out = [];
    for (let k = 0; k < inp.length; k++) { const p = inp[k], q = inp[(k + 1) % inp.length], fp = f(p), fq = f(q); if (fp >= 0) out.push(p); if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
  }
  return out.length > 2 ? out : null;
}

// ---------------- International Code of Signals ----------------
// Shapes in flag units (u from hoist to fly, v from top to bottom), painted bottom first; later shapes hide earlier ones.
const R = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const band = (c0, c1) => [[c0, 0], [c1, 0], [c1 - 1, 1], [c0 - 1, 1]];   // a diagonal band, clipped to the flag later
const disc = (u, v, r) => ({ disc: [u, v, r] });
const saltire = w => [[w, 0], [0, 0], [0, w], [1 - w, 1], [1, 1], [1, 1 - w]];
const FLAGS = {
  A: [["white", R(0, 0, 0.5, 1)], ["blue", [[0.5, 0], [1, 0], [0.75, 0.5], [0.5, 0.5]]], ["blue", [[0.5, 0.5], [0.75, 0.5], [1, 1], [0.5, 1]]]],
  B: [["red", [[0, 0], [1, 0], [0.75, 0.5], [0, 0.5]]], ["red", [[0, 0.5], [0.75, 0.5], [1, 1], [0, 1]]]],
  C: [["blue", R(0, 0, 1, 0.2)], ["white", R(0, 0.2, 1, 0.4)], ["red", R(0, 0.4, 1, 0.6)], ["white", R(0, 0.6, 1, 0.8)], ["blue", R(0, 0.8, 1, 1)]],
  D: [["yellow", R(0, 0, 1, 0.25)], ["blue", R(0, 0.25, 1, 0.75)], ["yellow", R(0, 0.75, 1, 1)]],
  E: [["blue", R(0, 0, 1, 0.5)], ["red", R(0, 0.5, 1, 1)]],
  F: [["white", R(0, 0, 1, 1)], ["red", [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]]],
  G: [0, 1, 2, 3, 4, 5].map(i => [i % 2 ? "blue" : "yellow", R(i / 6, 0, (i + 1) / 6, 1)]),
  H: [["white", R(0, 0, 0.5, 1)], ["red", R(0.5, 0, 1, 1)]],
  I: [["yellow", R(0, 0, 1, 1)], ["black", disc(0.5, 0.5, 0.26)]],
  J: [["blue", R(0, 0, 1, 1 / 3)], ["white", R(0, 1 / 3, 1, 2 / 3)], ["blue", R(0, 2 / 3, 1, 1)]],
  K: [["yellow", R(0, 0, 0.5, 1)], ["blue", R(0.5, 0, 1, 1)]],
  L: [["yellow", R(0, 0, 0.5, 0.5)], ["black", R(0.5, 0, 1, 0.5)], ["black", R(0, 0.5, 0.5, 1)], ["yellow", R(0.5, 0.5, 1, 1)]],
  M: [["blue", R(0, 0, 1, 1)], ["white", { clip: saltire(0.16) }], ["white", { clip: saltire(0.16).map(([u, v]) => [1 - u, v]) }]],
  N: Array.from({ length: 16 }, (_, i) => [(i % 4 + Math.floor(i / 4)) % 2 ? "white" : "blue", R((i % 4) / 4, Math.floor(i / 4) / 4, (i % 4 + 1) / 4, (Math.floor(i / 4) + 1) / 4)]),
  O: [["red", [[0, 0], [1, 0], [1, 1]]], ["yellow", [[0, 0], [1, 1], [0, 1]]]],
  P: [["blue", R(0, 0, 1, 1)], ["white", R(1 / 3, 1 / 3, 2 / 3, 2 / 3)]],
  Q: [["yellow", R(0, 0, 1, 1)]],
  R: [["red", R(0, 0, 1, 1)], ["yellow", R(0.4, 0, 0.6, 1)], ["yellow", R(0, 0.4, 1, 0.6)]],
  S: [["white", R(0, 0, 1, 1)], ["blue", R(1 / 3, 1 / 3, 2 / 3, 2 / 3)]],
  T: [["red", R(0, 0, 1 / 3, 1)], ["white", R(1 / 3, 0, 2 / 3, 1)], ["blue", R(2 / 3, 0, 1, 1)]],
  U: [["red", R(0, 0, 0.5, 0.5)], ["white", R(0.5, 0, 1, 0.5)], ["white", R(0, 0.5, 0.5, 1)], ["red", R(0.5, 0.5, 1, 1)]],
  V: [["white", R(0, 0, 1, 1)], ["red", { clip: saltire(0.16) }], ["red", { clip: saltire(0.16).map(([u, v]) => [1 - u, v]) }]],
  W: [["blue", R(0, 0, 1, 1)], ["white", R(1 / 6, 1 / 6, 5 / 6, 5 / 6)], ["red", R(1 / 3, 1 / 3, 2 / 3, 2 / 3)]],
  X: [["white", R(0, 0, 1, 1)], ["blue", R(0.4, 0, 0.6, 1)], ["blue", R(0, 0.4, 1, 0.6)]],
  Y: Array.from({ length: 10 }, (_, i) => [i % 2 ? "red" : "yellow", { clip: band(i * 0.2, (i + 1) * 0.2) }]),
  Z: [["yellow", [[0, 0], [1, 0], [0.5, 0.5]]], ["blue", [[1, 0], [1, 1], [0.5, 0.5]]], ["red", [[1, 1], [0, 1], [0.5, 0.5]]], ["black", [[0, 1], [0, 0], [0.5, 0.5]]]],
  // numeral pennants: the same kind of shapes, cut to a pennant's taper
  1: [["white", R(0, 0, 1, 1)], ["red", disc(0.28, 0.5, 0.26)]],
  2: [["blue", R(0, 0, 1, 1)], ["white", disc(0.28, 0.5, 0.26)]],
  3: [["red", R(0, 0, 1 / 3, 1)], ["white", R(1 / 3, 0, 2 / 3, 1)], ["blue", R(2 / 3, 0, 1, 1)]],
  4: [["red", R(0, 0, 1, 1)], ["white", R(0.24, 0, 0.38, 1)], ["white", R(0, 0.4, 1, 0.6)]],
  5: [["yellow", R(0, 0, 0.5, 1)], ["blue", R(0.5, 0, 1, 1)]],
  6: [["black", R(0, 0, 1, 0.5)], ["white", R(0, 0.5, 1, 1)]],
  7: [["yellow", R(0, 0, 1, 0.5)], ["red", R(0, 0.5, 1, 1)]],
  8: [["white", R(0, 0, 1, 1)], ["red", R(0.24, 0, 0.38, 1)], ["red", R(0, 0.4, 1, 0.6)]],
  9: [["white", R(0, 0, 0.5, 0.5)], ["black", R(0.5, 0, 1, 0.5)], ["red", R(0, 0.5, 0.5, 1)], ["yellow", R(0.5, 0.5, 1, 1)]],
  0: [["yellow", R(0, 0, 1 / 3, 1)], ["red", R(1 / 3, 0, 2 / 3, 1)], ["yellow", R(2 / 3, 0, 1, 1)]],
};
const PENNANT = [[0, 0], [1, 0.36], [1, 0.64], [0, 1]];
function drawFlag(ch, x, y, h, o, pn) {
  const pennant = /[0-9]/.test(ch), w = pennant ? 1.9 * h : 1.25 * h, map = ([u, v]) => [x + u * w, y + v * h];
  const outline = pennant ? PENNANT : R(0, 0, 1, 1);
  for (const [colour, shape] of FLAGS[ch]) {
    let poly;
    if (shape.disc) { const [u, v, r] = shape.disc; poly = ellipse(x + u * w, y + v * h, r * h, r * h, 0, 36); }
    else { poly = clip(shape.clip || shape, outline); if (!poly) continue; poly = poly.map(map); }
    pn.add({ outline: [[poly, true]], ...colourFill(o, poly, colour) }, [poly]);
  }
  pn.add({ outline: [[outline.map(map), true]] });
  return w;
}

// ---------------- semaphore ----------------
// Arm directions as the reader sees the signaller: 0 down, then round through down-left, left, up-left, up, up-right, right, down-right.
const DIRS = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]].map(([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; });
const SEMA = {
  A: [0, 1], B: [0, 2], C: [0, 3], D: [0, 4], E: [0, 5], F: [0, 6], G: [0, 7],
  H: [1, 2], I: [1, 3], K: [1, 4], L: [1, 5], M: [1, 6], N: [1, 7],
  O: [2, 3], P: [2, 4], Q: [2, 5], R: [2, 6], S: [2, 7],
  T: [3, 4], U: [3, 5], Y: [3, 6], J: [4, 6], V: [4, 7], W: [5, 6], X: [5, 7], Z: [6, 7],
  "#": [4, 5],   // numeral sign; the letters sign is J
};
const SEMA_DIGIT = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H", 9: "I", 0: "K" };
function drawSemaphore(ch, x, y, h, o, L) {
  const s = h, w = 0.9 * h, cx = x + w / 2, sh = [cx, y + 0.3 * s], arm = 0.3 * s, f = 0.15 * s;
  L.outline.push([ellipse(cx, y + 0.19 * s, 0.07 * s, 0.07 * s, 0, 20), true], [[[cx, y + 0.26 * s], [cx, y + 0.62 * s]], false], [[[cx - 0.12 * s, y + 0.95 * s], [cx, y + 0.62 * s], [cx + 0.12 * s, y + 0.95 * s]], false]);
  for (const di of SEMA[ch]) {
    const [dx, dy] = DIRS[di], hand = [sh[0] + dx * arm, sh[1] + dy * arm], tip = [hand[0] + dx * 0.05 * s, hand[1] + dy * 0.05 * s];
    const n = dx > 0.1 || (Math.abs(dx) <= 0.1 && dy < 0) ? [dy, -dx] : [-dy, dx];   // the flag flies on the upper side of the pole
    const a = tip, b = [tip[0] + dx * f, tip[1] + dy * f], c = [b[0] + n[0] * f, b[1] + n[1] * f], d = [a[0] + n[0] * f, a[1] + n[1] * f];
    L.outline.push([[sh, tip], false], [[a, b, c, d], true], [[a, c], false]);
    // the semaphore flag: red and yellow halves on the diagonal
    for (const [colour, tri] of [["red", [a, c, d]], ["yellow", [a, b, c]]]) for (const [k, v] of Object.entries(colourFill(o, tri, colour))) L[k].push(...v);
  }
  return w;
}

// ---------------- ogham ----------------
const OGHAM = { B: ["b", 1], L: ["b", 2], F: ["b", 3], S: ["b", 4], N: ["b", 5], H: ["h", 1], D: ["h", 2], T: ["h", 3], C: ["h", 4], Q: ["h", 5], M: ["m", 1], G: ["m", 2], "ŋ": ["m", 3], Z: ["m", 4], R: ["m", 5], A: ["v", 1], O: ["v", 2], U: ["v", 3], E: ["v", 4], I: ["v", 5] };
const OGHAM_SUB = { K: "C", V: "F", W: "U", J: "I", Y: "I", P: "B", X: "CS" };
function drawOgham(ch, x, y, h, o, L) {
  const [grp, n] = OGHAM[ch], sp = 0.18 * h, len = 0.42 * h, cy = y + h / 2;
  for (let k = 0; k < n; k++) {
    const sx = x + sp * (k + 0.75);
    if (grp === "b") L.outline.push([[[sx, cy], [sx, cy + len]], false]);
    else if (grp === "h") L.outline.push([[[sx, cy], [sx, cy - len]], false]);
    else if (grp === "m") L.outline.push([[[sx - 0.35 * len, cy - len], [sx + 0.35 * len, cy + len]], false]);
    else L.outline.push([[[sx, cy - 0.3 * len], [sx, cy + 0.3 * len]], false]);
  }
}

// ---------------- braille and tap code ----------------
const BRAILLE = { A: "1", B: "12", C: "14", D: "145", E: "15", F: "124", G: "1245", H: "125", I: "24", J: "245", K: "13", L: "123", M: "134", N: "1345", O: "135", P: "1234", Q: "12345", R: "1235", S: "234", T: "2345", U: "136", V: "1236", W: "2456", X: "1346", Y: "13456", Z: "1356", "#": "3456", ".": "256", "?": "236" };
const BRAILLE_DIGIT = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H", 9: "I", 0: "J" };
function drawBraille(ch, x, y, h, o, L) {
  const d = h / 3.2, r = d * 0.3, on = BRAILLE[ch];
  for (let k = 1; k <= 6; k++) {
    const cx = x + d * (k > 3 ? 1.5 : 0.5), cy = y + d * (0.5 + ((k - 1) % 3)) + 0.1 * h;
    if (on.includes(String(k))) { const c = ellipse(cx, cy, r, r, 0, 20); L.outline.push([c, true]); L.hatch.push(...fillConvex(c, "spiral", Math.max(0.5, o.pitch * 0.8), 0, 1)); }
    else if (o.ghost === "on") L.outline.push([ellipse(cx, cy, 0.08 * d, 0.08 * d, 0, 8), true]);
  }
}
const TAP = ["ABCDE", "FGHIJ", "LMNOP", "QRSTU", "VWXYZ"];
function drawTap(ch, x, y, h, o, L) {
  const c = ch === "K" ? "C" : ch, row = TAP.findIndex(r => r.includes(c)) + 1, col = TAP[row - 1].indexOf(c) + 1, d = h / 5.4, r = d * 0.32;
  // two columns of knocks: the row, then the column, read top down
  [row, col].forEach((n, g) => { for (let k = 0; k < n; k++) { const e = ellipse(x + d * (0.5 + g * 1.4), y + d * (0.5 + k), r, r, 0, 16); L.outline.push([e, true]); L.hatch.push(...fillConvex(e, "spiral", 0.5, 0, 1)); } });
}

// ---------------- message to glyph tokens ----------------
export const ALPHABETS = {
  flags: { name: "International Code of Signals", ratio: 1.25, carries: c => /[A-Z0-9]/.test(c) },
  semaphore: { name: "flag semaphore", ratio: 0.9, draw: drawSemaphore, carries: c => /[A-Z0-9]/.test(c) },
  ogham: { name: "ogham", ratio: 0.6, draw: drawOgham, carries: c => /[A-Z]/.test(c) },
  braille: { name: "braille shapes", ratio: 0.62, draw: drawBraille, carries: c => /[A-Z0-9.?]/.test(c) },
  tap: { name: "tap code", ratio: 0.45, draw: drawTap, carries: c => /[A-Z]/.test(c) },
};
// Text to tokens: each token is one glyph with the letter it stands for (label) and its id (what is drawn).
function tokens(o, text) {
  const words = text.split(" ").filter(Boolean), out = [], notes = [];
  for (const word of words) {
    const t = []; let numeric = false;
    for (const ch of word) {
      if (o.alpha === "ogham" && OGHAM_SUB[ch]) { notes.push(`${ch} written as ${OGHAM_SUB[ch]} (ogham has no ${ch})`); for (const c of OGHAM_SUB[ch]) t.push({ id: c, label: ch }); continue; }
      if (!ALPHABETS[o.alpha].carries(ch)) { notes.push(`${ch} left out`); continue; }
      if (o.alpha === "semaphore" && /[0-9]/.test(ch)) { if (!numeric) t.push({ id: "#", label: "#" }); numeric = true; t.push({ id: SEMA_DIGIT[ch], label: ch }); continue; }
      if (o.alpha === "semaphore" && numeric) { t.push({ id: "J", label: "abc" }); numeric = false; }
      if (o.alpha === "braille" && /[0-9]/.test(ch)) { if (!numeric) t.push({ id: "#", label: "#" }); numeric = true; t.push({ id: BRAILLE_DIGIT[ch], label: ch }); continue; }
      if (o.alpha === "braille") numeric = false;
      t.push({ id: ch, label: ch });
    }
    // ogham's NG is one letter
    if (o.alpha === "ogham") for (let i = 0; i + 1 < t.length; i++) if (t[i].id === "N" && t[i + 1].id === "G") t.splice(i, 2, { id: "ŋ", label: "NG" });
    if (t.length) out.push(t);
  }
  return { words: out, notes: [...new Set(notes)] };
}
// Read the drawn ids back to text, the way a reader with the chart would.
function readBack(o, words) {
  return words.map(w => {
    let s = "", numeric = false;
    for (const t of w) {
      if (t.id === "#") { numeric = true; continue; }
      if (o.alpha === "semaphore" && numeric && t.id === "J") { numeric = false; continue; }
      if (numeric && o.alpha === "semaphore") { s += Object.keys(SEMA_DIGIT).find(k => SEMA_DIGIT[k] === t.id); continue; }
      if (numeric && o.alpha === "braille" && /[A-J]/.test(t.id)) { s += Object.keys(BRAILLE_DIGIT).find(k => BRAILLE_DIGIT[k] === t.id); continue; }
      s += t.id === "ŋ" ? "NG" : t.id;
    }
    return s;
  }).join(" ");
}

// ---------------- build ----------------
export function build(o) {
  const t0 = performance.now(), [W, H] = o.page.split("x").map(Number), M = 14, L = { outline: [], hatch: [], red: [], blue: [], yellow: [], black: [], green: [], text: [] };
  const n = morse.normalize(o.msg), cip = o.cipher === "none" ? null : { kind: o.cipher, key: String(o.ckey || "") };
  const chart = o.layout === "chart";
  const text = chart ? (o.alpha === "ogham" ? "BLFSN HDTCQ MGNGZR AOUEI" : o.alpha === "tap" ? "ABCDE FGHIJ LMNOP QRSTU VWXYZ" : "ABCDEFG HIJKLMN OPQRSTU VWXYZ" + (/flags|semaphore|braille/.test(o.alpha) ? " 12345 67890" : "")) : cip ? encipher(n.text, cip) : n.text;
  const T = tokens(o, text);
  if (!T.words.length) return { W, H, ...L, o, error: "Nothing this alphabet can draw.", gates: [["the message makes glyphs", false, ""]], ms: 0, notes: T.notes };
  const cap = [], add = (s, h) => wrap(s, Math.max(4, Math.floor(((W - 2 * M) / h * 6 + 1.6) / ADV))).forEach(l => cap.push({ s: l, h }));
  if (o.caption === "message" && !chart) add(n.text, o.tsize);
  if (o.caption === "name") add(ALPHABETS[o.alpha].name.toUpperCase(), o.tsize * 0.7);
  const capH = cap.reduce((s, c) => s + c.h * 1.55, 0) + (cap.length ? o.tsize * 0.8 : 0);
  // with machine marks, glyphs sit on a regular grid of cells, so the key strip can say where every one is
  if ((o.marks === "on" || o.marks === "retro") && !chart) return gridBuild(o, T, L, W, H, cap, capH, cip, t0);
  const labels = o.labels === "on", lab = 0.3;   // label height as a share of glyph height
  const gw = t => (o.alpha === "flags" ? (/[0-9]/.test(t.id) ? 1.9 : 1.25) : o.alpha === "ogham" ? (OGHAM[t.id][1] * 0.18 + 0.18) : ALPHABETS[o.alpha].ratio);
  const gap = o.alpha === "ogham" ? 0.12 : 0.18, wordGap = o.alpha === "ogham" ? 0.5 : 0.6;
  const B = { x: M, y: M, w: W - 2 * M, h: H - 2 * M - capH };
  let rowsH;
  if (o.layout === "hoist" && o.alpha === "flags") {
    // one hoist per word, flags one above the other on a halyard, hoists side by side
    const colW = w => Math.max(...w.map(gw)) + (labels ? 0.9 : 0.5), colH = w => w.length * (1 + gap) + 0.4;
    const h = Math.min(o.gsize, B.w / T.words.reduce((s, w) => s + colW(w), 0), B.h / Math.max(...T.words.map(colH)));
    let x = B.x + (B.w - h * T.words.reduce((s, w) => s + colW(w), 0)) / 2;
    const pn = painter(h / 3), top = B.y + (B.h - h * Math.max(...T.words.map(colH))) / 2;
    for (const w of T.words) {
      const lx = x + 0.2 * h;
      L.outline.push([[[lx, top], [lx, top + h * colH(w)]], false], [ellipse(lx, top, 0.06 * h, 0.06 * h, 0, 12), true]);
      w.forEach((t, i) => { const y = top + 0.2 * h + i * (1 + gap) * h; drawFlag(t.id, lx, y, h, o, pn); if (labels && t.label !== "abc") drawText(t.label, lx + gw(t) * h + 0.3 * h, y + 0.35 * h, 0.3 * h, L.text); });
      x += colW(w) * h;
    }
    pn.resolve(L);
    rowsH = h;
  } else {
    // lines of words, wrapped to the page width, scaled to fit
    const wordW = w => w.reduce((s, t) => s + gw(t), 0) + gap * (w.length - 1);
    const lineW = l => l.reduce((s, w, i) => s + (i ? wordGap : 0) + wordW(w), 0);
    // a chart puts each group of the alphabet on its own line, so the glyphs stay large
    const layoutAt = h => { const out = []; let cur = []; for (const w of T.words) { if (cur.length && (chart || (lineW(cur) + wordGap + wordW(w)) * h > B.w)) { out.push(cur); cur = []; } cur.push(w); } if (cur.length) out.push(cur); return out; };
    const rowStep = 1 + (labels ? lab + 0.15 : 0) + 0.35;
    let h = o.gsize, lines = [];
    for (let k = 0; k < 80; k++) { lines = layoutAt(h); if (lines.length * rowStep * h <= B.h && lines.every(l => lineW(l) * h <= B.w + 1e-6)) break; h *= 0.95; }
    const pn = painter(h / 3), totalH = lines.length * rowStep * h - 0.35 * h;
    let y = B.y + (B.h - totalH) / 2;
    for (const line of lines) {
      let x = B.x + (B.w - lineW(line) * h) / 2;
      if (o.alpha === "ogham") {   // the stem runs under each word, with a feather at either end
        let sx = x;
        for (const w of line) { const ww = wordW(w) * h, cy = y + h / 2; L.outline.push([[[sx - 0.25 * h, cy], [sx + ww + 0.25 * h, cy]], false], [[[sx - 0.45 * h, cy - 0.15 * h], [sx - 0.25 * h, cy], [sx - 0.45 * h, cy + 0.15 * h]], false], [[[sx + ww + 0.45 * h, cy - 0.15 * h], [sx + ww + 0.25 * h, cy], [sx + ww + 0.45 * h, cy + 0.15 * h]], false]); sx += ww + wordGap * h; }
      }
      for (const w of line) {
        for (const t of w) {
          const gwmm = gw(t) * h;
          if (o.alpha === "flags") drawFlag(t.id, x, y, h, o, pn); else ALPHABETS[o.alpha].draw(t.id, x, y, h, o, L);
          if (labels && t.label !== "abc") drawText(t.label, x + gwmm / 2, y + h + 0.15 * h, lab * h, L.text);
          x += gwmm + gap * h;
        }
        x += (wordGap - gap) * h;
      }
      y += rowStep * h;
    }
    pn.resolve(L);
    rowsH = h;
  }
  let bottom = 0; for (const k of Object.keys(L)) for (const [p] of L[k]) for (const q of p) if (q[1] > bottom) bottom = q[1];
  let cy = bottom + (cap.length ? o.tsize * 0.8 : 0); for (const c of cap) { drawText(c.s, W / 2, cy, c.h, L.text); cy += c.h * 1.55; }
  const back = readBack(o, T.words), want = T.words.map(w => w.map(t => (t.label === "abc" || t.label === "#" ? "" : t.label)).join("")).join(" ");
  const inPage = Object.values(L).every(ps => ps.every(([p]) => p.every(([x, y]) => x >= 0.5 && y >= 0.5 && x <= W - 0.5 && y <= H - 0.5)));
  const gates = [["the chart reads the drawing back to the text", back === want, back === want ? `"${back.slice(0, 40)}"` : `read "${back.slice(0, 30)}" want "${want.slice(0, 30)}"`], ["everything fits the page", inPage, ""], ["glyphs at least 6 mm tall", rowsH >= 6, `${rowsH.toFixed(1)} mm`]];
  const notes = [...T.notes, ...(cip && !chart ? ["Classical ciphers are historical / puzzle ciphers, not modern security."] : []), ...(o.alpha === "braille" ? ["Braille shapes drawn with a pen are not tactile braille: raised dots need embossing."] : [])];
  return { W, H, ...L, o, gates, notes, how: HOW[o.alpha], points: Object.values(L).reduce((s, ps) => s + ps.reduce((a, [p]) => a + p.length, 0), 0), ms: performance.now() - t0 };
}
export const HOW = {
  flags: "International Code of Signals: one flag per letter, pennants for digits, read left to right (or top down on a hoist). Colours in black ink follow heraldry: vertical lines red, horizontal blue, dots yellow, crosshatch black, blank white.",
  semaphore: "Flag semaphore, drawn as the reader sees the signaller: each letter is a pair of arm positions. The numeral sign (arms up and up-right) turns A to I and K into 1 to 9 and 0; J turns letters back on.",
  ogham: "Ogham: strokes on a stem, read left to right from the feather. Below the stem B L F S N, above H D T C Q, slanting across M G NG Z R, short notches across A O U E I; one to five strokes each.",
  braille: "Braille cells: dots 1 2 3 down the left, 4 5 6 down the right. A number sign turns A to J into 1 to 9 and 0. Drawn shapes only, not tactile braille.",
  tap: "Tap code: letters on a 5 x 5 square (C and K share a place). Each letter is two columns of knocks, the row, then the column.",
};

// ---------------- machine marks: a regular grid of glyph cells ----------------
// Every cell holds one glyph or stays blank (a blank cell ends a word). Lines run left to right; on a hoist each word is
// a column hung top down. The key strip carries the grid (first cell, pitches, cells a line, lines) and the drawing
// settings, so the decoder can draw every glyph a cell might hold and see which one is there.
export const ALPHAS = ["flags", "semaphore", "ogham", "braille", "tap"], INKS = ["heraldic", "pens", "outline"], CIPHERS = ["none", "caesar", "keyword", "vigenere", "railfence", "route"];
const unitW = (alpha, wide) => ({ flags: wide ? 1.9 : 1.25, semaphore: 0.9, ogham: 1.08, braille: 0.62, tap: 0.45 })[alpha];
// the glyphs a cell may hold (the decoder's candidates); pennants only when the cells are wide enough for them
export function glyphIds(alpha, wide) {
  if (alpha === "flags") return [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ...(wide ? [..."1234567890"] : [])];
  if (alpha === "semaphore") return Object.keys(SEMA);
  if (alpha === "ogham") return Object.keys(OGHAM);
  if (alpha === "braille") return Object.keys(BRAILLE);
  return [...TAP.join("")];
}
function drawGlyph(o, id, x, y, h, L) {
  if (o.alpha === "flags") { const pn = painter(h / 3); drawFlag(id, x, y, h, o, pn); pn.resolve(L); }
  else ALPHABETS[o.alpha].draw(id, x, y, h, o, L);
}
const emptyL = () => ({ outline: [], hatch: [], red: [], blue: [], yellow: [], black: [], green: [], text: [], marks: [] });
// cell position: along a line (j) and which line (li); on a hoist lines are columns
const cellAt = (g, li, j) => (g.hoist ? [g.x0 + li * g.rowStep, g.y0 + j * g.cellW] : [g.x0 + j * g.cellW, g.y0 + li * g.rowStep]);
function gridBuild(o, T, L, W, H, cap, capH, cip, t0) {
  const retro = o.marks === "retro", M = retro ? 10 : MARK.margin, labels = o.labels === "on", hoist = o.layout === "hoist" && o.alpha === "flags";
  const wide = o.alpha === "flags" && T.words.some(w => w.some(t => /[0-9]/.test(t.id))), u = unitW(o.alpha, wide), gap = o.alpha === "ogham" ? 0.12 : 0.18;
  const B = { x: M, y: M, w: W - 2 * M, h: H - 2 * M - capH };
  let g, grid;
  for (let h = o.gsize; h > 2; h *= 0.96) {
    const hh = Math.floor(h * 10) / 10, cellW = Math.round((hoist ? 1 + gap : u + gap) * hh * 10) / 10, rowStep = Math.round((hoist ? u + (labels ? 0.9 : 0.5) : 1 + (labels ? 0.45 : 0) + 0.35) * hh * 10) / 10;
    // flow words into lines of `per` cells, a blank cell between words
    const per = hoist ? Math.max(...T.words.map(w => w.length)) : Math.max(1, Math.floor((B.w - u * hh) / cellW) + 1);
    const lines = []; let cur = [];
    for (const w0 of T.words) {
      let w = w0;
      if (hoist) { lines.push(w.slice()); continue; }
      while (w.length > per) { if (cur.length) { lines.push(cur); cur = []; } lines.push(w.slice(0, per)); w = w.slice(per); }
      if (cur.length && cur.length + 1 + w.length > per) { lines.push(cur); cur = []; }
      if (cur.length) cur.push(null);
      cur.push(...w);
    }
    if (cur.length) lines.push(cur);
    if (!hoist && per < Math.max(...T.words.map(w => w.length))) continue;   // a word split over two lines reads as two words
    const spanAlong = (per - 1) * cellW + (hoist ? hh : u * hh), spanAcross = (lines.length - 1) * rowStep + (hoist ? u * hh : hh);
    const fitsW = (hoist ? spanAcross : spanAlong) <= B.w, fitsH = (hoist ? spanAlong : spanAcross) <= B.h;
    if (fitsW && fitsH) {
      const x0 = Math.round((B.x + (B.w - (hoist ? spanAcross : spanAlong)) / 2) * 10) / 10, y0 = Math.round((B.y + (B.h - (hoist ? spanAlong : spanAcross)) / 2) * 10) / 10;
      g = { h: hh, cellW, rowStep, per, lines: lines.length, x0, y0, hoist, wide }; grid = lines; break;
    }
  }
  if (!g) return { W, H, ...L, o, error: "The message does not fit the page at any glyph size.", gates: [["the message fits", false, ""]], ms: 0, notes: T.notes };
  grid.forEach((line, li) => {
    // ogham: a stem under each run of letters, feathers at both ends; hoist: a halyard down each column
    if (o.alpha === "ogham") {
      for (let j = 0; j < line.length; j++) if (line[j] && (j === 0 || !line[j - 1])) {
        let k = j; while (k + 1 < line.length && line[k + 1]) k++;
        // feathers only at the ends of a line: one between words landed in the blank cell and read as a vowel notch
        const [xa, y] = cellAt(g, li, j), [xb] = cellAt(g, li, k), cy = y + g.h / 2, xe = xb + u * g.h;
        L.outline.push([[[xa - 0.1 * g.h, cy], [xe + 0.1 * g.h, cy]], false]);
        if (j === 0) L.outline.push([[[xa - 0.1 * g.h, cy], [xa - 0.3 * g.h, cy]], false], [[[xa - 0.5 * g.h, cy - 0.15 * g.h], [xa - 0.3 * g.h, cy], [xa - 0.5 * g.h, cy + 0.15 * g.h]], false]);
        // no end feather in grid mode: past the last letter it falls in the next cell and reads as a vowel notch
      }
    }
    if (g.hoist) { const [x, y] = cellAt(g, li, 0); L.outline.push([[[x, y - 0.2 * g.h], [x, y + line.length * g.cellW]], false], [ellipse(x, y - 0.2 * g.h, 0.06 * g.h, 0.06 * g.h, 0, 12), true]); }
    line.forEach((t, j) => {
      if (!t) return;
      const [x, y] = cellAt(g, li, j);
      drawGlyph(o, t.id, x, y, g.h, L);
      if (labels && t.label !== "abc") g.hoist ? drawText(t.label, x + u * g.h + 0.3 * g.h, y + 0.35 * g.h, 0.3 * g.h, L.text) : drawText(t.label, x + u * g.h / 2, y + g.h + 0.15 * g.h, 0.3 * g.h, L.text);
    });
  });
  let bottom = 0; for (const k of ["outline", "hatch", "red", "blue", "yellow", "black", "green", "text"]) for (const [p] of L[k]) for (const q of p) if (q[1] > bottom) bottom = q[1];
  let cy = bottom + (cap.length ? o.tsize * 0.8 : 0); for (const c of cap) { drawText(c.s, W / 2, cy, c.h, L.text); cy += c.h * 1.55; }
  const lay = retro ? LAYOUTS.retro : LAYOUTS.normal, drawn = ["outline", "hatch", "red", "blue", "yellow", "black", "green", "text"].flatMap(k => L[k]);
  const clear = marksClear(W, H, drawn, lay);
  drawMarks(W, H, packRecord(3, {
    alpha: ALPHAS.indexOf(o.alpha), hoist: g.hoist ? 1 : 0, ink: INKS.indexOf(o.ink), pitch: Math.round((o.pitch - 0.5) / 0.05), angle: Math.round(o.angle), x0: Math.round(g.x0 * 10), y0: Math.round(g.y0 * 10),
    h: Math.round(g.h * 10), cellW: Math.round(g.cellW * 10), rowStep: Math.round(g.rowStep * 10), per: g.per, lines: g.lines, page: PAGES.indexOf(o.page), cipher: CIPHERS.indexOf(o.cipher), ghost: o.ghost === "on" ? 1 : 0,
  }), L, lay);
  const words = [], back = readBack(o, T.words), want = T.words.map(w => w.map(t => (t.label === "abc" || t.label === "#" ? "" : t.label)).join("")).join(" ");
  const inPage = Object.values(L).every(ps => ps.every(([p]) => p.every(([x, y]) => x >= 0.5 && y >= 0.5 && x <= W - 0.5 && y <= H - 0.5)));
  const gates = [["the chart reads the drawing back to the text", back === want, back === want ? `"${back.slice(0, 40)}"` : `read "${back.slice(0, 30)}"`], ["everything fits the page", inPage, ""], ["glyphs at least 6 mm tall", g.h >= 6, `${g.h.toFixed(1)} mm`], clear];
  // coloured-pen hatching (0.4 mm pens) under 1 mm apart blurs solid in a phone photo, and the flags' colours stop reading
  if (o.ink === "pens" && o.alpha === "flags") gates.push(["pen-per-colour hatch at least 1 mm apart (so the camera can read it)", o.pitch >= 1 - 1e-9, `${o.pitch} mm`]);
  const notes = [...T.notes, ...(cip ? ["Classical ciphers are historical / puzzle ciphers, not modern security."] : []), ...(o.alpha === "braille" ? ["Braille shapes drawn with a pen are not tactile braille: raised dots need embossing."] : [])];
  return { W, H, ...L, o, gates, notes, how: HOW[o.alpha], grid: g, points: Object.values(L).reduce((s, ps) => s + ps.reduce((a, [p]) => a + p.length, 0), 0), ms: performance.now() - t0 };
}

// Key strip fields back to the grid, every cell's candidate drawings (blank first), and the text from read values.
export function readPlan(f) {
  const o = { alpha: ALPHAS[f.alpha], ink: INKS[f.ink] || "heraldic", pitch: Math.round((0.5 + f.pitch * 0.05) * 100) / 100, angle: f.angle, ghost: f.ghost ? "on" : "off", cipher: CIPHERS[f.cipher] || "none", page: PAGES[f.page], layout: f.hoist ? "hoist" : "lines" };
  const g = { h: f.h / 10, cellW: f.cellW / 10, rowStep: f.rowStep / 10, per: f.per, lines: f.lines, x0: f.x0 / 10, y0: f.y0 / 10, hoist: !!f.hoist };
  // pennants only if the cells were sized for them (along the line, or across it on a hoist)
  const wide = o.alpha === "flags" && (g.hoist ? g.rowStep >= 2.4 * g.h - 0.2 : g.cellW >= 2.08 * g.h - 0.2), ids = glyphIds(o.alpha, wide);
  const cells = [];
  for (let li = 0; li < g.lines; li++) for (let j = 0; j < g.per; j++) {
    const [x, y] = cellAt(g, li, j);
    cells.push({ li, j, cands: [[], ...ids.map(id => { const Lc = emptyL(); drawGlyph(o, id, x, y, g.h, Lc); return [...Lc.outline, ...Lc.hatch, ...Lc.red, ...Lc.blue, ...Lc.yellow, ...Lc.black, ...Lc.green]; })] });
  }
  return {
    o, cells, cipher: o.cipher,
    finish(values, cipherKey = "") {
      const words = []; let cur = [];
      values.forEach((v, i) => { if (i % g.per === 0 && cur.length) { words.push(cur); cur = []; } if (v === 0) { if (cur.length) { words.push(cur); cur = []; } } else cur.push({ id: ids[v - 1] }); });
      if (cur.length) words.push(cur);
      const text = readBack(o, words), plain = o.cipher !== "none" && cipherKey ? decipher(text, { kind: o.cipher, key: cipherKey }) : null;
      return { text, plain };
    },
  };
}
