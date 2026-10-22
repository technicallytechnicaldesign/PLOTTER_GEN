

"use strict";
import { ellipse, rect, drawText, wrap } from "./core.js";

export const MARK = { inset: 4, size: 10, margin: 17, slots: 64, rows: 2 };

export const LAYOUTS = {
  normal: { name: "normal", inset: 4, size: 10, ring: 1.6, core: 3.2, hollow: 0.8, stripX: 5, rowsAt: [0.78, 0.22], dot: 0.85 },
  retro: { name: "retro", inset: 2, size: 7, ring: 1.1, core: 2.2, hollow: 0.6, stripX: 3, rowsAt: [0.7, 0.25], dot: 0.8 },

  corners: { name: "corners", inset: 2, size: 7, ring: 1.1, core: 2.2, hollow: 0.6, strip: false },

  "border-arcs": { name: "border-arcs", inset: 4, size: 10, ring: 1.6, core: 3.2, hollow: 0.8, round: true, tiles: "arcs", band: 5 },
  "border-diag": { name: "border-diag", inset: 4, size: 10, ring: 1.6, core: 3.2, hollow: 0.8, round: true, tiles: "diag", band: 5 },

  label: { name: "label", inset: 3, size: 8, ring: 1.3, core: 2.6, hollow: 0.7, stripX: 3, rowsAt: [0.72, 0.25], dot: 0.75, page: "170x60" },
};

export function markMode(o) {
  const m = o.marks;
  if (m === "on") return { lay: LAYOUTS.normal, M: MARK.margin };
  if (m === "retro" || m === "corners") return { lay: LAYOUTS[m], M: 10 };
  if (m === "border-arcs" || m === "border-diag") return { lay: LAYOUTS[m], M: MARK.margin };
  if (m === "mount") { const w = Math.round(+o.mount || 25); return { lay: LAYOUTS.normal, M: w + 3, mount: w }; }
  return { lay: null, M: 10 };
}

export function markGates(W, H, drawn, mode) {
  const g = [marksClear(W, H, drawn, mode.lay)];
  if (mode.lay.tiles) { const n = borderTiles(W, H, mode.lay).length; g.push(["the border has a tile for every key bit", n >= MARK.slots * MARK.rows, `${n} tiles`]); }
  if (mode.mount) {

    const reach = Math.max(...markZones(W, H, mode.lay).map(([a, b, c, d]) => Math.min(c, W - a, d, H - b)));
    g.push(["every mark at least 2 mm under the mount card (window 18 mm in or more)", mode.mount >= 18 && reach <= mode.mount - 2, `window ${mode.mount} mm in, marks reach ${reach.toFixed(1)} mm`]);
  }
  return g;
}
export const PAGES = ["190x250", "250x190", "280x280"];
export const DOT_R = 0.85;
export const finderCentres = (W, H, lay = LAYOUTS.normal) => { const c = lay.inset + lay.size / 2; return [[c, c], [W - c, c], [W - c, H - c], [c, H - c]]; };
export function stripSlots(W, H, lay = LAYOUTS.normal) {
  if (lay.strip === false || lay.tiles) return { pitch: 0, slots: [] };
  const x0 = lay.inset + lay.size + lay.stripX, x1 = W - x0, pitch = (x1 - x0) / (MARK.slots - 1), ys = lay.rowsAt.map(f => H - lay.inset - lay.size * f);
  return { pitch, slots: Array.from({ length: MARK.slots * MARK.rows }, (_, i) => [x0 + (i % MARK.slots) * pitch, ys[Math.floor(i / MARK.slots)]]) };
}

export function marksClear(W, H, layers, lay = LAYOUTS.normal) {
  const Z = markZones(W, H, lay); let hits = 0;
  for (const [p] of layers) for (const [x, y] of p) if (Z.some(([a, b, c, d]) => x > a && x < c && y > b && y < d)) hits++;
  return [`the ${lay.name === "retro" ? "retrofit " : ""}marks land on bare paper`, hits === 0, hits ? `${hits} drawn points inside the mark zones` : ""];
}

export function markZones(W, H, lay = LAYOUTS.normal) {
  const z = finderCentres(W, H, lay).map(([x, y]) => [x - lay.size / 2 - 0.5, y - lay.size / 2 - 0.5, x + lay.size / 2 + 0.5, y + lay.size / 2 + 0.5]);
  if (lay.tiles) { const c = lay.inset + lay.size / 2, b = lay.band / 2 + 0.5, e = lay.inset + lay.size + 0.5; z.push([e, c - b, W - e, c + b], [e, H - c - b, W - e, H - c + b], [c - b, e, c + b, H - e], [W - c - b, e, W - c + b, H - e]); }
  const { slots } = stripSlots(W, H, lay);
  if (slots.length) z.push([slots[0][0] - lay.dot - 0.5, Math.min(...slots.map(s => s[1])) - lay.dot - 0.5, slots[MARK.slots - 1][0] + lay.dot + 0.5, Math.max(...slots.map(s => s[1])) + lay.dot + 0.5]);
  return z;
}

