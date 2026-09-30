// Gate for PLG-0474: every stego studio export carries its settings (never the message or a key) in <desc id="plg-settings">,
// and loading them back with the message re-supplied rebuilds a byte-identical SVG.
//   node 02_WORK/plg-stego/build.mjs && node 02_WORK/plg-stego/settings-test.mjs
// For each studio preset (and a keyword-cipher variant with a distinctive key): export the whole SVG and every per-pen SVG, check the desc
// exists and holds no message or key text, reset every control, load the desc through the studio's own applySettings, re-supply message and keys,
// rebuild, and compare bytes. Exit 0 when every case passes.
import { load, PAGES } from "./studio-vm.mjs";
const SECRET = ["msg", "ckey", "pkey"];

const words = s => s.split(/[^A-Za-z0-9]+/).filter(w => w.length >= 4);
let pass = 0, fail = 0;
const report = (ok, label, why = "") => { ok ? pass++ : fail++; console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok ? "" : "  " + why}`); };

for (const page of PAGES) {
  const { S, els, defaults } = load(page);
  if (!S.applySettings) { report(false, page, "no applySettings hook"); continue; }
  const cases = Object.keys(S.PRESETS).map(p => [p, {}]);
  if (els.has("cipher")) cases.push(["keyed", { ...S.PRESETS[Object.keys(S.PRESETS)[0]], cipher: "keyword", ckey: "ZEBRAKEYX" }]);
  for (const [name, extra] of cases) {
    const label = `${page.replace(/-?studio\.html/, "")} ${name}`;
    for (const [k, v] of defaults) if (els.get(k).type !== "div") els.get(k).value = v;
    const p = name === "keyed" ? extra : { ...S.PRESETS[name], ...extra };
    for (const [k, v] of Object.entries(p)) els.get(k).value = String(v);
    const secrets = SECRET.filter(k => els.has(k)).map(k => [k, els.get(k).value]);
    const r = S.build(S.read());
    if (r.error) { report(false, label, "build error: " + r.error); continue; }
    const orig = [S.toSVG(r), ...S.penLayers(r).map(L => S.toSVG(r, L.name, true))];
    const before = Object.fromEntries(S.IDS.map(k => [k, els.get(k).value]));
    // 1. the desc exists, holds the layout settings, and no secret text
    const problems = [];
    for (const svg of orig) {
      const m = svg.match(/<desc id="plg-settings">([\s\S]*?)<\/desc>/);
      if (!m) { problems.push("no desc"); continue; }
      const j = JSON.parse(m[1].replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
      for (const [k, v] of secrets) {
        if (k in j) problems.push(`${k} key present`);
        if (v.length >= 4 && m[1].includes(v)) problems.push(`${k} text leaked`);
        if (v.length >= 2 && m[1].toLowerCase().includes(v.toLowerCase()) && k === "msg") problems.push("message text leaked");
      }
      for (const k of S.IDS) if (!SECRET.includes(k) && !(k in j)) problems.push(`setting ${k} missing`);
      if (!(j.msgLen >= 1)) problems.push("msgLen missing");
    }
    // 1b. the desc does not depend on the message or keys at all: swap them for other text of the same length and the desc must not change
    const descOf = svg => svg.match(/<desc id="plg-settings">([\s\S]*?)<\/desc>/)[1];
    for (const [k, v] of secrets) els.get(k).value = k === "msg" ? v.replace(/[A-Z]/g, c => String.fromCharCode(65 + (c.charCodeAt(0) - 64) % 26)) : "Q".repeat(v.length);
    const swapped = S.build(S.read());
    if (!swapped.error && descOf(S.toSVG(swapped)) !== descOf(orig[0])) problems.push("desc changes with the message or a key");
    for (const [k, v] of secrets) els.get(k).value = v;
    // 2. reset everything, load from the whole-page SVG, put the message and keys back, rebuild, compare bytes
    for (const [k, v] of defaults) if (els.get(k).type !== "div") els.get(k).value = v;
    const changedByReset = S.IDS.filter(k => !SECRET.includes(k) && els.get(k).value !== before[k]).length;
    const m0 = orig[0].match(/<desc id="plg-settings">([\s\S]*?)<\/desc>/);
    const n = S.applySettings(JSON.parse(m0[1].replace(/&lt;/g, "<").replace(/&amp;/g, "&")));
    for (const [k, v] of secrets) els.get(k).value = v;
    const again = S.build(S.read()), svgs2 = [S.toSVG(again), ...S.penLayers(again).map(L => S.toSVG(again, L.name, true))];
    if (svgs2.length !== orig.length || svgs2.some((s, i) => s !== orig[i])) problems.push("reloaded settings do not rebuild a byte-identical SVG");
    report(!problems.length, `${label}  (${orig.length} files, ${n} settings loaded, reset moved ${changedByReset})`, [...new Set(problems)].join("; "));
  }
}
console.log(fail ? `SETTINGS TEST FAIL ${fail} of ${pass + fail}` : `SETTINGS TEST PASS ${pass} of ${pass}`);
process.exit(fail ? 1 : 0);
