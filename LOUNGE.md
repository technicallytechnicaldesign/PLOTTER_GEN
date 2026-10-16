# Lounge studio

**Version:** 1 · 2026-10-16

Inktober day 20, prompt "lounge". One studio, `lounge-studio.html`. The idea is the maker's: a living room drawn the way CAD furniture blocks are drawn, with a cat that lounges in the lounge.

## Sheets

- **Plan, with a strip of cat blocks:** the room on top, the six cat blocks along the bottom, each named.
- **Floor plan only:** just the room.
- **Block library:** every furniture block packed in rows, each over its name with an insertion point, and the cat blocks in their own section at a larger scale.

Every sheet has a frame, a title block (title, drawn by, checked by THE CAT, scale, date, drawing number and a paw print for approval), a north arrow and general notes ("DO NOT SCALE CATS. CATS DO NOT SCALE.").

## The room

- Laid out in centimetres and drawn at the largest standard scale (1:10 to 1:100) that fits, so the scale in the title block is true.
- Hatched, solid or outline walls, a door with its swing, a window with glass and sills, and overall dimensions in millimetres.
- Blocks: three-seater, two-seater, corner sofa with a chaise, curved sofa, armchairs, rectangle, oval or round coffee table (optionally a book, a mug and the remote on it), side table with a lamp, floor lamp, TV unit, bookshelf, rug (grid, diamonds, stripes, plain), plants, window seat, cat tree, cat bed, bowls, a cardboard box, and a sunbeam falling through the window.
- Each block has an outline that hides what is under it, so the sofa covers the rug and a cat covers the sofa.

## The cats

- Six blocks seen from above: CAT_LOAF, CAT_DONUT, CAT_SPLOOT, CAT_LIQUID, CAT_SUNBATHE and CAT_IF_I_FITS (a donut in a box).
- Each cat is a few overlapping shapes (body, head, ears, paws, tail) merged into one outline; a tail that wraps round is laid over the top.
- Markings: tabby stripes, solid patches or plain. Faces: closed eyes and whiskers, drawn only when the head is big enough on paper to read (eyes from 2 mm, whiskers from 3 mm).
- Spots: sofa (liquid), chaise (loaf), rug (sploot), window seat (loaf), sunbeam (sunbathing), armchair (donut), coffee table (loaf), box, cat tree and cat bed (donut, sized to fit).
- The star cat gets a dimension along its length ("1120 (??)"), a revision cloud with a delta, and an RFI ("RFI 01: SOFA OCCUPIED. PLEASE ADVISE.") on a leader. Paw prints run from the door to it.

## Pens

Plot in this order: the thin pen (hatching, dimensions, notes), the black line (walls, furniture, frame), then the colour pen last so the cats sit on top. The colour pen draws the cat layer, or the cats and the notes on them, or nothing (two pens, cats in black).

## Gates (every build)

Everything inside the margins, every coordinate a number, at least one cat, under 150 m of pen, built in under 4 s.

MEASURED (v1): all 8 presets and 300 random settings pass every gate headless (`02_WORK/lounge/fuzz.mjs` in the CLAUDE workspace), slowest build 47 ms; in the browser pane the Sunbeam preset passes with 0 console messages. ASSUMED: a cat head of 2 to 3 mm on paper reads as a cat with a 0.4 mm colour pen, and the stitched cushion dashes stay separate at 1:40.
