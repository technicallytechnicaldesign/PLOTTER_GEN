// Markless reading: plots made without the corner targets (or by other tools) read from four tapped grid corners.
// Nothing is rebuilt from settings. Each cell is measured for the one thing that tells its two states apart
// (Truchet: which corners hold the arcs; stitches: a hatched purl bump or an open knit V; dots, blocks, crosses:
// ink or none), the measurements are split into two groups, and the bit grid is tried against every UTP layout:
// the reading whose START/END frame and checks come out clean wins.
"use strict";
import { homography, project } from "@utp/photo";
import { readGrid } from "@utp/grid";
import { decodeFrame, DEFAULT_OPTIONS } from "@utp/errorcontrol";
import * as morse from "@utp/morse";
import * as bacon from "@utp/bacon";
import { decodeWithKey } from "@utp/unhide";
import { unframe, transform } from "@utp/grid";
import { scatterRoute, SYNC } from "@utp/stego";
import { KEY_FORMAT } from "@utp/key";
export { homography, project };   // for the page and freegrid-debug.mjs

// ---------------- measuring cells ----------------
// Grid units: u across 0..C, v down 0..R, one cell per unit. The quad is the grid's four outer corners in photo pixels (TL TR BR BL).
function sampler(I, quad, C, R) {
  const Hm = homography([[0, 0], [C, 0], [C, R], [0, R]], quad), at = (x, y) => { const i = Math.round(x), j = Math.round(y); return i < 0 || j < 0 || i >= I.w || j >= I.h ? 0 : I.dark[j * I.w + i]; };
  const cellPx = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) / C;
  return {
    cellPx,
    area: (u, v) => { const [x, y] = project(Hm, [u, v]); return at(x, y); },
    // darkest pixel within about a pen width: a line a little off where it is expected still counts
    line: (u, v) => { const [x, y] = project(Hm, [u, v]), r = Math.max(1, Math.round(cellPx * 0.04)); let m = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) m = Math.max(m, at(x + dx, y + dy)); return m; },
  };
}
const arc = (cu, cv, a0, a1) => Array.from({ length: 9 }, (_, k) => { const t = a0 + (a1 - a0) * (k + 0.5) / 9; return [cu + 0.5 * Math.cos(t), cv + 0.5 * Math.sin(t)]; });
// One number per cell; a larger number means value 1.
export const FEATURES = {
  // arcs round the top-right and bottom-left corners (1) against the top-left and bottom-right ones (0)
  truchet: (s, c, r) => {
    const one = [...arc(c + 1, r, Math.PI / 2, Math.PI), ...arc(c, r + 1, -Math.PI / 2, 0)], zero = [...arc(c, r, 0, Math.PI / 2), ...arc(c + 1, r + 1, Math.PI, 1.5 * Math.PI)];
    return one.reduce((a, [u, v]) => a + s.line(u, v), 0) / one.length - zero.reduce((a, [u, v]) => a + s.line(u, v), 0) / zero.length;
  },
  // inside a knit V's two lobes the paper is bare; a purl's hatched oval covers those same two spots
  // (an oval over the whole middle also caught the V's outlines, and knit and purl measured 0.3 against 0.5)
  stitches: (s, c, r) => meanIn(s, c, r, (x, y) => ((x - 0.3) / 0.1) ** 2 + ((y - 0.45) / 0.13) ** 2 <= 1 || ((x - 0.7) / 0.1) ** 2 + ((y - 0.45) / 0.13) ** 2 <= 1),
  dots: (s, c, r) => meanIn(s, c, r, (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.22 ** 2),
  blocks: (s, c, r) => meanIn(s, c, r, (x, y) => Math.abs(x - 0.5) < 0.3 && Math.abs(y - 0.5) < 0.3),
  cross: (s, c, r) => { let a = 0; for (let k = 1; k < 10; k++) { const t = 0.15 + 0.7 * k / 10; a += s.line(c + t, r + t) + s.line(c + 1 - t, r + t); } return a / 18; },
};
function meanIn(s, c, r, inside) { let a = 0, n = 0; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const x = (i + 0.5) / 9, y = (j + 0.5) / 9; if (inside(x, y)) { a += s.area(c + x, r + y); n++; } } return a / Math.max(1, n); }

