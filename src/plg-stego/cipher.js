// Cipher garden page: controls, preview and export around cipher-core.js (the methods, shared with the plot decoder).
"use strict";
import { plen, svgOf, wireSettingsLoader, applySettings } from "./core.js";
import { build, howToRead } from "./cipher-core.js";
import { labelSheet } from "./marks.js";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const $ = id => document.getElementById(id);
const IDS = ["msg", "enc", "cipher", "ckey", "method", "hide", "density", "seed", "size", "tiles", "walls", "mark", "cells", "rule", "noise", "pkey", "fill", "pitch", "angle", "caption", "tsize", "tpen", "reveal", "rpen", "page", "marks", "mount"];
const read = () => Object.fromEntries(IDS.map(k => [k, $(k).type === "range" ? +$(k).value : $(k).value]));
let last = null;

function draw(r) {
  const cv = $("cv"), maxW = Math.min(780, Math.max(200, cv.parentElement.clientWidth - 30)), k = Math.min(maxW / r.W, Math.max(1.2, (innerHeight - 90) / r.H));
  cv.width = Math.round(r.W * k * devicePixelRatio); cv.height = Math.round(r.H * k * devicePixelRatio); cv.style.width = Math.round(r.W * k) + "px";
  const c = cv.getContext("2d"); c.setTransform(k * devicePixelRatio, 0, 0, k * devicePixelRatio, 0, 0); paint(c, r);
  const len = ps => ps.reduce((a, [p, cl]) => a + plen(p, cl), 0) / 1000, esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (r.error) { $("stats").innerHTML = `<span class="fail">These settings do not make a drawing: ${esc(r.error)}</span>`; $("how").textContent = ""; return; }
  $("stats").innerHTML = `${esc(r.o.method)} · ${r.res.cap} cells · ${r.points} points · ${r.ms.toFixed(0)} ms<br>`
    + `<span class="sw" style="background:#0b0f14"></span>0.4 outline <b>${len(r.outline).toFixed(1)} m</b> · <span class="sw" style="background:#5c7080"></span>0.3 fill <b>${len(r.fill).toFixed(1)} m</b> · <span class="sw" style="background:${r.o.tpen}"></span>text <b>${len(r.text).toFixed(1)} m</b>`
    + (r.reveal.length ? ` · <span class="sw" style="background:${r.o.rpen}"></span>${r.o.method === "maze" ? "way through" : "reveal"} <b>${len(r.reveal).toFixed(1)} m</b>` : "") + "<br>"
    + r.gates.map(([n, ok, v]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "pass" : "FAIL"}</span> ${esc(n)} ${esc(v)}`).join("<br>")
    + `<br>key <b>${esc(r.key)}</b>` + (r.notes.length ? `<br><span class="note">${r.notes.map(esc).join("<br>")}</span>` : "");
  $("how").textContent = r.how;
}
function paint(c, r) {
  c.fillStyle = "#fbfaf6"; c.fillRect(0, 0, r.W, r.H); c.lineJoin = c.lineCap = "round";
  const stroke = (paths, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (const [p, cl] of paths) { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cl) c.closePath(); } c.stroke(); };
  stroke(r.fill, "#5c7080", 0.3); stroke(r.outline, "#0b0f14", 0.4); stroke(r.marks || [], "#0b0f14", 0.4); stroke(r.text, r.o.tpen, 0.3);
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
  stars: { method: "stars", msg: "ALL THE STARS ARE LETTERS", cipher: "none", pkey: "ORION", hide: "scatter", density: "3", fill: "spiral", pitch: 0.5, caption: "key", marks: "off" },
  disk: { method: "disk", msg: "ALBERTI SENDS HIS REGARDS", enc: "fivebit", cipher: "caesar", ckey: "3", hide: "open", fill: "lines", pitch: 0.6, angle: 60, caption: "message" },
  automaton: { method: "automaton", cells: "squares", rule: "30", msg: "RUN IT BACKWARDS", enc: "fivebit", hide: "open", size: 36, fill: "lines", pitch: 0.55, angle: 45, caption: "message" },
  sierpinski: { method: "automaton", cells: "dots", rule: "150", msg: "ORDER FROM NOISE", enc: "fivebit", hide: "open", size: 40, fill: "spiral", pitch: 0.5, caption: "key" },
  knots: { method: "knots", msg: "OVER UNDER", enc: "fivebit", hide: "open", size: 12, fill: "lines", pitch: 0.55, angle: -45, caption: "message" },
};
document.querySelectorAll("[data-preset]").forEach(b => (b.onclick = () => { for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) $(k).value = v; if (!("marks" in PRESETS[b.dataset.preset])) $("marks").value = "on"; run(); }));
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

// Settings label for the back: the key strip with its own finders, and the settings in words (never the message or keys).
const labelPairs = o => Object.entries(o).filter(([k]) => !/^(msg|ckey|pkey|tpen|rpen)$/.test(k));
const labelSVG = r => { const lab = labelSheet(r.marks.bits, "PLG CIPHER GARDEN", labelPairs(r.o)); return svgOf(lab, [{ name: "marks", colour: "000000", w: 0.4, paths: lab.marks }, { name: "text", colour: "000000", w: 0.3, paths: lab.text }], "PLG CIPHER GARDEN settings label"); };
$("label").onclick = () => { if (!last || last.error) return; if (!last.marks || !last.marks.bits) { $("stats").insertAdjacentHTML("afterbegin", '<span class="fail">Turn machine marks on (any kind) to make a settings label.</span><br>'); return; } save(labelSVG(last), stem(last.o) + "-label.svg"); };
wireSettingsLoader($, IDS, run);
window.__studio = { applySettings: obj => applySettings(obj, IDS, $), IDS, labelSVG, build, read, PRESETS, penLayers, paint, toSVG, howToRead };   // hooks for checking
run();
