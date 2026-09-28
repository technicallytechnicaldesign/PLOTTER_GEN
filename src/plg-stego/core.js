// Shared plotter core for the PLG stego studios: geometry, Cyrus-Beck clipping, seven hatch fills, the vector
// hidden-line painter and the single-stroke font. Pure functions, no DOM. Units are millimetres, y down.
"use strict";
export const TAU = 2 * Math.PI;

// ---------------- geometry ----------------
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
export const centroid = P => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
export const bbox = P => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of P) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
export function ellipse(cx, cy, rx, ry, rotDeg = 0, n = 28) {
  const a = rotDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), p = [];
  for (let i = 0; i < n; i++) { const t = TAU * i / n, x = rx * Math.cos(t), y = ry * Math.sin(t); p.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return p;
}
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function capsule(a, b, r, n = 12) {   // convex: a half disc round each end
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), p = [];
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + Math.PI * i / n; p.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + Math.PI * i / n; p.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
  return p;
}
export function sector(cx, cy, r, a0, a1, n = 10) { const p = [[cx, cy]]; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return p; }
export const plen = (p, closed) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed && p.length > 2) L += Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]); return L; };
export function densify(p, closed, step) {
  const out = [], n = p.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = p[i], b = p[(i + 1) % n], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push(lerp(a, b, j / k));
  }
  out.push(closed ? p[0] : p[n - 1]);
  return out;
}
export function simplify(p, tol) {
  if (p.length < 3) return p;
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const st = [[0, p.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(), [ax, ay] = p[i], [bx, by] = p[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    let worst = -1, wi = -1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs(dy * (p[k][0] - ax) - dx * (p[k][1] - ay)) / L; if (d > worst) { worst = d; wi = k; } }
    if (worst > tol) { keep[wi] = 1; st.push([i, wi], [wi, j]); }
  }
  return p.filter((_, k) => keep[k]);
}
export function dashed(p, closed, on = 0.9, off = 0.7) {
  const d = densify(p, closed, 0.1), out = []; let cur = [], acc = 0, drawing = true;
  for (let i = 0; i < d.length; i++) {
    if (i) acc += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]);
    if (drawing) cur.push(d[i]);
    if (acc >= (drawing ? on : off)) { if (drawing && cur.length > 1) out.push([simplify(cur, 0.01), false]); cur = []; drawing = !drawing; acc = 0; if (drawing) cur.push(d[i]); }
  }
  if (drawing && cur.length > 1) out.push([simplify(cur, 0.01), false]);
  return out;
}

