# Confused deck

**Version:** 2 · 2026-10-15

Inktober day 19, prompt "confused". One studio, `confused-deck-studio.html`. The idea is the maker's: a deck of trading cards about the small confusions of industrial production drawings. Each card is laid out as a drawing, with its own title block.

## The cards

| Card | The gag |
|---|---|
| Refer to detail C | The detail bubble is a flap. Under it: THERE IS NO DETAIL C. |
| Design intent unclear | Seven notes (TBC, AS REQ'D, SEE NOTE 4...) with leaders that all point at one empty spot, circled in red. |
| Drawn to scale, scale unknown | Chain dimensions that do not add up, two overall dimensions that disagree, a scale bar reading 0, 10, 7, ?, 100, and 1:1 and 2:1 struck out in red. |
| Refer to sheet 2 | The whole drawing is a flap. Under it, sheet 2: a blank frame marked "intentionally left blank". |
| The ??? title block | The card is one big title block, with every field ?, ??, ???. |
| Who dimensioned / approved / RELEASED this? | Three cards with dimensioning crimes, an APPROVED stamp and a RELEASED FOR PRODUCTION stamp. The red faces in the headline and the sign-off boxes get crosser from card to card. |
| Asked engineer | An RFI form. Lift the RESPONSE flap and the speech bubble says I DUNNO. |
| Tolerance spinner | A paper wheel turns behind a window in the drawing's tolerance callout, one callout at a time. |

## Your own words (version 2)

Every word on the deck can be edited, which turns it into a gag gift, for the colleague who puts ±0.2 on everything, say.

- **Words, deck-wide:** names for Drawn, Checked, Approved and Released (in place of the scrawls; the grumpy faces stay), an "every TOL. field says" override that the ??? card obeys too, and the drawing-number prefix.
- **Words, card by card:** pick a card under "Edit the words on" to edit its headline, its gag text (under the flap, the notes, the stamp, the question and the answer) and its title block. A / starts a new line.
- **Your own callouts:** the wheel can use the pool, your callouts topped up from the pool, or only yours, repeated round the wheel. One a line, a ; adds a small second line, and a | splits a feature control frame into its boxes.
- **Symbols, typed as words:** +/- gives ±. [dia], [flat], [perp], [pos], [par], [circ], [conc], [runout], [inf] and [deg] give ⌀ ⏥ ⊥ ⌖ ∥ ○ ◎ ↗ ∞ °. A letter the pens have no shape for comes out as ?.
- **Presets leave your words alone.** "Reset words" puts them back.
- **Words that will not fit:** when a field's text has to shrink below 1.1 mm, the lettering gate names the words and the card and asks for a shorter version or a / split.
- **Cut headlines:** a cut headline with a glyph in separate pieces (± ; : !) gets a short bar joining any pieces that would come closer than 2 mm, so no sliver of card is left between them.

## The tolerance wheel

- The callouts come from a pool of 15 real ones (±0.1, H7/g6, ISO 2768-m, feature control frames for flatness, perpendicularity, position, runout and so on) and 19 unhinged ones (±0.0001 on a weld, position to datum D with no datum D, perpendicular to itself, ±ish, ±vibes, H7 (hammer)).
- **Sanity** sets the share of real ones. **Callouts** sets how many go on the wheel (6 to 14).
- Each callout is drawn so that it reads the right way up when it reaches the window.
- The window starts far enough from the hub that a neighbouring callout never shows in it. This is checked on every build.
- A diamond knurl runs round the rim, and you turn the wheel with your thumb through a notch in the card's left edge.

## Pens and layers

- **Fine (0.3 black):** frames, dimensions, notes and labels.
- **Bold (0.5 black):** outlines and headlines.
- **Red:** the checker's pen, for faces, question marks, revision clouds and strike-outs.
- **Score:** the flap hinges.
- **Cut:** everything else.

**Confusion** adds red question marks. From 45 it adds a revision cloud, and from 70 a coffee ring on the odd card. **Headline: cut** cuts the last word through as a stencil, so the coloured backer shows behind it, and the backer is hatched where it shows.

## How it goes together

1. Plot and cut the fronts.
2. Plot and cut the backers and the wheel on coloured card.
3. Glue each backer behind its front, keeping the glue off the flaps.
4. For the spinner, put a paper brad through the front, the wheel and the backer at the hub. Glue the card to the backer round the edges only.

## Gates (every build)

- Pen ink at least 0.4 mm from every cut.
- Cuts on a piece at least 2 mm apart.
- Flap hinges at least 8 mm long.
- The window shows one callout at a time.
- Wheel lettering at least 1.2 mm tall, card lettering at least 1.1 mm tall.
- Pieces at least 3 mm apart and inside the margin, the trim frame matching the corner ticks.
- Pen length under 150 m, the SVG under 3 MB.

MEASURED: all 8 presets pass on all three sheets. A fuzz of 1000 random settings, with random custom words in six out of ten, passes every gate apart from two kinds of flag. In 333 the "everything" sheet was too big for one 12 x 24 mat, which the studio says in a note. In 515 the fuzz pushed text into fields too small for it, and the studio names those words (`02_WORK/confused/fuzz.mjs`).

## Assumed, not measured

- The following are ASSUMED until the cut calibration sheet has been read and a card has been plotted: the 2.4 mm brad hole, the 2 mm bridges, that a 0.3 mm pen reads on 1.15 mm title-block labels, and that the wheel's smallest callouts (1.3 mm on the trading-card size) can be read.
- The spinner's callouts are larger on the big and A6 sizes.
