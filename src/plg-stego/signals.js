// Signal book page: controls, preview and export around signals-core.js (the alphabets, shared with the plot decoder).
"use strict";
import { plen, svgOf, wireSettingsLoader, applySettings } from "./core.js";
import { build, PEN } from "./signals-core.js";
import { labelSheet } from "./marks.js";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const $ = id => document.getElementById(id);
const IDS = ["msg", "cipher", "ckey", "alpha", "layout", "labels", "ink", "pitch", "angle", "ghost", "gsize", "caption", "tsize", "tpen", "page", "marks", "mount"];
const read = () => Object.fromEntries(IDS.map(k => [k, $(k).type === "range" ? +$(k).value : $(k).value]));
let last = null;

// ---------------- draw + export ----------------
function draw(r) {
  const cv = $("cv"), maxW = Math.min(780, Math.max(200, cv.parentElement.clientWidth - 30)), k = Math.min(maxW / r.W, Math.max(1.2, (innerHeight - 90) / r.H));
  cv.width = Math.round(r.W * k * devicePixelRatio); cv.height = Math.round(r.H * k * devicePixelRatio); cv.style.width = Math.round(r.W * k) + "px";
  const c = cv.getContext("2d"); c.setTransform(k * devicePixelRatio, 0, 0, k * devicePixelRatio, 0, 0); paint(c, r);
  const len = ps => ps.reduce((a, [p, cl]) => a + plen(p, cl), 0) / 1000, esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (r.error) { $("stats").innerHTML = `<span class="fail">${esc(r.error)}</span>`; $("how").textContent = ""; return; }
  $("stats").innerHTML = `${r.points} points · ${r.ms.toFixed(0)} ms<br>` + penLayers(r).map(L => `<span class="sw" style="background:#${L.colour}"></span>${L.name} <b>${len(L.paths).toFixed(1)} m</b>`).join(" · ") + "<br>"
    + r.gates.map(([nm, ok, v]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "pass" : "FAIL"}</span> ${esc(nm)} ${esc(v)}`).join("<br>") + (r.notes.length ? `<br><span class="note">${r.notes.map(esc).join("<br>")}</span>` : "");
  $("how").textContent = r.how;
}
function paint(c, r) {
  c.fillStyle = "#fbf8f1"; c.fillRect(0, 0, r.W, r.H); c.lineJoin = c.lineCap = "round";
  for (const L of penLayers(r).slice().reverse()) { c.strokeStyle = "#" + L.colour; c.lineWidth = L.w; c.beginPath(); for (const [p, cl] of L.paths) { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cl) c.closePath(); } c.stroke(); }
}
// marks are their own pen, first: a retrofit plots only this file onto a sheet that is already drawn
const penLayers = r => [
  { name: "marks", colour: "111111", w: 0.4, paths: r.marks || [] },
  { name: "outline", colour: "111111", w: 0.4, paths: r.outline },
  { name: "hatch", colour: "555555", w: 0.3, paths: r.hatch },
  ...["red", "blue", "yellow", "black", "green"].map(k => ({ name: k, colour: PEN[k], w: 0.4, paths: r[k] })),
  { name: "text", colour: r.o.tpen.slice(1), w: 0.3, paths: r.text },
].filter(L => L.paths.length);
const toSVG = (r, only = null, ticks = false) => svgOf(r, penLayers(r), `PLG signal book (UTP ${UTP_REV})`, only, ticks);

function sync() { for (const k of IDS) { const out = $("o-" + k); if (out) out.textContent = $(k).value; } document.querySelectorAll("[data-for]").forEach(el => (el.hidden = !el.dataset.for.split(" ").includes($("alpha").value))); }
let pending = 0;
function run() { sync(); $("stats").textContent = "drawing"; clearTimeout(pending); pending = setTimeout(() => { last = build(read()); draw(last); }, 80); }
const PRESETS = {
  hoist: { alpha: "flags", layout: "hoist", msg: "ENGLAND EXPECTS", labels: "on", ink: "heraldic", pitch: 0.7, gsize: 22, caption: "none" },
  flagline: { alpha: "flags", layout: "lines", msg: "HELLO FROM THE PLOTTER", labels: "off", ink: "heraldic", pitch: 0.6, gsize: 18, caption: "message" },
  flagchart: { alpha: "flags", layout: "chart", labels: "on", ink: "heraldic", pitch: 0.6, gsize: 16, caption: "name" },
  pens: { alpha: "flags", layout: "hoist", msg: "PEN PALS", labels: "off", ink: "pens", pitch: 1.0, angle: 45, gsize: 24, caption: "none" },
  semaphore: { alpha: "semaphore", layout: "lines", msg: "WAVE BACK AT 3", labels: "on", ink: "heraldic", pitch: 0.6, gsize: 30, caption: "none" },
  semachart: { alpha: "semaphore", layout: "chart", labels: "on", ink: "heraldic", pitch: 0.6, gsize: 22, caption: "name" },
  ogham: { alpha: "ogham", layout: "lines", msg: "STONES REMEMBER", labels: "on", ink: "heraldic", gsize: 24, caption: "none" },
  braille: { alpha: "braille", layout: "lines", msg: "READ WITH YOUR EYES", labels: "on", ghost: "on", gsize: 16, caption: "none" },
  tap: { alpha: "tap", layout: "lines", msg: "KNOCK KNOCK", labels: "on", gsize: 22, caption: "none" },
};
document.querySelectorAll("[data-preset]").forEach(b => (b.onclick = () => { for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) $(k).value = v; run(); }));
IDS.forEach(k => $(k).addEventListener("input", run));
const save = (text, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const stem = o => `plg-signals-${o.alpha}-${o.layout}-${o.ink}-${(o.layout === "chart" ? "chart" : o.msg).replace(/[^A-Z0-9]/gi, "").slice(0, 20)}`;
$("export").onclick = () => { if (last && !last.error) save(toSVG(last, null, $("ticks").value === "on"), stem(last.o) + ".svg"); };
$("split").onclick = () => { if (!last || last.error) return; const ls = penLayers(last), ticks = $("ticks").value !== "off"; ls.forEach((L, i) => setTimeout(() => save(toSVG(last, L.name, ticks), `${stem(last.o)}-${i + 1}of${ls.length}-${L.name}.svg`), i * 500)); };
addEventListener("resize", () => last && draw(last));
if ($("rev")) $("rev").textContent = UTP_REV;

// Settings label for the back: the key strip with its own finders, and the settings in words (never the message or keys).
const labelPairs = o => Object.entries(o).filter(([k]) => !/^(msg|ckey|pkey|tpen|rpen)$/.test(k));
const labelSVG = r => { const lab = labelSheet(r.marks.bits, "PLG SIGNAL BOOK", labelPairs(r.o)); return svgOf(lab, [{ name: "marks", colour: "000000", w: 0.4, paths: lab.marks }, { name: "text", colour: "000000", w: 0.3, paths: lab.text }], "PLG SIGNAL BOOK settings label"); };
$("label").onclick = () => { if (!last || last.error) return; if (!last.marks || !last.marks.bits) { $("stats").insertAdjacentHTML("afterbegin", '<span class="fail">Turn machine marks on (any kind) to make a settings label.</span><br>'); return; } save(labelSVG(last), stem(last.o) + "-label.svg"); };
wireSettingsLoader($, IDS, run);
window.__studio = { applySettings: obj => applySettings(obj, IDS, $), IDS, labelSVG, build, read, PRESETS, penLayers, paint, toSVG };   // hooks for checking
run();
