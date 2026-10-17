# Bletchley studio

**Version:** 3 · 2026-10-18

Inktober 2026, prompt "hero". One studio, `bletchley-studio.html`. The idea is the maker's: the hero is the many people behind the code, with Turing as one name among them. The first plates in a longer Bletchley series.

## The engine

A working Enigma: rotors I to V, reflector B, a ten-pair plugboard, ring settings and the double step. Every load checks it against the published vector (I-II-III, rings and start A, no plugs: AAAAA gives BDZGO). The seed picks the wheel order, rings and plugs; the start position is typed in.

## Pieces

- **Bombe wall:** the front of a Bombe, 36 Enigmas of three drums each in three rows of twelve (or fewer, larger ones). The crib (WETTERVORHERSAGE by default) is enciphered with the key, and its letter pairs become the menu. Each Enigma takes one link, and its drums show the stop position, with the bottom drum moved on by the link's place in the crib. Drums are hatched by rotor number where the real ones were coloured. The menu is ghosted behind the drums with its loops in the colour pen, a name plate (VICTORY, the first Bombe) sits above the frame, and the stop is printed in the colour pen.
- **Hands at the drums (up to 12):** seen from the back, resting on drums at the edge of the frame, from below or from every side.
  - **Arms:** a hand alone with an open wrist, a hand with a white shirt cuff and a navy jacket cuff, or the whole sleeve running off the sheet.
  - **Skin:** shown by hatching: none, single or crossed.
  - **Nails:** short, medium or long almonds, mixed per hand, about a third painted in the colour pen.
  - **Outline:** one continuous line where the fingers and thumb join the hand; outline and hatching only, no creases.
  - **Jewellery:** some hands wear a band, a stone or a signet ring, or a wristwatch.
  - **Handedness:** most are right hands, with the thumb along the index side.
- **Wren, name redacted:** a profile in a WRNS ratings cap, drawn only in Enigma letters. The message is enciphered in one run and laid across the panel row by row. Each letter's size and pen follow how dark the portrait is under it: big double-struck letters for the cap, hair and jacket, small thin ones for the face and the ground, and a dark pool in front of her face so the profile reads. Her lips go in the colour pen. The title names her as "name redacted", in words or as a blacked-out bar. The wartime "H.M.S." cap tally is optional (off by default). The key is printed underneath, with "read across, row by row". The letters hide, by default, the Official Secrets Act 1911, section 2 as enacted (from legislation.gov.uk, Open Government Licence v3.0, credited in small print on the plate), then the dedication; or either alone.
- **The people of Station X:** every person number (1 to 2,000) is a different person with a job at Bletchley, drawn in the same Enigma letters as the Wren and captioned "ROLE, NAME REDACTED".
  - **Jobs:** Bombe and Colossus operators, Wren officers, ATS and WAAF intercept and teleprinter operators, codebreakers, translators, indexers, Hollerith operators, dispatch riders and Post Office engineers, each weighted by how common it was.
  - **Clothes and headwear:** from the research (`01_RESEARCH/bletchley/people-of-station-x.md` in the CLAUDE workspace): the WRNS ratings' cap, the officer's tricorne with its badge, the ATS side cap, the WAAF peaked cap, headphones, a leather helmet with goggles, cardigans, tweed and work coats.
  - **Faces:** parametric profiles (brow, nose, lips, chin, jaw, age), a period hairstyle, sometimes glasses, a moustache or lipstick, facing left or right. Lipstick and cap badges go in the colour pen.
  - **Height and build:** each number is short, average or tall, and slight, average, stocky or heavy, with studio overrides for both. Height sets where the head sits in the frame, since a shorter person sits lower. Build widens the shoulders, shortens the neck and fills out the jaw, with a soft double chin when heavy.
  - **One number:** one of them is someone in particular. Unmarked, one of the many.
- **A cast sheet:** consecutive people in a grid, like a staff photograph, with one stream of letters running through them all. Four to a 12 x 12 sheet reads best. Six is possible but rough, because a face needs about 60 letters across and a plotter cell cannot go below about 2 mm.
- **The menu on its own:** the crib, the cipher and the menu graph as a plate, with loops in the colour pen.

## Pens

Thin pen first (hatching, ticks, small letters, notes), then the black line (rims, hands, large letters), then the colour pen (menu loops, stop and painted nails, or lips, tally and key).

## Gates (every build)

Everything inside the margins, every coordinate a number, under 150 m of pen, built in under 4 s. Plus one per piece: the Wren's letters, read back off the sheet and deciphered with a fresh machine, must equal the message stream, and for the Bombe and the menu, the crib must encipher to the menu's cipher under the printed key.

MEASURED (v3): all 11 presets and 300 random settings pass every gate headless (`02_WORK/bletchley/fuzz.mjs` in the CLAUDE workspace), slowest build 180 ms. In the browser pane, all 11 preset buttons pass with 0 console errors.

ASSUMED: a 2 mm letter cell reads as tone from arm's length on paper as it does in a downsampled preview; rotor hatching reads as "different wheels" on paper; the 0.8 mm smallest letters stay letters with a 0.3 pen; a Bombe's real drum offsets also involved the middle wheel, so the drums here are a faithful-looking simplification, not a simulation of the Bombe's test.
