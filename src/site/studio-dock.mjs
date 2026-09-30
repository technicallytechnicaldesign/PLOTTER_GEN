// Studio dock: one shared layer that lets every PLG studio show the drawing and the controls at the same time.
//   Desktop: the controls column scrolls on its own and the drawing is sized to fit the window, so it never scrolls away.
//   Phone:   the drawing comes first and stays pinned to the top (size button cycles S / M / L / unpinned), controls below.
//   Both:    every control group folds from its legend, with Fold all / Open all; folds are remembered per studio.
// The snippet sits in <head> between markers, as a <script id=...> so the headless harnesses (studio_export.mjs,
// studio-vm.mjs), which slice the last bare <script> tag, never see it.
//   node 02_WORK/site/studio-dock.mjs            (inject or refresh the dock in every 04_DOCS/*-studio.html)
// plg-stego/build.mjs calls injectDock() on the pages it generates, so rebuilds keep the dock.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const START = "<!-- studio-dock:start -->", END = "<!-- studio-dock:end -->";

const CSS = `
aside fieldset > legend { cursor:pointer; user-select:none; display:flex; align-items:center; gap:6px; width:100%; }
aside fieldset > legend::before { content:"\\25BE"; font-style:normal; font-size:0.8em; color:var(--muted); width:0.9em; display:inline-block; transition:transform .12s; }
aside fieldset.dock-folded > legend::before { transform:rotate(-90deg); }
aside fieldset > legend:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
aside fieldset.dock-folded > :not(legend) { display:none !important; }
aside fieldset.dock-folded { padding-bottom:0; }
.dock-bar { display:flex; gap:6px; align-items:center; margin:0 0 10px; padding:0 0 8px; border-bottom:1px solid var(--grid); font-size:0.78rem; color:var(--muted); }
.dock-bar span { margin-right:auto; font-style:italic; }
.dock-bar button { font-size:0.76rem; padding:1px 8px; }
.dock-frame { position:relative; }
.dock-size { position:absolute; top:6px; right:6px; z-index:3; font:inherit; font-size:0.72rem; line-height:1.2; padding:3px 8px; background:var(--surface); color:var(--ink); border:1px solid var(--grid); border-radius:var(--radius); opacity:0.88; cursor:pointer; }
.dock-size:hover { opacity:1; border-color:var(--accent); }
@media (min-width:761px) {
  .wrap > aside { position:sticky; top:10px; max-height:calc(100vh - 20px); overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; }
  html:not([data-dock-img="wide"]) .dock-frame canvas { max-height:calc(100vh - 48px); width:auto; }
}
@media (max-width:760px) {
  .wrap { display:flex !important; flex-direction:column; }
  .wrap > main { display:contents; }
  .wrap > main > * { order:2; min-width:0; }
  .wrap > main > .dock-frame { order:0; }
  .wrap > aside { order:1; }
  .dock-frame { position:sticky; top:0; z-index:4; box-shadow:0 6px 14px -8px var(--ring), 0 1px 0 var(--grid); }
  html[data-dock-img="off"] .dock-frame { position:relative; box-shadow:none; }
  .dock-frame canvas { width:auto; max-height:42vh; }
  html[data-dock-img="s"] .dock-frame canvas { max-height:26vh; }
  html[data-dock-img="l"] .dock-frame canvas { max-height:62vh; }
  html[data-dock-img="off"] .dock-frame canvas { max-height:none; width:100%; }
}`;

// Runs in the page only. Guarded so a stub DOM that ever evaluates it just returns.
function dock() {
  if (typeof document === "undefined" || !document.querySelector) return;
  const key = "plg-dock:" + location.pathname.split("/").pop();
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } };
  const save = s => { try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) {} };
  const phone = () => matchMedia("(max-width:760px)").matches;
  const run = () => {
    const aside = document.querySelector(".wrap > aside"), main = document.querySelector(".wrap > main");
    if (!aside || !main || aside.dataset.dock) return;
    aside.dataset.dock = "1";
    const sets = [...aside.querySelectorAll("fieldset")].filter(f => f.querySelector(":scope > legend"));
    const name = f => f.querySelector(":scope > legend").textContent.trim();
    let st = load() || { folded: phone() ? sets.slice(1).map(name) : [], img: phone() ? "m" : "fit" };
    const persist = () => { st.folded = sets.filter(f => f.classList.contains("dock-folded")).map(name); save(st); };
    const setFold = (f, on) => { f.classList.toggle("dock-folded", on); f.querySelector(":scope > legend").setAttribute("aria-expanded", String(!on)); };
    for (const f of sets) {
      const lg = f.querySelector(":scope > legend");
      lg.setAttribute("role", "button"); lg.tabIndex = 0; lg.title = "Fold or open this group";
      setFold(f, st.folded.includes(name(f)));
      const flip = () => { setFold(f, !f.classList.contains("dock-folded")); persist(); };
      lg.addEventListener("click", flip);
      lg.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    }
    const bar = document.createElement("div");
    bar.className = "dock-bar";
    bar.innerHTML = '<span>Controls</span><button type="button" data-a="fold">Fold all</button><button type="button" data-a="open">Open all</button>';
    bar.addEventListener("click", e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; for (const f of sets) setFold(f, a === "fold"); persist(); });
    aside.prepend(bar);
    // The drawing's frame is main's first child (.paper, .case or .mount, depending on the studio).
    const frame = main.firstElementChild;
    if (!frame) return;
    frame.classList.add("dock-frame");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dock-size";
    const modes = () => phone() ? ["s", "m", "l", "off"] : ["fit", "wide"];
    const label = { s: "Image S", m: "Image M", l: "Image L", off: "Unpinned", fit: "Fit window", wide: "Full width" };
    const apply = () => {
      if (!modes().includes(st.img)) st.img = phone() ? "m" : "fit";
      document.documentElement.dataset.dockImg = st.img;
      btn.textContent = label[st.img];
      btn.title = phone() ? "Image size while pinned: small, medium, large, or scroll with the page" : "Fit the drawing to the window, or let it run full width";
    };
    btn.addEventListener("click", () => { const m = modes(); st.img = m[(m.indexOf(st.img) + 1) % m.length]; apply(); save(st); });
    frame.appendChild(btn);
    apply();
    matchMedia("(max-width:760px)").addEventListener("change", apply);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
}

export const SNIPPET = `${START}\n<style id="studio-dock-css">${CSS}\n</style>\n<script id="studio-dock">(${dock.toString()})();</script>\n${END}`;

export function injectDock(html) {
  const i = html.indexOf(START), j = html.indexOf(END);
  if (i >= 0 && j > i) return html.slice(0, i) + SNIPPET + html.slice(j + END.length);
  const h = html.indexOf("</head>");
  if (h < 0) throw Error("studio-dock: page has no </head>");
  return html.slice(0, h) + SNIPPET + "\n" + html.slice(h);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../04_DOCS");
  let n = 0;
  for (const f of fs.readdirSync(docs).filter(f => f.endsWith("-studio.html"))) {
    const p = path.join(docs, f), src = fs.readFileSync(p, "utf8");
    if (!/<aside[\s>]/.test(src) || !/<main[\s>]/.test(src)) { console.log("skip (no aside/main): " + f); continue; }
    const out = injectDock(src);
    if (out !== src) { fs.writeFileSync(p, out); n++; }
    console.log((out !== src ? "docked  " : "current ") + f);
  }
  console.log(`studio-dock: ${n} page(s) written`);
}
