# Working on Flield

Notes for any coding agent working in this repo. `CLAUDE.md` and `GEMINI.md`
are symlinks to this file, so whichever one your tool loads, it reads the
same thing and there is only ever one copy to keep true.

Read `CONTRIBUTING.md` first for the project's rules (no build step, no
dependencies, `generator.js` stays independent of the UI). This file covers
the traps that are invisible until they cost you a cycle.

## Before you commit

```bash
python3 .github/scripts/checks.py            # structural checks
python3 .github/scripts/checks.py origin/main  # adds the cache-bust check
```

Same script CI runs. The cache-bust check compares committed state, so run it
after committing, not before.

## Cache busting is load-bearing

Every page requests the project's own evolving files with a `?v=N` query:
`style.css` and `generator.js` from the app, `guide.css` from the guide, the
explainers and `404.html`, `generator.js` again from the explainers, and
`screenshot.png` (with its two `.webp` copies, on one number) from every page
plus the README. Bump the
number when you change that file, on **every page that requests it**, and
**leave it alone when you haven't**. A missed bump serves a returning visitor
a stale stylesheet; a bump on four pages and not the fifth is how `404.html`
served an older `guide.css` than the guide did; a needless bump throws away
every visitor's cache for nothing. CI checks all three.

## style.css: later wins at equal specificity

The file is long and the mobile `@media (max-width: 768px)` block sits
**earlier** than many of the base rules it needs to override. A rule like
`.canvas-area { bottom: … }` placed in that block loses to the `.canvas-area`
base declared 900 lines further down, silently.

This has bitten four separate rules (`.canvas-area`, `.site-footer`,
`.export-title`, `.app-chrome`). If a CSS change appears to do nothing,
check source order before anything else. The fix is to put the override
*after* the rule it beats, or raise specificity deliberately.

The same trap with a different shape: `#playBtn.playing` is an ID selector at
(1,1,0) and outranks `button.secondary:hover` at (0,3,1). Filled states that
need a hover must say so explicitly.

## The guide's scroll spy reads two numbers that must agree

A heading parks at its own `scroll-margin-top` after an anchor jump, and the
Contents menu marks a section active once its heading passes a cutoff. Those
were separate numbers, three pixels apart, so clicking an entry scrolled to
the right section and highlighted the one above it. The cutoff is now read
from `scroll-margin-top` at runtime rather than written out twice.

The spy also sorts sections by measured position rather than trusting the
order the menu lists them in. It had to: the menu had two entries the wrong
way round, and index-based logic handed the highlight to whichever came last
in the list. Both are fixed, and neither can silently return.

## Sidebar descriptions are written to one line

The desktop sidebar is a fixed 300px, so a `.hint` gets 259px, which is
roughly 44 characters at 12px. Every description is written to fit on one
line there, which makes it one line at every width the panel takes, since
the phone sheet is only ever wider.

Roughly, because the count is not the thing: a 45-character line can fit
where a 44-character one wraps, depending on which letters. Measure the
rendered lines in the browser (Range rects per character, grouped by top)
rather than counting; two strings tuned by eye both regressed here. Two
lines are allowed if the second is about half full, but one line is the
version that survives a change of width, so prefer it. `tieLastWords`
still guards the wrap.

## `text-wrap: pretty` does not prevent widows here

It reports as supported and computes as `pretty`, and it changes nothing:
sweeping every sidebar hint across eighteen column widths gives the same
single-word last lines with it on and with it off. The sidebar ties the last
two words of each hint with a non-breaking space instead (`tieLastWords`),
which also covers the hints the script writes. Don't replace that with the
CSS property without re-running the sweep.

## Hover needs a `(hover: hover)` guard

Touch browsers leave `:hover` stuck on whatever was tapped last, so an
unguarded hover style sits latched on a phone until the next tap elsewhere.
Any hover rule that changes a control's fill belongs inside
`@media (hover: hover)`.

## The inline script has one scope

`index.html` holds a single long inline script. Two consequences:

- **Declare a `const` above its first *caller*, not just its first use.**
  `syncActionBar()` runs during init and reaches into the sheet and the bar,
  so anything it touches must already exist. Getting this wrong throws a
  `ReferenceError` at load and takes the whole app down.
- **A duplicate declaration is fatal.** A second `const controlsBody` threw a
  `SyntaxError` that killed every listener on the page while it still served
  200. CI parses each inline block to catch this.

## The layout moves live elements, it does not copy them

