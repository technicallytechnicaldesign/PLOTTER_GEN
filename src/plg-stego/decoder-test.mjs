// Decoder check: every exported plot that carries machine marks, photographed synthetically (synth_photo.py) at a few
// tilts, run through the real decoder core, and compared with the message its sidecar JSON says it holds.
//   node 02_WORK/plg-stego/build.mjs && node 02_WORK/plg-stego/decoder-test.mjs [filter] [--tilt 0.08] [--px 5]
// Exit 0 when every photo reads back to its message.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { decode } from "./_build/decoder-core.mjs";

// synthetic photos are regenerated every run, so they live in the system temp folder, not the synced workspace
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(os.tmpdir(), "plg-decoder-test"), plots = path.resolve(here, "../../03_OUTPUT/plg-stego");
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const filter = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")))[0] || "";
const tilts = opt("--tilt") ? [+opt("--tilt")] : [0.03, 0.08], px = opt("--px") || "5";
const svgs = [...fs.readdirSync(plots).map(f => path.join(plots, f)), ...["cipher-garden", "signals"].flatMap(d => fs.readdirSync(path.join(plots, d)).map(f => path.join(plots, d, f)))]
  .filter(f => /\.svg$/.test(f) && !/-\d+of\d+-/.test(f) && f.includes(filter));
const readPGM = file => { const b = fs.readFileSync(file), head = b.subarray(0, 40).toString("latin1").split(/\s+/), w = +head[1], h = +head[2], off = b.indexOf(0x0a, b.indexOf("255")) + 1; return { width: w, height: h, data: b.subarray(off, off + w * h) }; };
const norm = s => String(s || "").replace(/\s+/g, " ").trim();
let pass = 0, fail = 0, skip = 0;
for (const svg of svgs) {
  const side = svg.replace(/\.svg$/, ".json"); if (!fs.existsSync(side)) continue;
  const meta = JSON.parse(fs.readFileSync(side, "utf8")), o = meta.controls;
  if (o.marks === "off" || o.layout === "chart" || !/stego-(stitches|scatter|motif|punch|truchet)|cipher-|signals-/.test(path.basename(svg))) { skip++; continue; }
  const retro = o.marks === "retro";
  for (const tilt of tilts) {
    const pgm = path.join(out, path.basename(svg).replace(/\.svg$/, `-t${tilt}.pgm`));
    execFileSync("python", [path.join(here, "synth_photo.py"), svg, pgm, "--tilt", String(tilt), "--px", px, "--seed", String(Math.round(tilt * 1000)), ...(retro ? ["--markshift", "0.9,-0.7"] : [])], { encoding: "utf8" });
    const r = decode(readPGM(pgm), { cipherKey: o.ckey });
    const want = norm(o.msg).toUpperCase(), got = norm(r.plain ?? r.text);
    // the message as the encoder carries it: five-bit/Morse keep letters, digits, space . ?; Bacon and pigpen keep letters
    // tap code shares C and K; ogham writes K V W J Y P X with other letters
    const sub = s => (o.alpha === "tap" ? s.replace(/K/g, "C").replace(/[^A-Z ]/g, "") : o.alpha === "ogham" ? s.replace(/K/g, "C").replace(/V/g, "F").replace(/W/g, "U").replace(/[JY]/g, "I").replace(/P/g, "B").replace(/X/g, "CS").replace(/[^A-Z ]/g, "") : s);
    const bac = /bacon/.test(o.enc) && !o.alpha;
    const carried = sub(bac && !/cipher-(pigpen)/.test(svg) ? want.replace(/[^A-Z]/g, "") : /pigpen/.test(svg) ? want.replace(/[^A-Z ]/g, "") : want.replace(/[^A-Z0-9 .?]/g, ""));
    const ok = r.ok && norm(got.replace(/ /g, bac ? "" : " ")) === norm(carried);
    ok ? pass++ : fail++;
    console.log(`${ok ? "pass" : "FAIL"}  ${path.basename(svg).padEnd(34)} tilt ${tilt}  ${r.ok ? `"${got.slice(0, 40)}" (${r.weak}/${r.cellsRead} weak cells, ${r.ms} ms)` : `${r.stage}: ${r.message}`}${ok ? "" : `  want "${carried.slice(0, 40)}"`}`);
  }
}
console.log(`${pass} read, ${fail} failed, ${skip} skipped (no marks, or a layout read by eye)`);
process.exit(fail ? 1 : 0);