// The part of segment a->b strictly inside convex polygon P (orientation sg), shrunk by eps: [t0, t1] or null (Cyrus-Beck).
export function segIn(a, b, P, sg, eps) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0, n = P.length; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
    if (L < 1e-12) continue;
    const c0 = sg * (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) - eps * L, c1 = sg * (ex * dy - ey * dx);
    if (Math.abs(c1) < 1e-15) { if (c0 <= 0) return null; continue; }
    const t = -c0 / c1;
    if (c1 > 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
    if (t0 >= t1) return null;
  }
  return [t0, t1];
}
// Pieces of a polyline inside a convex polygon.
export function insideRuns(p, P, eps) {
  const sg = Math.sign(area(P)) || 1, out = []; let cur = null;
  for (let i = 0; i + 1 < p.length; i++) {
    const a = p[i], b = p[i + 1], iv = segIn(a, b, P, sg, eps);
    if (!iv) { if (cur) out.push(cur); cur = null; continue; }
    const pa = lerp(a, b, iv[0]), pb = lerp(a, b, iv[1]);
    if (cur && iv[0] < 1e-9) cur.push(pb); else { if (cur) out.push(cur); cur = [pa, pb]; }
    if (iv[1] < 1 - 1e-9) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.filter(q => plen(q, false) > 0.25).map(q => [simplify(q, 0.01), false]);
}
// Offset a convex polygon inwards by d (Sutherland-Hodgman against each moved edge).
export function inset(P, d) {
  const sg = Math.sign(area(P)) || 1; let Q = P;
  for (let i = 0; i < P.length && Q.length > 2; i++) {
    const p = P[i], q = P[(i + 1) % P.length], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
    if (L < 1e-9) continue;
    const f = x => sg * (ex * (x[1] - p[1]) - ey * (x[0] - p[0])) / L - d, R = [];
    for (let k = 0; k < Q.length; k++) {
      const a = Q[k], b = Q[(k + 1) % Q.length], fa = f(a), fb = f(b);
      if (fa >= 0) R.push(a);
      if ((fa >= 0) !== (fb >= 0)) R.push(lerp(a, b, fa / (fa - fb)));
    }
    Q = R;
  }
  return Q.length > 2 && Math.abs(area(Q)) > 0.02 ? Q : null;
}

// ---------------- shading: seven fills for a convex region ----------------
// Line fills use one global screen (phase fixed to the page), so pieces of one shape and neighbouring cells line up.
export const hash2 = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 2147483647); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
export function fillConvex(P, style, pitch, angDeg, seed = 1) {
  if (!P || style === "none" || P.length < 3) return [];
  const out = [], sg = Math.sign(area(P)) || 1, eps = Math.min(0.12, pitch * 0.2), c = centroid(P), bb = bbox(P), R = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) + 1;
  const lineSet = (ad, zig) => {
    const a = ad * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], nr = [-d[1], d[0]];
    let s0 = 1e9, s1 = -1e9; for (const q of P) { const s = q[0] * nr[0] + q[1] * nr[1]; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    const segs = [];
    for (let k = Math.ceil(s0 / pitch); k * pitch <= s1; k++) {
      const s = k * pitch, o = [nr[0] * s, nr[1] * s], tc = (c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1];
      const A = [o[0] + d[0] * (tc - R), o[1] + d[1] * (tc - R)], B = [o[0] + d[0] * (tc + R), o[1] + d[1] * (tc + R)], iv = segIn(A, B, P, sg, eps);
      if (iv && (iv[1] - iv[0]) * 2 * R > 0.3) segs.push([lerp(A, B, iv[0]), lerp(A, B, iv[1])]);
    }
    if (zig) { const path = []; segs.forEach((q, i) => path.push(...(i % 2 ? q.reverse() : q))); if (path.length > 1) out.push([path, false]); }
    else for (const q of segs) out.push([q, false]);
  };
  if (style === "lines") lineSet(angDeg);
  else if (style === "cross") { lineSet(angDeg); lineSet(angDeg + 90); }
  else if (style === "zigzag") lineSet(angDeg, true);
  else if (style === "wave") {
    const a = angDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], nr = [-d[1], d[0]], amp = 0.3 * pitch, wl = 3 * pitch;
    let s0 = 1e9, s1 = -1e9; for (const q of P) { const s = q[0] * nr[0] + q[1] * nr[1]; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    for (let k = Math.ceil((s0 - amp) / pitch); k * pitch <= s1 + amp; k++) {
      const s = k * pitch, o = [nr[0] * s, nr[1] * s], tc = (c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1], pts = [];
      for (let t = Math.floor((tc - R) / 0.2) * 0.2; t <= tc + R; t += 0.2) { const w = amp * Math.sin(TAU * t / wl); pts.push([o[0] + d[0] * t + nr[0] * w, o[1] + d[1] * t + nr[1] * w]); }
      out.push(...insideRuns(pts, P, eps));
    }
  } else if (style === "stipple") {
    const sp = pitch * 1.45, r = 0.2;
    for (let i = Math.floor(bb[0] / sp) - 1; i * sp <= bb[2] + sp; i++) for (let j = Math.floor(bb[1] / sp) - 1; j * sp <= bb[3] + sp; j++) {
      const x = i * sp + (hash2(i, j, seed) - 0.5) * 0.5 * sp, y = j * sp + (hash2(j, i, seed + 7) - 0.5) * 0.5 * sp;
      if (segIn([x - 1e-4, y], [x + 1e-4, y], P, sg, r + 0.15)) out.push([ellipse(x, y, r, r, 0, 8), true]);
    }
  } else if (style === "contour") {
    for (let k = 1; k < 400; k++) { const Q = inset(P, k * pitch); if (!Q) break; out.push([Q, true]); }
  } else if (style === "spiral") {
    const rays = θ => { const d = [Math.cos(θ), Math.sin(θ)], iv = segIn(c, [c[0] + d[0] * R, c[1] + d[1] * R], P, sg, eps); return iv ? iv[1] * R : 0; };
    let maxR = 0; for (let k = 0; k < 36; k++) maxR = Math.max(maxR, rays(TAU * k / 36));
    const turns = Math.max(1, Math.floor(maxR / pitch)), N = turns * 72, pts = [];
    for (let k = 0; k <= N; k++) { const θ = TAU * k / 72, f = k / N; pts.push([c[0] + Math.cos(θ) * rays(θ) * f, c[1] + Math.sin(θ) * rays(θ) * f]); }
    out.push([simplify(pts, 0.01), false]);
  }
  return out;
}