const solidSquare = (cx, cy, s, upTo = s / 2) => {
  const out = []; for (let d = 0; d < upTo - 0.05; d += 0.4) out.push([rect(cx - s / 2 + d, cy - s / 2 + d, s - 2 * d, s - 2 * d), true]);
  if (upTo >= s / 2 - 0.05) out.push([[[cx - 0.5, cy], [cx + 0.5, cy]], false], [[[cx, cy - 0.5], [cx, cy + 0.5]], false]);
  return out;
};

const solidDisk = (cx, cy, r, upTo = r) => {
  const out = []; for (let d = 0; d < upTo - 0.05; d += 0.4) out.push([ellipse(cx, cy, r - d, r - d, 0, Math.max(16, Math.round((r - d) * 10))), true]);
  if (upTo >= r - 0.05) out.push([[[cx - 0.5, cy], [cx + 0.5, cy]], false], [[[cx, cy - 0.5], [cx, cy + 0.5]], false]);
  return out;
};

export function borderTiles(W, H, lay) {
  const c = lay.inset + lay.size / 2, e = lay.inset + lay.size + 1, t = lay.band, out = [];
  const run = (len, f) => { const n = Math.max(1, Math.round(len / t)), s = len / n; for (let i = 0; i < n; i++) out.push(f(i, s)); };
  run(W - 2 * e, (i, s) => ({ x: e + i * s, y: c - t / 2, w: s, h: t }));
  run(H - 2 * e, (i, s) => ({ x: W - c - t / 2, y: e + i * s, w: t, h: s }));
  run(W - 2 * e, (i, s) => ({ x: W - e - (i + 1) * s, y: H - c - t / 2, w: s, h: t }));
  run(H - 2 * e, (i, s) => ({ x: c - t / 2, y: H - e - (i + 1) * s, w: t, h: s }));
  return out;
}

export function tileWays(T, style) {
  const q = (cx, cy, a0) => { const p = []; for (let k = 0; k <= 10; k++) { const a = a0 + (Math.PI / 2) * k / 10; p.push([cx + (T.w / 2) * Math.cos(a), cy + (T.h / 2) * Math.sin(a)]); } return [p, false]; };
  if (style === "diag") return [[[[[T.x, T.y], [T.x + T.w, T.y + T.h]], false]], [[[[T.x + T.w, T.y], [T.x, T.y + T.h]], false]]];
  return [[q(T.x, T.y, 0), q(T.x + T.w, T.y + T.h, Math.PI)], [q(T.x + T.w, T.y, Math.PI / 2), q(T.x, T.y + T.h, -Math.PI / 2)]];
}

export const TILE_MASK = Array.from({ length: 512 }, (_, i) => { let h = Math.imul(i + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 13) & 1; });

export function drawMarks(W, H, bits, L, lay = LAYOUTS.normal) {
  const out = L.marks || (L.marks = []);
  out.bits = bits;
  finderCentres(W, H, lay).forEach(([cx, cy], i) => {
    if (lay.round) { out.push(...solidDisk(cx, cy, lay.size / 2, lay.ring)); out.push(...(i === 2 ? solidDisk(cx, cy, lay.core / 2, lay.hollow) : solidDisk(cx, cy, lay.core / 2))); return; }
    out.push(...solidSquare(cx, cy, lay.size, lay.ring));
    out.push(...(i === 2 ? solidSquare(cx, cy, lay.core, lay.hollow) : solidSquare(cx, cy, lay.core)));
  });
  if (lay.tiles) {
    const tiles = borderTiles(W, H, lay), N = MARK.slots * MARK.rows;
    tiles.forEach((T, i) => out.push(...tileWays(T, lay.tiles)[bits[i % N] ^ TILE_MASK[i]]));

    const c = lay.inset + lay.size / 2, b = lay.band / 2, e = lay.inset + lay.size + 1;
    for (const y of [c - b, c + b, H - c - b, H - c + b]) out.push([[[e, y], [W - e, y]], false]);
    for (const x of [c - b, c + b, W - c - b, W - c + b]) out.push([[[x, e], [x, H - e]], false]);
    return;
  }

  const { slots } = stripSlots(W, H, lay), r = lay.dot;
  slots.forEach(([x, y], i) => { if (bits[i]) for (let q = r; q > 0.05; q -= 0.3) out.push([ellipse(x, y, q, q, 0, 16), true]); });
}

export function drawMountTicks(W, H, w, L) {
  const a = w - 1.5, s = 5;
  L.marks.push(...[[[a, a + s], [a, a], [a + s, a]], [[W - a - s, a], [W - a, a], [W - a, a + s]], [[W - a, H - a - s], [W - a, H - a], [W - a - s, H - a]], [[a + s, H - a], [a, H - a], [a, H - a - s]]].map(p => [p, false]));
}

