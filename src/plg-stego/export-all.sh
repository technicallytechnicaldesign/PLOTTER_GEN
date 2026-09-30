#!/bin/sh
# Rebuild both stego studios and re-export every preset (with split files) through the gates. Run from anywhere.
# Prints one line per preset: PASS or FAIL, plus any failing gate.
R=$(cd "$(dirname "$0")/../.." && pwd)
node "$R/02_WORK/plg-stego/build.mjs" >/dev/null || exit 1
run() {   # studio page, output stem, preset, then any key=value overrides
  page=$1; stem=$2; preset=$3; shift 3
  out=$(node "$R/02_WORK/studio_export.mjs" "$R/04_DOCS/$page" "$stem.svg" "$preset" "$@" --split 2>&1)
  if echo "$out" | grep -q "GATE PASS"; then echo "PASS  $preset $*"; else echo "FAIL  $preset $*  $(echo "$out" | grep -E 'FAIL |rror' | tr '\n' ' ')"; fi
}
for p in parcel stitches cables scatter motif morse punch truchet bacon; do run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-$p" $p; done
for p in arcs truchet1704 tenprint ribbons maze bold thread loops ridges pigpen stars disk automaton sierpinski knots; do run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-$p" $p; done
mkdir -p "$R/03_OUTPUT/plg-stego/overlay"
for p in vc vcdots moire wavy fleissner dial cardano; do run overlay-studio.html "$R/03_OUTPUT/plg-stego/overlay/overlay-$p" $p; done
mkdir -p "$R/03_OUTPUT/plg-stego/signals"
for p in hoist flagline flagchart pens semaphore semachart ogham braille tap; do run signal-book-studio.html "$R/03_OUTPUT/plg-stego/signals/signals-$p" $p; done
# retrofits: the same drawings laid out without marks, with the small marks to plot on afterwards
run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-maze-retro" maze marks=retro
run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-stitches-retro" stitches marks=retro
run signal-book-studio.html "$R/03_OUTPUT/plg-stego/signals/signals-hoist-retro" hoist marks=retro
# the key hidden in plain sight: woven into a border, tucked under a mount, or carried on a label for the back
run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-maze-border" maze marks=border-arcs
run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-knots-border" knots marks=border-diag
run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-stitches-border" stitches marks=border-arcs
run signal-book-studio.html "$R/03_OUTPUT/plg-stego/signals/signals-hoist-border" hoist marks=border-diag
run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-arcs-mount" arcs marks=mount
run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-scatter-mount" scatter marks=mount mount=30
run signal-book-studio.html "$R/03_OUTPUT/plg-stego/signals/signals-semaphore-mount" semaphore marks=mount
run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-disk-corners" disk marks=corners
run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-motif-corners" motif marks=corners
run signal-book-studio.html "$R/03_OUTPUT/plg-stego/signals/signals-ogham-corners" ogham marks=corners
# PLG-0474 gate: settings ride in every SVG (never the message or a key) and rebuild a byte-identical plot
node "$R/02_WORK/plg-stego/settings-test.mjs" | tail -1