// ---------------- painter with vector hidden lines ----------------
// Shapes are added back to front; every line of a shape is cut where any later shape's convex occluder covers it.
export function painter(cell) {
  const shapes = [];
  return {
    add(lines, occ = []) { shapes.push({ lines, occ: occ.map(P => ({ P, sg: Math.sign(area(P)) || 1, bb: bbox(P) })) }); },
    resolve(L) {
      const grid = new Map(), K = (i, j) => i * 100003 + j;
      shapes.forEach((sh, id) => sh.occ.forEach(o => {
        for (let i = Math.floor(o.bb[0] / cell); i <= Math.floor(o.bb[2] / cell); i++) for (let j = Math.floor(o.bb[1] / cell); j <= Math.floor(o.bb[3] / cell); j++) {
          const k = K(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([id, o]);
        }
      }));
      const near = (a, b, id) => {
        const found = new Set(), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(y0 / cell); j <= Math.floor(y1 / cell); j++)
          for (const [sid, o] of grid.get(K(i, j)) || []) if (sid > id && o.bb[0] <= x1 && o.bb[2] >= x0 && o.bb[1] <= y1 && o.bb[3] >= y0) found.add(o);
        return found;
      };
      shapes.forEach((sh, id) => {
        for (const [layer, paths] of Object.entries(sh.lines)) for (const [p, closed] of paths || []) {
          const d = densify(p, closed, cell * 0.5), out = []; let cur = null, cut = false;
          for (let i = 0; i + 1 < d.length; i++) {
            const a = d[i], b = d[i + 1], ivs = [];
            for (const o of near(a, b, id)) { const iv = segIn(a, b, o.P, o.sg, 0.02); if (iv) ivs.push(iv); }
            ivs.sort((u, v) => u[0] - v[0]);
            const vis = []; let t = 0;
            for (const [s, e] of ivs) { if (s > t) vis.push([t, s]); t = Math.max(t, e); }
            if (t < 1) vis.push([t, 1]);
            if (ivs.length) cut = true;
            for (const [s, e] of vis) {
              if (e - s < 1e-6) continue;
              const pa = lerp(a, b, s), pb = lerp(a, b, e);
              if (cur && s < 1e-9) cur.push(pb); else { if (cur) out.push(cur); cur = [pa, pb]; }
              if (e < 1 - 1e-9) { out.push(cur); cur = null; }
            }
            if (!vis.length || vis.at(-1)[1] < 1 - 1e-9) { if (cur) out.push(cur); cur = null; }
          }
          if (cur) out.push(cur);
          if (!cut) { L[layer].push([p, closed]); continue; }
          for (const q of out) if (plen(q, false) > 0.3) L[layer].push([simplify(q, 0.01), false]);   // shorter scraps read as specks
        }
      });
    },
  };
}

