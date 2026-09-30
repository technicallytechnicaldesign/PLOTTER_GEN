// Overlay studio: methods that need two sheets, a slide or a cut. The base sheet is plotted on paper; the second sheet
// is plotted on acetate or tracing paper (visual cryptography, moire) or cut from card on the Cricut (the grilles).
//   vcrypt    Naor and Shamir's visual cryptography (1994): each sheet alone is random speckle; stacked, the message shows
//   moire     a line screen whose lines jump half a pitch inside the letters; the plain overlay screen makes them dark
//   fleissner a turning grille: one cut card, read through its holes, turned a quarter clockwise, four times (pinned at the centre)
//   dial      a round grille on one pin, turned through 3 to 8 numbered stops, each stop showing the next part of the message
//   cardano   a field of letters and the grille that finds the few that matter
// Grilles are locked to the message: every hole at every turn shows a message letter or an end mark, never a decoy.
// Both sheets carry the same frame and corner crosses, so they register on the mat and on each other.
"use strict";
import { rect, ellipse, plen, simplify, drawText, wrap, svgOf, ADV, wireSettingsLoader, applySettings } from "./core.js";
import { PACKS } from "@utp/glyphs";
import * as morse from "@utp/morse";
import { encipher } from "@utp/ciphers";
import { rng } from "@utp/fabric";
import { scatterRoute } from "@utp/stego";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FREQ = "EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMMWWFFGGYYPPBVK";
const cipherOf = o => (o.cipher === "none" ? null : { kind: o.cipher, key: String(o.ckey || "") });
const textOf = o => { const n = morse.normalize(o.msg), c = cipherOf(o); return { plain: n.text, text: c ? encipher(n.text, c) : n.text, dropped: n.dropped }; };

// Words onto lines of at most `per` characters (long words split).
function lines(text, per) {
  const out = []; let cur = "";
  for (let w of text.split(" ").filter(Boolean)) {
    while (w.length > per) { if (cur) { out.push(cur); cur = ""; } out.push(w.slice(0, per)); w = w.slice(per); }
    if (cur && cur.length + 1 + w.length > per) { out.push(cur); cur = ""; }
    cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
// The message as a bitmap in UTP's 5 x 5 pixel alphabet, one blank pixel between letters and lines. Rows top first.
function bitmap(text, per) {
  const L = lines(text, per), g = PACKS.pixel5.glyphs, w = Math.max(1, ...L.map(l => l.length)) * 6 - 1, h = L.length * 6 - 1;
  const px = Array.from({ length: h }, () => new Array(w).fill(0));
  L.forEach((line, li) => [...line].forEach((ch, i) => { const G = g[ch]; if (G) for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) px[li * 6 + 4 - r][i * 6 + c] = G[r][c]; }));
  return { w, h, get: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? px[y][x] : 0) };
}
// A square the pen fills solid: concentric squares under the pen's 0.4 mm, and a cross where the smallest one stops.
function solid(x, y, s, out) {
  for (let d = 0; d < s / 2 - 0.1; d += 0.38) out.push([rect(x + d, y + d, s - 2 * d, s - 2 * d), true]);
  out.push([[[x + s / 2 - 0.2, y + s / 2], [x + s / 2 + 0.2, y + s / 2]], false]);
}
function solidDot(x, y, r, out) { for (let q = r; q > 0.05; q -= 0.35) out.push([ellipse(x, y, q, q, 0, 16), true]); }
function registration(box, both) {   // frame and four corner crosses, drawn the same on every sheet
  const [x0, y0, x1, y1] = box, c = 3, e = 5;
  const paths = [[rect(x0, y0, x1 - x0, y1 - y0), true]];
  for (const [x, y] of [[x0 - e, y0 - e], [x1 + e, y0 - e], [x1 + e, y1 + e], [x0 - e, y1 + e]]) paths.push([[[x - c, y], [x + c, y]], false], [[[x, y - c], [x, y + c]], false]);
  for (const L of both) L.push(...paths.map(([p, cl]) => [p.map(q => [...q]), cl]));
}