// Two groups by 2-means; the score is how far apart they sit against how spread each is.
function split(f) {
  let lo = Math.min(...f), hi = Math.max(...f);
  for (let k = 0; k < 25; k++) { const cut = (lo + hi) / 2, a = f.filter(v => v <= cut), b = f.filter(v => v > cut); if (a.length) lo = a.reduce((s, v) => s + v, 0) / a.length; if (b.length) hi = b.reduce((s, v) => s + v, 0) / b.length; }
  const cut = (lo + hi) / 2, sd = Math.sqrt(f.reduce((s, v) => s + (v - (v > cut ? hi : lo)) ** 2, 0) / f.length);
  return { cut, lo, hi, score: (hi - lo) / (sd + 0.01), weak: f.filter(v => Math.abs(v - cut) < (hi - lo) * 0.15).length };
}
// Every cell as a small picture (a 12 x 12 patch of darkness), split into two kinds by k-means. This needs no model of
// how a stitch or a tile was drawn, only that there are two kinds: hand-picked sample spots failed on the real stitch
// photo (knit and purl measured 0.3 against 0.6 with half the cells unsure).
const G = 12;
function patches(s, C, R) {
  const out = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const p = new Float32Array(G * G); for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) p[j * G + i] = s.area(c + (i + 0.5) / G, r + (j + 0.5) / G); out.push(p); }
  return out;
}
const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };
// Seeded from a median split on a rough cue (ink for most looks, arc side for Truchet): starting from the two most
// extreme patches let one odd cell take a whole cluster.
function kmeans2(P, cue) {
  const med = P.map(cue).slice().sort((x, y) => x - y)[Math.floor(P.length / 2)], avg = sel => { const t = new Float32Array(P[0].length), s = P.filter(sel); for (const p of s) for (let i = 0; i < p.length; i++) t[i] += p[i] / Math.max(1, s.length); return t; };
  let a = avg(p => cue(p) <= med), b = avg(p => cue(p) > med);
  let lab = [];
  for (let it = 0; it < 12; it++) {
    lab = P.map(p => (d2(p, a) <= d2(p, b) ? 0 : 1));
    const na = new Float32Array(a.length), nb = new Float32Array(a.length); let ca = 0, cb = 0;
    P.forEach((p, k) => { const t = lab[k] ? nb : na; for (let i = 0; i < p.length; i++) t[i] += p[i]; lab[k] ? cb++ : ca++; });
    if (!ca || !cb) break;
    a = na.map(v => v / ca); b = nb.map(v => v / cb);
  }
  return { a, b, lab };
}
export function measure(I, quad, C, R, look) {
  const s = sampler(I, quad, C, R), P = patches(s, C, R), ink = p => p.reduce((x, v) => x + v, 0), { a, b } = kmeans2(P, look === "truchet" ? truchetSign : ink);
  // which kind is 1: the more inked one, or for Truchet the one whose arcs sit on the top-right and bottom-left corners
  const one = look === "truchet" ? truchetSign(b) > truchetSign(a) : b.reduce((x, v) => x + v, 0) > a.reduce((x, v) => x + v, 0);
  const [c0, c1] = one ? [a, b] : [b, a], sep = Math.sqrt(d2(c0, c1));
  // per cell: how much nearer it sits to kind 1 than to kind 0, in units of the distance between the two
  const f = P.map(p => (Math.sqrt(d2(p, c0)) - Math.sqrt(d2(p, c1))) / (sep || 1));
  // Fisher-style score: distance between the two kinds against the typical distance of a cell from its own kind
  const within = P.reduce((x, p, k) => x + Math.sqrt(d2(p, f[k] > 0 ? c1 : c0)), 0) / P.length;
  return { f, cut: 0, lo: -1, hi: 1, score: sep / (within + 1e-6), weak: f.filter(v => Math.abs(v) < 0.3).length, sp: s };
}
// On a 12 x 12 patch: ink along the top-right and bottom-left arcs, less ink along the other two.
function truchetSign(p) {
  const G = Math.round(Math.sqrt(p.length)), at = (u, v) => p[Math.min(G - 1, Math.floor(v * G)) * G + Math.min(G - 1, Math.floor(u * G))];
  let one = 0, zero = 0;
  for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9 * Math.PI / 2; one += at(1 - 0.5 * Math.cos(t), 0.5 * Math.sin(t)) + at(0.5 * Math.cos(t), 1 - 0.5 * Math.sin(t)); zero += at(0.5 * Math.cos(t), 0.5 * Math.sin(t)) + at(1 - 0.5 * Math.cos(t), 1 - 0.5 * Math.sin(t)); }
  return one - zero;
}

