// Plot decoder page: camera, photo or sample in; decoder-core.js reads it; the page shows the message and its working.
"use strict";
import { decode } from "./decoder-core.js";
import { build, howToRead } from "./cipher-core.js";
import { build as signalBuild, HOW as SIGNAL_HOW } from "./signals-core.js";
import { densify } from "./core.js";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const $ = id => document.getElementById(id);
let stream = null, scanning = false, lastImage = null;

// ---------------- showing a read ----------------
function show(img, r) {
  const view = $("view"), stage = $("stage");
  stage.classList.add("on"); $("video").style.display = "none"; view.style.display = "block";
  view.width = img.width; view.height = img.height;
  const c = view.getContext("2d"); c.putImageData(img, 0, 0);
  const k = img.width / (r.I ? r.I.w : img.width), lw = Math.max(2, img.width / 500);
  c.lineCap = c.lineJoin = "round";
  if (r.quad) { c.strokeStyle = "#a568e0"; c.lineWidth = lw * 1.5; c.beginPath(); r.quad.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k))); c.closePath(); c.stroke(); }
  for (const f of r.finders || []) { c.fillStyle = f.hollow ? "#e8c04a" : "#a568e0"; c.beginPath(); c.arc(f.x * k, f.y * k, lw * 3, 0, 7); c.fill(); }
  if (r.ok) r.cells.forEach((cell, i) => {
    const p = r.picks[i], cands = Array.isArray(cell.cands) ? cell.cands : null;
    if (cands && cands[p.value]) {
      c.strokeStyle = p.conf < 0.08 ? "#ef6a5a" : "#e8c04a"; c.lineWidth = lw;
      c.beginPath();
      for (const [pts, cl] of cands[p.value]) densify(pts, cl, 0.8).forEach((q, j) => { const [x, y] = r.Hm.px(q); j ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k); });
      c.stroke();
    }
  });
  $("status").textContent = r.ok ? `read ${r.cellsRead} cells` : r.message;
}
function report(r) {
  const box = $("result"); box.hidden = false;
  if (!r.ok) { $("head").innerHTML = ""; $("msg").innerHTML = `<span class="fail">${esc(r.message)}</span>`; $("plain").textContent = ""; $("how").textContent = ""; $("facts").innerHTML = ""; $("keyrow").hidden = true; return; }
  $("head").innerHTML = `<span class="chip">${esc(r.studio)}</span><span class="chip">${esc(r.method)}</span>`;
  $("msg").textContent = r.text || "(nothing readable)";
  const ciphered = r.cipher && r.cipher !== "none";
  $("keyrow").hidden = !ciphered; $("keylabel").textContent = ciphered ? `Enciphered with ${r.cipher}: type its key to read it` : "";
  $("plain").textContent = r.plain ? r.plain : "";
  $("how").textContent = r.o ? howToRead(r.o) : r.studio === "signal book" ? SIGNAL_HOW[r.method] : "";
  $("facts").innerHTML = [`${r.page} mm page`, `${r.cellsRead} cells`, `${r.ms} ms`, ...(r.marks === "retro" ? [`retrofit marks, shifted ${r.shift.map(v => v.toFixed(2)).join(", ")} mm`] : []), ...(r.weak ? [`<span class="chip warn">${r.weak} unsure</span>`] : []), ...(r.record.repaired !== undefined ? [`key strip repaired 1 bit`] : [])]
    .map(s => (s.startsWith("<") ? s : `<span class="chip">${esc(s)}</span>`)).join("");
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function read(img) {
  lastImage = img;
  const r = decode(img, { cipherKey: $("ckey").value.trim() });
  show(img, r); report(r);
  return r;
}

// ---------------- camera ----------------
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
  } catch (err) { $("stage").classList.add("on"); $("status").textContent = `No camera: ${err.message || err}. Use a photo instead.`; return; }
  const v = $("video"); v.srcObject = stream; await v.play();
  $("stage").classList.add("on"); v.style.display = "block"; $("view").style.display = "none"; $("stop").disabled = false;
  scanning = true; $("status").textContent = "looking for the four corner targets"; loop();
}
function stopCamera() { scanning = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; $("stop").disabled = true; }
function loop() {
  if (!scanning) return;
  const v = $("video"), g = $("grab");
  if (v.videoWidth) {
    g.width = v.videoWidth; g.height = v.videoHeight; const c = g.getContext("2d", { willReadFrequently: true }); c.drawImage(v, 0, 0);
    const img = c.getImageData(0, 0, g.width, g.height), r = decode(img, { cipherKey: $("ckey").value.trim() });
    if (r.ok && r.weak <= Math.max(2, r.cellsRead * 0.05)) { stopCamera(); lastImage = img; show(img, r); report(r); return; }
    $("status").textContent = r.ok ? `almost: ${r.weak} cells unsure, hold still` : r.message;
  }
  setTimeout(loop, 250);
}

