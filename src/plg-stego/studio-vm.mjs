// Loads a built studio page into a stub DOM so Node checks can drive its own code (build, toSVG, presets, applySettings).
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../04_DOCS");
export const PAGES = ["stego-plot-studio.html", "cipher-garden-studio.html", "signal-book-studio.html", "overlay-studio.html"];
export function load(page) {
  const src = fs.readFileSync(path.join(docs, page), "utf8"), els = new Map(), defaults = new Map();
  const el = (id, type, value) => { els.set(id, { id, type, value: String(value ?? ""), textContent: "", innerHTML: "", style: {}, dataset: {}, addEventListener() {}, insertAdjacentHTML() {}, scrollIntoView() {}, parentElement: { clientWidth: 800 }, getContext: () => new Proxy({}, { get: () => () => ({ data: [] }) }) }); defaults.set(id, String(value ?? "")); };
  for (const m of src.matchAll(/<input[^>]*type="(range|text)"[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g)) el(m[2], m[1], m[3]);
  for (const m of src.matchAll(/<select id="([^"]+)">\s*<option value="([^"]*)"/g)) el(m[1], "select-one", m[2]);
  for (const id of ["stats", "cv", "reroll", "export", "loadbtn", "loadsvg"]) if (!els.has(id)) el(id, "div", "");
  const document = { getElementById: id => els.get(id) || (el(id, "div", ""), els.get(id)), querySelectorAll: () => [], createElement: () => els.get("cv") };
  const ctx = { document, window: {}, performance, console, Math, JSON, Map, Set, Float32Array, Float64Array, Int32Array, Uint8Array, Array, Object, Number, String, Blob: class {}, URL: {}, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, cancelAnimationFrame: () => {}, requestAnimationFrame: () => 0, innerHeight: 1000, devicePixelRatio: 1 };
  ctx.window = ctx;
  vm.runInNewContext(src.slice(src.lastIndexOf("<script>") + 8, src.lastIndexOf("</script>")), ctx);
  return { S: ctx.__studio, els, defaults };
}
