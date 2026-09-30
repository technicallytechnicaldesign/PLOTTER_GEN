// Fit the rebuilt drawing onto a photo from four tapped corners that may be a few millimetres off (PLG-0475).
//
// The settings say exactly what was drawn, so the drawing is rendered as a template in page millimetres and the homography
// (page mm to photo px) is moved until the template and the photo's darkness correlate best. Two things make it survive a
// 3 to 4 mm tap error where nudging on the cells' picks did not:
//   1. the first fits use the expected ink: every candidate value of a cell counted equally, so no cell has to be read
//      before the drawing can be placed, and the photo and the template are blurred (1.0, 0.5, 0.25 mm) so a stroke that is
//      a few pixels off still pulls towards its place instead of sitting on a flat plain;
//   2. once the cells can be read, the template is redrawn from what was read and the fit is sharpened on that.
// A small pull back towards the taps settles ties between the repeats of a regular grid.
"use strict";
import { homography } from "@utp/photo";
import { densify } from "./core.js";

const RES = 0.2;   // template pixel, mm

// Separable box blur of radius r (pixels) with edge-clamped averages.
function boxBlur(src, w, h, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), P = new Float64Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    P[0] = 0; for (let x = 0; x < w; x++) P[x + 1] = P[x] + src[y * w + x];
    for (let x = 0; x < w; x++) { const lo = Math.max(0, x - r), hi = Math.min(w - 1, x + r); tmp[y * w + x] = (P[hi + 1] - P[lo]) / (hi - lo + 1); }
  }
  for (let x = 0; x < w; x++) {
    P[0] = 0; for (let y = 0; y < h; y++) P[y + 1] = P[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) { const lo = Math.max(0, y - r), hi = Math.min(h - 1, y + r); out[y * w + x] = (P[hi + 1] - P[lo]) / (hi - lo + 1); }
  }
  return out;
}
const blur2 = (src, w, h, r) => boxBlur(boxBlur(src, w, h, r), w, h, r);

// The drawing's ink as a raster in page mm. picks (optional): the value read for each cell; without them every candidate counts 1/n.
export function buildTemplate(cells, picks = null) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const see = ([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const c of cells) { if (Array.isArray(c.cands)) c.cands.forEach(ps => ps.forEach(([p]) => p.forEach(see))); else c.cands.area.forEach(see); }
  x0 -= 1.5; y0 -= 1.5; x1 += 1.5; y1 += 1.5;
  const nx = Math.ceil((x1 - x0) / RES), ny = Math.ceil((y1 - y0) / RES), E = new Float32Array(nx * ny), mark = new Int32Array(nx * ny);
  let id = 0;
  cells.forEach((c, ci) => {
    if (!Array.isArray(c.cands)) return;
    const n = c.cands.length;
    c.cands.forEach((ps, v) => {
      const wgt = picks ? (picks[ci].value === v ? 1 : 0) : 1 / n; if (!wgt || !ps.length) return;
      id++;
      for (const [p, cl] of ps) for (const [x, y] of (p.length > 1 ? densify(p, cl, RES * 0.7) : p)) {
        const i = Math.round((x - x0) / RES), j = Math.round((y - y0) / RES);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const k = b * nx + a; if (mark[k] !== id) { mark[k] = id; E[k] += wgt; } }
      }
    });
  });
  for (let k = 0; k < E.length; k++) if (E[k] > 1) E[k] = 1;
  return { E, x0, y0, x1, y1, nx, ny };
}

