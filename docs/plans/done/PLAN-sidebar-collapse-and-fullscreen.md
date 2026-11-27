# Collapse the sidebar, then go full screen

Status: done 26 November 2026 (#16 as `9ddf1ce`, #17 as `38898df`, live on flield.com the same day)

Two new view modes on top of the normal one, built in this order. **Wide** collapses the 300px settings
column on desktop so the artboard takes the whole viewport width. **Full screen** uses the Fullscreen API
to give the artwork the whole display, with no chrome at all. Both reuse the pattern the layout already
trusts: live elements move between homes (see "The layout moves live elements" in `AGENTS.md`), state
lives in an attribute on `<html>`, and nothing is copied.

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

- A toggle collapses the sidebar. It slides out left by its own width (`margin-left: -300px`, 0.2s,
  the sheet's own duration, off under `prefers-reduced-motion`), so nothing in it reflows on the way,
  and `.main-area` takes the window.
- The canvas fits the artboard both ways: it scales up as well as down, keeping its aspect, with
  `image-rendering: pixelated` so the blocks stay hard. Measured at 1440x900 and 1200x630: a
  1388x729 picture, against 1088x571 expanded. The fit is CSS (`100cqw` and `100cqh` of
  `.canvas-area`); `app.js` publishes only the picture's aspect as `--canvas-ar`, from a
  `MutationObserver` on the canvas's `width` and `height`.
- The exploration loop stays one click away. `.explore-row` (Undo, Play, Random) moves into the footer
  strip, left of the brand, the same way `syncActionBar()` moves it into the phone bar.
- The toggle is a sidebar icon button at the start of `.explore-row`, so it travels with the row and
  stays beside the controls it hides. Hidden below 768px.
- Key `S` toggles it, with the same guards as `R`. It is in the guide, `USAGE.md`, `README.md` and the
  toggle's tooltip, not in the footer legend, which would otherwise grow by 70px.
- The state is `data-sidebar="collapsed"` on `<html>`, stored as `flield-sidebar`. An inline script in
  `<head>` restores it before first paint, because the first paint comes before `app.js` runs. It never
  travels in a shared link. Below 768px the stylesheet ignores it, so the sheet works as before and
  widening back gives Wide back.
- Collapsing closes the color picker. The collapsed sidebar is `inert`, as the closed phone sheet
  already is, so Tab never walks into it.
- The tour is a modal of its own with its own mock-ups, so it does not touch Wide. The first draft of
  this plan had it expand the sidebar "since every tour step points into it"; none does.
- In Wide the theme and tutorial buttons are out of reach with the sidebar, and the keys are not.
- The footer strip is now a size container, and its legend hides by container query when the strip
  is too narrow. Building Wide found that on `cd5c8d7` the strip's one-line minimum already pushed
  `.main-area` past the window from 769px to 873px, cutting up to 104px off the canvas; the same rule
  fixes that. The cost: the expanded legend now hides below a 920px window, where it used to show
  from about 886px on a Mac.

### Full screen (every layout where the API exists)

- A full-screen icon button sits at the right end of the footer strip, where a video player keeps
  it. The strip is on screen expanded, in Wide and on a phone, so the button has one home and never
  moves. (The first draft put it in `#appChrome` with a third home in Wide; the strip needs neither.)
  Adding it moved the strip's legend thresholds (611px expanded, 845px in Wide), and on a phone strip
  under 348px of content the year goes rather than the button.
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

- [x] Add the toggle to `.explore-row`, the head script, and the Wide rules in a
      `@media (min-width: 769px)` block after `#preview` in `style.css`: the slide, the CSS fit, and the
      row's margin in the strip. Hide the toggle in the phone block.
- [x] In `app.js`, add `wideOn()`, `syncWide()` and `setWide()` before the first `syncActionBar()`
      call, run `syncWide()` after it at load and at the breakpoint, make `syncSheetInert()` ask
      `wideOn()`, publish `--canvas-ar`, and add `S` to the shortcut handler.
- [x] Fix the footer overflow found on the way: `.site-footer` as a size container, and the legend's
      two container-query thresholds. Add the new hash to `_headers`.
- [x] Verify Phase 1. Run on 26 November 2026 against a `git archive` of `7bb9ef6`:
      `view-modes.js` 24 of 24 `ok` (on the base, E2 reads 104px over at 769px and every W check
      fails). `style-dump.js` with `SKIP='#sidebarCollapseBtn'` differs in all 16 states, dark and
      light alike once color lines are set aside, and only where expected: the row's boxes (Random
      179px to 139px), `--canvas-ar`, the footer's `container-type`, the legend hidden at 900px and
      the overflow fix at 769px. `pseudo-dump.js`, re-keyed by button name so an added button no
      longer shifts every key (its exit status was always 0 before), differs only in Random's width
      in its four forced states. `bugs-b4-b16.js` 29 `ok`; `a11y-a1-a15.js` all `ok` except the
      known A4 flake, which passes alone; `gif-button-width.js` `ok`; `ux-u1-u7.js` `all ok`;
      `checks.py` passes. Screens with reduced motion at 1440, 1024 (light), 800 and 769px.
- [x] Commit Phase 1 as two commits, the overflow fix first, then Wide with the docs: the guide's shortcut table, `USAGE.md`, `README.md`, and the two
      new traps in `AGENTS.md`. `style.css` is at 128 and `app.js` at 3; `sitemap.xml` and the guide's
      `dateModified` already read the commit date if it lands on 26 November. Done as `b17770b` and
      `f3d5d23`, pushed and verified with `git ls-remote`, PR #16.

### Phase 2: Full screen

- [x] Add the button to the footer strip, the `.main-area:fullscreen` rules after Wide's block (strip
      hidden, no margins, bare canvas fitted on container units, `--bg` letterbox, idle cursor), and
      the strip's new thresholds.
