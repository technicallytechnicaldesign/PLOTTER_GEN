# PLOTTER_GEN

Pen-plotter generators for the Cricut Explore 5. [Open the live gallery](https://technicallytechnicaldesign.github.io/PLOTTER_GEN/).

- **Scenes:** Spider Web, Weather, Orrery, Island Atlas and Underground.
- **Hidden messages:** Cipher Garden, Purloined Plots and Overlay.
- **Signals:** flags, semaphore, ogham, braille and tap code.
- **Gears:** Gear 3D, Gear BAM, Gear Weave and Gear Reverb.
- **Read:** the Plot Decoder accepts photos or a camera feed, settings labels and manually tapped page corners.

Each studio is self-contained HTML and exports millimetre SVGs, including separate pen layers for Design Space. The gallery carries saved controls and source fingerprints for its example drawings.

## Source and publishing

Development takes place in the desktop workspace. Its 04_DOCS pages are mirrored at this repository root; its 02_WORK source snapshots live under src/. Gear and scene studios are authored directly as standalone HTML. The src/site folder contains the editable homepage assets and catalogue, while site/ is the generated live output.

Use the workspace's 02_WORK/plg-stego/build.mjs to rebuild the decoder and hidden-message studios, then 02_WORK/publish-site.mjs for a full publish. The build uses the sibling [Unravel the Purloined](https://github.com/technicallytechnicaldesign/unravel-the-purloined) engine and its esbuild installation. Source snapshots preserve the workspace layout assumptions; they are not a standalone npm application.

The publisher also supports --homepage-only and --only=page.html for scoped releases. Run 02_WORK/site/verify.mjs and 02_WORK/site/verify-sync.mjs after a full publish to verify specimen fingerprints and desktop/public source parity. Incoming GitHub changes must be reconciled into the corresponding desktop source before regeneration.

The decoder's tap-corner correction uses a previously scanned settings label. The experimental freegrid.js reader for unlabelled plots is included as source; its UI integration remains separate work. Research photos and private workspace records are not published.

Classical ciphers are historical puzzles, not modern security.
