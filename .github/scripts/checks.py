#!/usr/bin/env python3
"""Structural checks for a repo with no build step and no test suite.

Run it before pushing, the same way CI does:

    python3 .github/scripts/checks.py

Every check here is for something that has actually broken this project, and
every one is structural rather than stylistic, so it can't fail on taste. If
a check ever starts crying wolf, delete it. A check nobody trusts is worse
than no check.
"""

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = ["index.html", "guide/index.html", "404.html"]
failures = []
notes = []


def fail(check, detail):
    failures.append(f"{check}: {detail}")


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


# 1. Inline script syntax -----------------------------------------------
# A SyntaxError anywhere in the inline script kills the whole file, and the
# page still serves 200 with a dead UI. This has happened: a second `const
# controlsBody` took the entire app down with nothing but a console line.
def check_inline_js():
    for page in PAGES:
        html = read(page)
        blocks = re.findall(r"<script(?![^>]*\b(?:src|type)=)[^>]*>(.*?)</script>", html, re.S)
        for i, code in enumerate(blocks):
            proc = subprocess.run(
                ["node", "--check", "-"], input=code, text=True, capture_output=True
            )
            if proc.returncode != 0:
                # node prints the offending line, a caret, the error, then a
                # version banner. The error line is the only useful part.
                err = next(
                    (l for l in proc.stderr.splitlines() if "Error:" in l),
                    "syntax error",
                ).strip()
                fail("inline js", f"{page} block {i + 1}: {err}")
        notes.append(f"inline js: {page}, {len(blocks)} block(s) parsed")


# 2. Duplicate ids -------------------------------------------------------
# The UI moves live elements between the sidebar, the bar and the sheet
# rather than keeping a second copy. That is only safe while ids are
# unique; a duplicate makes getElementById silently return the wrong node.
def check_duplicate_ids():
    for page in PAGES:
        ids = re.findall(r'\bid="([^"]+)"', read(page))
        dupes = sorted(k for k, n in Counter(ids).items() if n > 1)
        if dupes:
            fail("duplicate id", f"{page}: {', '.join(dupes)}")
        notes.append(f"ids: {page}, {len(ids)} unique")


# 3. JSON-LD ------------------------------------------------------------
# Structured data is edited by hand alongside the prose it mirrors, and a
# trailing comma silently drops the page out of rich results.
def check_json_ld():
    for page in PAGES:
        blocks = re.findall(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', read(page), re.S
        )
        for i, raw in enumerate(blocks):
            try:
                json.loads(raw)
            except json.JSONDecodeError as err:
                fail("json-ld", f"{page} block {i + 1}: {err}")
        notes.append(f"json-ld: {page}, {len(blocks)} block(s) parsed")


# 4. In-page anchors -----------------------------------------------------
# The guide's contents list is hand-written, and renaming a heading without
# its anchor leaves a link that goes nowhere.
def check_anchors():
    for page in PAGES:
        html = read(page)
        ids = set(re.findall(r'\bid="([^"]+)"', html))
        targets = {h for h in re.findall(r'href="#([^"]+)"', html) if h}
        missing = sorted(targets - ids)
        if missing:
            fail("dead anchor", f"{page}: {', '.join('#' + m for m in missing)}")
        notes.append(f"anchors: {page}, {len(targets)} checked")


# 5. Cache busting -------------------------------------------------------
# index.html asks for style.css and generator.js with a ?v= query, and says
# in its own comment to bump it whenever either file changes. Forgetting is
# invisible locally and serves a returning visitor a stale stylesheet.
def check_cache_bust(base):
    if not base:
        notes.append("cache bust: skipped, no base ref to compare against")
        return
    changed = subprocess.run(
        ["git", "diff", "--name-only", f"{base}...HEAD"],
        cwd=ROOT, text=True, capture_output=True,
    )
    if changed.returncode != 0:
        notes.append("cache bust: skipped, base ref unavailable")
        return
    touched = set(changed.stdout.split())
    if not touched:
        notes.append("cache bust: nothing changed")
        return
    before = subprocess.run(
        ["git", "show", f"{base}:index.html"], cwd=ROOT, text=True, capture_output=True
    ).stdout
    after = read("index.html")

    def version(html, asset):
        m = re.search(re.escape(asset) + r"\?v=(\d+)", html)
        return m.group(1) if m else None

    for asset in ("style.css", "generator.js"):
        if asset not in touched:
            continue
        old, new = version(before, asset), version(after, asset)
        if old is None or new is None:
            fail("cache bust", f"no ?v= found for {asset}")
        elif old == new:
            fail("cache bust", f"{asset} changed but its ?v= is still {new}")
        else:
            notes.append(f"cache bust: {asset} {old} -> {new}")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else None
    check_inline_js()
    check_duplicate_ids()
    check_json_ld()
    check_anchors()
    check_cache_bust(base)

    for n in notes:
        print(f"  ok  {n}")
    if failures:
        print()
        for f in failures:
            print(f"FAIL  {f}")
        print(f"\n{len(failures)} check(s) failed.")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
