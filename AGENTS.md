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
`style.css`, `generator.js` and `app.js` from the app, `guide.css` from the
guide, the explainers and `404.html`, `generator.js` again from the
explainers, `gif-writer.js` from `app.js` on the first GIF export (the number
is in `loadGifWriter`, not in the markup), and `screenshot.png` (with its two
`.webp` copies, on one number) from every page plus the README. Bump the
number when you change that file, on **every page that requests it**, and
**leave it alone when you haven't**. A missed bump serves a returning visitor
a stale stylesheet; a bump on four pages and not the fifth is how `404.html`
served an older `guide.css` than the guide did; a needless bump throws away
every visitor's cache for nothing. CI checks all three.

A missed bump that already reached main is fixed by a follow-up commit
that bumps the number alone. CI allows it because the file changed after
its current number was set (`stale_on_base` in `checks.py`). Don't amend
and force-push to main to fix one. The same follow-up must move
`sitemap.xml`'s `lastmod` for every page it touches, including pages
whose only change is the new `?v=`, and a document page's JSON-LD
`dateModified` with it: `checks.py` holds the two equal.

## A new motion or texture leaves counts behind in the prose

Ripple and Tide took the motion count from four to six, and eight places
went on saying four: the animated-backgrounds lede and two of its own
comments, the guide's "all four", a comment in `index.html`, `USAGE.md`
twice (once in prose and once listing them as "Loop, Drift, Wind, and
Pulse"), and this file, which said a shared link is 82 characters in one
paragraph and 84 thirty lines below. The tutorial had drifted a
different way, telling the reader to pick a step count to stop a motion
when the menu's option is None.

Not one of them shows up in the browser or in `checks.py`, because every
one is prose. After adding or removing a kind, grep the repo for the old
number as a word, and for the kinds listed out by name, and read every
hit rather than trusting it. The same goes for a length: measure it
against the running app (`encodeCompact` returns 84 today) rather than
copying a number out of a neighbouring paragraph.

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

## The two themes swap a pair of grays, and contrast does not swap with them

`--text-muted` and `--text-subtle` traded values between the themes,
Zinc 500 one way and Zinc 400 the other. It reads as symmetry and is
not: the same gray measures very differently against near-black and
near-white. On the document pages that left body text at 4.40:1 in
light, under AA's 4.5, and the quieter roles (`.meta`, figcaptions, the
footer, the header's page name) at 4.12:1 in dark and 2.33:1 in light.

`style.css` had already found this and written it down beside
`.section-title`: no single gray fixes it, because the two themes want
it moved in opposite directions. Its answer there was to reach for
`--text` instead, which body copy cannot do. So each theme names its own
pair now rather than trading one, landing near 7:1 for body text and 5:1
for the quiet roles. Both new values sit off the Zinc ramp because no
step on it lands in range for the theme that needs it.

That makes those two tokens the one place `guide.css` deliberately
differs from the `style.css` block it otherwise copies, and its own
comment says so. Don't close the gap by copying the app's grays back
over. The app puts muted text on a `--panel` that is pure white in
light; a document page puts it on `--bg` at `#f4f4f5`, and that
difference is the whole margin. The app measures 4.83:1 and 6.91:1 on
its panels and wants nothing there. Two of its roles sit on the page
ground instead, the inactive tabs and the footer, and measured 4.40:1
in light; those read `--text-on-bg`, which is `--text-muted` in dark and
the guide's quiet gray in light. Anything new set on `--bg` rather than
a panel wants the same token.

Two ways a measurement lies here:

- **Against `--bg`, not `--panel`.** In dark, `--panel` is lighter than
  the page, so text on a panel has less contrast rather than more. The
  tightest reading on the site lives there: 4.65:1 on `.demo-value`.
- **Composite an alpha background first.** The inline `code` chip sits
  on `rgba(255, 255, 255, 0.05)`. Read that literally and it measures
  2.56:1, which is a bug in the measurement, not a finding. Composited
  over the page behind it, 7.10:1.

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

259px is not the only budget. A hint inside Palette Range or Density
Range gets 237px, because the collapsible panel indents it, and
measuring one of those against 259 passes a string that wraps. That is
how both came to sit on two lines with the second barely a third full.
Leave real slack either way: a string that fits on this machine can
still overflow in the stack's last entry, a generic `sans-serif`, so
measure a deliberately wide face too before calling one done.

Most hints are not on screen at load, so sweeping what is visible finds
three of thirteen. The rest need the Layer tab switched, the two range
panels expanded, and a Motion picked, since Speed, Depth, Direction and
Collide are revealed by that choice. The per-texture hint is swapped by
the texture select's `input` handler rather than `change`: dispatch only
`change` and the old string stays on screen, which reads as a bug and
is not one.

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

## Sharing is gated on the pointer, not on the API

`navigator.share` exists on desktop Chromium and desktop Safari, so a
feature-detect alone sends Brave, Chrome and Safari on macOS into the OS
share sheet. That sheet offers Mail, Messages, Notes and Reminders and no
clipboard entry, which leaves no way to get the link out of a button that
otherwise says Copy Link. The test is
`navigator.share && matchMedia("(pointer: coarse)")`, and the markup
comment beside the button says so too, because the label it describes is
written from the script.

The failure is quiet in both directions: a desktop visitor gets a sheet
that cannot do the one thing they pressed for, and a `share()` that
rejects for any reason other than a cancelled sheet leaves the button
doing nothing at all. Only `AbortError` returns early; everything else
falls through to the clipboard.

The browser pane cannot verify the clipboard half of this.
`navigator.clipboard.writeText` throws `NotAllowedError` there because the
pane's document is never focused, so the copy path can be read but not
run. Press the button in a real browser before believing it.

## The app's script has one scope

`app.js` holds the app's script, one long file that `index.html` loads after
`generator.js`. It was inline in `index.html` until November 2026 and moved
out verbatim, still indented as it was. Two consequences:

- **Declare a `const` above its first *caller*, not just its first use.**
  `syncActionBar()` runs during init and reaches into the sheet and the bar,
  so anything it touches must already exist. Getting this wrong throws a
  `ReferenceError` at load and takes the whole app down.
- **A duplicate declaration is fatal.** A second `const controlsBody` threw a
  `SyntaxError` that killed every listener on the page while it still served
  200. CI parses `app.js` and each inline block to catch this.

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

The other half of the trap is anything that finds fields by where they
sit. A field out on the strip is not inside its tab panel, so
`#tab-layerA .lock-btn` comes up one short while it is there, which is
how a tab came to say "11 of 10 fields locked". Count and look up by id
(`btn.dataset.targetId`), which travels with the element.

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

`checks.py` holds this with `.github/scripts/generator.test.js`. It
checks the three copies of the noise arithmetic against each other (the
reference functions the flow-fields explainer calls, the loop inlined
into `getFlowField`, and the warp's own sample) cell for cell, and holds
streaks and texture stills and a frame of every motion to recorded
checksums. A motion meant to play differently updates its line from
`--print`; a streaks still that moves is a break, not an update.

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

## Ripple is a post-pass and a painter, not a field motion

Loop, Drift and Wind move where the field is sampled. Pulse and Ripple
leave the field alone, which is why both work with no field strength
and why `buildGrid` reads the field at phase 0 for them: an identical
field sampled every frame was most of a Pulse frame's cost before that.

Ripple went through the field first and was invisible. A radial
displacement of the sampling coordinates, at any amplitude short of
mush, changes almost nothing a dither shows, because the dither stays
put and only the shading under it shifts. A lateral wave and a zoom
failed the same way. What reads is changing the finished cells. Ripple
does that in two places, neither of them `buildGrid`: `rippleSwell`
grows and shrinks each finished layer's shapes by a cell along the
rings, and `renderWarped` paints every pixel from the cell under the
refracted point, at pixel resolution, so blocks stretch rather than
step. A cell-level warp was tried between the two and stepped whole
blocks, which is what the pixel painter replaced.

Two things follow that a new consumer of `generate()` must know. It
returns `warp` alongside the grids, null for every motion but Ripple,
and `renderToCanvas` needs it passed through or a Ripple frame paints
with the swell and no pull; every call site in the app and the
explainers passes it. And the SVG exporter reads the grids only, which
is right, because an SVG is a still.

Ripple is rain: several seeded drops, each born at its own moment and
living one cycle, summed where the rings cross. Each is periodic on its
own so the sum closes, but rings are in flight at phase 0, so Ripple's
first frame is not the still, as Drift's is not. The preview passes
`loopCycle`, and with it each drop lands somewhere new at every
rebirth, when its ring is at zero; exports leave it out, so their rain
repeats and the loop closes. The rings are evaluated on a lattice
`RIPPLE_STEP` cells apart and interpolated; evaluating every drop at
every cell put a frame far over the 80ms budget. Both layers share the
one surface, B at 70% of the swell and pull.

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

## Collide and per-layer motion

Every motion is resolved per layer in `generate()`: a layer's `motion`
of "same" follows `loopMode`, "none" holds it still, and a kind runs
it, all on the one phase. Anything that reads "the" motion in the app
must say which: `generalMotion()` is what `generate()` gets as
`loopMode`, and `currentMotion()` is whether anything plays and what to
call it, which a layer's own kind can answer when General is None.

Collide is Tide's push under any motion: `tidePush` reads the pusher's
field as it is that frame, on a lattice two cells apart, because under
Loop, Drift, and Wind it is rebuilt every frame and a full-resolution
gradient put a frame far over budget. Tide's own push is the still
one, cached. Both go through the same `deform` hook.

## Wind stands, Drift slides, and B circles the other way

Wind's first octave holds still and only the finer octaves travel
(`WIND_PARALLAX`), with the gust bending the lot; it used to slide
like Drift with the gust on top, and the two were hard to tell apart.
Under Loop, and in Wind's gust circle, layer B turns the opposite way
(`LAYER_B_SPIN`), so the layers slide against each other; same-way
circling read as one sway. Both are how a motion plays, not how a
still looks, so links are untouched, but the Loop and Wind example
clips were re-rendered for them.

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

## The GIF encoder is the project's own

`gif-writer.js` replaced the vendored gif.js on 25 November 2026. gif.js
held every frame as raw RGBA until the encode finished, 3MB a frame on
the default canvas, and the memory cap that forced left the default
thirteen second cycle at 69 frames: 5fps in the file against 12.5 on the
canvas, which is what "the GIF plays slower than it looks" turned out to
be. It also trained a 256 color palette on a picture with three colors.
The new one compresses each frame as it arrives and keeps only the
bytes, reads the colors off the pixels and writes them as they are, and
writes a pixel that did not change as transparent. Measured on one
composition at the default speed, old encoder and new: 69 frames, 5.8MB
and eighteen seconds became 168 frames, 6.2MB and twelve seconds. The
file is no smaller; it holds two and a half times the frames. Three
other compositions that day came to 0.6MB, 0.9MB and 1.8MB for the same
168 frames: the less of the canvas a frame changes, the less it costs.

Four things about it are invisible until they cost a cycle:

- **It needs flat color.** A frame with more than 255 colors is refused
  and the export ends in a toast. Nothing on the main canvas antialiases
  today (`imageSmoothingEnabled` is off and Ripple's painter writes whole
  pixels), so a refusal means something new started blending. Fix that
  rather than teaching the encoder to quantize: quantizing is how a
  brand color comes out one step off.
- **A GIF delay is whole hundredths of a second.** Giving every frame
  `cycle / frames` repeats the rounding on every frame, and the file ran
  up to 4% long. `frameDelay` and `framePhase` cut the delays and the
  phases from the same rounded edges, so a pass lands within 5ms of the
  cycle and a frame held a hundredth longer also shows a moment a
  hundredth later. Don't replace them with a single delay.
- **The page is live while a moving export records.** Frames are drawn
  one at a time with a timer between them, because 168 of them in one
  task froze the tab. `gifExporting` holds still draws and the preview
  off for the length of it, Auto-randomize is paused and resumed, PNG
  and SVG are disabled because both read the canvas, and the size and
  the motion are read once at the start. A draw that ignores the flag
  cannot get into the file, since each frame is drawn and read back in
  one task, but it will flash on the canvas. The timer is `setTimeout`
  on purpose: a hidden tab stops delivering animation frames and the
  export would wait there.
- **The budget is pixels now, not bytes.** `GIF_PIXEL_BUDGET` gives the
  default canvas the whole 240 frames and a larger one fewer in
  proportion. It rations the wait and the download, not memory.

An encoder that goes wrong still hands back a file, so `checks.py` runs
`.github/scripts/gif-writer.test.js`, which reads the bytes back with a
decoder that shares no code with the encoder and compares every pixel.
Seven deliberate breaks (a code widened late, a table not restarted,
the transparency flag dropped, the remap skipped, a crop a row short,
the delay in the wrong unit, red and blue swapped) each fail it. That
covers the format. It does not cover the page, so after touching the
export handler, record a real one: drive the page in headless Chrome,
checksum each frame as it is handed to the encoder, decode the saved
file with ffmpeg, and compare. All 168 frames matched on the day.

## A shared link is a bit stream, and CI guards it

`?c=` is 84 characters of base64url over a packed bit stream: each value
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
fails on anything but an append to a menu or the tail. The lock ids and
the layer fields may not grow at all, not even at their ends: both sit
ahead of the tail, so one more of either shifts every tail field an old
link carries. A new lock or layer value belongs in the tail.

There is one place the format may grow: `COMPACT_TAIL_FIELDS`, written
after both layers and read back with a fallback rather than throwing, so
a link that stops before a tail field decodes to what that link meant.
Two rules keep it honest, and `checks.py` enforces the first: append
only, and every tail field's zero must mean "what this was before the
field existed", because base64 pads the last byte with zeros and an old
link's tail is read straight out of that padding. A tail that is all
zeros is not written at all, though nothing leaves it empty today: the
two durations are always written, so every new link is the same length
(it grew to 84 when depth, direction, collide, and the layers' own
motions joined the tail).

The escape hatch is `COMPACT_VERSION`. Bumping it says the break is
deliberate, and both checks stand down: the decoder refuses a version it
doesn't recognize, so old links stop opening rather than opening the
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

A push reaches flield.com in about 45 seconds. For a minute or so after
that, the edge can still hand back the previous HTML on a plain request,
with `cf-cache-status: HIT`, while the same URL with a cache-busting
query returns the new copy. Two pages reporting an old `?v=` right after
a deploy is that, not a deploy that half landed; check with a throwaway
query before concluding anything, and they catch up on their own.

A push to main that touches a page also runs `indexnow.yml`, which tells
Bing and the other IndexNow engines which pages changed so they recrawl
now. The key file at the repo root (32 hex characters, `.txt`) is the
site's proof it may submit; it is public by design and must keep serving
from the root, so don't move it or add it to `.assetsignore`. Which files
count as which page is the `PAGES` table in
`.github/scripts/indexnow.py`; a new page needs a row there and a line in
the workflow's `paths`.

## Editing an inline script changes the policy

`_headers` allows each inline script by its sha256, not by
`'unsafe-inline'`, so a change of one character to the app's undo-label
script, a document page's script or the theme script every page shares
changes its hash, and the browser refuses the old one: the page serves 200 with
nothing running. `checks.py` names the hash to add and the stale one to
drop, and the deploy runs `checks.py`, so a missed update stops the
deploy rather than the site. Copy the hash it prints into `script-src`.

## Some of the site lives in accounts, not in the repo

Nothing here reproduces it, so don't reach for code when one of these is
the cause, and don't undo one by accident:

- **Cloudflare.** A redirect rule sends `www.flield.com` to the bare
  domain (301, query string kept, so a shared `?c=` link survives), a
  placeholder `www` A record exists only so that rule can fire, and
  Always Use HTTPS is on for the zone. `_headers` never sees an http
  request because of that.
- **Email.** Cloudflare Email Routing receives `hello@flield.com`; Resend
  sends as it, signed with the `resend._domainkey` DKIM record. DMARC is
  `p=reject`. Any new sender has to sign for flield.com or its mail is
  refused; a plain Gmail "send as" would be.
- **Search.** Google Search Console and Bing Webmaster Tools are both
  verified by DNS records, not by a file or tag in the repo, and both have
  `/sitemap.xml` submitted. A new page only needs the sitemap entry and
  the IndexNow table above.


Any static file server works; there is nothing to build.

```bash
python3 -m http.server 8080
```

Claude Code has this wired up in `.claude/launch.json` (gitignored) as the
`flield` server on the same port. Reuse a running one rather than restarting.
