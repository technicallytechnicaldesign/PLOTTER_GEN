# Control relevance

**UID:** PLG-REL-BB78708C · **Version:** 1 · 2026-10-05

Studios show only the controls the current base actually uses. Pick a different base (web type, view, method, layer on/off and so on) and the panel changes to match.

## How it works

- **One engine, shared.** It lives in `src/site/studio-dock.mjs`, next to the fold/pin dock that's already injected into every studio. No studio has its own toggle code anymore.
- **Each studio just declares rules.** Put `data-when` on any label, row, hint or fieldset in the `<aside>`:

  | Clause | Shows when |
  |---|---|
  | `kind=spoked\|mix` | the value is one of these |
  | `fill!=none` | the value is none of these |
  | `dew&gt;0`, `n&lt;3` | the numeric comparison holds (write `>` and `<` as entities) |
  | `labels`, `!labels` | a checkbox is ticked, or a value is set (not `""`, `0`, `none` or `off`) |
  | `a; b` | both hold |
  | `a or b` | either holds |

- A fieldset whose controls are all hidden hides as well.
- Hidden controls **keep their values**. Exports, presets and "load settings" behave exactly as before. The export harness gives byte-identical SVGs.
- Presets write `.value` directly, which fires no event. To catch those writes, the controls that rules depend on report their own changes.
- **Show unused (N)** in the dock bar brings hidden controls back, dimmed. The choice is remembered per studio.

## What changed

- **Retired three one-off systems in favour of `data-when`:**
  - gear-3d (`.only`/`data-bg`)
  - weather (`.sky-only`/`.chart-only`)
  - `data-for` in archaeology, flint, cipher-garden, overlay and signal-book
- **Reviewed every studio's build code** and annotated 26 studios with about 255 rules. Spirograph got the most (32): layers B to D, text versus shape, rings and composition.
- **Generated stego pages:** the rules are in `src/plg-stego/*-template.html` too, so a rebuild keeps them. The `data-for` toggles were also removed from `cipher.js`, `overlay.js` and `signals.js`.

## Adding a new studio

Write the `data-when` rules while you write the controls: a rule only says when a control does nothing. If unsure, leave the rule off. Showing an extra control is harmless; hiding one the build still reads is not.
