// Build the stego studios: bundle each studio (studio.js, cipher.js, both on core.js) with the UNRAVEL THE PURLOINED engine (read straight from the
// UTP repo, never copied) into self-contained pages: 04_DOCS/stego-plot-studio.html and 04_DOCS/cipher-garden-studio.html.
//   node 02_WORK/plg-stego/build.mjs
// Rebuild whenever a studio, its template, core.js or the UTP engine changes; the page footer names the UTP commit it holds.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const utp = path.join(root, "PROJECTS/UNRAVEL_THE_PURLOINED/LOCAL_UNRAVEL_THE_PURLOINED_CLAUDE");
const PAGES = [["studio.js", "template.html", "stego-plot-studio.html"], ["cipher.js", "cipher-template.html", "cipher-garden-studio.html"]];

const { build } = await import(pathToFileURL(path.join(utp, "node_modules/esbuild/lib/main.js")).href);
let rev = "unknown";
try {
  rev = execFileSync("git", ["-C", utp, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  if (execFileSync("git", ["-C", utp, "status", "--porcelain", "src/engine"], { encoding: "utf8" }).trim()) rev += "+local";
} catch { /* no git: keep "unknown" */ }

for (const [entry, template, page] of PAGES) {
  const res = await build({
    entryPoints: [path.join(here, entry)],
    bundle: true, format: "iife", target: "es2020", write: false, charset: "utf8", legalComments: "none",
    alias: { "@utp": path.join(utp, "src/engine") },
    define: { __UTP_REV__: JSON.stringify(rev) },
    logLevel: "warning",
  });
  // The page is one inline script, so the bundle may not close or open a script tag of its own.
  const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<script/gi, "<\\script");
  const html = fs.readFileSync(path.join(here, template), "utf8").replace("/*@@BUNDLE@@*/", () => js);
  const out = path.resolve(here, "../../04_DOCS", page);
  fs.writeFileSync(out, html);
  console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, UTP ${rev})`);
}