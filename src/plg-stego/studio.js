// Purloined plot studio: UNRAVEL THE PURLOINED's encoders and carriers, drawn as pen-plotter vectors.
// The message side is UTP's own engine (bundled in by build.mjs from the UTP repo, never copied), so a
// plotted chart is the same chart the UTP lab makes and decodes. This file only lays cells out on paper
// and draws them: dot chart, knitted stitches, cross-stitch, punch card, squared chart or Truchet tiles,
// each filled with one of seven hatch styles, plus a caption in a single-stroke font.
// All units are millimetres, y down. Output layers: outline (0.4), fill (0.3), text, reveal (answer key).
"use strict";
import { createProject } from "@utp/project";
import { FLAT } from "@utp/construction";
import * as fivebit from "@utp/fivebit";
import * as morse from "@utp/morse";
import * as bacon from "@utp/bacon";
import { DEFAULT_OPTIONS } from "@utp/errorcontrol";
import { packOf } from "@utp/glyphs";
import { encipher } from "@utp/ciphers";
import { rng } from "@utp/fabric";
import { UNITS } from "@utp/units";
import { MOTIFS } from "@utp/motifs";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";


import { markMode, applyMarks, packRecord, PAGES, STEGO, labelSheet } from "./marks.js";
import { TAU, lerp, area, centroid, bbox, ellipse, rect, capsule, sector, plen, densify, simplify, dashed, segIn, insideRuns, inset, hash2, fillConvex, painter, GLYPHS, ADV, textWidth, drawText, wrap, svgOf, wireSettingsLoader, applySettings } from "./core.js";

// ---------------- message to cells ----------------
// Every layout returns screen rows (top first) of cells or null, with labels under letter columns.
// A cell: { on, v (visible stitch state), carry (holds message), dim (a space), el (id shared by one Morse mark) }.
const ON = new Set(["purl", "B", "c4b", "k2tog", "mb", "pb"]);
const stateFor = (on, carrier) => ({ "two-colour": on ? "B" : "A", stripes: on ? "B" : "A", bobble: on ? "mb" : "knit", bead: on ? "pb" : "knit", lace: on ? "k2tog" : "ssk" })[carrier] ?? (on ? "purl" : "knit");
const cipherOf = o => (o.cipher === "none" ? null : { kind: o.cipher, key: String(o.ckey || "") });
const isGlyph = e => ["pixel5", "geometric3", "geometric4"].includes(e);
const ERROR_CONTROL = { none: { code: "plain", separator: false, checksum: false }, parity: DEFAULT_OPTIONS, hamming: { code: "hamming", separator: true, checksum: true } };

// The letters to draw, each with its own column of cells, for the column and tape layouts.
function letters(o) {
  const cip = cipherOf(o), e = o.enc, plain = morse.normalize(o.msg).text;
  if (e === "fivebit") {
    const n = fivebit.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
    return { plain, text: t, dropped: n.dropped, list: [...t].map(ch => ({ ch, bits: fivebit.encode(ch), dim: ch === " " })), code: [...t].map(ch => fivebit.encode(ch).join("")).join(" ") };
  }
  if (e === "morse") {
    const n = morse.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
    return { plain, text: t, dropped: n.dropped, list: [...t].map(ch => (ch === " " ? { ch, gap: true } : { ch, units: morse.toUnits(morse.encode(ch)) })), code: morse.transcribe(morse.encode(t)) };
  }
  if (e === "bacon26" || e === "bacon24") {
    const v = e === "bacon24" ? "historical24" : "modern26", words = o.msg.split(/\s+/).map(w => bacon.normalize(w, v).text).filter(Boolean);
    let all = words.join(""); if (cip) all = encipher(all, cip);
    const list = []; let k = 0;
    words.forEach((w, wi) => { if (wi) list.push({ ch: " ", gap: true }); for (const ch of all.slice(k, k + w.length)) list.push({ ch, bits: bacon.encode(ch, v) }); k += w.length; });
    return { plain, text: all, dropped: bacon.normalize(o.msg, v).dropped.filter(d => !/\s/.test(d.char)), list, code: bacon.toAB(bacon.encode(all, v)), variant: v };
  }
  const pack = packOf(e), n = morse.normalize(o.msg), t = cip ? encipher(n.text, cip) : n.text;
  return { plain, text: t, dropped: n.dropped, pack, list: [...t].map(ch => { if (ch === " ") return { ch, gap: true }; if (!pack.glyphs[ch]) throw new Error(`"${ch}" has no symbol in ${pack.name}.`); return { ch, glyph: pack.glyphs[ch] }; }), code: "" };
}

