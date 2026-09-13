#!/usr/bin/env python3
"""Structural checks for a repo with no build step and no test suite.

Run it before pushing, the same way CI does:

    python3 .github/scripts/checks.py

Every check here is for something that has actually broken this project, or
that cannot be repaired once it does: a shared link is out of your hands the
moment someone pastes it somewhere. Every one is structural rather than
stylistic, so it can't fail on taste. If a check ever starts crying wolf,
delete it. A check nobody trusts is worse than no check.
"""

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = [
    "index.html",
    "guide/index.html",
    "flow-fields/index.html",
    "seamless-backgrounds/index.html",
    "animated-backgrounds/index.html",
    "404.html",
]
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
# Every page asks for the project's own evolving files with a ?v= query:
# style.css and generator.js from the app, guide.css and generator.js from
# the document pages, and the screenshot from all of them plus the README.
# Forgetting to bump is invisible locally and serves a returning visitor a
# stale copy; bumping one page and not another is how 404.html served an
# older guide.css than the guide did; bumping without a change throws away
# every visitor's cache for nothing. All three are caught here.
ASSET_REF = re.compile(r"\b(style\.css|generator\.js|guide\.css|screenshot(?:-\d+)?\.(?:png|webp))\?v=(\d+)")
VERSIONED = PAGES + ["README.md"]
# The files behind each versioned name. The screenshot's png and its webp
# copies are cut from one capture and share one number, so they count as
# one asset.
ASSET_FILES = {
    "style.css": {"style.css"},
    "generator.js": {"generator.js"},
    "guide.css": {"guide.css"},
    "screenshot": {"screenshot.png", "screenshot.webp", "screenshot-800.webp"},
}


def asset_versions(text_for):
    """{asset: {page: {versions}}} across every file that references one."""
    found = {}
    for page in VERSIONED:
        for asset, v in ASSET_REF.findall(text_for(page)):
            key = "screenshot" if asset.startswith("screenshot.") else asset
            found.setdefault(key, {}).setdefault(page, set()).add(int(v))
    return found


def check_cache_bust(base):
    now = asset_versions(read)
    # Needs no base: one file, one number, wherever it is requested from.
    for asset, pages in sorted(now.items()):
        if len(set().union(*pages.values())) > 1:
            fail(
                "cache bust",
                f"{asset} is requested at different versions: "
                + ", ".join(f"{p} ?v={'/'.join(map(str, sorted(v)))}" for p, v in sorted(pages.items())),
            )
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
    # A file that did not exist on the base has no stale copy in anyone's
    # cache, so adding one (a new size of the screenshot, say) is not a
    # change that needs a bump.
    added = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=A", f"{base}...HEAD"],
        cwd=ROOT, text=True, capture_output=True,
    )
    touched -= set(added.stdout.split())

    def before(rel):
        shown = subprocess.run(
            ["git", "show", f"{base}:{rel}"], cwd=ROOT, text=True, capture_output=True
        )
        return shown.stdout if shown.returncode == 0 else ""

    old = asset_versions(before)
    compared = len(notes)
    for asset, files in ASSET_FILES.items():
        was = set().union(*old.get(asset, {}).values()) if old.get(asset) else set()
        is_now = set().union(*now.get(asset, {}).values()) if now.get(asset) else set()
        if not was or not is_now:
            continue
        # The highest number is the one a fixed-up page catches up to, so
        # a commit that only brings a lagging page level is not a bump.
        was, is_now = max(was), max(is_now)
        if files & touched:
            if was == is_now:
                fail("cache bust", f"{asset} changed but its ?v= is still {is_now}")
            else:
                notes.append(f"cache bust: {asset} {was} -> {is_now}")
        elif was != is_now:
            fail(
                "cache bust",
                f"{asset} did not change but its ?v= moved {was} -> {is_now}; "
                "a needless bump throws away every visitor's cache",
            )
    if len(notes) == compared:
        notes.append("cache bust: no versioned file changed")


# 6. Shared link format -------------------------------------------------
# A ?c= link is a bit stream: each value takes exactly the bits its range
# needs, one after another with nothing between them. Two edits break every
# link already shared, and every SVG carrying one, without any visible sign:
# a menu that outgrows its width wraps around (option 8 in a 3-bit field
# decodes as option 0), and a slider widened past its width pushes every
# later value out of place. Both are caught here.
#
# The widths live in COMPACT_BITS and COMPACT_LAYER_NUMBERS in index.html.
LAYER_CONTROL = r'<(?:input|select)[^>]*\bclass="l-{}"[^>]*>'