// One level: sample points over the template (all of them when coarse, the ink and its neighbourhood in full plus a thin
// scatter of the rest when fine), with the template's blurred value at each.
export function makeLevel(T, I, ppm, sigma, spacing, focus) {
  const r = Math.max(1, Math.round(sigma / RES)), B = blur2(T.E, T.nx, T.ny, r), pts = [];
  const step = Math.max(1, Math.round(spacing / RES));
  for (let j = 0; j < T.ny; j += step) for (let i = 0; i < T.nx; i += step) {
    const a = B[j * T.nx + i], keep = !focus || a > 0.03, thin = (Math.round(i / step) % 3 === 0) && (Math.round(j / step) % 3 === 0);
    if (keep) pts.push([T.x0 + i * RES, T.y0 + j * RES, a, 1]); else if (thin) pts.push([T.x0 + i * RES, T.y0 + j * RES, a, 9]);
  }
  const n = pts.length, X = new Float64Array(n), Y = new Float64Array(n), A = new Float64Array(n), Wt = new Float64Array(n);
  let sw = 0, sa = 0, saa = 0;
  pts.forEach(([x, y, a, w], k) => { X[k] = x; Y[k] = y; A[k] = a; Wt[k] = w; sw += w; sa += w * a; saa += w * a * a; });
  const ma = sa / sw, va = saa / sw - ma * ma;
  const pr = Math.max(1, Math.round(sigma * ppm)), D = blur2(I.dark, I.w, I.h, pr);
  return { X, Y, A, Wt, n, sw, ma, va, D, w: I.w, h: I.h, sigma };
}
// Weighted Pearson correlation between the template and the blurred photo under homography H (page mm to photo px).
export function corr(L, H) {
  const { X, Y, A, Wt, n, sw, ma, va, D, w, h } = L;
  let sb = 0, sbb = 0, sab = 0;
  for (let k = 0; k < n; k++) {
    const x = X[k], y = Y[k], den = H[6] * x + H[7] * y + H[8], u = (H[0] * x + H[1] * y + H[2]) / den, v = (H[3] * x + H[4] * y + H[5]) / den;
    let b = 0;
    if (u >= 0 && v >= 0 && u < w - 1 && v < h - 1) { const i = u | 0, j = v | 0, fu = u - i, fv = v - j, o = j * w + i; b = (D[o] * (1 - fu) + D[o + 1] * fu) * (1 - fv) + (D[o + w] * (1 - fu) + D[o + w + 1] * fu) * fv; }
    const wt = Wt[k]; sb += wt * b; sbb += wt * b * b; sab += wt * A[k] * b;
  }
  const mb = sb / sw, vb = sbb / sw - mb * mb, cov = sab / sw - ma * mb;
  return va > 1e-9 && vb > 1e-9 ? cov / Math.sqrt(va * vb) : -1;
}


// ---------------- snapping a tap to the paper corner ----------------
// The paper is brighter than what it lies on, and its corner is where two straight edges meet, so the corner is the spot where
// a patch of paper (the quadrant between the two edges) is brightest against the three patches outside it. This needs nothing
// from the drawing, so it works on a plot whose ink says little (a maze) and it fixes the tap before the drawing is fitted.
function grey(I, x, y) {
  if (x < 0 || y < 0 || x >= I.w - 1 || y >= I.h - 1) return NaN;
  const i = x | 0, j = y | 0, fu = x - i, fv = y - j, o = j * I.w + i, g = I.g;
  return (g[o] * (1 - fu) + g[o + 1] * fu) * (1 - fv) + (g[o + I.w] * (1 - fu) + g[o + I.w + 1] * fu) * fv;
}
// tap: [x, y] px; u1, u2: unit vectors along the two paper edges away from the corner; ppm: px per mm.
function cornerScore(I, c, u1, u2, ppm) {
  let inn = 0, ni = 0, out = 0, no = 0;
  for (let a = 0.45; a <= 5.5; a += 0.5) for (let b = 0.45; b <= 5.5; b += 0.5) {
    for (const [sa, sb, inside] of [[1, 1, true], [-1, 1, false], [1, -1, false], [-1, -1, false]]) {
      const v = grey(I, c[0] + (sa * a * u1[0] + sb * b * u2[0]) * ppm, c[1] + (sa * a * u1[1] + sb * b * u2[1]) * ppm);
      if (Number.isNaN(v)) return -9;
      if (inside) { inn += v; ni++; } else { out += v; no++; }
    }
  }
  return inn / ni - out / no;
}
export function snapPaperCorners(I, quad, ppm, { reach = 6, minContrast = 0.06 } = {}) {
  let q = quad.map(p => [...p]), ok = [false, false, false, false];
  const unit = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  for (let round = 0; round < 3; round++) {
    const next = q.map(p => [...p]);
    for (let i = 0; i < 4; i++) {
      const t = q[i], u1 = unit(t, q[(i + 1) % 4]), u2 = unit(t, q[(i + 3) % 4]);
      let best = -9, bc = t;
      const n = Math.round(reach / 0.25);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
        const c = [t[0] + a * 0.25 * ppm, t[1] + b * 0.25 * ppm], sc = cornerScore(I, c, u1, u2, ppm) - 0.002 * Math.hypot(a, b) * 0.25;   // ties go to the tap
        if (sc > best) { best = sc; bc = c; }
      }
      if (best >= minContrast) { next[i] = bc; ok[i] = true; }
    }
    q = next;
  }
  return { quad: q, ok };
}