function layoutColumns(o, labels) {
  const M = letters(o), cols = [];
  const gw = M.pack ? M.pack.width : 1;
  for (const L of M.list) {
    if (L.gap) { cols.push({ w: M.pack ? Math.ceil(gw / 2) : 1, cells: [], ch: "", gap: true }); continue; }
    if (L.glyph) { const gh = M.pack.height; cols.push({ w: gw, ch: L.ch, glyph: L.glyph, h: gh }); cols.push({ w: 1, cells: [], ch: "", gap: true, spacer: true }); continue; }
    let cells;
    if (L.units) { let el = 0; cells = L.units.map((u, i) => { if (u && (i === 0 || !L.units[i - 1])) el++; return { on: !!u, el: u ? el : null }; }); }
    else cells = L.bits.map(b => ({ on: !!b }));
    cols.push({ w: 1, cells: cells.map(c => ({ ...c, carry: true, dim: L.dim })), ch: L.dim ? "␣" : L.ch, dim: L.dim, h: cells.length });
  }
  // lines: break between words once a line passes the letters-per-line limit; a space never starts or ends a line
  const words = []; let word = [];
  for (const c of cols) { if ((c.gap && !c.spacer) || c.dim) { words.push({ cols: word, sep: c }); word = []; } else word.push(c); }
  words.push({ cols: word, sep: null });
  const lines = [], trim = l => { while (l.length && (l.at(-1).gap || l.at(-1).dim)) l.pop(); return l; };
  let cur = [], count = 0;
  for (const { cols: wc, sep } of words) {
    const n = wc.filter(c => !c.gap).length;
    if (cur.length && count + n > o.perline) { lines.push(trim(cur)); cur = []; count = 0; }
    cur.push(...wc); count += n;
    if (sep && cur.length) { cur.push(sep); count += sep.dim ? 1 : 0; }
  }
  if (trim(cur).length) lines.push(cur);
  const hmax = Math.max(1, ...cols.map(c => c.h || 0)), C = Math.max(1, ...lines.map(l => l.reduce((s, c) => s + c.w, 0)));
  const rows = [], labs = [], rowsPerLine = hmax + (labels ? 1 : 0);
  lines.forEach((line, li) => {
    const top = rows.length;
    for (let r = 0; r < rowsPerLine + (li < lines.length - 1 ? 1 : 0); r++) rows.push(new Array(C).fill(null));
    let x = Math.floor((C - line.reduce((s, c) => s + c.w, 0)) / 2);
    for (const c of line) {
      if (c.glyph) for (let r = 0; r < c.h; r++) for (let k = 0; k < c.w; k++) rows[top + r][x + k] = { on: !!c.glyph[c.h - 1 - r][k], carry: true };
      else if (c.cells) c.cells.forEach((cell, r) => (rows[top + r][x] = cell));
      if (labels && c.ch) labs.push({ r: top + hmax, c: x, span: c.w, ch: c.ch, dim: c.dim });
      x += c.w;
    }
  });
  // read it back from the laid-out cells, the way a reader would
  let read = "";
  for (const line of lines) {
    for (const c of line) {
      if (c.spacer) continue;
      if (c.gap) { read += " "; continue; }
      if (c.glyph) { read += Object.keys(M.pack.glyphs).find(k => JSON.stringify(M.pack.glyphs[k]) === JSON.stringify(c.glyph)) ?? "?"; continue; }
      const bits = c.cells.map(x => (x.on ? 1 : 0));
      read += o.enc === "morse" ? morse.decodeUnits(bits).text : o.enc.startsWith("bacon") ? bacon.decode(bits, M.variant).text : fivebit.decode(bits).text;
    }
    read += " ";
  }
  const norm = s => s.replace(/\s+/g, o.enc.startsWith("bacon") ? "" : " ").trim();
  return { kind: "columns", rows, labels: labs, M, read: norm(read), want: norm(M.text) };
}

function layoutTape(o, labels) {
  if (isGlyph(o.enc)) return layoutColumns(o, labels);
  const M = letters(o), stream = [], labs = [];
  for (const L of M.list) {
    // Morse timing: 3 blank units between letters, 7 between words (the 3 plus these 4)
    if (L.gap) { if (o.enc === "morse") for (let k = 0; k < 4; k++) stream.push({ on: false }); continue; }
    if (o.enc === "morse" && stream.length) for (let k = 0; k < 3; k++) stream.push({ on: false });
    const start = stream.length, units = L.units || L.bits;
    let el = 0; units.forEach((u, i) => { if (L.units && u && (i === 0 || !units[i - 1])) el++; stream.push({ on: !!u, el: L.units && u ? `${start}-${el}` : null, carry: true, dim: L.dim }); });
    labs.push({ at: start, ch: L.dim ? "␣" : L.ch, dim: L.dim });
  }
  const W = Math.max(3, o.width), per = 2, nLines = Math.ceil(stream.length / W), rows = [], outLabs = [];
  for (let li = 0; li < nLines; li++) {
    const row = new Array(W).fill(null);
    for (let k = 0; k < W && li * W + k < stream.length; k++) row[k] = stream[li * W + k];
    rows.push(row);
    if (li < nLines - 1 || labels) rows.push(new Array(W).fill(null));
  }
  if (labels) for (const l of labs) outLabs.push({ r: Math.floor(l.at / W) * per + 1, c: l.at % W, span: 1, ch: l.ch, dim: l.dim, left: true });
  const bits = stream.map(s => (s.on ? 1 : 0));
  const read = o.enc === "morse" ? morse.decodeUnits(bits).text : o.enc.startsWith("bacon") ? bacon.decode(bits, M.variant).text : fivebit.decode(bits).text;
  return { kind: "tape", rows, labels: outLabs, M, read: read.trim(), want: M.text.trim() };
}