// ---------------- the four methods ----------------
function vcrypt(o, T, B, L) {
  const bm = bitmap(T.text, o.per), pad = 2, W = bm.w + 2 * pad, H = bm.h + 2 * pad;
  const u = Math.floor(Math.min(o.cell, B.w / (2 * W + 2), B.h / (2 * H + 2)) * 100) / 100, x0 = B.x + (B.w - 2 * W * u) / 2, y0 = B.y + (B.h - 2 * H * u) / 2;
  // two black subpixels out of four, in one of six patterns; the second sheet repeats the pattern (white) or inverts it (black)
  const PAT = [[1, 1, 0, 0], [0, 0, 1, 1], [1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0]], rnd = rng(o.seed * 101 + 13);
  let bad = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = PAT[Math.floor(rnd() * 6)], black = bm.get(x - pad, y - pad), q = black ? p.map(v => 1 - v) : p;
    const stacked = p.reduce((s, v, i) => s + (v | q[i]), 0); if (stacked !== (black ? 4 : 2)) bad++;
    // inset by half the 0.4 mm pen, so the ink covers exactly its subpixel: overdraw would darken the grey half and eat the contrast
    const sub = (v, i, out) => { const sx = x0 + (2 * x + (i % 2)) * u, sy = y0 + (2 * y + (i >> 1)) * u; if (v) o.mark === "dots" ? solidDot(sx + u / 2, sy + u / 2, u / 2 - 0.2, out) : solid(sx + 0.2, sy + 0.2, u - 0.4, out); };
    p.forEach((v, i) => sub(v, i, L.outline));
    q.forEach((v, i) => sub(v, i, L.overlay));
  }
  registration([x0 - u, y0 - u, x0 + 2 * W * u + u, y0 + 2 * H * u + u], [L.outline, L.overlay]);
  return { dims: `${W}X${H}`, feature: u, gates: [["stacked, every message pixel is 4 of 4 black and every other pixel 2 of 4", bad === 0, `${W * H} pixels, ${bad} wrong`], ["subpixels at least 0.8 mm (the pen can fill them)", u >= 0.8, `${u.toFixed(2)} mm`]], read: T.text, want: T.text };
}

function moire(o, T, B, L) {
  const bm = bitmap(T.text, o.per), m = 2, q = Math.min(B.w / (bm.w + 2 * m), B.h / (bm.h + 2 * m), 7), p = o.pitch;
  const bx = B.x + (B.w - (bm.w + 2 * m) * q) / 2 + m * q, by = B.y + (B.h - (bm.h + 2 * m) * q) / 2 + m * q;
  const box = [bx - m * q, by - m * q, bx + (bm.w + m) * q, by + (bm.h + m) * q], rnd = rng(o.seed * 7 + 3);
  const inside = (x, y) => bm.get(Math.floor((x - bx) / q), Math.floor((y - by) / q));
  const shape = x => (o.wave === "on" ? 0.35 * q * Math.sin(2 * Math.PI * (x - box[0]) / (2.3 * q)) : 0);
  // camouflage: short random jumps outside the letters, so the base sheet alone shows only nervous lines
  const camo = [];
  for (let k = 0, n = Math.round(o.noise * (box[3] - box[1]) / p); k < n; k++) camo.push([box[0] + rnd() * (box[2] - box[0]), box[1] + rnd() * (box[3] - box[1]), 1 + rnd() * q * 0.6]);
  const jumped = (x, y) => inside(x, y) || camo.some(([cx, cy, len]) => Math.abs(y - cy) < p * 0.5 && x >= cx && x <= cx + len);
  for (let y = box[1] + p / 2; y < box[3]; y += p) {
    const base = [], over = []; let prev = null;
    for (let x = box[0]; x <= box[2] + 1e-9; x += 0.25) {
      const s = jumped(x, y) ? p / 2 : 0, yy = y + shape(x);
      if (prev !== null && s !== prev) base.push([x, y + shape(x) + prev]);
      base.push([x, yy + s]); over.push([x, yy]); prev = s;
    }
    L.outline.push([simplify(base, 0.01), false]); L.overlay.push([simplify(over, 0.01), false]);
  }
  registration(box, [L.outline, L.overlay]);
  return { dims: `${bm.w}X${bm.h}.${p}`, feature: q, gates: [["letter pixels span at least three lines of the screen", q >= 3 * p, `${(q / p).toFixed(1)} lines per pixel`]], read: T.text, want: T.text };
}