// ---------------- single-stroke font (4 wide, 6 tall, y down) ----------------
export const GLYPHS = {
  A: [[[0,6],[2,0],[4,6]], [[0.8,3.9],[3.2,3.9]]],
  B: [[[0,3],[0,0],[2.6,0],[3.6,0.8],[3.6,2.2],[2.6,3],[0,3],[0,6],[2.8,6],[4,5],[4,4],[2.8,3]]],
  C: [[[4,1],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5]]],
  D: [[[0,0],[0,6],[2.4,6],[4,4.4],[4,1.6],[2.4,0],[0,0]]],
  E: [[[4,0],[0,0],[0,6],[4,6]], [[0,3],[3,3]]],
  F: [[[4,0],[0,0],[0,6]], [[0,3],[3,3]]],
  G: [[[4,1],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,3.4],[2.3,3.4]]],
  H: [[[0,0],[0,6]], [[4,0],[4,6]], [[0,3],[4,3]]],
  I: [[[2,0],[2,6]], [[0.8,0],[3.2,0]], [[0.8,6],[3.2,6]]],
  J: [[[4,0],[4,5],[3,6],[1,6],[0,5]]],
  K: [[[0,0],[0,6]], [[4,0],[0,3.6]], [[1.4,2.6],[4,6]]],
  L: [[[0,0],[0,6],[4,6]]],
  M: [[[0,6],[0,0],[2,3.4],[4,0],[4,6]]],
  N: [[[0,6],[0,0],[4,6],[4,0]]],
  O: [[[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]]],
  P: [[[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]]],
  Q: [[[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]], [[2.6,4.4],[4.2,6.2]]],
  R: [[[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]], [[2,3],[4,6]]],
  S: [[[4,1],[3,0],[1,0],[0,1],[0,2],[1,3],[3,3],[4,4],[4,5],[3,6],[1,6],[0,5]]],
  T: [[[0,0],[4,0]], [[2,0],[2,6]]],
  U: [[[0,0],[0,5],[1,6],[3,6],[4,5],[4,0]]],
  V: [[[0,0],[2,6],[4,0]]],
  W: [[[0,0],[1,6],[2,2.4],[3,6],[4,0]]],
  X: [[[0,0],[4,6]], [[4,0],[0,6]]],
  Y: [[[0,0],[2,3],[4,0]], [[2,3],[2,6]]],
  Z: [[[0,0],[4,0],[0,6],[4,6]]],
  0: [[[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]], [[3.4,0.8],[0.6,5.2]]],
  1: [[[0.9,1.3],[2,0],[2,6]], [[0.8,6],[3.2,6]]],
  2: [[[0,1],[1,0],[3,0],[4,1],[4,2.2],[0,6],[4,6]]],
  3: [[[0,0.7],[1,0],[3,0],[4,1],[4,2],[3,3],[1.6,3]], [[3,3],[4,4],[4,5],[3,6],[1,6],[0,5.3]]],
  4: [[[3,6],[3,0],[0,4.2],[4,4.2]]],
  5: [[[4,0],[0.4,0],[0,2.8],[3,2.6],[4,3.6],[4,5],[3,6],[1,6],[0,5.2]]],
  6: [[[3.6,0.4],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,3.8],[3,2.8],[1,2.8],[0,3.8]]],
  7: [[[0,0],[4,0],[1.4,6]]],
  8: [[[1,3],[0,2],[0,1],[1,0],[3,0],[4,1],[4,2],[3,3],[1,3],[0,4],[0,5],[1,6],[3,6],[4,5],[4,4],[3,3]]],
  9: [[[0.4,5.6],[1,6],[3,6],[4,5],[4,1],[3,0],[1,0],[0,1],[0,2.2],[1,3.2],[3,3.2],[4,2.2]]],
  "!": [[[2,0],[2,3.9]], [[2,6],[2,6]]],
  "?": [[[0,1],[1,0],[3,0],[4,1],[4,2],[2,3.4],[2,4]], [[2,6],[2,6]]],
  ".": [[[2,6],[2,6]]],
  ",": [[[2.2,5.6],[1.6,7]]],
  ":": [[[2,2],[2,2]], [[2,6],[2,6]]],
  "-": [[[0.5,3],[3.5,3]]],
  "'": [[[2.2,0],[1.8,1.6]]],
  "/": [[[4,0],[0,6]]],
  "+": [[[2,1.5],[2,4.5]], [[0.5,3],[3.5,3]]],
  "=": [[[0.5,2],[3.5,2]], [[0.5,4],[3.5,4]]],
  "_": [[[0,6],[4,6]]],
  "␣": [[[0.4,4.4],[0.4,6],[3.6,6],[3.6,4.4]]],
};
export const ADV = 5.6;
export const textWidth = (s, h) => Math.max(0, [...s].length * ADV - 1.6) * h / 6;
export function drawText(s, cx, top, h, out) {
  const u = h / 6, chars = [...s.toUpperCase()], x0 = cx - textWidth(s, h) / 2;
  chars.forEach((ch, i) => {
    for (const st of GLYPHS[ch] || []) {
      const pts = st.map(([x, y]) => [x0 + (i * ADV + x) * u, top + y * u]);
      if (plen(pts, false) < 0.2 * u) { const r = Math.max(0.18, 0.3 * u); out.push([ellipse(pts[0][0], pts[0][1] - r, r, r, 0, 8), true]); }
      else out.push([pts, false]);
    }
  });
}
export function wrap(s, maxChars) {
  const lines = []; let cur = "";
  for (let w of s.split(" ").filter(Boolean)) {
    while (w.length > maxChars) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, maxChars)); w = w.slice(maxChars); }
    if (cur && cur.length + 1 + w.length > maxChars) { lines.push(cur); cur = ""; }
    cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// One glyph turned by ang (radians) about its own centre, centred on (cx, cy): for lettering round a circle.