function layoutChart(o) {
  const cip = cipherOf(o), glyph = isGlyph(o.enc), hide = o.hide;
  const unitW = UNITS[o.carrier]?.width ?? 1, motif = hide.startsWith("motif-") ? hide.slice(6) : null, mult = motif ? MOTIFS[motif].size : 1;
  let lw = Math.max(3, Math.round(o.width / (unitW * mult)));
  if (glyph) lw = Math.max(lw, packOf(o.enc).width);
  const encoding = o.enc === "morse" ? { alphabet: "morse" } : o.enc.startsWith("bacon") ? { alphabet: "bacon", variant: o.enc === "bacon24" ? "historical24" : "modern26" } : { alphabet: "fivebit", errorControl: ERROR_CONTROL[o.check] };
  const settings = { title: "PLG plot", message: o.msg, encoding, layout: { width: lw, border: o.border === "on", borderWidth: 1 }, carrier: { id: o.carrier }, construction: FLAT };
  if (cip) settings.cipher = cip;
  if (glyph) settings.glyphs = { pack: o.enc };
  if (hide === "scatter") settings.hide = { mode: "scatter", seed: o.seed, filler: "texture", density: +o.density };
  if (motif) settings.hide = { mode: "motif", motif };
  const P = createProject(settings, "plg-plot");
  const lg = P.output.logicalGrid, roles = P.output.roles, chart = P.output.chart, R = lg.length, CR = chart.length;
  const fy = CR / R, fx = chart[0].length / lg[0].length;
  const bits = lg.map((_, rr) => lg[R - 1 - rr].map((b, c) => ({ on: b === 1, carry: roles[R - 1 - rr][c] === "data", role: roles[R - 1 - rr][c] })));
  const vis = chart.map((_, rr) => chart[CR - 1 - rr].map((v, c) => ({ v, on: ON.has(v), carry: roles[Math.floor((CR - 1 - rr) / fy)][Math.floor(c / fx)] === "data" })));
  const norm = s => s.replace(/\s+/g, " ").trim();
  return { kind: "chart", rows: bits, stitches: vis, labels: [], P, read: norm(P.output.decoded), want: norm(P.message.normalized), lw };
}

