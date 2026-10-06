# Plotter Gen public entrance

Canonical source: `02_WORK/site-index.template.html`, `02_WORK/site/`, and `02_WORK/publish-site.mjs`.
The public checkout's `index.html` and `site/` are generated. Do not hand-edit them.

## Build and concurrent generator work

Install the pinned build dependencies in this directory (`npm install`), or point `PLG_NODE_MODULES` to an existing dependency directory containing `sharp` and `@napi-rs/canvas`.

From the project root:

```powershell
node 02_WORK/publish-site.mjs --homepage-only
```

This mode reads the studio snapshots already in `PLOTTER_GEN`. It writes only `index.html` and `site/`; no studio, decoder, or generator source is copied or modified. Stage only those homepage paths when publishing during parallel generator work.

The existing full publish command still mirrors studios first, then regenerates the same entrance and catalogue. Both modes use one template and one catalogue. Do not replace the full pipeline with an independent homepage deploy.

## Putting a new studio on the site: the standard

Every new generator goes up the same way, so nothing on the entrance needs explaining twice. Do all of it in the same session the studio is published.

1. **Register it.** Add `[page, group, title, one line]` to `PAGES` in `publish-site.mjs`. Only what is listed is published.
2. **Give it a catalogue entry** in `catalogue.mjs`, plus a line in its `placement` table (shelf and pole weights, see "Shelves and the thematic view"): stable `id`, `page`, `name`, `subtitle`, `family`, `tags`, `description`, `lesson`, and `samples`: 3 to 5 of the studio's own built-in presets with display titles. These become the example sheets shown when the drawer is expanded. Every listed preset must pass the studio's own gates, or the build throws.
3. **Seasonal work goes on the Seasonal shelf.** Add `"season":"<label>"` (for example `"Spooky season"`) and a `seasonal` tag. The collection then shows in the SEASONAL section above the pile instead of in it, the section heading takes the label, and a pile search that matches it says so. When the season is over, delete the `season` field and the studio drops back into the pile. With no seasonal collections, the section and its rail link hide themselves.
4. **Give it the header treatment.** Every specimen joins the random header pool and gets the pen-drawing animation automatically. If the thing is assembled or used physically, it also gets a motion asset baked in `puppet-assets.mjs` and played in `hero-motion.js`:
   - jointed rigs (`r.R.parts` with `pivot`, `parent`, `key`): `motion`. It draws, assembles, then repeats the studio's wiggle (figure, animals, vampire). Extra parts such as a cape need a place in the draw order.
   - lino decals: `weeding`. Overlays: `reveal`. Strung charms: `garland`, where the charms lift off the sheet, hang on one string and sway (spooky garland).
   - a new kind of motion means three things: a bake branch in `puppet-assets.mjs`, a `create…`/`…Progress` pair in `hero-motion.js`, and the hook-up in `site.js` (`showHero` and `setProgress`). Bump `VERSION` in `puppet-assets.mjs` whenever baked geometry changes.
5. **Show only what's used.** Put `data-when` on each control that only matters for some bases (see `studio-dock.mjs` and `CONTROL_RELEVANCE.md` at the public root). Never hide a control the build still reads.
6. **Check it.** Run `node 02_WORK/publish-site.mjs`, then `node 02_WORK/site/verify.mjs`. In the browser pane, through the shared preview, open `index.html?sheet=<specimen-id>`, scrub the transport to the end to see the assembly, expand its drawer and open a specimen, at desktop and phone widths.
7. **Publish.** Commit and push `PLOTTER_GEN`, then load the live page.

The section rail (Seasonal, The pile, List) pins to the left on wide screens and becomes a strip under the tabs on phones. A new top-level section needs a link in `.rail` in `site-index.template.html`.

