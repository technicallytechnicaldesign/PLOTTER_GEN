// Build the stego studios: bundle each studio (studio.js, cipher.js, both on core.js) with the UNRAVEL THE PURLOINED engine (read straight from the
// UTP repo, never copied) into self-contained pages: 04_DOCS/stego-plot-studio.html and 04_DOCS/cipher-garden-studio.html.
//   node 02_WORK/plg-stego/build.mjs
// Rebuild whenever a studio, its template, core.js or the UTP engine changes; the page footer names the UTP commit it holds.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { injectDock } from "../site/studio-dock.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const utp = path.join(root, "unravel-the-purloined");
const PAGES = [["studio.js", "template.html", "stego-plot-studio.html"], ["cipher.js", "cipher-template.html", "cipher-garden-studio.html"], ["decoder.js", "decoder-template.html", "plot-decoder.html"], ["overlay.js", "overlay-template.html", "overlay-studio.html"], ["signals.js", "signals-template.html", "signal-book-studio.html"]];   // signals.js draws with signals-core.js

const { build } = await import(pathToFileURL(path.join(utp, "node_modules/esbuild/lib/main.js")).href);
let rev = "unknown";
try {
  rev = execFileSync("git", ["-C", utp, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  if (execFileSync("git", ["-C", utp, "status", "--porcelain", "src/engine"], { encoding: "utf8" }).trim()) rev += "+local";
} catch { /* no git: keep "unknown" */ }

const workerBundle = await build({
  entryPoints: [path.join(here, "markless-worker.js")], bundle: true, format: "iife", target: "es2020", write: false,
  alias: { "@utp": path.join(utp, "src/engine") }, logLevel: "warning",
});
for (const [entry, template, page] of PAGES) {
  if (!fs.existsSync(path.join(here, entry))) continue;
  const res = await build({
    entryPoints: [path.join(here, entry)],
    bundle: true, format: "iife", target: "es2020", write: false, charset: "utf8", legalComments: "none",
    alias: { "@utp": path.join(utp, "src/engine") },
    define: { __UTP_REV__: JSON.stringify(rev), __MARKLESS_WORKER__: JSON.stringify(workerBundle.outputFiles[0].text) },
    logLevel: "warning",
  });
  // The page is one inline script, so the bundle may not close or open a script tag of its own.
  const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<script/gi, "<\\script");
  let html = fs.readFileSync(path.join(here, template), "utf8").replace("/*@@BUNDLE@@*/", () => js);
  if (page.endsWith("-studio.html")) html = injectDock(html);   // fold-away controls and a pinned drawing, see ../site/studio-dock.mjs
  const out = path.resolve(here, "../../04_DOCS", page);
  fs.writeFileSync(out, html);
  console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, UTP ${rev})`);
}
// The decoder core again as a Node module, for decoder-test.mjs (synthetic photos through the real reading code).
await build({
  entryPoints: [path.join(here, "decoder-core.js")], bundle: true, format: "esm", platform: "node", target: "node20", outfile: path.join(here, "_build/decoder-core.mjs"),
  alias: { "@utp": path.join(utp, "src/engine") }, define: { __UTP_REV__: JSON.stringify(rev) }, logLevel: "warning",
});
console.log("wrote 02_WORK/plg-stego/_build/decoder-core.mjs (for decoder-test.mjs)");
await build({
  entryPoints: [path.join(here, "freegrid.js")], bundle: true, format: "esm", platform: "node", target: "node20", outfile: path.join(here, "_build/freegrid.mjs"),
  alias: { "@utp": path.join(utp, "src/engine") }, logLevel: "warning",
});await build({
  entryPoints: [path.join(here, "align.js")], bundle: true, format: "esm", platform: "node", target: "node20", outfile: path.join(here, "_build/align.mjs"),
  alias: { "@utp": path.join(utp, "src/engine") }, logLevel: "warning",
});