def parse_link_format(html):
    """The format as data: bit widths, layer fields, and the option lists."""
    bits = dict(
        (m.group(1), int(m.group(2)))
        for m in re.finditer(
            r"^\s{6}(\w+): (\d+),$",
            re.search(r"const COMPACT_BITS = \{(.*?)\n    \};", html, re.S).group(1),
            re.M,
        )
    )
    layers = [
        (k, int(b), int(o), int(sc))
        for k, b, o, sc in re.findall(
            r'\["(\w+)", (\d+), (-?\d+), (\d+)\]',
            re.search(r"const COMPACT_LAYER_NUMBERS = \[(.*?)\n    \];", html, re.S).group(1),
        )
    ]
    choices = {}
    for name, pattern in [
        ("shapeMask", r'<select id="shapeMask"'),
        ("motion", r'<select id="motion"'),
        ("symmetry", r'<select class="l-symmetry"'),
        ("texture", r'<select class="l-texture"'),
    ]:
        block = re.search(pattern + r"(.*?)</select>", html, re.S)
        choices[name] = re.findall(r'<option value="([^"]*)"', block.group(1)) if block else []
    # The speed menu became a slider, but old links still index into the
    # list it held, so the list stayed behind as a constant and is
    # checked here exactly as the menus above are.
    legacy = re.search(r"const LEGACY_AUTO_SPEEDS = \[(.*?)\];", html, re.S)
    if legacy:
        choices["autoSpeed"] = re.findall(r'"(\d+)"', legacy.group(1))
    else:
        block = re.search(r'<select id="autoSpeed"(.*?)</select>', html, re.S)
        choices["autoSpeed"] = re.findall(r'<option value="([^"]*)"', block.group(1)) if block else []
    # Directions are built in JS, not markup, and the widest list is the one
    # the shared 2-or-more-bit field has to hold.
    dirs = re.search(r"const SHAPE_MASK_DIRECTIONS = \{(.*?)\n    \};", html, re.S).group(1)
    choices["shapeMaskDirection"] = max(
        (re.findall(r'value: "([^"]*)"', shape.group(2)) for shape in
         re.finditer(r"(\w+): \[(.*?)\],\n", dirs, re.S)),
        key=len, default=[],
    )
    lock_src = re.search(
        r"const COMPACT_LOCK_IDS = \[(.*?)\n    \);", html, re.S
    ).group(1)
    general, prefixes, suffixes = (
        re.findall(r'"([\w-]+)"', group) for group in
        re.match(r"(.*?)\.concat\(\s*\[(.*?)\]\.flatMap\(.*?\[(.*?)\]", lock_src, re.S).groups()
    )
    locks = general + [f"{p}-{k}" for p in prefixes for k in suffixes]
    # The tail's widths are written as COMPACT_BITS lookups or as plain
    # numbers, so resolve both to the number of bits each field takes.
    # A revision from before the tail existed has none, which is the
    # empty list every tail field was appended to.
    tail_src = re.search(r"const COMPACT_TAIL_FIELDS = \[(.*?)\n    \];", html, re.S)
    tail = [
        (key, bits.get(width[len("COMPACT_BITS."):]) if width.startswith("COMPACT_BITS.") else int(width))
        for key, width in re.findall(r'\["([\w:-]+)", ([\w.]+)\]', tail_src.group(1) if tail_src else "")
    ]
    return {
        "version": re.search(r"const COMPACT_VERSION = (\d+);", html).group(1),
        "bits": bits,
        "layers": layers,
        "choices": choices,
        "locks": locks,
        "tail": tail,
    }


def check_link_format():
    html = read("index.html")
    fmt = parse_link_format(html)

    # Every menu must fit its field. autoSpeed stores index + 1, keeping 0
    # for "still", so it holds one fewer than the rest.
    for name, options in fmt["choices"].items():
        width = fmt["bits"][name]
        room = 2 ** width - (1 if name == "autoSpeed" else 0)
        if len(options) > room:
            fail("link format", f"{name} has {len(options)} options, {width} bits hold {room}")
        elif len(options) == room:
            fail("link format", f"{name} is full at {len(options)} options; widen COMPACT_BITS.{name} before adding another")

    # Every slider must fit its field, at both ends of its range.
    for key, width, offset, scale in fmt["layers"]:
        tag = re.search(LAYER_CONTROL.format(key), html)
        if not tag:
            fail("link format", f"no layer control found for {key}")
            continue
        lo = re.search(r'min="([\d.]+)"', tag.group(0))
        hi = re.search(r'max="([\d.]+)"', tag.group(0))
        if not lo or not hi:
            fail("link format", f"{key} has no min/max to check against {width} bits")
            continue
        low = round(float(lo.group(1)) * scale) - offset
        high = round(float(hi.group(1)) * scale) - offset
        if low < 0:
            fail("link format", f"{key} min {lo.group(1)} is below its offset of {offset}")
        if high > 2 ** width - 1:
            fail("link format", f"{key} max {hi.group(1)} needs {high.bit_length()} bits, has {width}")

    # A tail field read out of an old link's base64 padding comes back
    # zero, so every one of them has to mean "what this link meant
    # before the field existed" at index zero. Nothing here can check
    # what a value means, but an unresolved width is a typo'd
    # COMPACT_BITS key, which would silently misread the whole tail.
    for key, width in fmt["tail"]:
        if not width:
            fail("link format", f"tail field {key} has no width; check its COMPACT_BITS key")

    # Speed and the reroll interval are the tail fields that carry a
    # range rather than a menu index, so their top step gets the same
    # treatment the layer sliders get above. Both run on one scale and
    # are stored one higher, keeping zero for "this link says nothing
    # about that duration".
    top = int(re.search(r"const SPEED_MAX_STEP = (\d+);", html).group(1)) + 1
    for name in ("speed", "interval"):
        bits = dict(fmt["tail"]).get(name, 0)
        if top > 2 ** bits - 1:
            fail("link format", f"{name} step {top - 1} needs {top.bit_length()} bits, tail has {bits}")
        slider = re.search(r'id="%s"([^>]*)>' % name, html)
        if not slider:
            fail("link format", f"no {name} slider found to check against SPEED_MAX_STEP")
            continue
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', slider.group(1)))
        if int(attrs.get("max", -1)) != top - 1:
            fail("link format", f"the {name} slider's max and SPEED_MAX_STEP disagree")
        # A stepped slider whose min is not a multiple of its step stops
        # on values none of which is a doubling of the base, so every
        # reading comes out an odd fraction of a second.
        step = int(attrs.get("step", 1))
        if step > 1 and int(attrs.get("min", 0)) % step:
            fail("link format", f"the {name} slider's min is not a multiple of its step, so its stops are not round")

    notes.append(
        f"link format: v{fmt['version']}, {len(fmt['layers'])} layer fields, "
        f"{len(fmt['locks'])} locks, {sum(w for _, w in fmt['tail'])} tail bits, "
        "all within their widths"
    )
    return fmt