// ---------------- finding each cell where it actually is ----------------
// The plot's hand wobble moves every row and stitch a fraction of a cell off any regular grid, so a fixed grid reads some cells
// from the wrong spot. Here the photo is straightened once (a coarse quad is enough), and then every cell is searched for within
// a quarter cell each way: two shapes (the two kinds of cell) are learned from the cells themselves and each cell is matched, at
// its best offset, to whichever shape it fits better; the shapes are then re-learned from the matched cells. Nothing about how a
// stitch or a tile is drawn is assumed, only that there are two kinds.
const AS = 24, AM = 1.5;   // px per cell (default), margin in cells around the grid in the straightened picture
export function straighten(I, quad, C, R, S = AS) {
  const W = Math.round((C + 2 * AM) * S), H = Math.round((R + 2 * AM) * S), Hm = homography([[0, 0], [C, 0], [C, R], [0, R]], quad), D = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [px, py] = project(Hm, [x / S - AM, y / S - AM]), i = Math.floor(px), j = Math.floor(py);
    if (i < 0 || j < 0 || i >= I.w - 1 || j >= I.h - 1) continue;
    const fu = px - i, fv = py - j, o = j * I.w + i, d = I.dark;
    D[y * W + x] = (d[o] * (1 - fu) + d[o + 1] * fu) * (1 - fv) + (d[o + I.w] * (1 - fu) + d[o + I.w + 1] * fu) * fv;
  }
  return { D, W, H, C, R, S };
}
const cellPatch = (A, r, c, ox, oy, out) => {   // ox, oy in px of the straightened picture; outside the picture reads as bare paper
  const S = A.S, x0 = Math.round((c + AM) * S) + ox, y0 = Math.round((r + AM) * S) + oy;
  for (let j = 0; j < S; j++) { const y = y0 + j; for (let i = 0; i < S; i++) { const x = x0 + i; out[j * S + i] = x < 0 || y < 0 || x >= A.W || y >= A.H ? 0 : A.D[y * A.W + x]; } }
  return out;
};
// track: each cell is searched around where its already-placed neighbours sit (row by row, then back up), so a slow drift of
// a whole photo corner (paper curl, lens) is followed as far as it goes, where a fixed search would lose the cells after
// a fraction of a cell. maxDrift caps how far a cell may end up from the straight grid, in cells.
export function measureAligned(I, quad, C, R, look, { res = AS, iters = 7, A = null, maxDrift = 1.4 } = {}) {
  A = A || straighten(I, quad, C, R, res);
  const S = A.S, reach = Math.max(2, Math.round(S * 5 / 24)), n = C * R, K = S * S, tmp = new Float32Array(K), lim = Math.round(maxDrift * S);
  const P0 = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) P0.push(Float32Array.from(cellPatch(A, r, c, 0, 0, tmp)));
  const cue = look === "truchet" ? truchetSign : p => { let s = 0; for (let j = 0; j < K; j++) { const x = (j % S) / S - 0.5, y = Math.floor(j / S) / S - 0.5; if ((x / 0.32) ** 2 + (y / 0.12) ** 2 <= 1) s += p[j]; } return s; };
  let { a, b } = kmeans2(P0, cue);
  const lab = new Uint8Array(n), off = Array.from({ length: n }, () => [0, 0]), placed = new Uint8Array(n), cost = new Float32Array(n), margin = new Float32Array(n);
  const nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const prior = (r, c) => { let sx = 0, sy = 0, m = 0; for (const [dr, dc] of nb) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= R || cc >= C || !placed[rr * C + cc]) continue; sx += off[rr * C + cc][0]; sy += off[rr * C + cc][1]; m++; } return m ? [Math.round(sx / m), Math.round(sy / m)] : [0, 0]; };
  for (let it = 0; it < iters; it++) {
    if (it === 0) placed.fill(0);
    const na = new Float32Array(K), nb2 = new Float32Array(K); let ca = 0, cb = 0;
    const order = it % 2 === 0 ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
    for (const k of order) {
      const r = Math.floor(k / C), c = k % C, [px, py] = prior(r, c);
      let bestA = 1e9, bestB = 1e9, oa = [0, 0], ob = [0, 0];
      for (let oy = py - reach; oy <= py + reach; oy++) for (let ox = px - reach; ox <= px + reach; ox++) {
        if (Math.abs(ox) > lim || Math.abs(oy) > lim) continue;
        const p = cellPatch(A, r, c, ox, oy, tmp), pen = 0.02 * ((ox - px) ** 2 + (oy - py) ** 2);   // ties go to the neighbours' offset
        const da = d2(p, a) + pen, db = d2(p, b) + pen;
        if (da < bestA) { bestA = da; oa = [ox, oy]; } if (db < bestB) { bestB = db; ob = [ox, oy]; }
      }
      lab[k] = bestA <= bestB ? 0 : 1; off[k] = lab[k] ? ob : oa; placed[k] = 1; cost[k] = lab[k] ? bestB : bestA; margin[k] = Math.abs(bestA - bestB) / (bestA + bestB + 1e-6);
    }
    for (let k = 0; k < n; k++) { const p = cellPatch(A, Math.floor(k / C), k % C, off[k][0], off[k][1], tmp), t = lab[k] ? nb2 : na; for (let j = 0; j < K; j++) t[j] += p[j]; lab[k] ? cb++ : ca++; }
    if (!ca || !cb) break;
    a = na.map(v => v / ca); b = nb2.map(v => v / cb);
  }
  const one = look === "truchet" ? truchetSign(b) > truchetSign(a) : b.reduce((x, v) => x + v, 0) > a.reduce((x, v) => x + v, 0);
  const [c0, c1] = one ? [a, b] : [b, a], sep = Math.sqrt(d2(c0, c1));
  const f = Array.from(lab, (l, k) => (((one ? l : 1 - l) ? 1 : -1) * margin[k]));
  const within = cost.reduce((x, v) => x + Math.sqrt(v), 0) / n;
  return { f, cut: 0, lo: -1, hi: 1, score: sep / (within + 1e-6), weak: f.filter(v => Math.abs(v) < 0.15).length, off, A, kinds: [c0, c1] };
}
// The paper, found before anything is measured on it: what lies round a sheet (a cutting mat with a printed ruler, a desk) is
// darker than the paper, or brighter but cut off from it by the mat. Ink is a thin line, so the brightest pixel of each small
// block ignores it; blocks split into paper and not-paper at the gap between the two brightness groups (Otsu), and the paper is
// the connected patch of bright blocks holding the middle of the tapped area. Anything outside it (the mat's ruler lines, its
// grid) can no longer read as ink.
export function paperMask(I, quad, B = 8) {
  const bw = Math.ceil(I.w / B), bh = Math.ceil(I.h / B), bm = new Float32Array(bw * bh);
  for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const j = Math.floor(y / B) * bw + Math.floor(x / B), v = I.g[y * I.w + x]; if (v > bm[j]) bm[j] = v; }
  const hist = new Float64Array(64); for (const v of bm) hist[Math.min(63, Math.floor(v * 64))]++;
  let best = 0, thr = 0.5, tot = bm.length, sumAll = 0; hist.forEach((h, i) => { sumAll += h * i; });
  for (let t = 1, w0 = 0, s0 = 0; t < 64; t++) { w0 += hist[t - 1]; s0 += hist[t - 1] * (t - 1); const w1 = tot - w0; if (!w0 || !w1) continue; const m0 = s0 / w0, m1 = (sumAll - s0) / w1, sb = w0 * w1 * (m0 - m1) ** 2; if (sb > best) { best = sb; thr = t / 64; } }
  const bright = new Uint8Array(bw * bh); for (let i = 0; i < bright.length; i++) bright[i] = bm[i] >= thr ? 1 : 0;
  const cx = quad.reduce((a, p) => a + p[0], 0) / 4, cy = quad.reduce((a, p) => a + p[1], 0) / 4, seed = Math.floor(cy / B) * bw + Math.floor(cx / B);
  const mask = new Uint8Array(bw * bh);
  if (bright[seed]) { const st = [seed]; mask[seed] = 1; while (st.length) { const k = st.pop(), x = k % bw, y = (k - x) / bw; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= bw || b >= bh) continue; const n = b * bw + a; if (bright[n] && !mask[n]) { mask[n] = 1; st.push(n); } } } }
  else mask.fill(1);   // the middle is not bright (heavy ink or a dark photo): make no claim about the paper
  return { at: (x, y) => { const a = Math.floor(x / B), b = Math.floor(y / B); return a >= 0 && b >= 0 && a < bw && b < bh && mask[b * bw + a] === 1; }, thr, B, bw, bh, mask };
}
// Least-squares homography through many point pairs (src -> dst), for pulling the grid's outline to where the cells were found.
function homographyLS(src, dst) {
  const N = Array.from({ length: 8 }, () => new Float64Array(9)), K = 1000;
  for (let i = 0; i < src.length; i++) {
    const [X, Y] = src[i], u = dst[i][0] / K, v = dst[i][1] / K;
    for (const [row, rhs] of [[[X, Y, 1, 0, 0, 0, -u * X, -u * Y], u], [[0, 0, 0, X, Y, 1, -v * X, -v * Y], v]]) for (let a = 0; a < 8; a++) { for (let b = 0; b < 8; b++) N[a][b] += row[a] * row[b]; N[a][8] += row[a] * rhs; }
  }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(N[r][c]) > Math.abs(N[p][c])) p = r; [N[c], N[p]] = [N[p], N[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = N[r][c] / N[c][c]; for (let k = c; k < 9; k++) N[r][k] -= f * N[c][k]; } }
  const h = N.map((row, i) => row[8] / row[i]); return [h[0] * K, h[1] * K, h[2] * K, h[3] * K, h[4] * K, h[5] * K, h[6], h[7], 1];
}
// After a first reading the cells sit where they were found (offsets from the straight grid): fit one homography through those
// places and take its outline as the new quad, so the second reading starts nearly straight and has only the wobble left to follow.
export function refitQuad(quad, C, R, off, S) {
  const Hm = homography([[0, 0], [C, 0], [C, R], [0, R]], quad), src = [], dst = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { src.push([c + 0.5, r + 0.5]); dst.push(project(Hm, [c + 0.5 + off[r * C + c][0] / S, r + 0.5 + off[r * C + c][1] / S])); }
  const H2 = homographyLS(src, dst), pr = (x, y) => { const d = H2[6] * x + H2[7] * y + H2[8]; return [(H2[0] * x + H2[1] * y + H2[2]) / d, (H2[3] * x + H2[4] * y + H2[5]) / d]; };
  return [pr(0, 0), pr(C, 0), pr(C, R), pr(0, R)];
}
// Snap rough corners to the ink: look a little outside the tapped block, find where the drawing's ink starts and stops
// along each side (separately near each end, so a tilted or keystoned photo still fits), and intersect the four edges.
// Eyeballed corners were off by a sizeable share of a cell on the far side; a regular grid cannot survive that.
export function snap(I, quad, rounds = 3, paper = paperMask(I, quad)) {
  let q = quad.map(p => [...p]);
  for (let k = 0; k < rounds; k++) {
    const N = 400, Hm = homography([[0, 0], [1, 0], [1, 1], [0, 1]], q), at = (u, v) => { const [x, y] = project(Hm, [u, v]), i = Math.round(x), j = Math.round(y); return i < 0 || j < 0 || i >= I.w || j >= I.h || !paper.at(i, j) ? 0 : I.dark[j * I.w + i]; };
    // ink profile across u (for a band of v) and across v (for a band of u), from -0.1 to 1.1 of the block
    const prof = (along, lo, hi) => Array.from({ length: N }, (_, i) => { const t = -0.1 + 1.2 * i / (N - 1); let s = 0; for (let j = 0; j < 40; j++) { const o = lo + (hi - lo) * (j + 0.5) / 40; s += along === "u" ? (at(t, o) > 0.5 ? 1 : 0) : (at(o, t) > 0.5 ? 1 : 0); } return s / 40; });
    // grow out from the middle and stop at the first stretch of bare paper: that is the margin round the drawing
    // (scanning in from outside caught the mat's ruler and the caption, and snapped the grid onto the mat)
    const edges = p => {
      const mid = Math.round((N - 1) / 2), inner = p.slice(Math.round(N * 0.3), Math.round(N * 0.7)), thr = Math.max(0.01, 0.15 * inner.reduce((s, v) => s + v, 0) / inner.length), gapRun = Math.max(3, Math.round(N * 0.012));
      const walk = dir => { let last = mid, run = 0; for (let i = mid; i >= 0 && i < N; i += dir) { if (p[i] >= thr) { last = i; run = 0; } else if (++run >= gapRun) break; } return last; };
      return [-0.1 + 1.2 * walk(-1) / (N - 1), -0.1 + 1.2 * walk(1) / (N - 1)];
    };
    const [lT, rT] = edges(prof("u", 0.05, 0.35)), [lB, rB] = edges(prof("u", 0.65, 0.95)), [tL, bL] = edges(prof("v", 0.05, 0.35)), [tR, bR] = edges(prof("v", 0.65, 0.95));
    // edge lines in block units through the two measured points each, then their crossings
    const line = (p1, p2) => [p1, p2], cross = ([a, b], [c, d]) => { const x1 = a[0], y1 = a[1], x2 = b[0], y2 = b[1], x3 = c[0], y3 = c[1], x4 = d[0], y4 = d[1], den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; };
    const L = line([lT, 0.2], [lB, 0.8]), Rt = line([rT, 0.2], [rB, 0.8]), Tp = line([0.2, tL], [0.8, tR]), Bt = line([0.2, bL], [0.8, bR]);
    q = [cross(L, Tp), cross(Rt, Tp), cross(Rt, Bt), cross(L, Bt)].map(uv => project(Hm, uv));
  }
  return q;
}
// Nudge the tapped corners (and try a cell more or less each way) until the two groups sit furthest apart.
export function fit(I, quad0, C, R, look, { searchSize = true, snapToInk = true, slide = true, nudge = true } = {}) {
  let quad = snapToInk ? snap(I, quad0) : quad0;
  if (slide)
  // the ink's edge is not the grid's edge (leaning stitches overhang their cells), so slide the whole grid up to half a
  // cell each way and keep the offset where the two groups separate best
  { const Hm = homography([[0, 0], [C, 0], [C, R], [0, R]], quad), at = (a, b) => [[a, b], [C + a, b], [C + a, R + b], [a, R + b]].map(p => project(Hm, p));
    let bs = -1, bq = quad;
    for (let a = -0.5; a <= 0.5001; a += 0.05) for (let b = -0.5; b <= 0.5001; b += 0.05) { const q = at(a, b), m = measure(I, q, C, R, look); if (m.score > bs) { bs = m.score; bq = q; } }
    quad = bq; }
  let best = { quad, C, R, ...measure(I, quad, C, R, look) };
  const sizes = searchSize ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[0, 0]];
  for (const [dc, dr] of sizes) {
    const Cn = C + dc, Rn = R + dr; if (Cn < 3 || Rn < 3) continue;
    let q = quad.map(p => [...p]), cur = { quad: q, C: Cn, R: Rn, ...measure(I, q, Cn, Rn, look) };
    for (let step = best.sp.cellPx * 0.08; nudge && step > 0.5; step /= 2) {   // small: the snapped corners are already close
      let moved = true;
      for (let pass = 0; pass < 6 && moved; pass++) {
        moved = false;
        for (let i = 0; i < 4; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
          const tq = cur.quad.map((p, k) => (k === i ? [p[0] + dx, p[1] + dy] : p)), m = measure(I, tq, Cn, Rn, look);
          if (m.score > cur.score) { cur = { quad: tq, C: Cn, R: Rn, ...m }; moved = true; }
        }
      }
    }
    if (cur.score > best.score) best = cur;
  }
  return best;
}