## Shelves and the thematic view
The pile has three arrangements, chosen with the Arrange buttons and remembered per browser (`?view=shelves|az|thematic` also works).
**Shelves** folds studios of one kind under a single drawer; opening it lists each studio with its saved sheets as minis. Shelves fold only while browsing everything: a search, a shelf filter or A-Z lists studios one by one. Filter chips are the shelves.
**Thematic** places every studio on a diamond of four poles, Material opposite Signal and Machine opposite System. A studio sits at the weighted average of the poles it pulls toward, so one pole is a corner, two are an edge and more drift inward. Nodes are nudged apart to stay readable with a hairline back to the true spot; search and shelf filters dim the rest.
Both come from `catalogue.mjs`: `shelves`, `poles`, `edges` and the `placement` table (`shelf` plus `axes` weights per studio id). The build writes them to `site/taxonomy.json`. A new studio gets a `placement` line in the same session as its catalogue entry (step 2 of the standard above); without `axes` it is left off the thematic view, and without `shelf` it sits loose in the pile.

## Add a world or specimen

Register the studio in the existing `PAGES` list in `publish-site.mjs`. Add its editorial entry in `catalogue.mjs`, including a stable ID, page, family, tags, description, lesson and built-in preset IDs with display titles. Uncurated pages remain available in the directory automatically.

The build uses each studio's own build/export functions, recreates every selected built-in preset from clean defaults, and writes SVG + WebP + settings JSON. It does not read private user plots, messages or bench photos. The sample messages and keys are the public built-in preset examples.

SVGs stay exact. WebP images are white-paper previews. Gallery loading uses the lightweight previews; full SVG geometry is fetched only for the hero or a download. Each specimen records a SHA-256 of its source studio.

## Launch boundary

`launch.html` is a separate homepage-owned shell. It validates the source fingerprint and all saved control IDs/options/ranges, then loads those controls in a same-origin iframe and triggers the studio's existing input handlers. No generator files are rewritten or restyled. A mismatched source fails visibly with a direct studio link rather than silently opening an unrelated default.

The control-panel part of the generator redesign landed on 2026-09-30 as the studio dock (see below); expressive titles are still to come.

## Checks

Run `node 02_WORK/site/verify.mjs` after the build. Then check desktop and mobile layouts, expansion, search/filter/reset, specimen dialogs, saved links, launcher status, minimize/restore, pause/resume and reduced motion in a browser. The snapshot hashes must match the studio files included in the final commit. A full publish regenerates the catalogue after generator updates.

Use `_SYSTEM/scripts/preview.ps1` from the workspace for the shared localhost preview.

## Splash playback

`plot-animation.js` hides every undrawn stroke, starts at zero ink, and advances by physical path length; playback begins with the path nearest the visible centre so cropped registration marks do not delay the first visible stroke. This changes homepage playback order only, never exported geometry. Reduced-motion users retain the static complete drawing.

The initial SVG is preloaded alongside the catalogue; the next random sheet and visible loose sheets are warmed in the session cache. No finished thumbnail is placed on the drawing bed while geometry loads.

Open `02_WORK/site/animation-check.html` through the shared localhost preview and run all specimens at desktop and phone widths. It checks blank zero, first-frame visible ink, complete output, replay reset and backward scrubbing against the real browser SVG geometry. This diagnostic is not published.


## Publish selected studios

Use `node 02_WORK/publish-site.mjs --only=spider-web-studio.html,weather-studio.html` to mirror only the named registered pages from 04_DOCS, then rebuild the complete gallery against public snapshots. Other studios and shared source files are left unchanged. This cannot be combined with --homepage-only.

Scene launch checks: open scene-launch-check.html through the shared preview; all controls must match, with at most 2% changed ink pixels at a 1000-pixel raster width (40/255 channel tolerance) for cross-engine geometry differences. The final selected examples measured at most 0.013%.
## Studio dock
Every `04_DOCS/*-studio.html` carries one shared block in `<head>` between `studio-dock:start` and `studio-dock:end` markers, written by `node 02_WORK/site/studio-dock.mjs` (plg-stego/build.mjs re-injects it on every rebuild).
Desktop: the controls column scrolls on its own and the drawing fits the window. Phone: the drawing comes first and stays pinned (Image S/M/L/Unpinned button), controls below it, stats after. Every control group folds from its legend; folds and image size are remembered per studio in localStorage.
The block is a `<script id=...>` in the head, so the headless harnesses, which slice the page's last bare `<script>` tag, never run it. Studio hashes change when it is re-injected, so publish in full afterwards.