// A turning grille is locked to its message: exactly ceil(letters / turns) holes, so every hole in every turn shows a message
// letter. Spare cells hold decoys no hole ever opens, and when the letters do not divide evenly the last few holes show an
// end mark (a small diamond), never a decoy letter.
const END = "·";
const endMark = (x, y, d, out) => out.push([[[x, y - d], [x + d, y], [x, y + d], [x - d, y]], true]);
const shuffled = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rot = ([x, y], [cx, cy], a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };

// Fleissner: every cell of an N x N square belongs to one ring of four (its quarter turns); a hole opens one of the four.
function fleissner(o, T, B, L) {
  const text = T.text.replace(/ /g, ""), n = text.length, K = Math.ceil(n / 4), pin = o.pivot === "pin", rnd = rng(o.seed * 17 + 5);
  const Nfit = Math.max(4, 2 * Math.ceil(Math.sqrt(K + (pin ? 1 : 0)))), N = Math.max(Nfit, o.gsize % 2 ? o.gsize + 1 : o.gsize);
  const turn = ([r, c]) => [c, N - 1 - r], m = N / 2;
  // one representative per ring of four; with a pin through the centre, the four middle cells stay shut so the pin hole has card round it
  const reps = []; for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) if (!(pin && r === m - 1 && c === m - 1)) reps.push([r, c]);
  const holes = shuffled(reps, rnd).slice(0, K).map(cell => { const k = Math.floor(rnd() * 4); for (let t = 0; t < k; t++) cell = turn(cell); return cell; });
  const field = Array.from({ length: N * N }, () => FREQ[Math.floor(rnd() * FREQ.length)]), order = [];
  let h = holes.map(x => [...x]);
  for (let t = 0; t < 4; t++) { h.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([r, c]) => order.push(r * N + c)); h = h.map(turn); }
  order.forEach((p, i) => (field[p] = i < n ? text[i] : END));
  const shown = order.map(p => field[p]), reads = [0, 1, 2, 3].map(t => shown.slice(t * K, (t + 1) * K).join(""));
  const clean = new Set(order).size === order.length && shown.every((ch, i) => (i < n ? ch === text[i] : ch === END));
  const res = grilleSheets(o, B, L, N, N, field, holes.map(([r, c]) => r * N + c), "turn", {
    dims: `${N}X${N}`, read: shown.filter(ch => ch !== END).join(""), want: text, reads, step: 90, positions: 4,
    fit: `${N} x ${N} grid (smallest for ${n} letters: ${Nfit} x ${Nfit}), ${K} holes, ${N * N - 4 * K} decoy cells never opened`,
    gates: [["every hole in every turn shows a message letter or an end mark, never a decoy", clean, `${K} holes x 4 turns, ${4 * K - n} end marks`]],
  });
  if (pin) {
    const [cx, cy] = res.pivot, s = res.cell, clear = Math.min(...res.cut.holes.flat().map(([x, y]) => Math.hypot(x - cx, y - cy))) - 1;
    res.cut.pin = ellipse(cx, cy, 1, 1, 0, 24); L.overlay.push([res.cut.pin, true]);
    L.outline.push([ellipse(cx, cy, 1, 1, 0, 24), true], [[[cx - 2.2, cy], [cx + 2.2, cy]], false], [[[cx, cy - 2.2], [cx, cy + 2.2]], false]);
    // turn numbers round the frame: the notch points at the number of the turn being read
    const [bx0, by0] = res.box, hh = Math.min(4, Math.max(2.5, 0.35 * s)), p0 = [bx0 + 0.45 * s, by0 - 1.5 - hh / 2];
    for (let t = 0; t < 4; t++) { const [x, y] = rot(p0, res.pivot, t * Math.PI / 2); drawText(String(t + 1), x, y - hh / 2, hh, L.outline); }
    res.gates.push(["the pin hole has at least 1 mm of card round it", clear >= 1, `${clear.toFixed(2)} mm`]);
  }
  return res;
}
// A dial grille: a round card on one pin through its centre, turned to P marked positions; every position shows the next part.
function dial(o, T, B, L) {
  const text = T.text.replace(/ /g, ""), n = text.length, P = Math.round(o.turns), K = Math.ceil(n / P), rnd = rng(o.seed * 31 + 11);
  const lab = 3.5, Rd = Math.min(B.w, B.h) / 2 - 11, cx = B.x + B.w / 2, cy = B.y + B.h / 2, Rin = Math.max(5, 0.14 * Rd);
  let rings = Math.round(o.rings), s, ring;
  for (;; rings++) {   // rings is a minimum: add rings until there are enough window places for the message
    s = (Rd - 1.5 - Rin) / rings;
    ring = Array.from({ length: rings }, (_, i) => { const r = Rin + (i + 0.5) * s; return { r, m: Math.max(1, Math.floor(2 * Math.PI * r / (P * s))) }; });
    if (ring.reduce((a, g) => a + g.m, 0) >= K || rings > 30) break;
  }
  const ang = (i, idx) => -Math.PI / 2 + (idx + 0.5) * 2 * Math.PI / (P * ring[i].m), at = (i, idx) => [cx + ring[i].r * Math.cos(ang(i, idx)), cy + ring[i].r * Math.sin(ang(i, idx))];
  const reps = []; ring.forEach((g, i) => { for (let j = 0; j < g.m; j++) reps.push([i, j]); });
  // each window sits at a random one of its P places; the reading order is the card's own: clockwise from the pointer, outer ring first
  const wins = shuffled(reps, rnd).slice(0, K).map(([i, j]) => [i, j + Math.floor(rnd() * P) * ring[i].m])
    .sort((a, b) => (a[1] + 0.5) / (P * ring[a[0]].m) - (b[1] + 0.5) / (P * ring[b[0]].m) || b[0] - a[0]);
  const field = ring.map(g => Array.from({ length: P * g.m }, () => FREQ[Math.floor(rnd() * FREQ.length)])), order = [];
  for (let t = 0; t < P; t++) for (const [i, a] of wins) order.push([i, (a + t * ring[i].m) % (P * ring[i].m)]);
  order.forEach(([i, idx], k) => (field[i][idx] = k < n ? text[k] : END));
  const shown = order.map(([i, idx]) => field[i][idx]), reads = Array.from({ length: P }, (_, t) => shown.slice(t * K, (t + 1) * K).join(""));
  const clean = new Set(order.map(q => q.join(":"))).size === order.length && shown.every((ch, k) => (k < n ? ch === text[k] : ch === END));
  // the paper: letters upright on their rings, the pin mark, the disc's edge and a numbered tick for every position
  const h = Math.min(0.55 * s, 9);
  ring.forEach((g, i) => field[i].forEach((ch, idx) => { const [x, y] = at(i, idx); if (ch === END) endMark(x, y, 0.18 * s, L.outline); else drawText(ch, x, y - h / 2, h, L.outline); }));
  L.outline.push([ellipse(cx, cy, Rd, Rd, 0, 180), true], [ellipse(cx, cy, 1, 1, 0, 24), true], [[[cx - 2.2, cy], [cx + 2.2, cy]], false], [[[cx, cy - 2.2], [cx, cy + 2.2]], false]);
  for (let t = 0; t < P; t++) {
    const a = -Math.PI / 2 + t * 2 * Math.PI / P, u = [Math.cos(a), Math.sin(a)];
    L.outline.push([[[cx + u[0] * (Rd + 1), cy + u[1] * (Rd + 1)], [cx + u[0] * (Rd + 4), cy + u[1] * (Rd + 4)]], false]);
    drawText(String(t + 1), cx + u[0] * (Rd + 7.5), cy + u[1] * (Rd + 7.5) - lab / 2, lab, L.outline);
  }
  // the card: a disc with a pointer tab at the top, a pin hole, and the windows
  const beta = 2.6 / Rd, disc = [[cx, cy - Rd - 3.4]];
  for (let k = 0; k <= 200; k++) { const a = -Math.PI / 2 + beta + k * (2 * Math.PI - 2 * beta) / 200; disc.push([cx + Rd * Math.cos(a), cy + Rd * Math.sin(a)]); }
  const holes = wins.map(([i, a]) => {
    const g = ring[i], th = ang(i, a), half = Math.min(0.42 * 2 * Math.PI / (P * g.m), 0.42 * s / g.r), r0 = g.r - 0.42 * s, r1 = g.r + 0.42 * s, arc = [];
    for (let k = 0; k <= 8; k++) { const q = th - half + 2 * half * k / 8; arc.push([cx + r1 * Math.cos(q), cy + r1 * Math.sin(q)]); }
    for (let k = 8; k >= 0; k--) { const q = th - half + 2 * half * k / 8; arc.push([cx + r0 * Math.cos(q), cy + r0 * Math.sin(q)]); }
    return arc;
  });
  const pinHole = ellipse(cx, cy, 1, 1, 0, 24);
  L.overlay.push([disc, true], [pinHole, true], ...holes.map(p => [p, true]));
  return {
    dims: `${P}P${rings}R`, feature: h, read: shown.filter(ch => ch !== END).join(""), want: text, reads, step: 360 / P, positions: P, pivot: [cx, cy],
    cut: { outline: disc, holes, pin: pinHole }, fit: `${rings} rings, ${reps.length} window places, ${K} windows, ${P} positions`,
    gates: [["every window in every position shows a message letter or an end mark, never a decoy", clean, `${K} windows x ${P} positions, ${P * K - n} end marks`],
      ["letters at least 2.5 mm tall", h >= 2.5, `${h.toFixed(1)} mm`]],
  };
}
function cardano(o, T, B, L) {
  const text = T.text.replace(/ /g, ""), cells = Math.ceil(text.length * Math.max(2, +o.density)), C = Math.max(6, o.gsize), R = Math.max(Math.ceil(cells / C), Math.round(C * 0.6));
  const holes = scatterRoute(o.seed, text.length, C * R).slice().sort((a, b) => a - b), rnd = rng(o.seed * 7 + 29), field = Array.from({ length: C * R }, () => FREQ[Math.floor(rnd() * FREQ.length)]);
  holes.forEach((p, i) => (field[p] = text[i]));
  return grilleSheets(o, B, L, C, R, field, holes, false, { dims: `${C}X${R}`, read: holes.map(p => field[p]).join(""), want: text, gates: [] });
}
// The letter field on the base sheet; the card with its holes on the cut sheet, same frame and crosses on both.
function grilleSheets(o, B, L, C, R, field, holes, turning, res) {
  const s = Math.min(B.w / (C + 3), B.h / (R + 3)), x0 = B.x + (B.w - C * s) / 2, y0 = B.y + (B.h - R * s) / 2, h = 0.58 * s;
  field.forEach((ch, p) => { const x = x0 + (p % C + 0.5) * s, y = y0 + Math.floor(p / C) * s; if (ch === END) endMark(x, y + s / 2, 0.18 * s, L.outline); else drawText(ch, x, y + (s - h) / 2, h, L.outline); });
  const box = [x0 - 0.4 * s, y0 - 0.4 * s, x0 + (C + 0.4) * s, y0 + (R + 0.4) * s];
  registration(box, [L.outline, L.overlay]);
  const cut = holes.map(p => rect(x0 + (p % C + 0.08) * s, y0 + (Math.floor(p / C) + 0.08) * s, 0.84 * s, 0.84 * s));
  for (const p of cut) L.overlay.push([p, true]);
  // turning grille: a notch marks the corner that starts at top left; turn the card a quarter clockwise after each reading
  if (turning) L.overlay.push([[[box[0] + 0.6 * s, box[1] + 0.25 * s], [box[0] + 0.25 * s, box[1] + 0.25 * s], [box[0] + 0.25 * s, box[1] + 0.6 * s]], true]);
  return { ...res, feature: h, cell: s, box, pivot: [x0 + C * s / 2, y0 + R * s / 2], cut: { outline: rect(box[0], box[1], box[2] - box[0], box[3] - box[1]), holes: cut } };
}

