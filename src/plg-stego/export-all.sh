#!/bin/sh
# Rebuild both stego studios and re-export every preset (with split files) through the gates. Run from anywhere.
# Prints one line per preset: PASS or FAIL, plus any failing gate.
R=$(cd "$(dirname "$0")/../.." && pwd)
node "$R/02_WORK/plg-stego/build.mjs" >/dev/null || exit 1
run() {   # studio page, output stem, preset
  out=$(node "$R/02_WORK/studio_export.mjs" "$R/04_DOCS/$1" "$2.svg" "$3" --split 2>&1)
  if echo "$out" | grep -q "GATE PASS"; then echo "PASS  $3"; else echo "FAIL  $3  $(echo "$out" | grep -E 'FAIL |rror' | tr '\n' ' ')"; fi
}
for p in parcel stitches cables scatter motif morse punch truchet bacon; do run stego-plot-studio.html "$R/03_OUTPUT/plg-stego/stego-$p" $p; done
for p in arcs truchet1704 tenprint ribbons maze bold thread loops ridges pigpen stars disk automaton sierpinski knots; do run cipher-garden-studio.html "$R/03_OUTPUT/plg-stego/cipher-garden/cipher-$p" $p; done
mkdir -p "$R/03_OUTPUT/plg-stego/overlay"
for p in vc vcdots moire wavy fleissner cardano; do run overlay-studio.html "$R/03_OUTPUT/plg-stego/overlay/overlay-$p" $p; done