## Doll rig parity
The paper doll wardrobe carries a copy of the jointed figure studio's `rig()`, so its pin holes land on the doll's joints. After changing the doll in either studio, copy the rig across and run `node 02_WORK/site/rig-parity-check.mjs`: it must report every setting as identical (60 of 60 on 2026-10-01).

## Plotter / Cutter workspaces
The shared homepage switches between PLOTTER GEN and CUTTER GEN via ?gen=cutter (drawing remains the default). Catalogue entries use mode: 'cutter' for blade-only studios; unmarked entries belong to Plotter. Gallery filters, random sheets, desk previews, field notes and launcher return links follow the selected workspace. Lino cut previews animate from the uncarved silhouette to the finished vinyl; exported SVGs remain exact.

## Header motion
Lino playback begins with the studio’s true uncarved silhouette, including cuts open to the outside; it lifts away patches derived from the uncarved mask minus the final vinyl; its final view is the exact exported geometry. Figure and animal specimens carry motion assets built from their public studio rigs and saved controls: draw for 12 seconds, assemble for 4, then repeat the studio wiggle/walk poses. Replay and scrub return to the sheet; Pause, folding, visibility and reduced motion apply to every phase. Optional ?sheet=figure-skeleton or ?gen=cutter&sheet=lino-raven selects a repeatable header.

Run node 02_WORK/site/hero-motion-test.mjs to compare 1,206 point poses against the original studio functions and raster-check the final lino view against its exported SVG.

## Shared print exhibition
The gallery is a photo exhibition of physical prints, separate from the generated specimens on the studio entrance.
Author the photo list in `02_WORK/site/print-gallery.json`: `photo: null` is a visibly empty placeholder; supply a photo URL, title, description, room, frame width/height, optional studio/decoder links and explicit content flags for a real print.
No generated SVG or specimen thumbnail is used as gallery artwork.
Six fixed rooms open onto one entrance corridor; geometry and exhibited slots stay mounted while walking, turning, using the map and applying filters.
`gallery-world.js` owns dimensions, walkable bounds, destinations and frame-rate-based keyboard integration; doors start exactly at the floor and open sightlines remain unobstructed.
Hold W/A/S/D or touch movement buttons to walk, hold arrow keys to turn, drag to look, and use the live floor plan or room selector for direct travel.
NSFW and swearing are excluded by default; photo entries carry editorial content flags, and swearing also checks titles.
Simplify mode shows the same physical-print photo list and empty slots without the rooms; its preference is remembered.
Header cryptography movement and studio crossfades still use generated specimens outside this gallery.

Run `node 02_WORK/site/gallery-world-test.mjs` to check collision boundaries, door connectivity, frame-rate parity, key release and photo-placeholder invariants.

## Generated studio pages
`04_DOCS/worlds-studio.html` is generated by a separate assembler (the public twin of the VIGIL worlds studio, with the story and the watcher's words left out). Edit its sources there and re-run that assembler; never edit the page here.

## Print photos
Photos of real prints live in `02_WORK/site/prints/` (web copies, about 1400 px wide) and are named in `print-gallery.json` as `prints/<name>.jpg`; the build copies the folder whole.
Masters and originals live in `02_WORK/print-photos/`: run `python flatten.py <photo> <out.jpg> "TL TR BR BL" "l,t,r,b"` with the four corners of the drawn frame boxes, check the result, then make the web copy.
`gallery-world-test.mjs` fails if a named photo is missing from `site/prints/`, or if an empty frame carries a studio or decoder link.

## Inktober room
`inktober.html` is a second tab on the gallery: one hall, 31 frames, driven by the same `gallery.js` and `gallery-gl.js` (`<body data-world="inktober">` swaps in `inktober-world.js` and `inktober.json`).
Each day in `inktober.json` takes a `prompt` and a `photo` as it is inked; the frame title becomes `Day 06: <prompt>`, and today's frame is outlined red from the viewer's own date.
Run `node 02_WORK/site/inktober-world-test.mjs`: it checks day order on the walls, every day reachable and faced, and the today/past/ahead labels.