// With the cell counts known, a bad corner tap can be put right by the grid itself: walk each corner (coarse steps, then fine)
// to where a C x R grid separates its two kinds of cell best. Used by readMarkless only when both counts are given.
export function fitKnownSize(I, quad0, C, R, look, { span = 2, res = 1 } = {}) {
  const score = q => { try { const m = measure(I, q, C, R, look); return m.score * (1 - m.weak / m.f.length); } catch { return -1; } };
  let cur = quad0.map(p => [...p]), cs = score(cur);
  const cell0 = Math.hypot(cur[1][0] - cur[0][0], cur[1][1] - cur[0][1]) / C;
  const home = quad0.map(p => [...p]), reach = span * cell0;
  for (let step = cell0 * 0.5; step > cell0 * 0.03; step /= 2) {
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (let i = 0; i < 4; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const p = [cur[i][0] + dx, cur[i][1] + dy];
        if (Math.hypot(p[0] - home[i][0], p[1] - home[i][1]) > reach) continue;
        const tq = cur.map((q, k) => (k === i ? p : q)), sc = score(tq);
        if (sc > cs) { cur = tq; cs = sc; moved = true; }
      }
      if (!moved) break;
    }
  }
  return cur;
}

// The snap can run a corner two cells along an edge (it lands on a stray bit of ink). With the size known, a tap is trusted to
// within about a cell: a snapped corner that moved further than that is pulled back onto that radius, along the line to its tap.
export function clampSnap(snapped, taps, C, lim = 1) {
  const cell = Math.hypot(taps[1][0] - taps[0][0], taps[1][1] - taps[0][1]) / C, r = lim * cell;
  return snapped.map((p, i) => { const dx = p[0] - taps[i][0], dy = p[1] - taps[i][1], d = Math.hypot(dx, dy); return d <= r ? p : [taps[i][0] + dx / d * r, taps[i][1] + dy / d * r]; });
}

