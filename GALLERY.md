# Print gallery

**UID:** PLG-GAL-1AFF2EBC · **Version:** 3 · 2026-10-05

Source is in `src/site/` (`gallery.js`, `gallery-world.js`, `gallery.css`, `print-gallery.json`). `site/` is the published copy. Check changes with `node src/site/gallery-world-test.mjs`.

## v1 changes

- **Phone flicker.** Only `#scene` is a 3D context now. Frames, walls and labels are flat, so their shadows and hatching no longer share a plane with them (coplanar layers z-fight on phone GPUs). The viewport is isolated and the map and caption sit on their own layers. Door jambs became door reveals set square to the wall, so nothing hangs a few pixels in front of another surface.
- **Map on phones.** It starts folded and opens small: about 120px, with no caption text.
- **Space.**
  - The corridor is wider, the rooms are 1500 × 1100 and the ceilings are taller.
  - The field of view follows the viewport (about 70° across), so a phone sees a room, not a wall.
  - You arrive just inside the door, looking at the far wall.
- **Hanging.** `hang()` gives each frame the wall with the most free length, then spaces every wall evenly. Frames hang at 1.5× their listed size. On a crowded wall they shrink instead of overflowing, and none is taller than 55% of the wall.
- **Peg garland.** In `print-gallery.json`, a print with `"hang": "peg"` goes on a sagging string with a clothes peg. It is unframed and sways slightly, unless reduced motion is on. A room's peg line uses its far wall, laid out by the width of each piece. The Paper & creatures room has five reserved peg spaces for dolls and garlands.

## v2: plinths

- A print with `"hang": "plinth"`, a `box` size (`width`, `height`, `depth`, scaled by 1.5 like frames) and `faces` (`front`, `back`, `left`, `right`, `top`, each a photo URL or null) stands on a plinth on the room's centre line.
- The box is a CSS 3D cuboid turning slowly on top; it stands still if reduced motion is on. The plinth's label faces the door. The box has no bottom face, so it shares no plane with the plinth top.
- The plinth is solid: you walk around it, not through it. Clicking it opens a large copy of the box that you drag to turn.
- Mechanical studies and Collected prints each have one placeholder box.
- The horizon now sits at 38% from the top (a shift lens), so floors and plinths stay in view without tilting the walls.

## v3: phone glitching, second pass

- **Tiles.** Walls, floors and ceilings are cut into pieces of at most 640px. Each piece's background is sized to the whole surface, so patterns run on with no seams. iOS Safari draws big 3D planes that pass behind the viewer badly and drops textures over about 4096px; the corridor floor had reached 4850px.
- **Culling.** Every tile, frame, peg line and plinth carries its floor footprint. Anything wholly behind the eye is set to `display:none`. A check with culling on and off gives pixel-identical views.
- **A true stop.** Released movement used to decay towards zero without reaching it, so the scene was redrawn every frame, forever, at sub-pixel offsets. It now snaps to zero, and the camera only redraws when you move.
- **Live site.** These changes are on the feature branch. GitHub Pages serves `main`, so they show on the live site only once merged.

## Later: photogrammetry

Scan the object (RealityScan, Polycam or Meshroom) and export a GLB model. The walkable gallery is CSS 3D, not WebGL, so the model would open in the inspection dialog through `<model-viewer>` (orbit, zoom, AR on phones). The plinth keeps showing the face photos as its stand-in.
