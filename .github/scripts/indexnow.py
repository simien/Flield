"""Tell IndexNow which pages a push to main changed.

IndexNow is the protocol Bing, Yandex, and others use to learn that a page
changed without waiting for their next crawl. Google does not use it. A
site proves it may submit URLs by serving a key file from its root, and
the key is public by design: the file is the proof, not a secret.

The deploy pipeline is a push to main, so this runs from CI after one.
Cloudflare's build has taken six minutes from push to live, so the script
waits up to fifteen for the key file to come back from the live site
before submitting, and then a short grace period on top so the build that
carried this push has most likely finished. It is a heuristic: nothing in the deploy exposes a version to
poll for. Getting it wrong costs nothing but an early recrawl.

Usage:

    python3 .github/scripts/indexnow.py <changed file> [<changed file> ...]

With no arguments every page is submitted, which is what a first push or
a force push wants.
"""

import json
import sys
import time
import urllib.error
import urllib.request

HOST = "flield.com"
KEY = "bd26fbe3c33d856468a3f59caa78f297"
KEY_URL = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"

# Which page a file's change is visible on. Assets shared by every page
# are attributed to the home page, which is the one that matters for
# search, rather than fanning out to all five.
PAGES = {
    "/": {"index.html", "style.css", "generator.js"},
    "/guide/": {"guide/index.html", "guide.css"},
    "/flow-fields/": {"flow-fields/index.html"},
    "/seamless-backgrounds/": {"seamless-backgrounds/index.html"},
    "/animated-backgrounds/": {"animated-backgrounds/index.html"},
}

DEPLOY_WAIT_S = 900
DEPLOY_GRACE_S = 90


def changed_pages(files):
    if not files:
        return list(PAGES)
    changed = set(files)
    return [path for path, owned in PAGES.items() if owned & changed]


def wait_for_key_file():
    deadline = time.time() + DEPLOY_WAIT_S
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(KEY_URL, timeout=15) as res:
                if res.status == 200 and res.read().decode().strip() == KEY:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(15)
    return False


def submit(paths):
    body = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_URL,
        "urlList": [f"https://{HOST}{p}" for p in paths],
    }).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
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
    if not wait_for_key_file():
        print(f"indexnow: {KEY_URL} not served within {DEPLOY_WAIT_S}s, giving up")
        return 1
    time.sleep(DEPLOY_GRACE_S)
    status = submit(paths)
    print(f"indexnow: HTTP {status} for {', '.join(paths)}")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
