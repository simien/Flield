# Collapse the sidebar, then go full screen

Status: in flight (spec written 26 November 2026, nothing built)

Two new view modes on top of the normal one, built in this order. **Wide** collapses the 300px settings
column on desktop so the artboard takes the whole viewport width. **Full screen** uses the Fullscreen API
to give the artwork the whole display, with no chrome at all. Both reuse the pattern the layout already
trusts: live elements move between homes (see "The layout moves live elements" in `AGENTS.md`), state
lives in a class on `body`, and nothing is copied.

## What exists today

- `.controls` is a fixed `width: 300px` flex column beside `.main-area` (`style.css:334`). Above 768px
  it is always on screen; below, it is the bottom sheet (`setSidebarOpen`, `app.js:2075`).
- `#preview` is capped by `max-width` and `max-height` against `.canvas-area`'s padding box
  (`style.css:1891`). The caps only shrink. At the default 1200x630 on a 1440x900 window the artboard
  is about 1090px wide, so the canvas shows at about 1090x572.
- Collapsing the sidebar alone would only grow that to 1200x630, the canvas's own size: 10 percent.
  "As wide as possible" therefore needs the canvas to scale up to fit in the new modes, not just stop
  shrinking. That is the one real design change in this spec.
- `centerCanvas()` (`app.js:417`) already re-centers on any size change of the canvas or its area, so
  a resized artboard needs no new centering code.
- Exports read the canvas's pixels, never its displayed size, so no mode changes a PNG, SVG or GIF.

## Behavior

### Wide (desktop, above 768px)

