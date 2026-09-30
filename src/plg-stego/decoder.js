// Plot decoder page: camera, photo or sample in; decoder-core.js reads it; the page shows the message and its working.
"use strict";
import { decode, pageMm } from "./decoder-core.js";
import { build, howToRead } from "./cipher-core.js";
import { build as signalBuild, HOW as SIGNAL_HOW } from "./signals-core.js";
import { densify } from "./core.js";

const UTP_REV = typeof __UTP_REV__ === "string" ? __UTP_REV__ : "dev";
const $ = id => document.getElementById(id);
let stream = null, scanning = false, lastImage = null;
// a settings label read off the back of a piece, kept for the corners-only front that comes next
let label = null;
const opts = () => ({ cipherKey: $("ckey").value.trim(), label });

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
  $("status").textContent = r.label ? "settings label read: now the front" : r.ok ? `read ${r.cellsRead} cells` : r.message;
}
function report(r) {
  const box = $("result"); box.hidden = false;
  if (!r.ok) { $("head").innerHTML = ""; $("msg").innerHTML = `<span class="fail">${esc(r.message)}</span>`; $("plain").textContent = ""; $("how").textContent = ""; $("facts").innerHTML = ""; $("keyrow").hidden = true; return; }
  $("head").innerHTML = `<span class="chip">${esc(r.studio)}</span><span class="chip">${esc(r.method)}</span>`;
  if (r.label) { $("msg").textContent = r.message; $("plain").textContent = ""; $("how").textContent = "The label carries the settings the front was made with. Point the camera at the front (or pick its photo) and it reads with these settings."; $("facts").innerHTML = ""; $("keyrow").hidden = true; return; }
  $("msg").textContent = r.text || "(nothing readable)";
  const ciphered = r.cipher && r.cipher !== "none";
  $("keyrow").hidden = !ciphered; $("keylabel").textContent = ciphered ? `Enciphered with ${r.cipher}: type its key to read it` : "";
  $("plain").textContent = r.plain ? r.plain : "";
  $("how").textContent = r.o ? howToRead(r.o) : r.studio === "signal book" ? SIGNAL_HOW[r.method] : "";
  $("facts").innerHTML = [`${r.page} mm page`, `${r.cellsRead} cells`, `${r.ms} ms`, ...(r.fromLabel ? ["settings from the back label"] : []), ...(r.marks === "retro" || r.marks === "corners" ? [`${r.marks === "retro" ? "retrofit" : "corner"} marks, shifted ${r.shift.map(v => v.toFixed(2)).join(", ")} mm`] : []), ...(r.weak ? [`<span class="chip warn">${r.weak} unsure</span>`] : []), ...(r.record.repaired !== undefined ? [`key strip repaired 1 bit`] : [])]
    .map(s => (s.startsWith("<") ? s : `<span class="chip">${esc(s)}</span>`)).join("");
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function read(img) {
  clearTapping();
  lastImage = img;
  const r = decode(img, opts());
  if (r.label) label = r.record;
  show(img, r); report(r);
  return r;
}

// ---------------- camera ----------------
async function startCamera() {
  clearTapping();
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
    const img = c.getImageData(0, 0, g.width, g.height), r = decode(img, opts());
    // a label: keep it and keep looking, the front comes next
    if (r.label) { if (!label || label !== r.record) { label = r.record; report(r); } $("status").textContent = "settings label read: now point at the front"; setTimeout(loop, 250); return; }
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
// ---------------- no marks: tap the four page corners (PLG-0475) ----------------
// Needs a settings label already read (it gives the page size and layout). Taps go top-left, top-right, bottom-right,
// bottom-left of the PAGE as it lies on the mat; a fifth tap starts over. The fit snaps each tap to the real paper edge
// and slides the drawing into place, so a tap off by a few mm still reads.
let taps = [], tapImage = null, tapMode = "label", replaceCorner = null, marklessWorker = null;
function cancelMarkless() {
  if (marklessWorker) marklessWorker.terminate();
  marklessWorker = null; $("tap-cancel").disabled = true;
}
function clearTapping() {
  cancelMarkless(); tapImage = null; taps = []; replaceCorner = null; $("tap-tools").hidden = true;
}
function tapStatus(text) { $("status").textContent = text; $("tap-progress").textContent = text; }
function cornerControls() {
  for (let i = 0; i < 4; i++) { $("tap-" + i).disabled = i >= taps.length; $("tap-" + i).setAttribute("aria-pressed", String(replaceCorner === i)); }
  $("tap-read").disabled = taps.length !== 4;
}
function validCorners() {
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if (taps.length !== 4 || taps.some((a,i) => cross(a,taps[(i+1)%4],taps[(i+2)%4]) <= 0)) return false;
  const sides = taps.map((a,i) => Math.hypot(a[0]-taps[(i+1)%4][0],a[1]-taps[(i+1)%4][1]));
  return Math.min(...sides) >= 20 && Math.max(...sides)/Math.min(...sides) < 5;
}
async function loadTapPhoto(file, mode) {
  clearTapping(); stopCamera(); tapMode = mode; $("result").hidden = true;
  try {
    const bmp = await createImageBitmap(file), g = $("grab"); g.width = bmp.width; g.height = bmp.height;
    const c = g.getContext("2d", { willReadFrequently: true }); c.drawImage(bmp, 0, 0); bmp.close();
    tapImage = c.getImageData(0, 0, g.width, g.height);
    const view = $("view"); $("stage").classList.add("on"); $("video").style.display = "none"; view.style.display = "block"; view.width = g.width; view.height = g.height;
    $("tap-tools").hidden = false; drawTaps(); cornerControls();
    tapStatus(`Tap the ${mode === "free" ? "drawing grid" : "page"}: top-left, top-right, bottom-right, bottom-left.`);
  } catch { tapStatus("Could not open this photo. Try a JPEG or PNG."); }
}
function readTapped() {
  cancelMarkless();
  if (!validCorners()) { tapStatus("Corners must surround the drawing in order: top-left, top-right, bottom-right, bottom-left. Correct a corner or start over."); return; }
  $("result").hidden = true;
  if (tapMode === "free") {
    tapStatus("Finding the grid… this can take a minute. You can cancel or correct a corner.");
    try {
      const url = URL.createObjectURL(new Blob([__MARKLESS_WORKER__], { type: "text/javascript" }));
      try { marklessWorker = new Worker(url); } finally { URL.revokeObjectURL(url); }
      $("tap-cancel").disabled = false;
      marklessWorker.onmessage = ({data}) => {
        if (data.progress) { tapStatus(data.progress); return; }
        cancelMarkless();
        if (data.error) { tapStatus("No usable grid found. Check the pattern and adjust the drawing corners, then read again."); return; }
        const r = data.result, best = r.readings[0]; drawTaps();
        $("result").hidden = false; $("keyrow").hidden = true; $("plain").textContent = "";
        $("head").textContent = "Experimental · suggested reading, not verified";
        $("msg").textContent = best?.text?.trim() || "No readable candidate. Adjust the corners and try again.";
        $("how").textContent = "Less reliable than marks or a settings label. Check the text against your plot; a plausible result can still be wrong.";
        $("facts").textContent = `${r.C} × ${r.R} cells · ${r.weak} uncertain cells` + (best ? ` · ${best.layout} · ${best.enc}` : "");
        tapStatus("Finished. Choose a corner to adjust it, or read again.");
      };
      marklessWorker.onerror = () => { cancelMarkless(); tapStatus("The experimental reader could not run. Try another photo or use marked/labelled decoding."); };
      const count = id => { const n = Math.round(+$(id).value); return n >= 3 && n <= 80 ? n : null; };   // blank or out of range = guess
      marklessWorker.postMessage({ image: tapImage, taps, look: $("free-look").value, C: count("free-cols"), R: count("free-rows") });
    } catch { cancelMarkless(); tapStatus("This browser could not start the experimental reader. Use marked or labelled decoding."); }
    return;
  }
  const [W, H] = pageMm(label);
  tapStatus("Fitting…");
  const image = tapImage, points = taps.map(p => [...p]);
  setTimeout(() => {
    if (tapImage !== image || tapMode !== "label") return;
    const res = decode(image, { ...opts(), anchor: { mm: [[0, 0], [W, 0], [W, H], [0, H]], px: points } });
    lastImage = image; show(image, res); report(res);
    tapStatus(res.ok ? `Read ${res.cellsRead} cells. Choose a corner to adjust it.` : res.message + " Adjust the corners and retry.");
  }, 30);
}
function drawTaps() {
  const img = tapImage, view = $("view"), c = view.getContext("2d"); c.putImageData(img, 0, 0);
  const lw = Math.max(3, img.width / 300); c.fillStyle = c.strokeStyle = "#a568e0"; c.lineWidth = lw;
  c.beginPath(); taps.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (taps.length === 4) c.closePath(); c.stroke();
  taps.forEach(([x, y], i) => { c.beginPath(); c.arc(x, y, lw * 2.5, 0, 7); c.fill(); c.font = `${lw * 6}px sans-serif`; c.fillText(["TL", "TR", "BR", "BL"][i], x + lw * 3, y - lw * 3); });
}
$("nomarks").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!label) { clearTapping(); $("result").hidden = true; $("stage").classList.add("on"); tapStatus("Scan the settings label first, or open the experimental reader for a plot without a label."); return; }
  await loadTapPhoto(f, "label");
});
$("free-photo").addEventListener("change", async e => { const f = e.target.files[0]; e.target.value = ""; if (f) await loadTapPhoto(f, "free"); });
$("free-look").addEventListener("change", () => { if (tapMode === "free" && tapImage) { cancelMarkless(); $("result").hidden = true; tapStatus("Pattern changed. Tap Read again when your corners are ready."); } });
for (let i = 0; i < 4; i++) $("tap-" + i).onclick = () => { cancelMarkless(); replaceCorner = i; cornerControls(); tapStatus(`Tap the new ${["top-left", "top-right", "bottom-right", "bottom-left"][i]} corner.`); };
$("tap-reset").onclick = () => { cancelMarkless(); taps = []; replaceCorner = null; drawTaps(); cornerControls(); $("result").hidden = true; tapStatus("Tap the top-left corner first."); };
$("tap-read").onclick = readTapped;
$("tap-cancel").onclick = () => { cancelMarkless(); tapStatus("Reading cancelled. Adjust corners or read again."); };
$("view").addEventListener("click", e => {
  if (!tapImage || (taps.length === 4 && replaceCorner === null)) return;
  cancelMarkless();
  const view = $("view"), r = view.getBoundingClientRect();
  const point = [(e.clientX - r.left) * view.width / r.width, (e.clientY - r.top) * view.height / r.height];
  if (replaceCorner !== null) { taps[replaceCorner] = point; replaceCorner = null; } else taps.push(point);
  drawTaps(); cornerControls();
  if (taps.length < 4) { tapStatus(`Next: ${["top-left", "top-right", "bottom-right", "bottom-left"][taps.length]}.`); return; }
  readTapped();
});
const SAMPLES = {
  arcs: { method: "truchet", tiles: "arcs", msg: "NOTHING TO SEE HERE", hide: "scatter", density: "2", size: 22, fill: "contour", pitch: 0.7 },
  maze: { method: "maze", walls: "line", msg: "YOU FOUND THE WAY IN", size: 24, fill: "lines", pitch: 0.6 },
  thread: { method: "hilbert", mark: "wave", msg: "FOLLOW THE THREAD", fill: "none" },
  knots: { method: "knots", msg: "OVER UNDER", size: 12, fill: "lines", pitch: 0.55, angle: -45 },
  disk: { method: "disk", msg: "ALBERTI SENDS HIS REGARDS", cipher: "caesar", ckey: "3", fill: "lines", pitch: 0.6, angle: 60 },
  pigpen: { method: "pigpen", msg: "THE LODGE MEETS AT MIDNIGHT", size: 12, fill: "lines", pitch: 0.6 },
  automaton: { method: "automaton", cells: "squares", rule: "30", msg: "RUN IT BACKWARDS", size: 36, fill: "lines", pitch: 0.55 },
  border: { method: "maze", walls: "line", msg: "THE FRAME IS THE KEY", size: 24, fill: "lines", pitch: 0.6, marks: "border-arcs" },
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
$("ckey").addEventListener("input", () => { if (lastImage) { const r = decode(lastImage, opts()); report(r); } });
$("scan").onclick = startCamera;
$("stop").onclick = stopCamera;
$("rev").textContent = UTP_REV;
window.__decoder = { decode, SAMPLES, taps: () => taps };   // hooks for checking