// ---------------- looks ----------------
function looks(G, g, o, L) {
  const { x0, y0, cw } = g, rows = o.look === "stitches" ? (G.stitches || G.rows) : G.rows, R = rows.length, C = Math.max(...rows.map(r => r.length));
  const at = (r, c) => (r >= 0 && r < R && c >= 0 && c < rows[r].length ? rows[r][c] : null);
  const X = c => x0 + c * cw, Y = r => y0 + r * g.ch;
  const fillOn = P => fillConvex(P, o.fill, o.pitch, o.angle, o.seed);
  const fillOff = P => (o.offfill === "light" ? fillConvex(P, o.fill === "none" ? "lines" : o.fill, o.pitch * 2.6, o.angle + 90, o.seed + 3) : o.offfill === "dots" ? fillConvex(P, "stipple", o.pitch * 2.2, 0, o.seed + 5) : []);
  const ring = (cx, cy) => { if (o.reveal === "on" && G.kind !== "columns" && G.kind !== "tape") L.reveal.push([ellipse(cx, cy, 0.16 * cw, 0.16 * cw, 0, 12), true]); };

  if (o.look === "dots") {
    const gap = 0.12 * cw, rd = 0.3 * cw;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = at(r, c); if (!cell) continue;
      const box = rect(X(c) + gap / 2, Y(r) + gap / 2, cw - gap, cw - gap), cx = X(c) + cw / 2, cy = Y(r) + cw / 2;
      if (o.boxes === "on") cell.dim ? L.outline.push(...dashed(box, true)) : L.outline.push([box, true]);
      if (cell.carry) ring(cx, cy);
      if (!cell.on) { L.fill.push(...fillOff(inset(box, 0.1 * cw) || box)); continue; }
      let shape;
      if (cell.el != null) {
        const same = (rr, cc) => { const q = at(rr, cc); return q && q.el === cell.el; };
        if (same(r - 1, c) || same(r, c - 1)) continue;   // drawn from the first cell of the mark
        let r1 = r, c1 = c; while (same(r1 + 1, c)) r1++; while (same(r, c1 + 1)) c1++;
        shape = r1 === r && c1 === c ? ellipse(cx, cy, rd, rd, 0, 28) : capsule([cx, cy], [X(c1) + cw / 2, Y(r1) + cw / 2], rd);
      } else shape = ellipse(cx, cy, rd, rd, 0, 28);
      if (cell.dim) { L.outline.push(...dashed(shape, true, 0.5, 0.5)); continue; }
      L.outline.push([shape, true]); L.fill.push(...fillOn(shape));
    }
  } else if (o.look === "blocks" || o.look === "cross") {
    // shared grid lines, each edge drawn once and merged into long runs
    const gridLayer = o.look === "blocks" ? L.outline : L.fill;
    if (o.look === "blocks" || o.boxes === "on") {
      for (let r = 0; r <= R; r++) { let s = null; for (let c = 0; c <= C; c++) { const e = c < C && (at(r - 1, c) || at(r, c)); if (e && s === null) s = c; if (!e && s !== null) { gridLayer.push([[[X(s), Y(r)], [X(c), Y(r)]], false]); s = null; } } }
      for (let c = 0; c <= C; c++) { let s = null; for (let r = 0; r <= R; r++) { const e = r < R && (at(r, c - 1) || at(r, c)); if (e && s === null) s = r; if (!e && s !== null) { gridLayer.push([[[X(c), Y(s)], [X(c), Y(r)]], false]); s = null; } } }
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = at(r, c); if (!cell) continue;
      const cx = X(c) + cw / 2, cy = Y(r) + cw / 2; if (cell.carry) ring(cx, cy);
      if (o.look === "blocks") {
        const inner = rect(X(c) + 0.1 * cw, Y(r) + 0.1 * cw, 0.8 * cw, 0.8 * cw);
        if (!cell.on) { L.fill.push(...fillOff(inner)); continue; }
        if (cell.dim) { L.outline.push(...dashed(inner, true, 0.5, 0.5)); continue; }
        o.fill === "none" ? L.outline.push([inner, true]) : L.fill.push(...fillOn(inner));
      } else if (cell.on) {
        const e = 0.16 * cw, a = [X(c) + e, Y(r) + e], b = [X(c) + cw - e, Y(r) + cw - e], p = [X(c) + cw - e, Y(r) + e], q = [X(c) + e, Y(r) + cw - e];
        if (cell.dim) { L.outline.push(...dashed([a, b], false, 0.5, 0.5), ...dashed([p, q], false, 0.5, 0.5)); continue; }
        L.outline.push([[q, p], false], [[a, b], false]);   // bottom stitch first, then the top one, as it is sewn
        // shading on a stitch is a diamond knot where the two legs cross
        if (o.fill !== "none") L.fill.push(...fillOn([[cx - 0.22 * cw, cy], [cx, cy - 0.22 * cw], [cx + 0.22 * cw, cy], [cx, cy + 0.22 * cw]]));
      } else L.fill.push(...fillOff(rect(X(c) + 0.3 * cw, Y(r) + 0.3 * cw, 0.4 * cw, 0.4 * cw)));
    }
  } else if (o.look === "punch") {
    const m = 2.4 * cw, card = [X(0) - m, Y(0) - cw, X(C) + m, Y(R) + cw], ch = 1.3 * cw;
    L.outline.push([[[card[0] + ch, card[1]], [card[2], card[1]], [card[2], card[3]], [card[0], card[3]], [card[0], card[1] + ch]], true]);
    for (let r = 0; r < R; r += 2) for (const x of [X(0) - 1.4 * cw, X(C) + 1.4 * cw]) L.outline.push([ellipse(x, Y(r) + cw, 0.22 * cw, 0.22 * cw, 0, 16), true]);
    if (G.kind === "chart" && o.caption !== "none") for (let k = 5; k <= R; k += 5) drawText(String(k), X(0) - 0.55 * cw, Y(R - k) + 0.3 * cw, 0.42 * cw, L.text);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = at(r, c); if (!cell) continue;
      const cx = X(c) + cw / 2, cy = Y(r) + cw / 2; if (cell.carry) ring(cx, cy);
      if (!cell.on) { if (o.offfill !== "none") L.fill.push([ellipse(cx, cy, 0.05 * cw, 0.05 * cw, 0, 6), true]); continue; }
      const hole = ellipse(cx, cy, 0.32 * cw, 0.32 * cw, 0, 24);
      if (cell.dim) { L.outline.push(...dashed(hole, true, 0.5, 0.5)); continue; }
      L.outline.push([hole, true]); L.fill.push(...fillOn(hole));
    }
  } else if (o.look === "truchet") {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = at(r, c); if (!cell) continue;
      const x = X(c), y = Y(r), h = cw / 2; if (cell.carry) ring(x + h, y + h);
      // 0: arcs round the top-left and bottom-right corners; 1: top-right and bottom-left
      const corners = cell.on ? [[x + cw, y, Math.PI / 2, Math.PI], [x, y + cw, -Math.PI / 2, 0]] : [[x, y, 0, Math.PI / 2], [x + cw, y + cw, Math.PI, 1.5 * Math.PI]];
      for (const [cx, cy, a0, a1] of corners) {
        const arc = []; for (let k = 0; k <= 12; k++) { const t = a0 + (a1 - a0) * k / 12; arc.push([cx + h * Math.cos(t), cy + h * Math.sin(t)]); }
        cell.dim ? L.outline.push(...dashed(arc, false, 0.5, 0.5)) : L.outline.push([arc, false]);
        if (!cell.dim) L.fill.push(...fillConvex(sector(cx, cy, h, a0, a1), o.fill, o.pitch, o.angle, o.seed));
      }
    }
  } else stitches(rows, G, g, o, L, fillOn, fillOff, ring);

  // letters under their columns
  for (const lab of G.labels) {
    const h = Math.min(0.6 * cw, g.labelMax), cx = lab.left ? X(lab.c) + textWidth(lab.ch, h) / 2 + 0.1 * cw : X(lab.c) + lab.span * cw / 2;
    drawText(lab.ch, cx, Y(lab.r) + (g.ch - h) / 2, h, L.text);
  }
}