export function drawGlyphAt(ch, cx, cy, h, ang, out) {
  const u = h / 6, c = Math.cos(ang), s = Math.sin(ang);
  for (const st of GLYPHS[ch.toUpperCase()] || []) {
    const pts = st.map(([x, y]) => { const px = (x - 2) * u, py = (y - 3) * u; return [cx + px * c - py * s, cy + px * s + py * c]; });
    if (plen(pts, false) < 0.2 * u) { const r = Math.max(0.18, 0.3 * u); out.push([ellipse(pts[0][0], pts[0][1], r, r, 0, 8), true]); }
    else out.push([pts, false]);
  }
}
// Pen layers in plotting order and the SVG writer, shared so every studio exports the same way.
export const cornerTicks = (W, H, a = 3, e = 1) => [[[e, e + a], [e, e], [e + a, e]], [[W - e - a, e], [W - e, e], [W - e, e + a]], [[W - e, H - e - a], [W - e, H - e], [W - e - a, H - e]], [[e + a, H - e], [e, H - e], [e, H - e - a]]].map(p => [p, false]);
export function svgOf(r, layers, title, only = null, ticks = false) {
  const f = v => v.toFixed(3), group = L => `<g id="pen-${L.name}" stroke="#${L.colour}" stroke-width="${L.w}" stroke-linecap="round" stroke-linejoin="round">\n`
    + [...L.paths, ...(ticks ? cornerTicks(r.W, r.H) : [])].map(([p, cl]) => `<path d="M${p.map(([x, y]) => f(x) + "," + f(y)).join(" L")}${cl ? " Z" : ""}" fill="none"/>`).join("\n") + "\n</g>";
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${r.W}mm" height="${r.H}mm" viewBox="0 0 ${r.W} ${r.H}">\n<title>${title}${only ? " (" + only + ")" : ""}</title>\n`
    + layers.filter(L => !only || L.name === only).map(group).join("\n") + "\n</svg>";
}