Across the 768px breakpoint, `syncActionBar()` reparents the real
`.explore-row`, the sheet toggle, and the app-chrome row; `showLastField()`
moves a whole `.field` into the strip above the bar and back. Nothing is
duplicated, so every listener stays bound and no id is ever on the page twice.

When adding to this pattern: record the element itself along with where it
came from, so the right one goes back. `lastFieldHome` carries both, and has
to, because a control reached for while a field is out on the strip moves
`lastTouchedField` on without moving the field, and returning whatever was
touched last would strand the field that actually left. And bind handlers by
delegation if an element can gain or lose its trigger attribute at runtime
(the hold-to-confirm guard does this, because a save button gains `data-hold`
only once its slot is occupied).

CI checks for duplicate ids, which is the failure this pattern risks.

## Six textures share one field and five controls

A layer's `texture` says what is made of the field, not what the field
is. Four bias a cell's chance of filling (`streaks`, `nebula` ridged at
zero, `marble` domain-warped, `contours` as level lines) and two trace
particles (`streamlines`, `weave`), which `isParticleTexture()` is for:
three separate passes ask, and a missed one is a layer that silently
stops animating.

`streaks` output must stay bit-identical: it is what every link and
every exported SVG made before textures existed renders as. That is why
marble is the streaks loop over a warped field rather than a fourth
branch, and why new textures get their own loops instead of a condition
inside that one.

Some controls mean something different per texture, and `TEXTURE_LABELS`
renames them in the panel. Remap one without renaming it there and the
control lies. Density means the fraction of the canvas covered in every
texture, which is why the traced ones solve their particle count against
the trail's length *and* its weight, and why contours read density as
how far either side of a level line a cell may sit.

Two things break silently and neither shows up on screen as a bug:

- **The loop.** Traced textures close because each particle lives one
  cycle and respawns at a fixed point, with birth offsets spread evenly.
  Anything that makes a path depend on the phase non-periodically breaks
  it. Marble hit this: the warp reads the plain 256-unit lattice, so
  drift's travel had to be left out of the warp's coordinates or phase 1
  landed somewhere phase 0 never was.
- **Smoothing.** The cellular pass erases a one-cell strand (two
  neighbours reads as "too few"), so traced textures dilate instead.

## Speed and interval are two durations, not one

Speed is how long a motion cycle lasts (`currentCycleMs`). Reroll every
is how long Auto-randomize waits (`currentIntervalMs`). Both sliders
carry a step index rather than milliseconds (`speedMs`). They were one
control briefly, which was wrong; the only place they need reconciling
is a GIF with both running, and `exportPlan()` settles it by making a
pass one whole motion cycle. Cutting a cycle short at the reroll would
lose the seam that makes the export loop.

The preview's redraw cadence is cut from the cycle, not fixed. It was
fixed at 80ms, which is three frames to a cycle at the slider's fastest
and reads as strobing at every speed alike. `PREVIEW_FRAMES_PER_CYCLE`
is set so a two second cycle still lands on exactly 80ms.

The five-entry speed menu these replaced is gone from the markup but
survives as `LEGACY_AUTO_SPEEDS`, because a link written before the
change carries its speed as an index into that list, and it meant both
durations at once. `checks.py` guards the constant the way it guarded
the menu.

## Ripple moves cells and density, not the field

Loop, Drift and Wind move where the field is sampled. Pulse and Ripple
leave the field alone, which is why both work with no field strength
and why `buildGrid` reads the field at phase 0 for them: an identical
field sampled every frame was most of a Pulse frame's cost before that.