// ---------------- reading the bits as UTP would have laid them ----------------
const EC = { none: { code: "plain", separator: false, checksum: false }, parity: DEFAULT_OPTIONS, hamming: { code: "hamming", separator: true, checksum: true } };
const clean = t => t.replace(/[^A-Z0-9 .?]/g, "").length;
// A reading's worth: characters that decoded cleanly, less a heavy cost for every reported issue.
function worth(text, issues = 0) { const good = clean(text), bad = text.length - good; return good - 3 * bad - 4 * issues; }
// Does the text read as language? A reading with no checks of its own (no separator, no parity) turns any bits into letters,
// so the layouts with checks are told from the ones without by whether words come out. A short list of common English words
// (generic, not from any test message) earns their letters; a word with a plausible vowel share earns half; the rest costs.
const COMMON = new Set(("A I AM AN AND ARE AS AT BE BUT BY CAN DO FOR FROM GO HAD HAS HAVE HE HER HERE HIM HIS HOW IF IN IS IT ITS KEY LET ME MY NO NOT NOW OF OFF ON ONE OR OUR OUT OVER SEE SHE SO THAT THE THEIR THEM THEN THERE THEY THIS TO TOO UNDER UP US WAS WE WELL WHAT WHEN WHERE WHO WILL WITH YES YOU YOUR ALL ANY BEEN BOTH CAME COME DAY EACH EVER FIND FIRST GET GIVE GOOD HAND HOME KNOW LIFE LIKE LONG LOOK LOVE MAKE MANY MEET MORE MOST MUST NAME NEW NEXT ONLY OPEN OTHER PART SAID SAME SOME TAKE TELL TIME UPON VERY WANT WAY WORK YEAR").split(" "));
export function lang(text) {
  let sc = 0;
  for (const raw of text.split(/\s+/)) {
    const w = raw.replace(/[^A-Z0-9?]/g, "");
    if (!w) continue;
    if (/[^A-Z]/.test(w)) { sc -= w.length; continue; }
    const v = (w.match(/[AEIOUY]/g) || []).length / w.length;
    if (COMMON.has(w)) sc += 1.5 * w.length;
    else if (w.length >= 3 && v >= 0.2 && v <= 0.65 && !/[^AEIOUY]{5}/.test(w) && !/[QJXZ].*[QJXZ]/.test(w)) sc += 0.5 * w.length;
    else sc -= w.length;
  }
  return sc;
}
// Seeds whose first sixteen route cells hold the sync pattern in this field, in any of its eight turns (the seed is part of the
// key, which a label would carry; with no label it can still be found, because a wrong seed has about 1 chance in 8000 of passing).
export function findSeeds(up, border, { from = 0, to = 4000 } = {}) {
  const inner = unframe(up, border), h = inner.length, w = inner[0].length, out = [];
  const turns = [false, true].flatMap(r => [false, true].flatMap(m => [false, true].map(i => ({ rotated180: r, mirrored: m, inverted: i }))));
  const fields = turns.map(o => transform(inner, o));
  for (let seed = from; seed <= to; seed++) {
    const route = scatterRoute(seed, SYNC.length, w * h);
    if (fields.some(f => route.every((pos, i) => f[Math.floor(pos / w)][pos % w] === SYNC[i]))) out.push(seed);
  }
  return out;
}
export function readings(grid, { seed = null } = {}) {
  const up = grid.slice().reverse(), R = up.length, C = up[0].length, out = [];
  for (const b of [0, 1, 2]) {
    if (C - 2 * b < 3 || R - 2 * b < 3) continue;
    const g = readGrid(up, b), place = `knitting chart, border ${b}`, add = (enc, text, base) => out.push({ layout: place, enc, text, worth: base + lang(text) });
    for (const [name, ec] of Object.entries(EC)) { const d = decodeFrame(g.bits, ec); add(`five-bit, ${name === "none" ? "no" : name} checks`, d.text, worth(d.text, d.issues.length) + (d.ok ? 5 : 0)); }
    const m = morse.decodeUnits(g.bits); add("Morse", m.text, worth(m.text, m.issues.length));
    for (const v of ["modern26", "historical24"]) { const d = bacon.decode(g.bits, v); add(`Bacon ${v === "modern26" ? 26 : 24}`, d.text, worth(d.text, d.invalidGroups.length) - 5); }
    // scattered: the sync cells at the start of the route say whether the seed is right, and the stream length is unknown so each is tried
    let seeds = [seed]; if (seed == null) { try { seeds = findSeeds(up, b); } catch { seeds = []; } }   // a wrong (tiny) size can leave too few cells for the route
    for (const sd of seeds) for (const [name, ec] of Object.entries(EC)) {
      let bestS = null;
      for (let len = 16 + 20; len <= (C - 2 * b) * (R - 2 * b); len++) {
        try {
          const key = { format: KEY_FORMAT, version: 1, hide: { mode: "scatter", seed: sd, filler: "texture", density: 2 }, encoding: { alphabet: "fivebit", errorControl: ec }, carrier: "purl-relief", border: b, width: C - 2 * b, height: R - 2 * b, length: len };
          const d = decodeWithKey(up, key), synced = !d.findings.some(f => /sync cells/.test(f.message));
          if (!synced) break;   // the sync cells do not depend on the length: a wrong seed or border fails for every length
          const w = worth(d.text) + lang(d.text) + (seed != null ? 30 : 4) + (d.ok ? 20 : 0);   // a searched seed passes sync by chance about half the time, so it earns little on its own
          if (!bestS || w > bestS.worth) bestS = { layout: `scattered (seed ${sd}), border ${b}`, enc: `five-bit, ${name === "none" ? "no" : name} checks`, text: d.text, worth: w };
        } catch { /* a length the canvas cannot hold */ }
      }
      if (bestS) out.push(bestS);
    }
  }
  return out.sort((a, b) => b.worth - a.worth);
}

