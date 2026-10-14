# Contraption studio

**Version:** 1 · 2026-10-14

Inktober day 17, prompt "contraption". One studio, `contraption-studio.html`. The idea comes from the maker's own trade. In technical design, a dimsa-doosa is a part you draw up because the engineer said so, with nobody quite sure what it does. The studio is a parts kit plus a chain solver, so the machines are nonsense but the engineering is real.

## The chain solver

- **Starts from a driver:** an overbalanced wheel (hinged arms flung out on the falling side, hanging limp on the rising side), a hand crank, or a motor of unknown origin.
- **Grows one link at a time.** A gear mesh puts the new shaft at exactly the sum of the two pitch radii, with the new gear turned so a tooth faces a gap (involute teeth, 20 degree pressure angle). A belt takes the outer tangents of its two pulleys. A link is kept only if it clears everything already placed.
- **Compound shafts:** a pinion in front of a gear, or a pulley behind one, so belts come out from under the teeth.
- **Driven things:** a piston in a hatched cylinder (sometimes with a pressure gauge), a cam and follower raising a flag, a bell hammer or a sign, a ratchet and pawl, a fan, a flywheel.
- **The plate on three struts:** a balance plate that adds no function, standing on the base on exactly three struts. It is always on the engineering drawings and the exploded view, and on the patent plate only when plausibility slips.
- **Real speeds:** every shaft carries its true turning speed, so the colour-pen turning arrows and the output ratio printed in the notes are both correct.

## The three sheets

- **Perpetual motion patent plate:** double border, "(No Model.)", the inventor's name, a Victorian title and patent number, letter callouts, shading lines on the lower right of every round part, Fig. 1, witnesses' and inventor's signatures. With the wheel and plausibility under 70, a dashed colour-pen arrow carries the "energy (returned)" back to the wheel.
- **Dimsa-doosa engineering drawing:** zoned border, centre lines and pitch circles, balloons matched one-to-one to a parts list read upward from the title block, a 2:1 detail view of one mesh, the revision table, notes, revision clouds, stamps and markups. There is no note 7, though other notes point to it.
- **Exploded view:** the plate and its three struts, bearing housing, washer, gear, boss, spacer, a cam, pinion or split pulley, the dimsa-doosa itself (a lumpy bracket), lock washer, nut and the shaft pulled out for clarity. They are drawn as real extrusions with hidden lines removed, along a dash-dot axis you can lean.

## Parked

- **Dimensions:** centre-distance dimensions and diameter callouts are written but switched off (`SHOW_DIMS = false` near the top of the script), because the numbers read as noise on this sheet. Set it to true to bring them back.

## The dials

- **Plausibility** breaks things on purpose: mismatched tooth sizes that clash, square teeth, a square pulley, a twisted or knotted belt, a shaft with no strut ("held up by optimism"). Each break writes its own note.
- **Bureaucracy** adds balloons, dimensions, callouts, the detail view, revisions (A: initial release, B: added plate, reason unclear, C: removed plate, D: re-added plate per eng. ...), stamps and notes. The checked and approved boxes get less reassuring as it rises.

## Pens

Plot in this order: the thin pen (hatching, centre lines, dimensions, lettering), the black line pen (the parts), then the colour pen (turning arrows, clouds, stamps, markups). Each split file carries the same corner ticks. The colour pen is any pen taped to fit the Cricut's clamp.

## Gates (every build)

- Everything inside the margins, every coordinate a number.
- Letters at least 2 mm tall: text shrinks to fit a box, then gets cut short rather than going smaller.
- Under 150 m of pen in all.

MEASURED: all seven presets and 1000 random settings pass every gate headless (`02_WORK/contraption/fuzz.mjs`), slowest build 30 ms. In the browser pane, all four checked presets pass and the console has 0 errors. ASSUMED: 2 mm single-stroke letters read cleanly with a 0.3 mm pen, and a taped colour pen holds its line as well as a Cricut pen.