// Knitted fabric after UTP's fabric renderer: V legs for knit, bumps for purl, specials on top, drawn top row first.
function stitches(rows, G, g, o, L, fillOn, fillOff, ring) {
  const r = rng(o.seed * 7 + 1), w = g.cw, wob = o.wobble, R = rows.length, P = painter(w);
  const hs = rows.map(() => g.ch * (1 + (r() - 0.5) * 0.12 * wob)), k = g.ch * R / hs.reduce((a, b) => a + b, 0);
  const ys = []; let yy = g.y0; for (let i = 0; i < R; i++) { ys.push(yy); yy += hs[i] * k; }
  // fabric gaps: shading behind the stitches, left showing only between the legs
  if (o.gaps === "shaded") for (let rr = 0; rr < R; rr++) rows[rr].forEach((cell, c) => { if (cell) P.add({ fill: fillConvex(rect(g.x0 + c * w, ys[rr], w, hs[rr] * k), "lines", Math.max(0.5, o.pitch * 1.2), o.angle + 90, o.seed) }); });
  const raised = [], leg = (cx, cy, rot, fill, h) => { const E = ellipse(cx, cy, w * 0.23, h * 0.54, rot, 24); P.add({ outline: [[E, true]], fill: fill(E) }, [E]); };
  const knitV = (x, y, h, fill, tilt) => { leg(x + w / 2 - 0.21 * w, y + h / 2, -26 + tilt, fill, h); leg(x + w / 2 + 0.21 * w, y + h / 2, 26 + tilt, fill, h); };
  const none = () => [];
  for (let rr = 0; rr < R; rr++) {
    const h = hs[rr] * k, drift = (r() - 0.5) * 2 * wob; let run = 0;
    rows[rr].forEach((cell, col) => {
      if (!cell) { run = 0; return; }
      const v = cell.v ?? stateFor(cell.on, o.carrier), x = g.x0 + col * w + (r() - 0.5) * 0.08 * w * wob, y = ys[rr] + (r() - 0.5) * 0.07 * h * wob, tilt = (r() - 0.5) * 8 * wob + drift;
      const on = cell.dim ? none : fillOn, off = cell.dim ? none : fillOff, cx = x + w / 2, cy = y + h / 2;
      if (cell.carry) ring(cx, cy);
      run = col > 0 && rows[rr][col - 1] && (rows[rr][col - 1].v ?? "") === v ? run + 1 : 0;
      if (v === "purl") {
        const E = ellipse(cx, cy, w * 0.52, h * 0.36, tilt, 28), arc = [];
        for (let t = 0; t <= 8; t++) { const s = t / 8, u = 1 - s; arc.push([u * u * (x + w * 0.18) + 2 * u * s * cx + s * s * (x + w * 0.82), u * u * (cy - h * 0.06) + 2 * u * s * (cy - h * 0.2) + s * s * (cy - h * 0.06)]); }
        P.add({ outline: [[E, true]], fill: on(E).concat(o.fill === "none" ? [[arc, false]] : []) }, [E]);
      } else if (v === "yo") {
        const E = ellipse(cx, cy, w * 0.42, h * 0.44, 0, 24), hole = ellipse(cx, cy, w * 0.24, h * 0.26, 0, 20);
        P.add({ outline: [[E, true]], fill: off(E) }, [E]); P.add({ outline: [[hole, true]], fill: on(hole) }, [hole]);
      } else if (v === "k2tog" || v === "ssk") {
        const E = ellipse(cx, cy, w * 0.3, h * 0.62, (v === "k2tog" ? 38 : -38) + tilt, 24); P.add({ outline: [[E, true]], fill: off(E) }, [E]);
      } else {
        knitV(x, y, h, v === "B" ? on : off, tilt);
        if (v === "mb") raised.push(() => { const E = ellipse(cx, y + h * 0.45, w * 0.62, w * 0.62, 0, 32); P.add({ outline: [[E, true]], fill: on(E) }, [E]); });
        if (v === "pb") { const rb = Math.min(w, h) * 0.3, E = ellipse(cx, cy, rb, rb, 0, 20), gl = ellipse(cx - rb * 0.35, cy - rb * 0.35, rb * 0.28, rb * 0.28, 0, 10); P.add({ outline: [[E, true]], fill: on(E) }, [E]); P.add({ outline: [[gl, true]] }, [gl]); }
        if ((v === "c4f" || v === "c4b") && run % 4 === 0) raised.push(() => cable(P, g.x0 + col * w, y, w, h, v === "c4f", off));
      }
    });
  }
  raised.forEach(f => f());
  P.resolve(L);
}
// One 4-stitch crossing: two bands of two stitches each, the back one first, the front one over it.
// UTP's cable block is 4 rows with the crossing row at the bottom, so the twist spans that row and the 3 above it;
// bands end vertical at the pair centres, so one block's strands run on into the next.
function cable(P, x, y, w, h, leftLean, fill) {
  const [x0, x1] = [x + w, x + 3 * w], [top, bottom] = [y - 3.15 * h, y + 1.15 * h], hw = 0.82 * w;   // ends overlap the next block a little, closing the join
  const band = (from, to) => {
    const c = [], n = 20, mid = (top + bottom) / 2;
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; c.push([u ** 3 * from + 3 * u * u * t * from + 3 * u * t * t * to + t ** 3 * to, u ** 3 * bottom + 3 * u * u * t * mid + 3 * u * t * t * mid + t ** 3 * top]); }
    const nrm = c.map((p, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(n, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; });
    const lft = c.map((p, i) => [p[0] + nrm[i][0] * hw, p[1] + nrm[i][1] * hw]), rgt = c.map((p, i) => [p[0] - nrm[i][0] * hw, p[1] - nrm[i][1] * hw]);
    // fill pieces tile the band exactly; occluder pieces overlap a sample each way so nothing leaks through the seams.
    // No end caps: the band runs on into the next block's crossing.
    const quads = [], occ = [];
    for (let i = 0; i < n; i++) { quads.push([lft[i], lft[i + 1], rgt[i + 1], rgt[i]]); const a = Math.max(0, i - 1), b = Math.min(n, i + 2); occ.push([lft[a], lft[b], rgt[b], rgt[a]]); }
    P.add({ outline: [[lft, false], [rgt, false]], fill: quads.flatMap(fill) }, occ);
  };
  leftLean ? (band(x0, x1), band(x1, x0)) : (band(x1, x0), band(x0, x1));
}

