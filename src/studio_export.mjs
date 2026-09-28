// Headless export for the PLG HTML studios (gear studios, stego-plot): loads the page's own script
// with a stub DOM, applies a preset and overrides, builds, gates, writes the SVG + a JSON sidecar.
//   node studio_export.mjs <studio.html> <out.svg> [preset] [key=value ...] [--split]
// --split also writes one SVG per pen layer (<out>-1of3-outline.svg ...), each with the same corner ticks.
// Exit 0 on GATE PASS, 1 on GATE FAIL.
import fs from "node:fs";
import vm from "node:vm";

const args = process.argv.slice(2), split = args.includes("--split"), wantLabel = args.includes("--label"), [html, out, preset, ...kv] = args.filter(a => a !== "--split" && a !== "--label");
if (!html || !out) { console.error("usage: node studio_export.mjs <studio.html> <out.svg> [preset] [key=value ...]"); process.exit(2); }
const src = fs.readFileSync(html, "utf8");

// Controls and their default values, read from the page's own markup.
const els = new Map();
const el = (id, type, value) => els.set(id, { id, type, value: String(value ?? ""), textContent: "", innerHTML: "", style: {}, dataset: {},
  addEventListener() {}, scrollIntoView() {}, parentElement: { clientWidth: 800 }, getContext: () => new Proxy({}, { get: () => () => ({ data: [] }) }) });
for (const m of src.matchAll(/<input[^>]*type="(range|text)"[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g)) el(m[2], m[1], m[3]);
for (const m of src.matchAll(/<select id="([^"]+)">\s*<option value="([^"]*)"/g)) el(m[1], "select-one", m[2]);
for (const id of ["stats", "cv", "reroll", "export"]) if (!els.has(id)) el(id, "div", "");
const document = {
  getElementById: id => els.get(id) || (el(id, "div", ""), els.get(id)),
  querySelectorAll: () => [], createElement: () => els.get("cv"),
};
const ctx = { document, window: {}, performance, console, Math, JSON, Map, Set, Float32Array, Float64Array, Int32Array, Uint8Array, Array, Object, Number, String, Blob: class {}, URL: {},
  setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, innerHeight: 1000, devicePixelRatio: 1 };
ctx.window = ctx;
const script = src.slice(src.lastIndexOf("<script>") + 8, src.lastIndexOf("</script>"));
vm.runInNewContext(script, ctx);
const S = ctx.__studio;

if (preset) { const p = S.PRESETS[preset]; if (!p) { console.error(`no preset "${preset}"; have ${Object.keys(S.PRESETS).join(", ")}`); process.exit(2); } for (const [k, v] of Object.entries(p)) els.get(k).value = String(v); }
for (const a of kv) { const [k, v] = a.split("="); if (!els.has(k)) { console.error(`no control "${k}"`); process.exit(2); } els.get(k).value = v; }
const o = S.read(), r = S.build(o);

// Gates: every point is a finite number inside the page, every layer carries line, pitch and gap rules hold.
const layers = Object.entries(r).filter(([, v]) => Array.isArray(v) && v.length && Array.isArray(v[0]) && Array.isArray(v[0][0]));
const gates = [];
let bad = 0, pts = 0;
const lens = {};
for (const [name, paths] of layers) {
  let L = 0;
  for (const [p, closed] of paths) {
    for (let i = 0; i < p.length; i++) { const [x, y] = p[i]; pts++; if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > r.W || y > r.H) bad++; if (i) L += Math.hypot(x - p[i - 1][0], y - p[i - 1][1]); }
    if (closed && p.length > 2) L += Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]);
  }
  lens[name] = { paths: paths.length, metres: +(L / 1000).toFixed(2) };
}
gates.push(["all points finite and on the page", bad === 0, `${bad} of ${pts} off`]);
const want = o.ink === "outline" ? ["key"] : o.ink === "lines" ? ["key", "shade"] : o.ink === "dots" ? ["key", "spot"] : layers.map(([n]) => n);
gates.push(["every pen layer the style asks for has line", want.every(n => (r[n] || []).length), layers.map(([n, v]) => `${n} ${v.length}`).join(", ") || "none"]);
const pitch = o.pitch ?? o.hp;
gates.push(["hatch pitch >= 0.5 mm (0.3 pen)", pitch >= 0.5, `${pitch} mm`]);
if ("minGap" in r) gates.push(["dot-to-dot gap >= 0.2 mm after a 0.3 pen", r.minGap >= 0.2 - 1e-9, `${r.minGap.toFixed(3)} mm`]);
if ("bgTight" in r && r.bgTight !== 99) gates.push(["floor lines never closer than the tightest gap", r.bgTight >= o.mingap - 1e-9, `${r.bgTight.toFixed(3)} mm (limit ${o.mingap})`]);
if ("pileups" in r) gates.push(["three-way pile-up points < 1%", r.pileups / r.samples < 0.01, `${(100 * r.pileups / r.samples).toFixed(2)}%`]);
if (Array.isArray(r.gates)) gates.push(...r.gates);   // a studio's own checks (stego-plot: decode proof, cell size)
const splits = [];
if (split) {
  const ls = S.penLayers(r), boxes = ls.map((L, i) => {
    const svgL = S.toSVG(r, L.name, true), name = out.replace(/\.svg$/, `-${i + 1}of${ls.length}-${L.name}.svg`);
    fs.writeFileSync(name, svgL); splits.push(name.split(/[\\/]/).pop());
    let b = [1e9, 1e9, -1e9, -1e9];
    for (const m of svgL.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) { const x = +m[1], y = +m[2]; b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; }
    return b.map(v => v.toFixed(3)).join(" ");
  });
  gates.push(["split files share one bounding box (they line up in Design Space)", new Set(boxes).size === 1, `${ls.length} files, box ${boxes[0]}`]);
}
const pass = gates.every(g => g[1]);

const svg = S.toSVG(r);
fs.writeFileSync(out, svg);
// the settings label for the back (always for a corners-only front, which cannot be read without it)
if ((wantLabel || o.marks === "corners") && S.labelSVG && r.marks && r.marks.bits) { fs.writeFileSync(out.replace(/\.svg$/, "-label.svg"), S.labelSVG(r)); splits.push("label"); }
fs.writeFileSync(out.replace(/\.svg$/, ".json"), JSON.stringify({ studio: html.split(/[\\/]/).pop(), preset: preset || null, controls: o, gears: r.gears?.length ?? 0, layers: lens, ms: Math.round(r.ms), gates: gates.map(([n, ok, v]) => ({ gate: n, pass: ok, value: v })), pass, kb: Math.round(svg.length / 1024), splits }, null, 1));
for (const [n, ok, v] of gates) console.log(`${ok ? "pass" : "FAIL"}  ${n}: ${v}`);
console.log(Object.entries(lens).map(([n, v]) => `${n}: ${v.metres} m in ${v.paths} paths`).join(" | "), `| ${r.gears ? r.gears.length + " gears" : (r.G ? r.G.C + "x" + r.G.R + " cells" : "")} | ${Math.round(svg.length / 1024)} KB | ${Math.round(r.ms)} ms`);
console.log(pass ? "GATE PASS" : "GATE FAIL", out);
process.exit(pass ? 0 : 1);
