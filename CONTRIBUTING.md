# Contributing to Flield

Thanks for taking the time to contribute. Flield is a small, dependency-free
project by design, so contributions that fit that philosophy are the easiest
to merge.

## Before you start

- **License**: Flield is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).
  By submitting a contribution, you agree it's provided under the same terms
  and that the maintainer may also use it under a separate commercial license
  offered to paying licensees.
- **No build step, no dependencies**: the project is plain HTML, CSS, and
  JavaScript, fully vendored, fully offline. Please don't introduce a build
  tool, package manager, framework, or CDN dependency. If a change seems to
  need one, open an issue first to discuss it.
- **`generator.js` stands alone**: it has no dependency on the UI (`index.html`,
  `style.css`), so it can be reused in other projects. Keep it that way.
- **The site is three pages**: the app (`index.html` + `style.css`), the guide
  (`guide/index.html` + `guide.css`), and `404.html`. The guide and the 404 page
  share `guide.css`; the app does not, because `style.css` gives `body` a fixed,
  non-scrolling viewport that a document page can't use. `guide.css` copies the
  handful of design tokens it needs from `style.css`, so a token changed in one
  needs changing in the other.
- **Documentation lives at [flield.com/guide](https://flield.com/guide/)**, not in
  the repo. `USAGE.md` is a stub pointing there on purpose: a second copy would
  only drift. Corrections to the walkthrough go in `guide/index.html`.

## Reporting bugs

Open a [GitHub issue](https://github.com/simien/Flield/issues) with:

- What you did, what you expected, what happened instead
- Browser and OS
- A screenshot or the shareable link (Copy Link, in the sidebar or the export
  panel on a phone) if the bug is specific to a composition

## Suggesting features

Open an issue describing the use case, not just the feature. Flield's feature
set is intentionally curated (see the Features list in [README.md](README.md)),
so a clear problem statement makes it much easier to judge fit.

## Submitting changes

1. Fork the repo and create a branch from `main`.
2. Serve the folder locally to test: `python3 -m http.server 8080`. The app is
   at `/`, the guide at `/guide/`, and the 404 page at `/404.html`.
3. Keep changes focused; unrelated formatting or refactors make a diff harder
   to review.
4. Open a pull request describing what changed and why, and link any related
   issue.

Small fixes (typos, broken links, obvious bugs) can skip the issue and go
straight to a pull request.
