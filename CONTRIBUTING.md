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

## Reporting bugs

Open a [GitHub issue](https://github.com/simien/Flield/issues) with:

- What you did, what you expected, what happened instead
- Browser and OS
- A screenshot or the shareable link (Copy Link in the sidebar) if the bug is
  specific to a composition

## Suggesting features

Open an issue describing the use case, not just the feature. Flield's feature
set is intentionally curated (see the Features list in [README.md](README.md)),
so a clear problem statement makes it much easier to judge fit.

## Submitting changes

1. Fork the repo and create a branch from `main`.
2. Serve the folder locally to test: `python3 -m http.server 8080`.
3. Keep changes focused; unrelated formatting or refactors make a diff harder
   to review.
4. Open a pull request describing what changed and why, and link any related
   issue.

Small fixes (typos, broken links, obvious bugs) can skip the issue and go
straight to a pull request.
