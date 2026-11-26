"""Tell IndexNow which pages a push to main changed.

IndexNow is the protocol Bing, Yandex, and others use to learn that a page
changed without waiting for their next crawl. Google does not use it. A
site proves it may submit URLs by serving a key file from its root, and
the key is public by design: the file is the proof, not a secret.

The deploy pipeline is a push to main, so this runs from CI after one,
while Cloudflare's build is still running. Cloudflare's build has taken
six minutes from push to live, so the script waits up to fifteen for
every changed page to serve, byte for byte, the file this push carries,
and submits only then. A page whose stylesheet or script changed matches
too, since its ?v= moved with it. It asks for the plain URL, as a crawler
does, so the edge's copy of the old HTML counts as not live yet. A deploy
that never lands (a failing check stops it) is never submitted.

This used to wait for the key file, which every deploy already serves, so
the wait returned at once and only a fixed 90 second grace stood between
the push and a crawler reading the old page.

Usage:

    python3 .github/scripts/indexnow.py <changed file> [<changed file> ...]

With no arguments every page is submitted, which is what a first push or
a force push wants.
"""

import json
import sys
from pathlib import Path
import time
import urllib.error
import urllib.request

HOST = "flield.com"
KEY = "bd26fbe3c33d856468a3f59caa78f297"
KEY_URL = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"
# Cloudflare's browser integrity check answers Python's default user agent
# with a 403 (error 1010), so the key file never came back and the first
# run gave up. A named agent is let through.
USER_AGENT = f"flield-indexnow/1 (+https://{HOST}/)"

# Which page a file's change is visible on. Assets shared by every page
# are attributed to the home page, which is the one that matters for
# search, rather than fanning out to all five.
PAGES = {
    "/": {"index.html", "style.css", "generator.js", "core.js", "hold.js", "app.js", "picker.js", "tutorial.js"},
    "/guide/": {"guide/index.html", "guide.css"},
    "/flow-fields/": {"flow-fields/index.html"},
    "/seamless-backgrounds/": {"seamless-backgrounds/index.html"},
    "/animated-backgrounds/": {"animated-backgrounds/index.html"},
}

ROOT = Path(__file__).resolve().parents[2]
DEPLOY_WAIT_S = 900
POLL_S = 15


def changed_pages(files):
    if not files:
        return list(PAGES)
    changed = set(files)
    return [path for path, owned in PAGES.items() if owned & changed]


def page_file(path):
    """The HTML file in the checkout that the live page should serve."""
    return next(f for f in PAGES[path] if f.endswith(".html"))


def live_matches(path):
    want = (ROOT / page_file(path)).read_bytes()
    try:
        req = urllib.request.Request(f"https://{HOST}{path}", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status == 200 and res.read() == want
    except (urllib.error.URLError, OSError):
        return False


def wait_for_deploy(paths):
    """Wait until every page serves this push's file; return the ones that never did."""
    pending = list(paths)
    deadline = time.time() + DEPLOY_WAIT_S
    while pending:
        pending = [p for p in pending if not live_matches(p)]
        if not pending or time.time() >= deadline:
            break
        time.sleep(POLL_S)
    return pending


def submit(paths):
    body = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_URL,
        "urlList": [f"https://{HOST}{p}" for p in paths],
    }).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status
    except urllib.error.HTTPError as err:
        return err.code


def main(argv):
    paths = changed_pages(argv)
    if not paths:
        print("indexnow: no page changed, nothing to submit")
        return 0
    stale = wait_for_deploy(paths)
    if stale:
        print(f"indexnow: {', '.join(stale)} not live within {DEPLOY_WAIT_S}s, giving up")
        return 1
    status = submit(paths)
    print(f"indexnow: HTTP {status} for {', '.join(paths)}")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