// ---------------- photo and samples ----------------
$("file").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; stopCamera();
  const bmp = await createImageBitmap(f), g = $("grab"); g.width = bmp.width; g.height = bmp.height;
  const c = g.getContext("2d", { willReadFrequently: true }); c.drawImage(bmp, 0, 0); read(c.getImageData(0, 0, g.width, g.height));
});
const SAMPLES = {
  arcs: { method: "truchet", tiles: "arcs", msg: "NOTHING TO SEE HERE", hide: "scatter", density: "2", size: 22, fill: "contour", pitch: 0.7 },
  maze: { method: "maze", walls: "line", msg: "YOU FOUND THE WAY IN", size: 24, fill: "lines", pitch: 0.6 },
  thread: { method: "hilbert", mark: "wave", msg: "FOLLOW THE THREAD", fill: "none" },
  knots: { method: "knots", msg: "OVER UNDER", size: 12, fill: "lines", pitch: 0.55, angle: -45 },
  disk: { method: "disk", msg: "ALBERTI SENDS HIS REGARDS", cipher: "caesar", ckey: "3", fill: "lines", pitch: 0.6, angle: 60 },
  pigpen: { method: "pigpen", msg: "THE LODGE MEETS AT MIDNIGHT", size: 12, fill: "lines", pitch: 0.6 },
  automaton: { method: "automaton", cells: "squares", rule: "30", msg: "RUN IT BACKWARDS", size: 36, fill: "lines", pitch: 0.55 },
  flags: { signal: true, alpha: "flags", layout: "hoist", msg: "ENGLAND EXPECTS" },
  semaphore: { signal: true, alpha: "semaphore", layout: "lines", msg: "WAVE BACK AT 3", gsize: 30 },
};
// A sample drawn in the browser, laid slightly askew on a table, the way a phone would see it.
$("sample").addEventListener("change", e => {
  const s = SAMPLES[e.target.value]; if (!s) return; stopCamera();
  const o = { msg: "", enc: "fivebit", cipher: "none", ckey: "", method: "truchet", hide: "open", density: "2", seed: 7, size: 22, tiles: "arcs", walls: "line", mark: "wave", cells: "squares", rule: "30", noise: 0.5, pkey: "", fill: "lines", pitch: 0.7, angle: 45, caption: "message", tsize: 6, tpen: "#0b0f14", reveal: "off", rpen: "#c23b3b", page: "190x250", marks: "on", ...s };
  const r = s.signal ? signalBuild({ msg: "", cipher: "none", ckey: "", labels: "on", ink: "heraldic", pitch: 0.7, angle: 45, ghost: "on", gsize: 22, caption: "none", tsize: 6, tpen: "#132c42", page: "190x250", marks: "on", ...s }) : build(o), k = 6, W = r.W * k, H = r.H * k, paper = document.createElement("canvas"); paper.width = W; paper.height = H;
  const p = paper.getContext("2d"); p.fillStyle = "#f3efe4"; p.fillRect(0, 0, W, H); p.lineCap = p.lineJoin = "round"; p.strokeStyle = "#1d1b20";
  for (const [layer, w] of [["fill", 0.3], ["hatch", 0.3], ["outline", 0.4], ["marks", 0.4], ["text", 0.3]]) { if (!r[layer]) continue; p.lineWidth = w * k; p.beginPath(); for (const [pts, cl] of r[layer]) { pts.forEach(([x, y], i) => (i ? p.lineTo(x * k, y * k) : p.moveTo(x * k, y * k))); if (cl) p.closePath(); } p.stroke(); }
  const g = $("grab"); g.width = Math.round(W * 1.3); g.height = Math.round(H * 1.25);
  const c = g.getContext("2d", { willReadFrequently: true }); c.fillStyle = "#5d5a55"; c.fillRect(0, 0, g.width, g.height);
  c.translate(g.width / 2, g.height / 2); c.rotate((Math.random() - 0.5) * 0.14); c.drawImage(paper, -W / 2, -H / 2); c.setTransform(1, 0, 0, 1, 0, 0);
  $("ckey").value = s.ckey || "";
  read(c.getImageData(0, 0, g.width, g.height));
});
$("ckey").addEventListener("input", () => { if (lastImage) { const r = decode(lastImage, { cipherKey: $("ckey").value.trim() }); report(r); } });
$("scan").onclick = startCamera;
$("stop").onclick = stopCamera;
$("rev").textContent = UTP_REV;
window.__decoder = { decode, SAMPLES };   // hooks for checking