// ---------------- how many cells across and down ----------------
// Ink laid out in cells repeats, so the darkness summed along the columns (and along the rows) of the straightened block
// repeats at the cell pitch; the lags where it best matches itself give candidate counts. A hatch line or a half-cell lobe
// repeats too, so there are several candidates and the caller tries each; the strongest few are kept.
export function guessCounts(I, quad, { top = 3 } = {}) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), Wp = (d(quad[0], quad[1]) + d(quad[3], quad[2])) / 2, Hp = (d(quad[0], quad[3]) + d(quad[1], quad[2])) / 2;
  const W = 800, H = Math.max(200, Math.round(800 * Hp / Wp)), Hm = homography([[0, 0], [W, 0], [W, H], [0, H]], quad), D = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [px, py] = project(Hm, [x, y]), i = Math.round(px), j = Math.round(py); D[y * W + x] = i < 0 || j < 0 || i >= I.w || j >= I.h ? 0 : I.dark[j * I.w + i]; }
  const profile = (n, m, f) => Array.from({ length: n }, (_, i) => { let s = 0; for (let k = 0; k < m; k++) s += f(i, k); return s / m; });
  const counts = (p, len) => {
    const n = p.length, m = p.reduce((a, b) => a + b, 0) / n, z = p.map(v => v - m), v0 = z.reduce((a, b) => a + b * b, 0) || 1;
    const a = Array.from({ length: Math.floor(n / 2) }, (_, l) => z.reduce((s, b, i) => s + (i + l < n ? b * z[i + l] : 0), 0) / v0 * n / (n - l));
    const peaks = []; for (let l = 8; l < a.length - 1; l++) if (a[l] > a[l - 1] && a[l] >= a[l + 1] && a[l] > 0.1) { const c = Math.round(len / l); if (c >= 3 && c <= 60) peaks.push([c, a[l]]); }
    const seen = new Set(); return peaks.sort((x, y) => y[1] - x[1]).filter(([c]) => (seen.has(c) ? false : seen.add(c))).slice(0, top).map(([c]) => c);
  };
  return { cols: counts(profile(W, H, (i, k) => D[k * W + i]), W), rows: counts(profile(H, W, (i, k) => D[i * W + k]), H) };
}

