# PLOTTER_GEN

Pen-plotter generators for the Cricut Explore 5. [Open the live gallery](https://technicallytechnicaldesign.github.io/PLOTTER_GEN/).

- **Natural Sciences:** Spider Web, Weather, Orrery, Island Atlas and Underground.
- **Archaeology:** Flint studio, Archaeology studio, Pottery puzzle.
- **Space:** Orrery, worlds.
- **Hidden messages:** Cipher Garden, Purloined Plots and Overlay.
- **Signals:** sub of hidden messages: flags, semaphore, ogham, braille and tap code.
- **Gears:** Gear 3D, Gear BAM, Gear Weave and Gear Reverb.
- **Read:** the Plot Decoder accepts photos or a camera feed, settings labels and manually tapped page corners.
- **Posthuman:** Forks, Meatsack.
- **Apothecary:** Bottle studio: bottles, labels and a shelf or countertop of them.
- **Motion:** Toss studio: a coin, die or cap caught at several moments along a throw.

Each studio is self-contained HTML and exports millimetre SVGs, including separate pen layers for Design Space. The gallery carries saved controls and source fingerprints for its example drawings.

## Source and publishing

Gear and scene studios are authored directly as standalone HTML. The src/site folder contains the editable homepage assets and catalogue, while site/ is the generated live output.

Uses /plg-stego/build.mjs to rebuild the decoder and hidden-message studios, then /publish-site.mjs for a full publish. 

The build uses the sibling [Unravel the Purloined](https://github.com/technicallytechnicaldesign/unravel-the-purloined) engine and its esbuild installation. 
Source snapshots preserve the workspace layout assumptions; they are not a standalone npm application.

The publisher also supports --homepage-only and --only=page.html for scoped releases. Run 02_WORK/site/verify.mjs and 02_WORK/site/verify-sync.mjs after a full publish to verify specimen fingerprints and homebuild/public source parity. Incoming GitHub changes must be reconciled into the corresponding homebuild source before regeneration.

## Decoder note

The decoder supports labelled page-corner correction and an experimental unlabelled reader for stitch charts and Truchet arcs. The experimental mode is less accurate and reliable, uses drawing-grid corners, and presents unverified candidate text. It runs locally in a cancellable worker; individual corners can be corrected without starting over. Far-off taps remain unreliable, and automatic scattered-seed search covers 0-4000. 

Classical ciphers are historical puzzles, not modern security, so don't put stuff in the hidden that you dont want decryping by the decoder (if it works lol) 
