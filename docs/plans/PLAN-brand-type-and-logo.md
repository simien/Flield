# Bring Flield's new typography and logo to flield.com

Status: in flight

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
- [ ] Lockup: an SVG of the mark tile and the logotype, drawn from pixels so it needs no font,
      in place of the text "Flield" in `index.html`'s strip and the document headers, keeping the
      accessible name ("Flield") and the `sr-only` subtitle.
- [ ] Fonts: Silkscreen Regular and Geist Mono at weight 500 as Latin-subset WOFF2 in `fonts/`,
      with their OFL files, `@font-face` with `font-display: swap`, and a year-long cache in
      `_headers` under versioned names. Needs `py314-fonttools` (MacPorts).
- [ ] Type: Silkscreen at multiples of 8px for titles and labels, Geist Mono 500 for document body.
      Verify: every hint in the app still measures one line (method in `AGENTS.md`).
- [ ] Bump `?v=` for every changed versioned file on every page that requests it, with
      `sitemap.xml` and JSON-LD dates; `rehash.py` if an inline script changed.
- [ ] Verify: `checks.py` passes; `bugs-b4-b16.js`, `a11y-a1-a15.js` (A4 alone if flagged),
      `gif-button-width.js` and `ux-u1-u7.js` pass; `csp-probe.js` reports no refused font or image;
      shots of the app strip and each document header in both themes, looked at.
- [ ] Commit per part; push after asking; confirm flield.com serves the new files.