const METHODS = { vcrypt, moire, fleissner, dial, cardano };
// How the second sheet moves in the preview: the clear sheets slide (moire lines run across, so it slides up and down), the grilles turn on their pivot.
const MOTION = { vcrypt: "x", moire: "y", cardano: "x", fleissner: "turn", dial: "turn" };
const HOW = {
  vcrypt: "Visual cryptography: each sheet alone is random speckle, provably without the message. Lay the clear sheet on the paper, crosses on crosses: every message pixel turns fully black, everything else stays half grey. It reads best from arm's length.",
  moire: "A moire reveal: the base lines jump half a pitch inside the letters. Lay the clear line screen on top, crosses on crosses, and the letters go dark; slide it half a line up or down and they go light.",
  fleissner: "A Fleissner turning grille: pin the card through the centre with the notch at top left (by the 1) and read the holes left to right, top to bottom. Turn it a quarter clockwise, so the notch points at the next number, and read again, four times. A small diamond means the message has ended.",
  dial: "A dial grille: pin the round card through the centre of the paper with its pointer on 1, and read the windows clockwise from the pointer, outer ring first where two line up. Turn it to 2 and read on, and so on round the dial: each position shows the next part of the message. A small diamond means the message has ended.",
  cardano: "A Cardano grille: lay the card on the letters, crosses on crosses, and read the letters showing through, left to right, top to bottom.",
};
const SECOND = { vcrypt: "overlay", moire: "overlay", fleissner: "grille-cut", dial: "grille-cut", cardano: "grille-cut" };

