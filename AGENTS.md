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

`index.html` requests `style.css?v=N` and `generator.js?v=N`. Bump the number
when you change that file, and **leave it alone when you haven't**. A missed
bump serves a returning visitor a stale stylesheet; a needless bump throws
away every visitor's cache for nothing. CI checks both directions.

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

When adding to this pattern: record where the element came from so it can be
returned exactly (`lastFieldHome` does this), and bind handlers by delegation
if an element can gain or lose its trigger attribute at runtime (the
hold-to-confirm guard does this, because a save button gains `data-hold` only
once its slot is occupied).

CI checks for duplicate ids, which is the failure this pattern risks.

## Three orthogonal controls drive animation

Don't re-entangle them. **Motion** (General tab) is what a pass looks like,
the **speed** menu beside Play is how long a pass lasts, and the **GIF** menu
is how many passes to record. A GIF export is capped at `GIF_FRAME_BUDGET`
(240) frames; smoothness gives way before file size does.

## A shared link is a bit stream, and CI guards it

`?c=` is 79 characters of base64url over a packed bit stream: each value
takes exactly the bits its range needs, with nothing between them. Two
kinds of edit would break every link already shared, plus the URL inside
every exported SVG, and neither shows up in the browser:

- **A menu outgrowing its field.** A choice travels as its index, so
  option 16 in a 4-bit field decodes as option 0. Shape mask, motion,
  symmetry, auto-randomize speed and the shape-mask directions all work
  this way.
- **A slider widened past its width.** `fieldScale` gets 10 bits with an
  offset of 8, holding 8-1031. Push its max past that and every value
  after it in the stream shifts.

Both are checked by `checks.py`, against the widths in `COMPACT_BITS` and
`COMPACT_LAYER_NUMBERS`, so the build fails rather than the links. It also
compares option order and field positions against the base branch and
fails on anything but an append, which includes adding a lock: the lock
ids expand to one bit each in a fixed order, and a new one lands in the
middle of that order rather than the end.

The escape hatch is `COMPACT_VERSION`. Bumping it says the break is
deliberate, and both checks stand down: the decoder refuses a version it
doesn't recognise, so old links stop opening rather than opening the
wrong picture.

Changing what a field *means* rather than where it sits is still
`STATE_VERSION` and `upgradeState()`, as it was.

Links from before the compact format arrive as `?state=`, base64'd JSON,
and still open. Don't drop that path: it is what is written inside every
SVG exported up to now.

## Preview

Any static file server works; there is nothing to build.

```bash
python3 -m http.server 8931
```

Claude Code has this wired up in `.claude/launch.json` (gitignored) as the
`flield` server on the same port. Reuse a running one rather than restarting.