// ---------------- build ----------------
const $ = id => document.getElementById(id);
const IDS = ["msg", "enc", "check", "cipher", "ckey", "hide", "carrier", "border", "width", "perline", "density", "seed", "look", "boxes", "gaps", "wobble", "fill", "pitch", "angle", "offfill", "caption", "tsize", "reveal", "tpen", "rpen", "page", "cellmax", "marks", "mount"];
const read = () => Object.fromEntries(IDS.map(k => [k, $(k).type === "range" ? +$(k).value : $(k).value]));
let last = null;

const { LOOKS, CARRIERS, ENCS, CHECKS, HIDES, CIPHERS } = STEGO;   // key strip vocabularies, shared with the decoder

function build(o) {
  // marks: the layout and margin come from markMode (on, borders, mount, retrofit, corners with a back label)
  const t0 = performance.now(), [W, H] = o.page.split("x").map(Number), mode = markMode(o), marksOn = !!mode.lay, M = mode.M;
  const L = { outline: [], fill: [], text: [], reveal: [] }, gates = [];
  let G;
  const openLayout = o.hide === "columns" || o.hide === "tape", labels = openLayout && /message/.test(o.caption);
  try { G = o.hide === "columns" ? layoutColumns(o, labels) : o.hide === "tape" ? layoutTape(o, labels) : layoutChart(o); }
  catch (err) { return { W, H, ...L, o, error: err instanceof Error ? err.message : String(err), gates: [["the settings make a pattern", false, String(err.message || err)]], ms: performance.now() - t0 }; }

  // caption lines: the message (for chart layouts; open layouts carry it under the columns), the code, or the parcel key
  let codeText = "";
  try { codeText = G.M ? G.M.code : letters(o).code; } catch { codeText = ""; }
  const plain = G.M ? G.M.plain : morse.normalize(o.msg).text, key = G.P?.output.keyCode;
  const cap = [], th = o.tsize, avail = W - 2 * M;
  const add = (s, h) => wrap(s, Math.max(4, Math.floor((avail / h * 6 + 1.6) / ADV))).forEach(l => cap.push({ s: l, h }));
  if (!openLayout && /message/.test(o.caption)) add(plain, th);
  if (/code/.test(o.caption) && codeText) add(codeText, Math.max(2.5, th * 0.55));
  if (o.caption === "key") key ? add("KEY " + key, Math.max(2.5, th * 0.5)) : add(plain, th);
  const capH = cap.reduce((s, c) => s + c.h * 1.55, 0) + (cap.length ? th * 0.7 : 0);

  // fit the cells into what is left
  const rows = o.look === "stitches" ? (G.stitches || G.rows) : G.rows, R = rows.length, C = Math.max(...rows.map(r => r.length));
  const aspect = o.look === "stitches" ? 0.78 : 1, extraC = o.look === "punch" ? 4.8 + 1.2 : o.look === "stitches" ? 0.8 : 0, extraR = o.look === "punch" ? 2 : o.look === "stitches" ? 0.8 : 0;
  // rounded to what the key strip carries (0.01 mm cells, 0.1 mm origin), so the decoder rebuilds the same cells
  const cw = Math.floor(Math.min(o.cellmax, (W - 2 * M) / (C + extraC), (H - 2 * M - capH) / ((R + extraR) * aspect)) * 100) / 100;
  const ch = cw * aspect, bw = C * cw, bh = R * ch, blockH = bh + extraR * ch + capH;
  const x0 = Math.round((W - bw) / 2 * 10) / 10, top = Math.max(M, (H - blockH) / 2), y0 = Math.round((top + extraR * ch / 2) * 10) / 10;
  const g = { x0, y0, cw, ch, labelMax: th };
  looks(G, g, o, L);
  let cy = y0 + bh + extraR * ch / 2 + (cap.length ? th * 0.7 : 0);
  for (const c of cap) { drawText(c.s, W / 2, cy, c.h, L.text); cy += c.h * 1.55; }

  const notes = [];
  if (marksOn) {
    const camera = G.kind === "chart" && C <= 127 && R <= 255 && !(o.look === "stitches" && UNITS[o.carrier]);
    if (camera) gates.push(...applyMarks(W, H, packRecord(2, {
      look: LOOKS.indexOf(o.look), carrier: CARRIERS.indexOf(o.carrier), border: o.border === "on" ? 1 : 0, enc: ENCS.indexOf(o.enc), check: CHECKS.indexOf(o.check), hide: HIDES.indexOf(o.hide),
      seed: o.seed, density: +o.density - 2, cipher: CIPHERS.indexOf(o.cipher), x0: Math.round(x0 * 10), y0: Math.round(y0 * 10), cw: Math.round(cw * 100), rows: R, cols: C,
      wobble: Math.round(o.wobble * 20), gaps: o.gaps === "shaded" ? 1 : 0, page: PAGES.indexOf(o.page), len: G.P?.output.key?.length ?? 0, fill: STEGO.FILLS.indexOf(o.fill),
    }), L, mode, [...L.outline, ...L.fill, ...L.text]));
    else notes.push(G.kind === "chart" ? "Machine marks left off: knitted cables, lace, bobbles and beads are read by eye." : "Machine marks left off: letter columns and tapes are read by eye.");
  }
  const all = [...L.outline, ...L.fill, ...L.text, ...L.reveal];
  const decodeOK = G.read === G.want;
  gates.push([G.kind === "chart" ? "UTP decodes the plotted chart back to the message" : "the laid-out cells read back to the message", decodeOK, decodeOK ? `"${G.read.slice(0, 40)}${G.read.length > 40 ? "..." : ""}"` : `read "${G.read.slice(0, 30)}" want "${G.want.slice(0, 30)}"`]);
  gates.push(["cells at least 2 mm (the pen can still draw a mark inside)", cw >= 2 - 1e-9, `${cw.toFixed(2)} mm`]);
  gates.push(["message carries at least one mark", rows.some(r => r.some(c => c && c.on)), ""]);
  const dropped = G.P ? G.P.message.dropped : G.M.dropped;
  if (dropped.length) notes.push(`Left out (the alphabet cannot carry them): ${[...new Set(dropped.map(d => d.char))].join(" ")}`);
  if (G.P) notes.push(...G.P.message.notes, ...G.P.output.checks);
  return { W, H, ...L, o, G: { kind: G.kind, R, C, read: G.read, want: G.want, how: howToRead(o, G) }, cw, key, notes, gates, decodeOK, points: all.reduce((s, [p]) => s + p.length, 0), ms: performance.now() - t0 };
}