# 7. Shared link compatibility -------------------------------------------
# The widths above say a link can be *written*. This says an old one can
# still be *read*: a menu choice travels as its index and a layer field as
# its position in the stream, so reordering either silently repaints every
# link ever shared. Appending is always safe and passes quietly.
#
# Bumping COMPACT_VERSION is the way to say a break is deliberate; the
# decoder refuses a version it doesn't know, so old links stop rather than
# opening the wrong picture, and this check stands down.
def check_link_compat(base, current):
    if not base:
        notes.append("link compat: skipped, no base ref to compare against")
        return
    before = subprocess.run(
        ["git", "show", f"{base}:index.html"], cwd=ROOT, text=True, capture_output=True
    )
    if before.returncode != 0:
        notes.append("link compat: skipped, base ref unavailable")
        return
    try:
        old = parse_link_format(before.stdout)
    except AttributeError:
        notes.append("link compat: skipped, base predates the ?c= format")
        return

    if old["version"] != current["version"]:
        notes.append(
            f"link compat: COMPACT_VERSION {old['version']} -> {current['version']}, "
            "old links will be refused rather than misread"
        )
        return

    def appended_only(what, was, now):
        """Old entries must still be where they were; new ones may follow."""
        if now[: len(was)] == was:
            return
        # Point at the first thing that moved rather than printing both
        # lists: with 23 lock bits, the diff is the only readable part.
        for i, gone in enumerate(was):
            if i >= len(now):
                fail("link compat", f"{what}: {gone!r} (position {i}) was removed from the end")
                return
            if now[i] != gone:
                fail(
                    "link compat",
                    f"{what}: position {i} was {gone!r}, now {now[i]!r}. "
                    "Old links read that position as the old value, so append "
                    "instead, or bump COMPACT_VERSION to refuse them outright",
                )
                return

    for name, options in old["choices"].items():
        appended_only(f"{name} options", options, current["choices"].get(name, []))
    appended_only("lock ids", old["locks"], current["locks"])
    appended_only(
        "layer fields", [f[0] for f in old["layers"]], [f[0] for f in current["layers"]]
    )
    # The tail is the one part of the stream that may grow, and only at
    # its end: a link written before a tail field existed reads it out of
    # the padding, so anything inserted ahead of it shifts what that
    # padding decodes to.
    appended_only("tail fields", [f[0] for f in old["tail"]], [f[0] for f in current["tail"]])
    for key, width in old["tail"]:
        now = next((f for f in current["tail"] if f[0] == key), None)
        if now and now[1] != width:
            fail(
                "link compat",
                f"tail field {key} was {width} bits, now {now[1]}. Every field "
                "after it in the tail shifts. Bump COMPACT_VERSION",
            )
    for key, width, offset, scale in old["layers"]:
        now = next((f for f in current["layers"] if f[0] == key), None)
        if now and (now[1], now[2], now[3]) != (width, offset, scale):
            fail(
                "link compat",
                f"{key} was {width} bits/offset {offset}/scale {scale}, "
                f"now {now[1]}/{now[2]}/{now[3]}. Bump COMPACT_VERSION",
            )
    for name, width in old["bits"].items():
        if current["bits"].get(name) != width:
            fail(
                "link compat",
                f"COMPACT_BITS.{name} was {width}, now {current['bits'].get(name)}. "
                "Bump COMPACT_VERSION",
            )
    notes.append("link compat: every field still where old links expect it")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else None
    check_inline_js()
    check_duplicate_ids()
    check_json_ld()
    check_anchors()
    check_cache_bust(base)
    check_link_compat(base, check_link_format())

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
