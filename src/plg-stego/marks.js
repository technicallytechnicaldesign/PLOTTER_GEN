// Machine marks: four finder targets in the page corners and a key strip along the bottom, so the plot decoder can
// find a plot in a photo, turn it the right way up, and know exactly how it was made. Pure geometry and bit packing.
//
//   finders   10 mm squares 4 mm in from each corner: a thick ring round a solid core, except bottom right, whose core
//             is hollow, so a photo taken upside down or sideways is turned back by the decoder.
//   strip     2 rows of 64 slots between the bottom finders: a solid dot is 1, bare paper is 0.
//             Bits: SYNC, a 3-bit studio id, the studio's record (schema below), CRC-8 over studio id and record.
"use strict";
import { ellipse, rect } from "./core.js";

export const MARK = { inset: 4, size: 10, margin: 17, slots: 64, rows: 2 };
export const PAGES = ["190x250", "250x190", "280x280"];
export const DOT_R = 0.85;   // strip dot radius (mm): the 190 mm page's 2.44 mm pitch leaves 0.7 mm of paper between dots
const centre = MARK.inset + MARK.size / 2;
export const finderCentres = (W, H) => [[centre, centre], [W - centre, centre], [W - centre, H - centre], [centre, H - centre]];   // TL TR BR BL
export function stripSlots(W, H) {
  const x0 = MARK.inset + MARK.size + 5, x1 = W - x0, pitch = (x1 - x0) / (MARK.slots - 1), ys = [H - MARK.inset - MARK.size * 0.78, H - MARK.inset - MARK.size * 0.22];
  return { pitch, slots: Array.from({ length: MARK.slots * MARK.rows }, (_, i) => [x0 + (i % MARK.slots) * pitch, ys[Math.floor(i / MARK.slots)]]) };
}

// Concentric squares 0.4 mm apart read as solid ink once a 0.4 mm pen has drawn them.
// A solid square also gets a cross through its middle, or a pinhole is left where the smallest square stops.
const solidSquare = (cx, cy, s, upTo = s / 2) => {
  const out = []; for (let d = 0; d < upTo - 0.05; d += 0.4) out.push([rect(cx - s / 2 + d, cy - s / 2 + d, s - 2 * d, s - 2 * d), true]);
  if (upTo >= s / 2 - 0.05) out.push([[[cx - 0.5, cy], [cx + 0.5, cy]], false], [[[cx, cy - 0.5], [cx, cy + 0.5]], false]);
  return out;
};
export function drawMarks(W, H, bits, L) {
  finderCentres(W, H).forEach(([cx, cy], i) => {
    L.outline.push(...solidSquare(cx, cy, MARK.size, 1.6));   // ring 1.6, clear gap 1.8 (1.4 after the pen), core 3.2: blur must not bridge it
    L.outline.push(...(i === 2 ? solidSquare(cx, cy, 3.2, 0.8) : solidSquare(cx, cy, 3.2)));
  });
  // a 1 is a solid dot, a 0 is bare paper (a ring round every slot blurred into its dot below about 5 px per mm)
  const { slots } = stripSlots(W, H), r = DOT_R;
  slots.forEach(([x, y], i) => { if (bits[i]) for (let q = r; q > 0.05; q -= 0.3) L.outline.push([ellipse(x, y, q, q, 0, 16), true]); });
}

// ---------------- records ----------------
// Vocabularies the purloined plot studio writes into its record (schema 2). Order is fixed: records store indexes.
export const STEGO = {
  LOOKS: ["dots", "stitches", "cross", "punch", "blocks", "truchet"], CARRIERS: ["purl-relief", "two-colour", "cable", "lace", "bobble", "bead", "stripes"],
  ENCS: ["fivebit", "morse", "bacon26", "bacon24", "pixel5", "geometric3", "geometric4"], CHECKS: ["none", "parity", "hamming"],
  HIDES: ["columns", "tape", "chart", "scatter", "motif-window", "motif-diamond", "motif-cross"], CIPHERS: ["none", "caesar", "keyword", "vigenere", "railfence", "route"],
  FILLS: ["contour", "lines", "cross", "zigzag", "wave", "stipple", "spiral", "none"],
};
export const SYNC = [1, 0, 1, 1, 0];
// [field, bits, signed]. Distances are stored in tenths (or hundredths) of a millimetre as noted.
export const SCHEMAS = {
  1: [["method", 4], ["variant", 2], ["enc", 2], ["hide", 1], ["density", 2], ["seed", 10], ["len", 12], ["size", 6], ["page", 2], ["cipher", 3], ["capH", 11], ["dy", 12, true], ["noise", 5], ["fill", 3], ["pitch", 6], ["angle", 8, true]],   // cipher garden (pitch: 0.05 mm steps above 0.5)
  2: [["look", 3], ["carrier", 3], ["border", 1], ["enc", 3], ["check", 2], ["hide", 3], ["seed", 10], ["density", 2], ["cipher", 3], ["x0", 12], ["y0", 12], ["cw", 11], ["rows", 8], ["cols", 7], ["wobble", 5], ["gaps", 1], ["page", 2], ["len", 12], ["fill", 3]],   // purloined plot studio: chart, scatter and motif layouts
};
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
// Bits read off a strip back to { studio, fields }, or { error } when the sync, studio or checksum is wrong.
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