function howToRead(o, G) {
  const glyph = isGlyph(o.enc);
  if (G.kind === "columns") {
    if (glyph) return `Each block is one letter drawn in ${packOf(o.enc).name}. Read left to right.`;
    if (o.enc === "morse") return "Each column is one letter in Morse, read top to bottom: a round mark is a dot, a long one a dash. Blank columns are spaces between words.";
    if (o.enc.startsWith("bacon")) return "Each column is one letter in Bacon's biliteral alphabet: five cells top to bottom, a mark is B and a blank is A (AAAAA is A). A historical / puzzle cipher, not modern security.";
    return "Each column is one letter: five cells top to bottom make a binary number, a mark is 1 (A = 00000, B = 00001, T = 10011, space = 11010, the dashed column).";
  }
  if (G.kind === "tape") return o.enc === "morse" ? "One Morse tape, left to right, line after line: a dot is one cell, a dash three, a gap of three between letters and seven between words." : "One tape of five-cell letters, left to right, line after line; the small letters mark where each starts.";
  if (o.hide === "scatter") return "The message cells are scattered through random texture along a route set by the seed; without the key the fabric reads as noise. Type the key into the UTP decoder to read it.";
  if (o.hide.startsWith("motif-")) return MOTIFS[o.hide.slice(6)].reading;
  return "Read it like a knitting chart: an asymmetric marker row at the bottom, message cells right to left and bottom up, a row of full cells on top. The UTP lab decodes it cell by cell.";
}

