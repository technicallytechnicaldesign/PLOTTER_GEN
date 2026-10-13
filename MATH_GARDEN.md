# Math garden

**Version:** 1 · 2026-10-13

The fractal and maths plots, settled as one studio with three modes (PLG-1013): `math-garden-studio.html`. Each mode grows a drawing out of a rule, on the same pens, gates and SVG export as the spirograph.

## Harmonograph

- **Two damped pendulums:** x = e^(-dt) [sin(a t) + m sin(b t + 0.7)], y = e^(-dt) [sin(b t + phase) + m sin(a t + 1.9)], with the frequency ratio a : b from eight small whole-number pairs, a detune in percent and a second pendulum mixed in by m.
- **The fade:** the damping is set from how much swing is left at the end, so the drawing spirals in towards the middle the way a real pendulum loses swing.
- **Rotary table:** the paper turns a set number of times over the whole drawing, which wraps the figure into a rose.
- **Traces:** up to six, each a few degrees of phase on from the last.
- **Colour:** one pen, a pen per trace, or time (the pen changes as the swing fades).
- **Sampling:** a coarse pass finds the scale, then the curve is sampled so no raw step is longer than 0.4 mm (1.2 million samples shared over the traces) and fitted to the page on those fine samples. Some phases fold a Lissajous back on itself into one arc (2 : 3 at 45 degrees), so the Lissajous preset uses 0 degrees and one swing.

## L-systems

- **Nine systems:** four plants (plant, bush, weed, sticks) and five curves (Koch snowflake, dragon, Hilbert, Sierpinski arrowhead, Gosper flowsnake).
- **The turtle:** F (or A and B) draws a step, + and - turn, [ and ] start and end a branch; each run of steps is one polyline, so a plant plots as branches, not as dots.
- **Jitter:** turn and step jitter from the seed make plants grow untidily; the curves read best without it.
- **A row of plants:** up to twelve on a ground line, each in its own share of the row, with the end plants kept inside the margin; variety lowers some by a generation and changes their height.
- **Colour:** branch depth, one pen, a pen per plant, or along the line (cut into equal shares of all the steps, so a single long curve such as the dragon changes pen too).
- **The cap:** the word stops growing at 600,000 symbols and the studio says how many generations it reached.

## Mandelbrot and Julia contours

- **The field:** a smooth escape-time count on a grid across the page (120 to 700 cells across), bail-out radius 16, the inside of the set held at a flat value above the highest count.
- **The lines:** marching squares at each level, chained into polylines; lines that meet the frame stay open, lines shorter than a set length are dropped.
- **Levels:** by area (each band covers about as much of the page, from the 2nd percentile to the reach) or even in escape time; the set's own edge is one more level, in the last pen. Repeated levels are kept once, so no line is drawn twice.
- **Places:** the whole set, seahorse valley, elephant valley, the antenna's mini set and the top bulb, plus five Julia sets (Douady rabbit, dendrite, Siegel disc, San Marco, spirals), with a zoom in doublings about each centre. A zoom that lands wholly inside the set draws nothing and says so.

## Gates

Build time under 4 s, pen under 150 m, SVG under 3 MB, all ink inside the margin, plus one per mode: no raw harmonograph step over 0.5 mm; the L-system word under its cap; every contour level drew a line.

## Checks

`02_WORK/math-garden/check.mjs` (in the CLAUDE workspace) runs every preset through the gates with a PNG each, checks every preset value is one its slider or menu can hold, and fuzzes 60 random settings per mode for exceptions (MEASURED 2026-10-13: 13 presets GATE PASS, 0 exceptions in 180 fuzzed builds; the fuzz fails it does count are the gates refusing heavy settings, such as pen over 150 m). All 13 presets also pass in the browser.

## Assumed, not measured

Pen widths (0.3 mm), plotting rate (150 m as about 45 minutes) and how dense a contour field can be before the 0.3 pen floods it are ASSUMED until a sheet is plotted.