// ---------------- build ----------------
const $ = id => document.getElementById(id);
const IDS = ["msg", "cipher", "ckey", "method", "per", "cell", "mark", "pitch", "wave", "noise", "gsize", "pivot", "turns", "rings", "density", "seed", "caption", "tsize", "tpen", "opcol", "page", "view", "slide", "turn"];
const read = () => Object.fromEntries(IDS.map(k => [k, $(k).type === "range" ? +$(k).value : $(k).value]));
let last = null;
function build(o) {
  const t0 = performance.now(), [W, H] = o.page.split("x").map(Number), M = 14, L = { outline: [], overlay: [], text: [] };
  let T, res;
  try {
    T = textOf(o); if (!T.text.trim()) throw new Error("Nothing to hide: the message has no letters or digits.");
    const key = `PLG1-${{ vcrypt: "VC", moire: "MO", fleissner: "FL", dial: "DG", cardano: "CG" }[o.method]}-S${o.seed}`;
    const cap = [], add = (s, h) => wrap(s, Math.max(4, Math.floor(((W - 2 * M) / h * 6 + 1.6) / ADV))).forEach(l => cap.push({ s: l, h }));
    if (o.caption === "message") add(T.plain, o.tsize); if (o.caption === "key") add("KEY " + key, Math.max(2.5, o.tsize * 0.5));
    const capH = cap.reduce((s, c) => s + c.h * 1.55, 0) + (cap.length ? o.tsize * 0.8 : 0);
    res = METHODS[o.method](o, T, { x: M, y: M, w: W - 2 * M, h: H - 2 * M - capH }, L);
    let bottom = 0; for (const [p] of [...L.outline, ...L.overlay]) for (const q of p) bottom = Math.max(bottom, q[1]);
    let y = bottom + (cap.length ? o.tsize * 0.8 : 0); for (const c of cap) { drawText(c.s, W / 2, y, c.h, L.text); y += c.h * 1.55; }
    res.key = key;
  } catch (err) { return { W, H, ...L, o, error: err instanceof Error ? err.message : String(err), gates: [["the settings make two sheets", false, String(err.message || err)]], ms: performance.now() - t0 }; }
  const inPage = [...L.outline, ...L.overlay, ...L.text].every(([p]) => p.every(([x, y]) => x >= 0.5 && y >= 0.5 && x <= W - 0.5 && y <= H - 0.5));
  const ok = res.read === res.want;
  const gates = [["reading the sheets as described gives the message back", ok, ok ? `"${res.read.slice(0, 40)}"` : `read "${res.read.slice(0, 30)}"`], ...res.gates, ["both sheets fit the page", inPage, ""]];
  const notes = T.dropped.length ? [`Left out (the pixel alphabet has no shape for them): ${[...new Set(T.dropped.map(d => d.char))].join(" ")}`] : [];
  if (o.cipher !== "none") notes.push("Classical ciphers are historical / puzzle ciphers, not modern security.");
  return { W, H, ...L, o, res, key: res.key, how: HOW[o.method], gates, notes, points: [...L.outline, ...L.overlay, ...L.text].reduce((s, [p]) => s + p.length, 0), ms: performance.now() - t0 };
}

