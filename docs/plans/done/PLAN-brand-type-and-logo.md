# Bring Flield's new typography and logo to flield.com

Status: done 2026-11-26

The identity chosen on 25 November 2026 lives in `local/Brand` (reference:
`local/Brand/SAP-FLIELDBRAND-Reference-v1.2.md`). This plan brings two parts of it to the site:
the type and the logo. Each part lands as its own commit and is proven by looking at the pages in
both themes, by the Harness suites, and by the CSP probe, because fonts and data URLs both pass
through the policy.

## Scope

- In: Silkscreen for the logotype, page titles, section titles and panel labels on every page.
  Geist Mono 500 for the body text of the four document pages (guide and three explainers). The
  lockup (mark tile beside the Silkscreen FLIELD) in the app's strip and every document header.
  The brand favicon set at the root. In the app, the tab icon is the mark's shape painted in the
  live composition's ground and two layer colors; the document pages show the Citrus mark.
- Out: the Citrus palette in the interface, `theme-color` and the social card (owner, 26 November:
  typography and logo only). App controls and sidebar hints keep the system sans, so the one-line
  hint budget in `AGENTS.md` holds. `generateRandomFavicon` stays in `app.js`, unused, for later.
  Sorting `local/` is #2143.

Decided by the owner on 26 November 2026 (#2140).

## Steps

- [x] Favicon files: `favicon.svg` regenerated from the rule (cells equal to the brand file's),
      `icon-192.png` re-encoded from the brand file (pixels equal), `favicon.ico` copied. The brand
      files carry a C2PA manifest (8KB of the SVG's 8.9KB); the shipped copies do not, and the
      originals stay in `local/Brand`. The 180px touch icon was left out: `icon-192.png` stays the
      linked one, for the reason in `index.html`'s comment.
- [x] App favicon: `brandMarkCells(n)` in `core.js`, `drawBrandFavicon` in `app.js` from
      `prepareRender()`, redrawing only when a color changes. Verified: `core.test.js` holds
      `favicon.svg` to `brandMarkCells(16)` and fails on one changed cell; on the live page the
      icon read back has 0 of 256 wrong cells before and after Random, under the real CSP too.
- [x] Lockup: inline SVG, 76 by 16, in the app's strip and all five document headers (404
      included), accessible name kept in an `sr-only` span. The brand leaves the small header
      lockup's gap undefined; this one uses the 16 cell mark at one pixel a cell, the logotype at
      two pixels per font pixel 3 down (10px caps, whole pixels at 1x), and a 6px gap. The
      logotype is `currentColor`; the mark keeps its dark tile. Looked at in both themes at 1280
      and 390.
- [x] Fonts: `fonts/silkscreen-400.woff2` (7.8KB) and `fonts/geist-mono-500.woff2` (15.7KB, the
      variable font fixed at 500), Latin-1 plus common punctuation, with both OFL files. Every
      character the six pages use is covered. Neither license reserves a font name. `@font-face`
      with `font-display: swap` and `?v=1`; `/fonts/*` cached for a year in `_headers`.
- [x] Type: Silkscreen 40/24/16px for the document headings (32px h1 under 480px), 16px for the
      header's page name and the app's section titles; Geist Mono 500 at 16px for document body.
      Silkscreen on the app's field labels was tried and dropped: at 16px, its smallest readable
      whole-pixel size, the long names wrapped and the labels matched the section titles.
      Verified: `style-dump.js` against the commit before shows only the section titles changed in
      the app, plus the 7px each adds below it; no hint or label changed size in any state.
- [x] Bumps: `style.css` 126, `guide.css` 14. No inline script changed.
- [x] Verify: `checks.py` passes; `bugs-b4-b16.js`, `a11y-a1-a15.js`, `gif-button-width.js` and
      `ux-u1-u7.js` pass; `csp-probe.js` finds no violation and both fonts report `loaded` under
      the policy. A14 caught two tables overflowing at 390px in the wider face; header cells now
      wrap on phones, in a rule placed after the base one (source order). Looked at in both themes.
- [x] Commit per part (`19b64f7` favicon, `437748f` lockup, `9b47b01` type); reviewed by the owner on
      a local server; pushed at `464b9fc`, remote head verified. flield.com served the guide at
      `guide.css?v=14` with the lockup, the app at `style.css?v=126` and both fonts byte for byte
      60 seconds later, the fonts as `font/woff2` with the year-long cache.

## Where the plan was wrong

- It planned Silkscreen for the app's field labels. Seen at its smallest whole-pixel size, they
  wrapped and lost the hierarchy under the section titles; they stay in the sans.
- It planned a 180px touch icon. `icon-192.png` already does that job and the comment in
  `index.html` says why, so no new file.
- It expected the type change to touch nothing outside type. The wider monospace pushed two
  tables past a phone column, which only the accessibility suite caught, and the first fix sat
  above the rule it overrode: the source-order trap `AGENTS.md` describes.
- It assumed `fonttools` would run from the shell's `python3`. That is pyenv's 3.12; the MacPorts
  install is `/opt/local/bin/python3.14`.
