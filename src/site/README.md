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
