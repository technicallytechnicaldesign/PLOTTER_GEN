# Print gallery

**UID:** PLG-GAL-1AFF2EBC · **Version:** 1 · 2026-10-05

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

## Idea: 3D objects (not built)

- **Box nets as CSS cubes: cheap, fits the current engine.** The studios already draw the flat net, so a plinth could carry a CSS 3D box with one image per face. List six face photos, or crops of the net, in the JSON. It turns as you walk past, with no new library.
- **Photogrammetry as a GLB: more work.** Scan the print with RealityScan, Polycam or Meshroom and export a GLB. The walkable gallery is CSS 3D, not WebGL, so the model goes in the inspection dialog through `<model-viewer>` (orbit, zoom, AR on phones). In the room, a plinth shows a photo stand-in.