// ---------------- the markless read ----------------
// Tapped corners (rough) in, the readings out: the paper is found first so the ink search cannot run onto the mat, the taps are
// snapped to the drawing's own edge, the photo is straightened, and every cell is then found and read where it actually sits.
// C, R: how many cells across and down if known (a size within slack of the truth is enough: each size is tried and the one
// that reads as a message wins); without them the counts are guessed from the photo's own repeats.
export function readMarkless(I, taps, look, { C = null, R = null, slack = 1, seed = null, keep = 6, refine = 1, log = null } = {}) {
  const paper = paperMask(I, taps), snapped = snap(I, taps, 3, paper);
  // The snap can be fooled (a caption or a ruler right beside the drawing looks like more drawing), and the taps can be good
  // already, so both quads are carried and the readings themselves decide which fits.
  const quads = [{ tag: "snapped", q: snapped }, { tag: "taps", q: taps }];
  if (C && R) {   // known size: more starting points (the snap held back to a cell from its tap, corners walked to where that grid fits best)
    const held = clampSnap(snapped, taps, C);
    quads.push({ tag: "held", q: held }, { tag: "fitted", q: fitKnownSize(I, held, C, R, look) }, { tag: "tapfit", q: fitKnownSize(I, taps, C, R, look) });
  }
  const near = (list, k) => [...new Set(list.flatMap(c => range(c - k, c + k)))].filter(c => c >= 3);
  // every candidate size is tried first on a small straightened picture (cheap), the best few are then read at full detail
  const exact = 1.25, quality = m => m.score * (1 - m.weak / m.f.length), pre = [];
  const g = C && R ? null : guessCounts(I, snapped);
  const cs = C ? range(C - slack, C + slack) : near(g.cols, 1), rs = R ? range(R - slack, R + slack) : near(g.rows, 1);
  for (const Q of quads) for (const c of cs) for (const r of rs) pre.push({ C: c, R: r, Q, s: (C && R && c === C && r === R ? exact : 1) * quality(measureAligned(I, Q.q, c, r, look, { res: 10, iters: 4 })) });   // separation, less the share of cells that sit between the two kinds
  pre.sort((x, y) => y.s - x.s); log?.(`candidates ${pre.length}: ` + pre.slice(0, 6).map(t => `${t.Q.tag} ${t.C}x${t.R}=${t.s.toFixed(2)}`).join(" "));
  const tried = [];
  for (const p of pre.slice(0, keep)) {
    let q = p.Q.q, m = measureAligned(I, q, p.C, p.R, look);
    for (let pass = 0; pass < refine; pass++) { const q2 = refitQuad(q, p.C, p.R, m.off, m.A.S), m2 = measureAligned(I, q2, p.C, p.R, look); if (quality(m2) > quality(m)) { q = q2; m = m2; } }
    tried.push({ C: p.C, R: p.R, m, quad: q, from: p.Q.tag });
  }
  tried.sort((x, y) => quality(y.m) - quality(x.m));
  let best = null;
  for (const t of tried) {
    const grid = []; for (let r = 0; r < t.R; r++) grid.push(t.m.f.slice(r * t.C, (r + 1) * t.C).map(v => (v > 0 ? 1 : 0)));
    t.grid = grid; t.readings = readings(grid, { seed });
  }
  // A size the caller gave is trusted over the off-by-one sizes tried for slack: a wrong size can still produce letters that
  // look plausible, so the exact size takes the reading whenever it produced one at all.
  const given = t => (!C || t.C === C) && (!R || t.R === R), pool = (C || R) && tried.some(t => given(t) && t.readings.length) ? tried.filter(given) : tried;
  for (const t of pool) if (t.readings.length && (!best || t.readings[0].worth > best.readings[0].worth)) best = t;
  best = best || tried[0];
  if (!best) throw new Error("No repeating grid found; check the pattern and drawing corners.");
  return { quad: best.quad, paper, C: best.C, R: best.R, grid: best.grid, score: best.m.score, weak: best.m.weak, offsets: best.m.off, aligned: best.m, from: best.from, readings: best.readings || [], tried: tried.map(t => ({ from: t.from, C: t.C, R: t.R, score: +t.m.score.toFixed(2), weak: t.m.weak, worth: t.readings?.[0] ? Math.round(t.readings[0].worth) : null })) };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// The older read, kept for freegrid-debug.mjs: a regular grid nudged to the two-group split (fit), no per-cell search.
export function readFree(I, quad, C, R, look, opts = {}) {
  const g = fit(I, quad, C, R, look, opts), grid = [];
  for (let r = 0; r < g.R; r++) grid.push(g.f.slice(r * g.C, (r + 1) * g.C).map(v => (v > 0 ? 1 : 0)));
  return { ...g, grid, readings: readings(grid, opts) };
}
