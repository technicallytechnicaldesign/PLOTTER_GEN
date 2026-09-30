// Mirror the PLG studios into the public site repo (PLOTTER_GEN -> github.com/technicallytechnicaldesign/PLOTTER_GEN,
// served by GitHub Pages). The workspace stays the source of truth: pages are built into 04_DOCS, then copied here with the
// sources that made them, and the hub index.html is written from the list below.
//   node 02_WORK/publish-site.mjs          (then commit and push the repo)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./site/build.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const repo = path.join(proj, "PLOTTER_GEN");
const docs = path.join(proj, "04_DOCS");

// [page in 04_DOCS, group, title, one line]. Only what is listed is published.
export const PAGES = [
  ["plot-decoder.html", "Read", "Plot decoder", "Point a phone camera at a plot (or upload a photo) and read the hidden message back."],
  ["stego-plot-studio.html", "Hide", "Purloined plot studio", "Unravel the Purloined's knitting encoders as plots: dot charts, stitches, cross-stitch, punch cards, Truchet."],
  ["cipher-garden-studio.html", "Hide", "Cipher garden", "Drawings that are the code: Truchet tiles, mazes, a Hilbert thread, ridgelines, pigpen, constellations, cipher disks, automata, knots."],
  ["overlay-studio.html", "Hide", "Overlay studio", "Two sheets, a slide or a cut: visual cryptography, moire reveals and turning grilles."],
  ["signal-book-studio.html", "Signal", "Signal book", "Alphabets as pictures: ship's signal flags on hoists, semaphore, ogham, braille shapes and tap code."],
  ["spider-web-studio.html", "Scenes", "Spider web studio", "Webs grown the way a spider builds them: orbs, cobwebs, sheet webs, dew and moonlit hedges."],
  ["weather-studio.html", "Scenes", "Weather studio", "Clouds, rain, lightning, fog and rainbows over the hills, or a synoptic chart with isobars and fronts."],
  ["orrery-studio.html", "Scenes", "Orrery studio", "A new star system every seed: plan, tilted, textbook plate and brass orrery views."],
  ["island-atlas-studio.html", "Scenes", "Island atlas studio", "Islands nobody has visited, as survey sheets, antique charts, portolans and treasure maps."],
  ["underground-studio.html", "Scenes", "Underground studio", "A cut-away slice of the earth: roots, mycelium, burrows, strata and a buried fossil."],
  ["archaeology-studio.html", "Scenes", "Archaeology studio", "Trench sections, site plans with findspots, a finds sieve and a pottery refit, drawn to excavation conventions."],
  ["gear-3d-studio.html", "Gears", "Gear 3D studio", "3D gears under a perspective lens on floors of rays, rings, ripples and Truchet ribbons."],
  ["gear-bam-studio.html", "Gears", "Gear BAM studio", "Comic 3D gears with crosshatched walls, riso halftone tops and extruded sound effects."],
  ["gear-weave-studio.html", "Gears", "Gear weave studio", "Hundreds of overlapping gears woven over and under like chainmail."],
  ["gear-reverb-studio.html", "Gears", "Gear reverb studio", "A meshing gear train wrapped in reverb rings, tilted under a camera."],
];
export const SOURCES = ["plg-stego/core.js", "plg-stego/marks.js", "plg-stego/studio.js", "plg-stego/cipher-core.js", "plg-stego/cipher.js", "plg-stego/overlay.js", "plg-stego/signals.js", "plg-stego/signals-core.js", "plg-stego/decoder-core.js", "plg-stego/decoder.js",
  "plg-stego/build.mjs", "plg-stego/decoder-test.mjs", "plg-stego/decoder-debug.mjs", "plg-stego/synth_photo.py", "plg-stego/export-all.sh", "studio_export.mjs",
  "plg-stego/markless-worker.js", "plg-stego/align.js", "plg-stego/freegrid.js", "plg-stego/template.html", "plg-stego/cipher-template.html",
  "plg-stego/decoder-template.html", "plg-stego/overlay-template.html", "plg-stego/signals-template.html",
  "plg-stego/anchor-test.mjs", "plg-stego/settings-test.mjs", "plg-stego/studio-vm.mjs", "plg-stego/README.md",
  "publish-site.mjs", "site-index.template.html", "site-public-readme.md",
  "site/build.mjs", "site/catalogue.mjs", "site/verify.mjs", "site/verify-sync.mjs", "site/README.md",
  "site/package.json", "site/package-lock.json", "site/site.js", "site/site.css", "site/bench.css",
  "site/plot-animation.js", "site/launch.html", "site/launch.js"];

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!fs.existsSync(repo)) throw new Error(`no repo at ${repo}`);
  // Homepage-only reads the existing public snapshots: never mirrors concurrent generator work.
  const homepageOnly = process.argv.includes("--homepage-only");
  const selectedArg=process.argv.find(arg=>arg.startsWith('--only='));
  const selected=selectedArg?new Set(selectedArg.slice(7).split(',')):null;
  if(selected&&homepageOnly)throw Error('--only cannot be combined with --homepage-only');
  if(selected)for(const page of selected)if(!PAGES.some(([p])=>p===page)||!fs.existsSync(path.join(docs,page)))throw Error('Unknown or missing studio: '+page);
  const live = PAGES.filter(([p]) => fs.existsSync(path.join(homepageOnly || (selected&&!selected.has(p)) ? repo : docs, p)));
  if (!homepageOnly) {
    for (const [p] of live.filter(([p])=>!selected||selected.has(p))) fs.copyFileSync(path.join(docs, p), path.join(repo, p));
    fs.mkdirSync(path.join(repo, "src/plg-stego"), { recursive: true });
    for (const s of selected?[]:SOURCES) {
      if(!fs.existsSync(path.join(here,s)))throw Error('Missing public source: '+s);
      const target=path.join(repo,'src',s);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(here,s),target);
    }
    if(!selected)fs.copyFileSync(path.join(here,'site-public-readme.md'),path.join(repo,'README.md'));
    fs.writeFileSync(path.join(repo, ".nojekyll"), "");
  }
  await buildSite({repo, here, pages: live});
  console.log(`built ${homepageOnly ? "homepage only; generators untouched" : `${live.length} pages and homepage`} in ${repo}`);
}
