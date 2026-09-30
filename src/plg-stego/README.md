# plg-stego: hidden-message plots and the decoder that reads them

Sub-project PLG-STEGO. Messages drawn so the drawing is the code, using UNRAVEL THE PURLOINED's encoders (bundled in from its repo at build time, never copied), plus a camera decoder that reads the plots back off paper. Public at https://technicallytechnicaldesign.github.io/PLOTTER_GEN/

| Page (04_DOCS) | Built from | What it is |
|---|---|---|
| `stego-plot-studio.html` | `studio.js`, `template.html` | UTP's knitting charts as plots: dot chart, stitches, cross-stitch, punch card, squared chart, Truchet (FIELD_NOTES). |
| `cipher-garden-studio.html` | `cipher-core.js`, `cipher.js`, `cipher-template.html` | Truchet tiles, binary-tree maze, Hilbert thread, ridgelines, pigpen, constellations, cipher disk, reversible automaton, knotwork (GOBLIN). |
| `overlay-studio.html` | `overlay.js`, `overlay-template.html` | Two sheets or a cut: visual cryptography, moire reveal (slides vertically), Fleissner turning grille pinned at the centre, dial grille on one pin with 3 to 8 stops, Cardano grille; grilles are locked so every hole shows a message letter or an end mark (VITRINE). |
| `signal-book-studio.html` | `signals-core.js`, `signals.js`, `signals-template.html` | Alphabets as pictures: ICS flags, semaphore, ogham, braille shapes, tap code (SALON). |
| `plot-decoder.html` | `decoder-core.js`, `decoder.js`, `decoder-template.html` | Camera or photo in, message out (SIGNAL). |

Shared: `core.js` (geometry, clipping, seven fills, vector hidden lines, stroke font, SVG writer) and `marks.js` (corner targets, key strip, record schemas).

## How the decoder reads a plot

1. **Finders**: four 10 mm corner targets, a ring round a core; bottom right's core is hollow, which fixes the orientation.
2. **Key strip**: 2 x 64 dots between the bottom targets carry the plot's record (method, seed, sizes, offsets, fill) with a sync header and CRC-8; one weak bit is repaired if the checksum then passes on the right page size.
3. **Rebuild**: the studio's own code redraws the plot from the record, reporting for every message cell what each possible value would draw.
4. **Read**: each candidate is sampled along its strokes in the photo; the one inked most against the strokes it lacks wins. Shaded areas split into two levels by clustering, never a fixed cut-off.

## Commands

```
sh 02_WORK/plg-stego/export-all.sh                 rebuild the pages, export all 30 presets through their gates
node 02_WORK/plg-stego/decoder-test.mjs [filter] [--tilt 0.08] [--px 5]    synthetic photos through the decoder
node 02_WORK/plg-stego/decoder-debug.mjs <photo> [first cell] [count]      paint what the reader looks at
node 02_WORK/publish-site.mjs                       mirror pages and sources into PLOTTER_GEN
```

Test photos go to the system temp folder (`plg-decoder-test`), not the workspace. Current results (2026-09-28): 38/38 at 3 to 8 per cent tilt, 19/19 at 12 per cent, 18/19 at 4 px per mm (pigpen's dotted letters blur into its shading). Since 2026-09-30 pigpen decides each dot on its own ink and reads every letter at 4, 3 and 2.5 px per mm (`pigpen-scale-test.mjs`); at 4 px per mm the remaining misses are the small-mark layouts (corners, retrofit, border) and signal flags. `bench-stitch-anchor.mjs` reads the 2026-09-28 stitch bench photo through the four-corner anchor.

## Retrofit marks

Marks set to "retrofit" draws small corner targets and the key strip inside the ordinary 10 mm margin, as their own `marks` pen.
To mark a sheet plotted without marks: re-enter exactly the settings it was made with, choose retrofit, export per pen, and plot only the `marks` file on the finished sheet at the same mat position.
The decoder searches up to 2 mm of offset between the marks and the drawing, so a slightly shifted re-load still reads.

## Where the key goes (the marks setting)

| Setting | What it plots | How to read it |
| --- | --- | --- |
| on | square corner targets and a dot strip along the bottom, drawing inside a 17 mm margin | scan the front |
| border of arcs / slashes | round corner rosettes and a band of two-way tiles round the page; each tile is one key bit (scrambled so padding still looks like pattern, repeated where the border has more than 128 tiles) | scan the front |
| under a mount | the normal marks, with the drawing kept inside a window `mount` mm in (18 to 50) and small ticks to line the card up by; a gate checks every mark sits 2 mm or more under the card | take it out of the mount, scan the front |
| corners only | four small corner targets, nothing else; the settings go on a 170 x 60 mm label for the back | scan the label, then the front |
| retrofit | small marks inside the 10 mm margin, plotted onto a finished sheet | scan the front |

Every studio has a "Settings label" export: the key strip with its own finders and every setting in words (never the message or cipher keys).
The decoder page remembers a label it has read and uses it for the next front with no key of its own.

## Four-corner and markless reading

The decoder page accepts a settings label followed by an unmarked front and four page-corner taps. `decode(photo, { label, anchor: { mm, px } })` uses `align.js` to refine the fit against the paper edge and ink. Run `anchor-test.mjs` to check perturbed taps.

`freegrid.js` is the separate experimental reader for an unlabelled drawing. It measures a tapped grid directly, searches its dimensions and encoding, and does not require the original generator settings. It passed both existing bench-photo fixtures on 2026-09-30 (30/30 and 18/18 letters, with no differing cells). The decoder now exposes it under “No marks or label? Try the experimental reader”, with stitch-chart and Truchet options and an explicit reliability warning. Tap the drawing grid corners, not the page corners. A local Web Worker keeps the page responsive; cancel, retry, reset, or replace a single corner. Suggested text is not presented as verified. Scattered seed search is limited to 0–4000. Optional “Cells across” and “Cells down” inputs (blank = guess) tell the reader the grid size; `readMarkless` takes them as `C` and `R`. With both given it adds three more starting quads (the edge snap held to within one cell of its tap, then walked to where a C × R grid separates best, and the same walk from the raw taps), scores the exact size ahead of the off-by-one sizes tried for slack, and lets an exact-size reading take the result whenever it produced one. Without the inputs nothing changes. MEASURED 2026-09-30 with `SIZE=1 node markless-bench.mjs goose 6 60` (taps up to 60 px off, 6 trials): Truchet 2/6 with no size, 3/6 with the true size and a first version of this change, 5/6 with the size and the final version (the one miss has a bottom-left tap more than a cell from the corner); the snap drags bottom corners up to two tiles off and a known size lets the reader hold it back. The stitch fixture with the size given reads 6/6 at true corners and 6/6 at 60 px; both fixtures without a size still read 30/30 and 18/18 letters with 0 differing cells. Time is about 29 s per goose trial and 20 s per stitch trial with a size (12 s and 16 s for the normal tapped read without a size). `readings` now also survives a tiny wrong size (it threw when the route needed more cells than the grid held). Earlier, three corner-search changes without a size prior were rejected (`markless-bench.mjs` reproduces the failure; `SIZE=1` gives it the true size). The separate labelled four-corner workflow remains available.

Run `settings-test.mjs` for settings export/import round trips and `decoder-test.mjs` for marked synthetic photos. The 2026-09-30 synchronization run passed 43/43 settings cases and 78 marked-photo reads, with seven intentionally skipped visual/unmarked cases. Private bench fixtures and research photos are not mirrored to the public source repository.