- A toggle collapses `.controls` to nothing. The sidebar slides out left (`transform` plus `width`,
  0.2s, the sheet's own duration, off under `prefers-reduced-motion`) and `.main-area` takes the width.
- The canvas fits the artboard both ways: it scales up as well as down, keeping its aspect, with
  `image-rendering: pixelated` so the blocks stay hard. Expected at 1440x900 and 1200x630: about
  1390x730, against about 1090x572 today.
- The exploration loop stays one click away. `.explore-row` (Undo, Play, Random) moves into the footer
  strip, left of the brand, the same way `syncActionBar()` moves it into the phone bar. The footer
  strip is 32px tall and so are those buttons, so it fits without a new row.
- The toggle itself: a sidebar icon button. Expanded, it sits at the start of `.explore-row` in the
  sidebar header. Collapsed, it travels with the row into the footer strip, so it is always in the
  same place relative to the controls it hides.
- Key `S` toggles it, with the same guards as `R` (not in a text field, no modifier, no repeat, not
  while the tour or the picker is up).
- The state is remembered per viewer in `localStorage` as `flield-sidebar`, beside `flield-theme`,
  inside the same try/catch. It never travels in a shared link.
- Closing the sidebar closes the color picker first. Opening the tour expands the sidebar, since every
  tour step points into it, and puts it back as it was when the tour closes.
- The collapsed sidebar is `inert`, as the closed phone sheet already is, so Tab never walks into it.
- Below 768px Wide does not exist: the sheet already gives the artwork the screen. Crossing the
  breakpoint while collapsed restores the normal desktop layout on the way back up, from storage.

### Full screen (every layout where the API exists)

- A full-screen icon button joins `#appChrome` (tutorial, theme). That row already lives in the sidebar
  footer on desktop and at the end of the settings scroll on a phone, so one button covers both
  layouts. In Wide, a second home is needed because the sidebar is hidden: it travels into the footer
  strip's right end, after the links, where a video player keeps its full-screen control.
- Key `F` toggles it, guarded like `S`. `Escape` exits through the browser's own handling, so the
  existing Escape ladder (`app.js:2318`) is untouched.
- What goes full screen is `.main-area`, not the document, so the sidebar, the sheet and the action bar
  are simply not rendered. Inside it the footer strip hides and `--footer-strip` drops to 0 (or
  `.canvas-area` would still stop 52px short of the bottom), `.canvas-area` loses its padding, and the
  canvas loses its border, radius and shadow and fits the display with the same scale-up rule as Wide.
  Letterbox bars are `--bg`. Expected on a 1440x900 display: about 1440x756.
- Toasts and the play offer stay visible, because they are children of `.main-area`.
- The pointer hides after two seconds without movement and returns on the next move. On entry, one
  toast says how to leave: "Press F or Esc to exit full screen".
- `R`, `Space` and Undo keep working, which makes full screen a viewing mode for Auto-randomize.
- The button's state follows `fullscreenchange`, not the click, so leaving with Escape or a browser
  gesture keeps the label and `aria-pressed` right.
- Where `document.fullscreenEnabled` is false (iPhone Safari, some embedded frames) the button is not
  shown and `F` does nothing. No prefixed fallback: every browser Flield supports ships the unprefixed
  API, and iPhone Safari refuses non-video elements under either name.
- `_headers`' `Permissions-Policy` does not mention `fullscreen`, so the default (same origin allowed)
  holds and nothing there changes.

## Scope

- In: the two modes, their buttons and keys, the canvas fit in those two modes, the shortcut legend
  in the footer, and the prose that lists shortcuts (`guide/index.html#shortcuts`, `USAGE.md:18`,
  `README.md:128`).
- Out: scaling the canvas up in the normal layout (its behavior stays byte for byte, proven below);
  tiling the composition, which repeats without a visible edge, to fill the screen instead of
  letterboxing it (a Later question);
  any change to the share link format.

## Steps

### Phase 1: Wide

- [ ] Add the toggle button to `.explore-row` in `index.html` and the `body.sidebar-collapsed` rules
      to `style.css` above the phone block: the column's collapse, its transition, and the canvas fit.
      The fit: `#preview` takes `width` and `height` from a scale `app.js` publishes as a custom
      property. Container query units on `.canvas-area` could do it in CSS alone; try that first and
      keep it if `view-modes.js` passes, since it removes a script dependency from the layout.
- [ ] In `app.js`, add `setSidebarCollapsed()` beside `setSidebarOpen()`: the class, `inert`, storage,
      moving `.explore-row` and the toggle into the footer strip and back (recording each element's
      home, as `lastFieldHome` does), closing the picker, and a no-op below 768px. Extend
      `centerCanvas()` to publish the fit scale in Wide and full screen only. Declare every `const`
      it reads above `syncActionBar()`'s first call.
- [ ] Add `S` to the shortcut handler and to `.site-footer-keys`, and make the tour expand the
      sidebar and restore it.
- [ ] Verify Phase 1. Write `local/Harness/view-modes.js` on the pattern of `ux-u1-u7.js`, at 1440x900
      and 1024x768, that measures the canvas's rendered box and fails unless: expanded equals the
      baseline measured before the change (expected about 1090 wide at 1440); Wide is at least the
      artboard width minus 1px, still centered within 1px; the footer strip does not overflow at 769px
      wide; Tab from the toggle never lands inside `.controls` while collapsed; and a reload restores
      the state. Then the standing gates: `style-dump.js` and `pseudo-dump.js` against a `git archive`
      of the commit before show zero computed-style differences in the expanded layout, both themes;
      `bugs-b4-b16.js` and `a11y-a1-a15.js` print no `BUG`; `gif-button-width.js` ends in `ok`;
      `ux-u1-u7.js` ends in `all ok`; `checks.py` passes.
- [ ] Commit Phase 1: bump `style.css` (127 to 128) and `app.js` (2 to 3) on every page that requests
      them, move `sitemap.xml`'s `lastmod` for the app page, update the three shortcut lists.

### Phase 2: Full screen

- [ ] Add the full-screen button to `#appChrome`, its third home in the footer strip for Wide, and the
      `.main-area:fullscreen` rules (footer hidden, no padding, bare canvas, `--bg` letterbox, idle
      cursor class).
- [ ] In `app.js`, add `toggleFullscreen()`, the `fullscreenchange` listener that owns the button's
      label and `aria-pressed`, the idle-pointer timer, the entry toast, `F` in the shortcut handler,
      and the `fullscreenEnabled` gate that hides the button.
- [ ] Verify Phase 2. Extend `view-modes.js`: in headless Chrome, `requestFullscreen` on `.main-area`
      gives a canvas within 1px of contain-fit to the screen size, the footer is not rendered,
      `R` still rerolls (the canvas checksum changes), and after `exitFullscreen` the expanded
      baseline from Phase 1 measures again exactly. Then press `F` and Escape by hand in Chrome,
      Safari and Firefox on this Mac, since headless full screen is not the real one, and on an
      Android phone through the live site. Rerun the Phase 1 gates.
- [ ] Commit Phase 2 with the same cache-bust and `lastmod` rules, and the `F` key in the three lists.

## Open questions

- None blocking. The work is Memex #2149. Two calls this spec makes are open there as low decisions,
  each with the built option marked: #2150 (letterbox or tile in full screen) and #2151 (any fit, or
  whole multiples only, when scaling the pixel art up).
