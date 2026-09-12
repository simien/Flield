# Security Policy

Flield is a static, client-side, offline-capable app: no backend, no
accounts, no server-side data storage. The main surfaces worth reporting
issues against are:

- The shareable link / URL parameter parsing
- Anything stored in the browser (save slots, theme preference)
- The vendored, offline-bundled dependencies in `vendor/`

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security report. Instead,
report it privately through the contact listed on [flield.com](https://flield.com/),
or via a [GitHub private security advisory](https://github.com/simien/Flield/security/advisories/new).

Include:

- A description of the issue and its potential impact
- Steps to reproduce, or a proof-of-concept URL/link
- The browser and OS you tested on

You should get an initial response within a few days. Once a fix is
available, it will ship as a normal update to the live site at
[flield.com](https://flield.com/); there are no versioned releases to
backport to.

## Supported versions

Flield is a single, continuously updated site rather than a versioned
release train. Only the current version at [flield.com](https://flield.com/)
and the `main` branch are supported.
