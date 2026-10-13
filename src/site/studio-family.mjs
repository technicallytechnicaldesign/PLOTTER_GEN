// Studio families: close sibling studios shown as one studio with sub-studio tabs under the header.
//   Each member page keeps its own file, script, presets, specimens and URL (so the headless harnesses, the shelf bake
//   and old links all keep working); the family gives them one shared title (the h1) and a tab strip linking them.
//   Families are listed in studio-families.json: { id, name, members: [{ page, tab }] }.
// The block sits at the end of <header> between markers and holds no <script>, so harnesses that slice the last bare
// <script> tag never see it. Re-run after editing the JSON or adding a member; it replaces the old block in place.
//   node src/site/studio-family.mjs            (inject or refresh every family's tabs in the repo root's studio pages)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../..");
const START = "<!-- studio-family:start -->", END = "<!-- studio-family:end -->";
const CSS = `.family-tabs { display:flex; gap:2px; flex-wrap:wrap; margin:14px 0 0; border-bottom:1px solid var(--grid); }
.family-tabs a { font-size:0.88rem; color:var(--ink-2); text-decoration:none; padding:5px 14px 4px; border:1px solid transparent; border-bottom:0; border-radius:var(--radius) var(--radius) 0 0; margin-bottom:-1px; }
.family-tabs a:hover { color:var(--ink); border-color:var(--grid); }
.family-tabs a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.family-tabs a[aria-current="page"] { color:var(--ink); background:var(--surface); border-color:var(--grid); border-bottom:1px solid var(--surface); font-style:italic; }`;
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function familyBlock(fam, page) {
  const tabs = fam.members.map(m => `<a href="${esc(m.page)}"${m.page === page ? ' aria-current="page"' : ""}>${esc(m.tab)}</a>`).join("");
  return `${START}\n<style id="studio-family-css">\n${CSS}\n</style>\n<nav class="family-tabs" id="studio-family" data-family="${esc(fam.id)}" aria-label="${esc(fam.name)} studios">${tabs}</nav>\n${END}`;
}
export function injectFamily(html, fam, page) {
  let out = html.replace(/[ \t]*<!-- studio-family:start -->[\s\S]*?<!-- studio-family:end -->\n?/, "");
  const h = out.indexOf("</header>");
  if (h < 0) throw new Error(`${page}: no </header> to put the tabs in`);
  out = out.slice(0, h) + "  " + familyBlock(fam, page) + "\n" + out.slice(h);
  return out.replace(/(<header>\s*<h1>)[\s\S]*?(<\/h1>)/, `$1${esc(fam.name)}$2`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fams = JSON.parse(fs.readFileSync(path.join(here, "studio-families.json"), "utf8"));
  for (const fam of fams) for (const m of fam.members) {
    const file = path.join(root, m.page);
    if (!fs.existsSync(file)) { console.log(`skip ${m.page}: not found`); continue; }
    const before = fs.readFileSync(file, "utf8"), after = injectFamily(before, fam, m.page);
    if (after !== before) fs.writeFileSync(file, after);
    console.log(`${fam.id}: ${m.page} ${after === before ? "unchanged" : "tabs written"}`);
  }
}