- [x] In `app.js`, add `toggleFullscreen()`, the `fullscreenchange` listener that owns the button's
      label, icon and `aria-pressed`, the idle-pointer timer, the entry toast (only with a pointer
      that hovers), `F` in the shortcut handler, and the `fullscreenEnabled` gate. Entering closes
      the sheet and the picker.
- [x] Verify Phase 2, headless, against a `git archive` of `f3d5d23` on 26 November 2026:
      `view-modes.js` 49 of 49 `ok`, F1 to F5 beside the Phase 1 checks (a 1200x630 picture at
      1440x756 on a 1440x900 screen, unframed and centered; the same pixels after leaving; `R`
      rerolls in full screen; the pointer idles at two seconds; a phone closes its sheet first; the
      strip fits from 340 to 1280px). On the base, F1, F3 and F4 fail. `style-dump.js` with
      `SKIP='#fullscreenBtn'`, dark and light identical: only the footer links moving over for the
      button, and the year gone at 340px. `pseudo-dump.js` 0 differences in 384 forced states.
      `bugs-b4-b16.js` 29 `ok`, `a11y-a1-a15.js` 65 `ok`, `gif-button-width.js` `ok`,
      `ux-u1-u7.js` `all ok`, `checks.py` passes.
- [x] Press `F` and Esc by hand, since headless full screen is not the real one. The owner tried it
      in a real browser on 26 November and reported it works; which browsers was not recorded, and
      an Android phone was not named.
- [x] Commit Phase 2 with `style.css` at 130 and `app.js` at 4, and `F` in the three lists.

## Open questions

- None. The two calls the plan made on the owner's behalf stay open in Memex as low decisions, each
  with the built option marked: #2150 (letterbox or tile in full screen) and #2151 (any fit, or
  whole multiples only, when scaling the pixel art up).

## Where the plan was wrong

- It said a collapsed sidebar alone was most of the win. Measured, it was 10 percent: the canvas only
  ever shrank, so the real change was letting it scale up, and that became the spec's center.
- It put Wide's state in a class on `body`, set from `app.js`. The first paint comes before `app.js`
  runs, so a stored collapse would have flashed the sidebar on every load; the state moved to an
  attribute on `<html>`, set by an inline script in `<head>`, which also cost a new hash in
  `_headers`.
- It had the tour expand the sidebar "since every tour step points into it". None does: the tour is
  a modal with its own mock-ups.
- It expected the footer strip to take the exploration row without trouble, and checked only for
  overflow inside the strip. The strip's minimum was already pushing the artboard past the window
  on main from 769px to 873px; only a check against the window found it, and the fix (a size
  container with a legend that steps down) became its own commit.
- It put the full-screen button in `#appChrome` with a third home in Wide. The footer strip is on
  screen in every layout, so the button got one home and never moves.
- It planned to add `S` to the legend in Phase 1, took it out to save width, and the owner asked for
  it back with `F` after Phase 2. The two-step legend is what made room for both.
- It assumed the harness could be trusted as it stood. `pseudo-dump.js` keyed buttons by index, so an
  added button shifted every key, and it exited 0 whatever it found; both were fixed before its
  result counted.
- It assumed a stacked pair of PRs would merge as they were. Squashing #16 left #17's branch holding
  the original commits; a rebase and force-push was refused, and merging main into the branch with
  the `ours` strategy, safe because main's tree equalled the branch's base, took its place.
