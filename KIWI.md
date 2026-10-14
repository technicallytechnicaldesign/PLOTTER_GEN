# Kiwi studio

**Version:** 2 · 2026-10-14

Inktober day 18, prompt "flightless". One studio, `kiwi-studio.html`. The maker is from New Zealand, so there was only ever one bird for this: the kiwi.

## The kiwi

- **Body:** one smooth pear-shaped outline with a small head, roughened into hair-like tufts that flick back away from the head. Tufts are sized in mm, so small and large kiwi look equally fluffy.
- **Feathers:** short strokes that hang down and back from the head, on a jittered grid. A "darker underneath" dial thins them out towards the back.
- **Beak:** long and curving down, with whiskers at the base and nostrils at the tip, where a kiwi keeps them. Head and beak share one outline, so there is no seam across the base of the beak (maker, v2).
- **Tiny wing (v2, maker's idea):** hidden in the fluff as on a real kiwi, showing on her side, or flapping, hopefully: raised off the back with flap marks either side. The wing wears the same feather strokes as the body, and its outline is left open on the side nearest the head so it grows out of the fluff rather than sitting on it like a leaf (maker). No claw at the tip: it read as a hook (maker). Not drawn on kiwi under 14 mm or asleep.
- **Legs:** stout scaled shanks, three toes forward and a hind toe, each with a claw.
- **Poses:** standing, gazing up, probing the ground, running, and asleep (a fluff ball with a closed eye and the beak laid along its side).
- **Occlusion:** each part cuts the lines behind it, so the body hides the tops of the legs and a kiwi standing on another's back stands in its fluff.

## Scenes

- **One kiwi:** with an egg beside her, or an x-ray egg inside her (the egg is about a fifth of her weight).
- **Tower:** each kiwi stands on the back of the one below, with a shrink per level and whimsy for wobble and tilt.
- **Wallpaper:** a brick or marching grid; a negative gap overlaps them.
- **Packed madness:** biggest first, each dropped where it fits on a 1 mm occupancy grid, sizes falling towards the smallest. They stand upright and awake (a little wobble); only past 90 whimsy do some tip over.
- **Kiwifruit:** a dial swaps a share of the birds for whole fuzzy kiwifruit (much like a kiwi with no head) or halves.
- **Night bush:** ponga fronds, koru, a crescent or full moon, the Southern Cross (Gacrux, Mimosa, Acrux, Delta and Epsilon in their real places, five-pointed stars sized by brightness), other stars and the ground, for the one-kiwi and tower scenes.

## Dropped in v2

- **Heap of sleepers:** removed at the maker's call; the sleeping pose stays in the pose menu but is out of the mix.

## Pens

Plot in this order: the thin pen, the colour pen, then the black line pen so the outlines sit on top. The colour pen draws either the feathers (a brown is the obvious choice) or the ferns, koru and moon.

## Gates (every build)

Everything inside the margins, every coordinate a number, at least one kiwi, under 150 m of pen, built in under 4 s. Placements keep 0.2 mm spare for the bold second outline pass.

MEASURED (v2, with the wing and the Flapping hopefully preset): all 8 presets and 300 random settings pass every gate headless (`02_WORK/kiwi/fuzz.mjs` in the CLAUDE workspace), slowest build 0.4 s; every awake kiwi of 156 sampled has one closed head-and-beak loop. In the browser pane all 8 presets pass with 0 console errors. ASSUMED: feather strokes at 1.25 mm spacing stay separate lines with a 0.4 mm colour pen, and kiwi under 9 mm tall read as fuzz.