// mm: the four page points the taps stand for; quad: the taps in photo px (scaled image); cells: the plan's cells;
// pickFn(quad) -> picks, to redraw the template from a reading. Returns { quad, corr } and a log of the stages.
export function alignAnchor(I, mm, quad, cells, pickFn = null, { pull = 0.0015, range = 5.5, snap = true, log = null } = {}) {
  const H0 = homography(mm, quad), cx = mm.reduce((s, p) => s + p[0], 0) / 4, cy = mm.reduce((s, p) => s + p[1], 0) / 4;
  const proj = (H, x, y) => { const d = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d]; };
  const [ax, ay] = proj(H0, cx, cy), [bx, by] = proj(H0, cx + 1, cy), [ex, ey] = proj(H0, cx, cy + 1), ppm = (Math.hypot(bx - ax, by - ay) + Math.hypot(ex - ax, ey - ay)) / 2;
  // 0. the taps go to the paper corners first (the drawing may say little), then the drawing is fitted within a short reach of those
  let start = quad.map(p => [...p]), snapped = false;
  if (snap) { const sn = snapPaperCorners(I, quad, ppm); if (sn.ok.filter(Boolean).length >= 3) { start = sn.quad; snapped = true; } log?.push(["snap " + sn.ok.map(b => (b ? 1 : 0)).join(""), Math.max(...quad.map((p, i) => Math.hypot(p[0] - start[i][0], p[1] - start[i][1]))) / ppm]); }
  const reach = snapped ? 2.5 : 7;
  let q = start.map(p => [...p]), T = buildTemplate(cells);
  const safe = (L, qq) => { if (qq.some((p, i) => Math.hypot(p[0] - start[i][0], p[1] - start[i][1]) > reach * ppm)) return -9; try { const c = corr(L, homography(mm, qq)); const d = qq.reduce((s, p, i) => s + (p[0] - start[i][0]) ** 2 + (p[1] - start[i][1]) ** 2, 0) / 4 / (ppm * ppm); return c - pull * d; } catch { return -9; } };
  const moveAll = (qq, dx, dy) => qq.map(([x, y]) => [x + dx, y + dy]);
  const descend = (L, moves, passes = 6) => {
    let best = safe(L, q);
    for (const m of moves) {
      const s = m * ppm;
      for (let pass = 0, moved = true; pass < passes && moved; pass++) {
        moved = false;
        for (let i = 0; i < 4; i++) for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
          const tq = q.map((p, k) => (k === i ? [p[0] + dx, p[1] + dy] : p)), c = safe(L, tq);
          if (c > best + 1e-6) { best = c; q = tq; moved = true; }
        }
        for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]]) { const tq = moveAll(q, dx, dy), c = safe(L, tq); if (c > best + 1e-6) { best = c; q = tq; moved = true; } }
      }
    }
    return best;
  };
  // Is the drawing's expected ink a good guide? A maze's few short dashes are not (they line up along their walls and the fit
  // slides), so those plots keep the snapped corners and are polished on the reading alone.
  const L0 = makeLevel(T, I, ppm, 0.5, 0.4, true), c0 = snapped ? corr(L0, homography(mm, start)) : 1, rich = c0 >= 0.2;
  log?.push(["expected-ink corr at the snap", c0]);
  if (!rich) return { quad: q, corr: c0, ppm, snapped, rich };
  // 1. expected ink, coarse: slide the whole quad about, then let the corners move
  let L = makeLevel(T, I, ppm, 1.0, 0.8, false);
  { let best = -9, bq = q; const st = 0.5 * ppm, n = Math.round((snapped ? 2 : range) / 0.5);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const tq = moveAll(start, a * st, b * st), c = safe(L, tq); if (c > best) { best = c; bq = tq; } }
    q = bq; log?.push(["slide", best]); }
  log?.push(["1.0 mm", descend(L, [1.5, 0.75, 0.4])]);
  L = makeLevel(T, I, ppm, 0.5, 0.4, true); log?.push(["0.5 mm", descend(L, [0.4, 0.2])]);
  L = makeLevel(T, I, ppm, 0.25, 0.25, true); log?.push(["0.25 mm", descend(L, [0.2, 0.1, 0.05])]);
  // 2. redraw the template from the reading and sharpen on that
  if (pickFn) for (let round = 0; round < 2; round++) {
    T = buildTemplate(cells, pickFn(q));
    L = makeLevel(T, I, ppm, 0.4, 0.3, true); log?.push([`read ${round + 1} @0.4`, descend(L, [0.3, 0.15])]);
    L = makeLevel(T, I, ppm, 0.25, 0.25, true); log?.push([`read ${round + 1} @0.25`, descend(L, [0.15, 0.08, 0.04])]);
  }
  return { quad: q, corr: safe(L, q), ppm, snapped, rich };
}