Ripple went through the field first and was invisible. A radial
displacement of the sampling coordinates, at any amplitude short of
mush, changes almost nothing a dither shows, because the dither stays
put and only the shading under it shifts. A lateral wave and a zoom
failed the same way. What reads is either changing how many cells fill
(the crest's swell, as Pulse does) or moving the finished cells
themselves (`rippleWarp`, which pulls each drawn cell along the
water's slope, dither and all). Ripple does both, and the warp is what
makes every texture move under it, traced ones included, so it needs
no per-texture answer.

Ripple is rain: several seeded drops, each born at its own moment and
living one cycle, summed where the rings cross. Each is periodic on its
own so the sum closes, but rings are in flight at phase 0, so Ripple's
first frame is not the still, as Drift's is not. The rings are
evaluated on a lattice `RIPPLE_STEP` cells apart and interpolated;
evaluating every drop at every cell put a frame far over the 80ms
budget. Both layers share A's drops, B at 70% of the swell and pull.

## Tide is the one motion where the layers touch

Every other motion builds a layer from its own settings alone. Tide
reads the other layer too: `generate()` hands each `buildGrid` a
`deform`, the other layer's normalised field gradient (`tidePush`,
cached per composition, symmetry applied so it is the field the canvas
shows), scaled by a raised-cosine gate, and `getFlowField` reads the
field from the pushed coordinates. The hook is null for every other
motion and every still, which is what keeps those bit-identical; a
field read with a deform is never cached, since its phase is in the
scale. A layer with no field strength has a flat field and pushes
nothing, so the other layer holds still under it. The push is away
from the other's ridges; toward was tried and gathers both layers onto
the same lines.

## Contours' edge is thin on purpose

The line was a linear falloff across its whole width, and under any
motion it sparkled at every speed: a line shifting a quarter of a cell
per frame re-rolled the dither across its whole width, and the flips
landed as scatter. Cells flipping per frame scale with speed either
way, so the slider worked and looked dead. The edge is now dithered
over `CONTOUR_FEATHER` of a level and no more, so the same shift moves
the line. Don't widen it to soften the look without watching it move.

## Six orthogonal controls drive animation

Don't re-entangle them. **Motion** (General tab) is what a pass looks like,
**Speed** beneath it is how long an animated pass lasts, **Depth** is how
far it goes (every kind but Drift, whose travel is its period and cannot
change), **Direction** runs the phase backwards, **Reroll every** is how
long a still one is held, and the **GIF** menu is how many passes to
record. Depth is applied inside the generator as `options.depth`, a
multiplier whose 1 leaves every constant's arithmetic exactly as it was,
and Direction as `options.direction`, which maps the phase to one minus
itself. Both are tail fields whose zero is the default, so a link from
before them opens as it did. A GIF export is capped at `GIF_FRAME_BUDGET` (240) frames; smoothness
gives way before file size does, and at the default settings that cap is not
what binds, the per-pass smoothness is.

## A shared link is a bit stream, and CI guards it

`?c=` is 82 characters of base64url over a packed bit stream: each value
takes exactly the bits its range needs, with nothing between them. Two
kinds of edit would break every link already shared, plus the URL inside
every exported SVG, and neither shows up in the browser:

- **A menu outgrowing its field.** A choice travels as its index, so
  option 16 in a 4-bit field decodes as option 0. Shape mask, motion,
  symmetry, texture, `LEGACY_AUTO_SPEEDS` and the shape-mask directions
  all work this way.
- **A slider widened past its width.** `fieldScale` gets 10 bits with an
  offset of 8, holding 8-1031. Push its max past that and every value
  after it in the stream shifts.

Both are checked by `checks.py`, against the widths in `COMPACT_BITS` and
`COMPACT_LAYER_NUMBERS`, so the build fails rather than the links. It also
compares option order and field positions against the base branch and
fails on anything but an append, which includes adding a lock: the lock
ids expand to one bit each in a fixed order, and a new one lands in the
middle of that order rather than the end.

There is one place the format may grow: `COMPACT_TAIL_FIELDS`, written
after both layers and read back with a fallback rather than throwing, so
a link that stops before a tail field decodes to what that link meant.
Two rules keep it honest, and `checks.py` enforces the first: append
only, and every tail field's zero must mean "what this was before the
field existed", because base64 pads the last byte with zeros and an old
link's tail is read straight out of that padding. A tail that is all
zeros is not written at all, though nothing leaves it empty today: the
two durations are always written, so every new link is the same length
(83 characters since depth and direction joined the tail).

The escape hatch is `COMPACT_VERSION`. Bumping it says the break is
deliberate, and both checks stand down: the decoder refuses a version it
doesn't recognise, so old links stop opening rather than opening the
wrong picture.

Changing what a field *means* rather than where it sits is still
`STATE_VERSION` and `upgradeState()`, as it was.

Links from before the compact format arrive as `?state=`, base64'd JSON,
and still open. Don't drop that path: it is what is written inside every
SVG exported up to now.

## Two deployments read main

flield.com is the Cloudflare Worker described by `wrangler.jsonc`, and the
repo's GitHub Pages site is live behind it as a fallback. `.nojekyll` is
what keeps Pages from running Jekyll over the files, so it stays. Anything
Cloudflare-only (`_headers`, the 404 routing in `wrangler.jsonc`) is
simply absent on the Pages copy; that is accepted, not a bug to fix.

## Preview

Any static file server works; there is nothing to build.

```bash
python3 -m http.server 8080
```

Claude Code has this wired up in `.claude/launch.json` (gitignored) as the
`flield` server on the same port. Reuse a running one rather than restarting.