export function applyMarks(W, H, bits, L, mode, drawn) {
  const gates = markGates(W, H, drawn, mode);
  drawMarks(W, H, bits, L, mode.lay);
  if (mode.mount) drawMountTicks(W, H, mode.mount, L);
  return gates;
}

export function labelSheet(bits, title, pairs) {
  const lay = LAYOUTS.label, [W, H] = lay.page.split("x").map(Number), L = { marks: [], text: [] };
  drawMarks(W, H, bits, L, lay);
  const x0 = lay.inset + lay.size + 3, th = 3.6, h = 2.8, cx = W / 2, per = Math.floor(((W - 2 * x0) / h * 6 + 1.6) / 5.6);
  drawText(title, cx, lay.inset + 1, th, L.text);

  const words = pairs.map(([k, v]) => `${k}=${String(v).trim().replace(/\s+/g, "-")}`.toUpperCase().replace(/[^A-Z0-9.,:=\-]/g, ""));
  let y = lay.inset + 1 + th * 1.7;
  const floor = H - lay.inset - lay.size - 1;
  for (const line of wrap(words.join(" "), per)) { if (y + h > floor) break; drawText(line, cx, y, h, L.text); y += h * 1.6; }
  return { W, H, ...L };
}

export const STEGO = {
  LOOKS: ["dots", "stitches", "cross", "punch", "blocks", "truchet"], CARRIERS: ["purl-relief", "two-colour", "cable", "lace", "bobble", "bead", "stripes"],
  ENCS: ["fivebit", "morse", "bacon26", "bacon24", "pixel5", "geometric3", "geometric4"], CHECKS: ["none", "parity", "hamming"],
  HIDES: ["columns", "tape", "chart", "scatter", "motif-window", "motif-diamond", "motif-cross"], CIPHERS: ["none", "caesar", "keyword", "vigenere", "railfence", "route"],
  FILLS: ["contour", "lines", "cross", "zigzag", "wave", "stipple", "spiral", "none"],
};
export const SYNC = [1, 0, 1, 1, 0];

export const SCHEMAS = {
  1: [["method", 4], ["variant", 2], ["enc", 2], ["hide", 1], ["density", 2], ["seed", 10], ["len", 12], ["size", 6], ["page", 2], ["cipher", 3], ["capH", 11], ["dy", 12, true], ["noise", 5], ["fill", 3], ["pitch", 6], ["angle", 8, true]],
  2: [["look", 3], ["carrier", 3], ["border", 1], ["enc", 3], ["check", 2], ["hide", 3], ["seed", 10], ["density", 2], ["cipher", 3], ["x0", 12], ["y0", 12], ["cw", 11], ["rows", 8], ["cols", 7], ["wobble", 5], ["gaps", 1], ["page", 2], ["len", 12], ["fill", 3]],

  3: [["alpha", 3], ["hoist", 1], ["ink", 2], ["pitch", 6], ["angle", 8, true], ["x0", 12], ["y0", 12], ["h", 10], ["cellW", 10], ["rowStep", 10], ["per", 7], ["lines", 7], ["page", 2], ["cipher", 3], ["ghost", 1]],
};
SCHEMAS[4] = SCHEMAS[1];
SCHEMAS[5] = [...SCHEMAS[1], ["mount", 6]];
const crc8 = bits => { let c = 0; for (const b of bits) { const top = (c >> 7) & 1; c = ((c << 1) & 0xff) ^ ((top ^ b) ? 0x07 : 0); } return Array.from({ length: 8 }, (_, i) => (c >> (7 - i)) & 1); };
const toBits = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
export function packRecord(studio, fields) {
  const body = [...toBits(studio, 3)];
  for (const [name, n, signed] of SCHEMAS[studio]) {
    let v = Math.round(fields[name] ?? 0);
    if (signed) v = v < 0 ? v + (1 << n) : v;
    if (v < 0 || v >= 1 << n) throw new Error(`key strip: ${name} = ${fields[name]} does not fit in ${n} bits`);
    body.push(...toBits(v, n));
  }
  const bits = [...SYNC, ...body, ...crc8(body)];
  if (bits.length > MARK.slots * MARK.rows) throw new Error("key strip record is too long");
  return [...bits, ...new Array(MARK.slots * MARK.rows - bits.length).fill(0)];
}

export function unpackRecord(bits) {
  if (SYNC.some((b, i) => bits[i] !== b)) return { error: "no key strip sync" };
  let p = SYNC.length; const take = n => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + (bits[p++] ? 1 : 0); return v; };
  const studio = take(3), schema = SCHEMAS[studio];
  if (!schema) return { error: `unknown studio ${studio}` };
  const fields = {};
  for (const [name, n, signed] of schema) { let v = take(n); if (signed && v >= 1 << (n - 1)) v -= 1 << n; fields[name] = v; }
  const body = bits.slice(SYNC.length, p), crc = bits.slice(p, p + 8);
  if (crc8(body).some((b, i) => b !== crc[i])) return { error: "key strip checksum does not match" };
  return { studio, fields };
}
