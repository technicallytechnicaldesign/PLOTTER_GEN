# Flimsy

**Version:** 1 · 2026-10-10

Inktober day 13, prompt "flimsy". One studio, `flimsy-bridge-studio.html`: bridge types folded out of card, each one loaded by a small solver and drawn with what it found. A second plate keeps the bridge that really was flimsy.

## The truss board (and the single bridge)

- **Six bridges, one sheet of card each:** Pratt, Howe, Warren, K truss, bowstring and a bare plank, at one span and one depth. Pratt sits next to Howe on purpose: the same truss with the diagonals turned the other way.
- **The net:** truss panel, deck, truss panel, in one strip. The two long edges of the deck are fold lines; each panel has a glue flap at both ends that folds in across the deck and meets its twin. The voids are the enclosed faces of the truss graph, shrunk by half a member width, with the corners relieved so the blade does not tear a point. The bowstring's outline follows its arch.
- **The solver:** pin-jointed 2D statics (direct stiffness, pin at one foot, roller at the other), load spread along the bottom chord, half the load to each side truss. Member force over member capacity gives the load the whole bridge holds.
- **Ink:** along every member, more lines the harder it works (up to four). Tension solid in one pen, compression dashed in another. The member that goes first is drawn bowed (a strut) or crossed (a torn joint).
- **The deck draws the sag:** the straight line is the bridge unloaded, the curve is the bridge at the test load. On the board all six share one exaggeration so the sags compare; on a single bridge it is its own.
- **Top chord:** "held" by the folded deck (default, member by member), "free with one tie" or "free over the whole span". Free is the honest mode for an unbraced card chord and takes every truss down to the same ~85 g: depth, not type, is what a wobbly chord cares about.
- **Layers:** tension pen, compression pen, thin black, black line, score (blue), cut (red) with the usual 1 mm trim rectangle; split export carries corner ticks so the files register.

## What the board says (100 mm span, 0.9 mm card, chord held)

Order, stiffest first: K truss, bowstring, Pratt, Warren, Howe, plank. The Howe is weakest of the trusses because its long diagonals are the compressed ones; the Pratt turns the same diagonals into tension and holds about twice as much. The plank, the same card laid flat, holds roughly an eighth of the K truss and sags a thousand times more at the test load.

## The Tacoma plate

Ten moments (5 to 14) of the same bridge between 10.00 and 11.02: a main cable, suspenders, towers, and the deck drawn as a ribbon with two edges that twist against each other, the twist growing each moment, a tear, and the fall into the water. Pure plot, no cut. Settings: moments, how fast the twist grows, waves along the span (1 to 3), ending (0 stands, 1 falls, 2 tears first), cables, water. The 1 : 350 depth to span (2.4 m deep on 853 m) is the one number worth printing, and it is in the subtitle.

## Assumed, not measured

Card stiffness (2500 MPa), tearing (20 MPa), crushing (12 MPa), the joint share (30 %), the buckling knock-down (0.35) and the pen widths are all ASSUMED until a strip has been pulled and bent. The order of the bridges follows from the statics; the grams do not. The Tacoma figures and times are from memory (ASSUMED).
