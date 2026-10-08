# Ram

**UID:** PLG-RAM-5D00C2F0 · **Version:** 2 · 2026-10-09

Inktober day 9, prompt "ram". Two studios.

## Ram skull (`ram-skull-studio.html`)

- **Horns** are tubes swept along a logarithmic spiral: steady turning, radius of curvature and thickness shrinking by the same factor. Tilted out from the face (`spread`) and flared sideways, they coil beside the skull. Horn grows at the base, so the year rings count from the tip (the lamb's horn); past seven years the tip is broomed off.
- **Hidden lines** come from a depth buffer (0.25 mm): plaque, skull (a dome) and horn meshes are rasterised, and every pen line is kept only where it is nearest the eye.
- **Show:** one skull; a wall of mounts from lamb to old ram (one scale, so the growth shows; laid out on whichever grid fits best); or an overlay of up to four ages on one skull, each younger horn in its own colour pen, seen through the old one.
- **RAM on the ram:** a memory chip on every year of horn, circuit traces routed on a 45-degree grid from a chip on the forehead (never crossing, 0.6 mm apart as a gate), gold contacts at the snout. Mount labels can read the age, OVIS ARIES, or its memory.

- **Cut out and glue up (v2):** a cut line round the head (signed distance from the head's footprint in the depth buffer, contoured at 1 to 5 mm out), optionally through any gap the horns close off. **This sheet** puts the head and board together, the head alone, or the board alone with a dashed glue guide 1.5 mm inside where the head goes; all at one scale, so they register when plotted on different card. The cut file carries a 1 mm trim rectangle like the other cut studios.

## Battering ram (`battering-ram-studio.html`)

- Built on the Smack studio's net engine (copied in: faces, unfold, tabs, ink clear of cuts, seam and overlap gates).
- **Shed:** a house-shaped prism (floor, walls, two roof slopes, two gables) with a square hole in each gable, 1 mm bigger than the beam. **Beam:** a long box with a ram's skull on its head end, never thinner than 17.5 mm so its flaps stay 5 mm deep.
- Art is drawn in a frame on each face that knows which way is up when folded. Looks: wood (planks, shingles, iron bands, painted wheels), ram (skull over the door, fleece of curls on the roof, horns down the beam), memory (circuit walls, RAM lettering, the beam as a memory stick with chips and gold contacts).
- **Pin-on parts (v2):** wheels (four, with the shed) and a mirrored pair of horns (with the beam) are separate cut pieces with 2.4 mm split-pin holes, matching holes cut in the walls and beam sides. They are packed into the card the net leaves free (0.5 mm occupancy grid, 3 mm clear, upright or turned). "Painted on" keeps the old painted wheels and horns.
- The put-together preview shows shed and beam assembled with the parts pinned on, long faces sliced so the painter's order holds where the beam runs inside.
- `__studio.model(r)` exports the assembled ram (faces in mm with holes and ink) as JSON for the gallery.

## On the site

- Catalogue `ram` and `bram` on the Inktober 2026 shelf, five and four baked specimens, all in the plotter hero pool.
- Ink room day 9: `prints/inktober-09-ram.png`, the old ram on a shield, hung as a labelled studio render until the real sheet is photographed. In front of it the battering ram stands on a plinth and turns: `prints/models/inktober-09-battering-ram.json`, built by `gallery-gl.js` (new: a hall day with `model` and `box` keeps its frame and gets a plinth; each face is a three.js shape with its holes, its ink drawn as its texture).