// ---------------- draw + export ----------------
function draw(r) {
  const cv = $("cv"), maxW = Math.min(780, Math.max(200, cv.parentElement.clientWidth - 30)), k = Math.min(maxW / r.W, Math.max(1.2, (innerHeight - 90) / r.H));
  cv.width = Math.round(r.W * k * devicePixelRatio); cv.height = Math.round(r.H * k * devicePixelRatio); cv.style.width = Math.round(r.W * k) + "px";
  const c = cv.getContext("2d"); c.setTransform(k * devicePixelRatio, 0, 0, k * devicePixelRatio, 0, 0);
  paint(c, r);
  const len = ps => ps.reduce((a, [p, cl]) => a + plen(p, cl), 0) / 1000;
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (r.error) { $("stats").innerHTML = `<span class="fail">These settings do not make a pattern: ${esc(r.error)}</span>`; $("how").textContent = ""; return; }
  $("stats").innerHTML = `<b>${r.G.C}</b> x <b>${r.G.R}</b> cells at <b>${r.cw.toFixed(2)} mm</b> · ${r.points} points · ${r.ms.toFixed(0)} ms<br>`
    + `<span class="sw" style="background:#26200f"></span>0.4 outline <b>${len(r.outline).toFixed(1)} m</b> · <span class="sw" style="background:#736b56"></span>0.3 fill <b>${len(r.fill).toFixed(1)} m</b> · <span class="sw" style="background:${r.o.tpen}"></span>text <b>${len(r.text).toFixed(1)} m</b>`
    + (r.reveal.length ? ` · <span class="sw" style="background:${r.o.rpen}"></span>reveal <b>${len(r.reveal).toFixed(1)} m</b>` : "") + "<br>"
    + r.gates.map(([n, ok, v]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "pass" : "FAIL"}</span> ${esc(n)} ${esc(v)}`).join("<br>")
    + (r.key ? `<br>parcel key <b>${esc(r.key)}</b>` : "") + (r.notes.length ? `<br><span class="note">${r.notes.map(esc).join("<br>")}</span>` : "");
  $("how").textContent = r.G.how;
}
function paint(c, r) {
  c.fillStyle = "#fbf7ec"; c.fillRect(0, 0, r.W, r.H); c.lineJoin = c.lineCap = "round";
  const stroke = (paths, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (const [p, cl] of paths) { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cl) c.closePath(); } c.stroke(); };
  stroke(r.fill, "#736b56", 0.3); stroke(r.outline, "#26200f", 0.4); stroke(r.marks || [], "#26200f", 0.4); stroke(r.text, r.o.tpen, 0.3);
  c.globalAlpha = 0.85; stroke(r.reveal, r.o.rpen, 0.35); c.globalAlpha = 1;
}
// marks are their own pen, first: a retrofit plots only this file onto a sheet that is already drawn
const penLayers = r => [
  { name: "marks", colour: "000000", w: 0.4, paths: r.marks || [] },
  { name: "outline", colour: "000000", w: 0.4, paths: r.outline },
  { name: "fill", colour: "555555", w: 0.3, paths: r.fill },
  { name: "text", colour: r.o.tpen.slice(1), w: 0.3, paths: r.text },
  { name: "reveal", colour: r.o.rpen.slice(1), w: 0.3, paths: r.reveal },
].filter(L => L.paths.length);
const toSVG = (r, only = null, ticks = false) => svgOf(r, penLayers(r), `PLG purloined plot studio (UTP ${UTP_REV})`, only, ticks);

function sync() { for (const k of IDS) { const out = $("o-" + k); if (out) out.textContent = $(k).value; } }
let pending = 0;
function run() { sync(); $("stats").textContent = "drawing"; clearTimeout(pending); pending = setTimeout(() => { last = build(read()); draw(last); }, 80); }

const PRESETS = {
  parcel: { msg: "THE PURLOINED PARCEL", enc: "fivebit", hide: "columns", look: "dots", boxes: "on", fill: "spiral", pitch: 0.6, offfill: "none", caption: "message", perline: 22, cellmax: 9 },
  stitches: { msg: "MEET AT DAWN", enc: "fivebit", check: "none", hide: "chart", carrier: "purl-relief", border: "on", width: 18, look: "stitches", gaps: "shaded", fill: "lines", pitch: 0.7, angle: 60, offfill: "none", caption: "message", wobble: 0.5 },
  scatter: { msg: "THE KEY IS UNDER THE MAT", enc: "fivebit", check: "parity", hide: "scatter", density: "3", carrier: "two-colour", width: 28, look: "blocks", fill: "cross", pitch: 0.8, offfill: "none", caption: "key", reveal: "off" },
  motif: { msg: "HOLD FAST", enc: "fivebit", check: "none", hide: "motif-diamond", carrier: "purl-relief", border: "off", width: 30, look: "dots", boxes: "off", fill: "contour", pitch: 0.6, caption: "message" },
  morse: { msg: "SOS WE ARE KNITTING", enc: "morse", hide: "tape", width: 40, look: "dots", boxes: "off", fill: "zigzag", pitch: 0.55, angle: 90, caption: "message code" },
  punch: { msg: "RED CAPS IN TRONDHEIM", enc: "fivebit", check: "parity", hide: "chart", carrier: "two-colour", border: "off", width: 24, look: "punch", fill: "spiral", pitch: 0.55, offfill: "none", caption: "message" },
  truchet: { msg: "NOTHING TO SEE HERE", enc: "fivebit", check: "parity", hide: "scatter", density: "2", carrier: "purl-relief", width: 26, look: "truchet", fill: "contour", pitch: 0.7, caption: "none" },
  cables: { msg: "YES", enc: "fivebit", check: "none", hide: "chart", carrier: "cable", border: "off", width: 24, look: "stitches", gaps: "shaded", fill: "lines", pitch: 0.8, angle: 45, offfill: "none", caption: "message", wobble: 0.3 },
  bacon: { msg: "HIDE IN PLAIN SIGHT", enc: "bacon26", hide: "columns", look: "cross", boxes: "on", fill: "none", caption: "message code", perline: 16 },
};
document.querySelectorAll("[data-preset]").forEach(b => (b.onclick = () => { for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) $(k).value = v; run(); }));
$("reroll").onclick = () => { $("seed").value = 1 + Math.floor(Math.random() * 999); run(); };
IDS.forEach(k => $(k).addEventListener("input", run));
const save = (text, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const stem = o => `plg-stego-${o.hide}-${o.enc}-${o.look}-${o.fill}-s${o.seed}-${o.msg.replace(/[^A-Z0-9]/gi, "").slice(0, 20)}`;
$("export").onclick = () => { if (last && !last.error) save(toSVG(last, null, $("ticks").value === "on"), stem(last.o) + ".svg"); };
$("split").onclick = () => {
  if (!last || last.error) return;
  const ls = penLayers(last), ticks = $("ticks").value !== "off";
  ls.forEach((L, i) => setTimeout(() => save(toSVG(last, L.name, ticks), `${stem(last.o)}-${i + 1}of${ls.length}-${L.name}.svg`), i * 500));
};
addEventListener("resize", () => last && draw(last));
if ($("rev")) $("rev").textContent = UTP_REV;

// Settings label for the back: the key strip with its own finders, and the settings in words (never the message or keys).
const labelPairs = o => Object.entries(o).filter(([k]) => !/^(msg|ckey|pkey|tpen|rpen)$/.test(k));
const labelSVG = r => { const lab = labelSheet(r.marks.bits, "PLG PURLOINED PLOT", labelPairs(r.o)); return svgOf(lab, [{ name: "marks", colour: "000000", w: 0.4, paths: lab.marks }, { name: "text", colour: "000000", w: 0.3, paths: lab.text }], "PLG PURLOINED PLOT settings label"); };
$("label").onclick = () => { if (!last || last.error) return; if (!last.marks || !last.marks.bits) { $("stats").insertAdjacentHTML("afterbegin", '<span class="fail">Turn machine marks on (any kind) to make a settings label.</span><br>'); return; } save(labelSVG(last), stem(last.o) + "-label.svg"); };
wireSettingsLoader($, IDS, run);
window.__studio = { applySettings: obj => applySettings(obj, IDS, $), IDS, labelSVG, build, read, PRESETS, penLayers, paint, toSVG, fillConvex };   // hooks for checking
run();
