# Beacon studio

**Version:** 1 · 2026-10-17

Inktober day 22, prompt "beacon". One studio, `beacon-studio.html`, with two scenes the maker picked from a brainstorm: a SETI message with its rings and a Dyson swarm that may answer, and a LORAN interference chart.

## A message to the stars

- **The bitmap:** built section by section on a grid whose width and height are both prime, as Arecibo's 23 x 73 was, so the bits can only be laid out one way. It counts 1 to 10 in binary, gives the atomic numbers of H, C, N, O and P, a helix with a number down its middle, a figure with a height bar and a population, the sun and planets with home raised a bit, and the dish. Shapes come from the seed and are not a copy of the 1974 message. "Your words" adds letters as 5-bit numbers (A = 1).
- **Pixels:** square, round, diamond, cross or plus, hatched, nested or outlined, with a gap; unlit bits blank or a dot. Sections take the thin pen, colour 1, colour 2 or black, after the coloured Arecibo chart.
- **The dish:** a bowl in karst hills with three towers, cables, platform, arm and dome (Arecibo), a steerable dish, or an array of four.
- **Rings:** arcs round the source. In "carries the bits" each ring reads on through the message, row by row, long dash for 1 and short for 0; they fade with distance and break round stars and the message.
- **The answer:** a swarm of collectors on tilted rings round a star, listening; or the collectors facing us part into a round window, light spills out and reply rings come back in colour, carrying either our message reversed or their own bitmap (a figure with antennae and four arms, their star in its swarm).
- **Layouts:** a dish under the sky with the message beside or in the beam, or the message alone broadcasting rings all round.

## A LORAN chart

- **Coast:** one noise field; the land is exactly the chosen share of it, coast and depth contours are marching-squares lines, the shallows and the land hatched, soundings in fathoms.
- **Stations:** a master and up to four secondaries (W, X, Y, Z) on the coast as far apart as they can get, or off the chart with arrows at the edge.
- **Lanes:** exact hyperbolas, the points with the same difference in distance to the master and one secondary, a lane width apart on the baseline. Each secondary has its own pen or dash, labelled at the chart edge with a time difference (coding delay plus baseline plus offset, at an assumed 1:500000).
- **Waves:** optional rings a lane apart round the stations; they cross exactly on the lanes, which is where the lanes come from.
- **The ship:** a dashed track through open water with timed fixes, each with its two lines of position.
- **Furniture:** minute-bar border, compass rose with a variation ring, title block with a legend.

## Pens

Plot the thin pen, colour 1, colour 2, then black last.

## Gates (every build)

Inside the margins, every coordinate a number, under 150 m of pen, built in under 4 s; SETI also checks the grid is prime by prime, LORAN that lanes are at least 0.8 mm apart and at least one lane is drawn.

MEASURED (v1): all 10 presets and 300 random settings per scene pass every gate headless (`02_WORK/beacon/fuzz.mjs` in the CLAUDE workspace), slowest build 0.15 s; all 10 presets pass in the browser with 0 console errors. ASSUMED: lanes under 1.2 mm and pixels under 1 mm run together with a 0.4 pen.