// ---------------- draw + export ----------------
function draw(r) {
  const cv = $("cv"), maxW = Math.min(780, Math.max(200, cv.parentElement.clientWidth - 30)), k = Math.min(maxW / r.W, Math.max(1.2, (innerHeight - 90) / r.H));
  cv.width = Math.round(r.W * k * devicePixelRatio); cv.height = Math.round(r.H * k * devicePixelRatio); cv.style.width = Math.round(r.W * k) + "px";
  const c = cv.getContext("2d"); c.setTransform(k * devicePixelRatio, 0, 0, k * devicePixelRatio, 0, 0); paint(c, r);
  const len = ps => ps.reduce((a, [p, cl]) => a + plen(p, cl), 0) / 1000, esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (r.error) { $("stats").innerHTML = `<span class="fail">These settings do not make a pair of sheets: ${esc(r.error)}</span>`; $("how").textContent = ""; return; }
  const now = turnNow(r), reads = r.res.reads ? r.res.reads.map((s, t) => `${t === now ? "<b>" : ""}${t + 1}: ${esc(s)}${t === now ? "</b>" : ""}`).join(" · ") : "";
  $("stats").innerHTML = `${esc(r.o.method)} · ${r.res.dims} · ${r.points} points · ${r.ms.toFixed(0)} ms<br>`
    + (r.res.fit ? `${esc(r.res.fit)}<br>through the holes at each turn: ${reads}<br>` : "")
    + `paper sheet <b>${len(r.outline).toFixed(1)} m</b> · ${SECOND[r.o.method] === "grille-cut" ? "grille to cut" : "clear sheet"} <b>${len(r.overlay).toFixed(1)} m</b> · caption <b>${len(r.text).toFixed(1)} m</b><br>`
    + r.gates.map(([n, ok, v]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "pass" : "FAIL"}</span> ${esc(n)} ${esc(v)}`).join("<br>")
    + `<br>key <b>${esc(r.key)}</b>` + (r.notes.length ? `<br><span class="note">${r.notes.map(esc).join("<br>")}</span>` : "");
  $("how").textContent = r.how;
}
// Which turn the grille sits at (within 4 degrees of a stop), or -1 between stops.
function turnNow(r, deg = +r.o.turn || 0) {
  if (!r.res || !r.res.step) return -1;
  const k = Math.round(deg / r.res.step); return Math.abs(deg - k * r.res.step) <= 4 ? ((k % r.res.positions) + r.res.positions) % r.res.positions : -1;
}
// The second sheet's pose: a slide (dx, dy in mm) or a turn about the pivot (degrees clockwise).
function poseOf(r) { const m = MOTION[r.o.method], d = +$("slide").value; return m === "turn" ? { deg: +$("turn").value } : m === "y" ? { dy: d } : { dx: d }; }
function paint(c, r, pose = poseOf(r)) {
  c.fillStyle = "#fbfaf7"; c.fillRect(0, 0, r.W, r.H); c.lineJoin = c.lineCap = "round";
  const trace = (paths, cl0) => { for (const [p, cl] of paths) { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cl || cl0) c.closePath(); } };
  const stroke = (paths, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); trace(paths); c.stroke(); };
  const view = r.o.view, cut = SECOND[r.o.method] === "grille-cut";
  if (view !== "overlay") { stroke(r.outline, "#111", 0.4); stroke(r.text, r.o.tpen, 0.3); }
  if (view === "base" || r.error) return;
  c.save(); c.translate(pose.dx || 0, pose.dy || 0);
  if (pose.deg && r.res.pivot) { const [px, py] = r.res.pivot; c.translate(px, py); c.rotate(pose.deg * Math.PI / 180); c.translate(-px, -py); }
  if (cut) {
    // the card, holes and all: tinted everywhere except through the holes and the pin hole
    const k = r.res.cut; c.beginPath(); trace([[k.outline], ...k.holes.map(h => [h]), ...(k.pin ? [[k.pin]] : [])], true);
    c.fillStyle = view === "overlay" ? "#e9dcc6" : "rgba(233,220,198,0.93)"; c.fill("evenodd");
    stroke(r.overlay, r.o.opcol, 0.3);
  } else stroke(r.overlay, view === "overlay" ? "#111" : r.o.opcol, 0.4);
  c.restore();
}
const penLayers = r => [
  { name: "base", colour: "000000", w: 0.4, paths: r.outline },
  { name: "text", colour: r.o.tpen.slice(1), w: 0.3, paths: r.text },
  { name: SECOND[r.o.method], colour: r.o.opcol.slice(1), w: 0.4, paths: r.overlay },
].filter(L => L.paths.length);
const toSVG = (r, only = null, ticks = false) => svgOf(r, penLayers(r), `PLG overlay studio (UTP ${UTP_REV})`, only, ticks);

const moveWord = () => (MOTION[$("method").value] === "turn" ? ["Turn the grille", "Stop turning"] : ["Slide the clear sheet", "Stop sliding"]);
function sync() {
  for (const k of IDS) { const out = $("o-" + k); if (out) out.textContent = $(k).value; }
  document.querySelectorAll("[data-for]").forEach(el => (el.hidden = !el.dataset.for.split(" ").includes($("method").value)));
  $("animate").textContent = moveWord()[$("animate").dataset.on === "1" ? 1 : 0];
}
let pending = 0, anim = 0;
function run() { sync(); $("stats").textContent = "drawing"; clearTimeout(pending); pending = setTimeout(() => { last = build(read()); draw(last); }, 80); }
// Move the second sheet the way a hand would: slide the clear sheet to and fro (up and down for moire lines),
// or turn the grille on its pin, resting at each stop long enough to read it.
function animate() {
  cancelAnimationFrame(anim);
  if ($("animate").dataset.on !== "1" || !last || last.error) return;
  const t = performance.now() / 1000, m = MOTION[last.o.method], amp = Math.max(0.5, last.o.pitch || 1);
  let pose;
  if (m === "turn") {
    const per = 2.2, k = Math.floor(t / per), f = t / per - k, e = f < 0.62 ? 0 : (u => u * u * (3 - 2 * u))((f - 0.62) / 0.38);
    pose = { deg: ((k + e) * last.res.step) % 360 }; $("o-turn").textContent = Math.round(pose.deg);
  } else pose = m === "y" ? { dy: Math.sin(t * 1.3) * amp } : { dx: Math.sin(t * 1.3) * amp };
  const cv = $("cv"), c = cv.getContext("2d"), k = cv.width / last.W; c.setTransform(k, 0, 0, k, 0, 0); paint(c, last, pose);
  anim = requestAnimationFrame(animate);
}
const PRESETS = {
  vc: { method: "vcrypt", msg: "MEET AT NINE", per: 6, cell: 1.4, mark: "squares", caption: "none", view: "stacked" },
  vcdots: { method: "vcrypt", msg: "YES", per: 4, cell: 2.2, mark: "dots", caption: "none", view: "stacked" },
  moire: { method: "moire", msg: "LOOK CLOSER", per: 6, pitch: 0.8, wave: "off", noise: 0.4, caption: "none", view: "stacked" },
  wavy: { method: "moire", msg: "HIDDEN", per: 6, pitch: 0.9, wave: "on", noise: 0.6, caption: "none", view: "stacked" },
  fleissner: { method: "fleissner", msg: "TURN THE CARD A QUARTER", gsize: 4, pivot: "pin", caption: "key", view: "stacked" },
  dial: { method: "dial", msg: "EVERY TURN OF THE DIAL SHOWS A LITTLE MORE OF WHAT I MEANT TO SAY", turns: 6, rings: 3, caption: "key", view: "stacked" },
  cardano: { method: "cardano", msg: "MEET ME BY THE OLD MILL", gsize: 18, density: "4", caption: "none", view: "stacked" },
};
document.querySelectorAll("[data-preset]").forEach(b => (b.onclick = () => { for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) $(k).value = v; $("slide").value = 0; $("turn").value = 0; run(); }));
$("reroll").onclick = () => { $("seed").value = 1 + Math.floor(Math.random() * 999); run(); };
IDS.forEach(k => $(k).addEventListener("input", run));
$("animate").onclick = () => { const b = $("animate"); b.dataset.on = b.dataset.on === "1" ? "0" : "1"; b.textContent = moveWord()[b.dataset.on === "1" ? 1 : 0]; if (b.dataset.on === "1") animate(); else if (last) { sync(); draw(last); } };
const save = (text, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const stem = o => `plg-overlay-${o.method}-s${o.seed}-${o.msg.replace(/[^A-Z0-9]/gi, "").slice(0, 20)}`;
$("export").onclick = () => { if (last && !last.error) { const ls = penLayers(last); ls.forEach((L, i) => setTimeout(() => save(toSVG(last, L.name, true), `${stem(last.o)}-${i + 1}of${ls.length}-${L.name}.svg`), i * 500)); } };
addEventListener("resize", () => last && draw(last));
if ($("rev")) $("rev").textContent = UTP_REV;
wireSettingsLoader($, IDS, run);
window.__studio = { applySettings: obj => applySettings(obj, IDS, $), IDS, build, read, PRESETS, penLayers, paint, toSVG };   // hooks for checking
run();
