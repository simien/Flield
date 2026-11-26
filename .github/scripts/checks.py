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

import base64
import hashlib
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
# The app's script moved out to files of its own (SCRIPTS), where the same
# SyntaxError does the same damage, so they are parsed alongside the inline
# blocks.
# The app's own scripts, in the order index.html loads them. Every list
# below that needs them reads this one.
SCRIPTS = ["core.js", "hold.js", "app.js", "picker.js", "tutorial.js"]


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
    for rel in SCRIPTS:
        proc = subprocess.run(["node", "--check", str(ROOT / rel)], text=True, capture_output=True)
        if proc.returncode != 0:
            err = next((l for l in proc.stderr.splitlines() if "Error:" in l), "syntax error").strip()
            fail("inline js", f"{rel}: {err}")
        else:
            notes.append(f"inline js: {rel} parsed")


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
# style.css, generator.js and the SCRIPTS from the app, guide.css and
# generator.js from the document pages, and the screenshot from all of them
# plus the README. gif-writer.js is asked for by app.js rather than by
# markup, on the first GIF export, and is held to the same rule, so the
# SCRIPTS are read for numbers as the pages are.
# Forgetting to bump is invisible locally and serves a returning visitor a
# stale copy; bumping one page and not another is how 404.html served an
# older guide.css than the guide did; bumping without a change throws away
# every visitor's cache for nothing. All three are caught here.
ASSET_REF = re.compile(
    r"\b(style\.css|generator\.js|"
    + "|".join(re.escape(rel) for rel in SCRIPTS)
    + r"|gif-writer\.js|guide\.css|screenshot(?:-\d+)?\.(?:png|webp))\?v=(\d+)"
)
VERSIONED = PAGES + SCRIPTS + ["README.md"]
# The files behind each versioned name. The screenshot's png and its webp
# copies are cut from one capture and share one number, so they count as
# one asset.
ASSET_FILES = {
    "style.css": {"style.css"},
    "generator.js": {"generator.js"},
    **{rel: {rel} for rel in SCRIPTS},
    "gif-writer.js": {"gif-writer.js"},
    "guide.css": {"guide.css"},
    "screenshot": {"screenshot.png", "screenshot.webp", "screenshot-800.webp"},
}


def asset_versions(text_for):
    """{asset: {page: {versions}}} across every file that references one."""
    found = {}
    for page in VERSIONED:
        for asset, v in ASSET_REF.findall(text_for(page)):
            # screenshot-800.webp included: one capture, one number.
            key = "screenshot" if asset.startswith("screenshot") else asset
            found.setdefault(key, {}).setdefault(page, set()).add(int(v))
    return found


def stale_on_base(asset, files, was, base):
    """True when the asset changed on base after its ?v=was was first set.

    A push that changed a file without bumping it fails here, but once it is
    on main the follow-up that bumps it changes no asset file, so it would
    read as a needless bump and fail too. Only a force-push could pass, which
    is the wrong fix. The first commit to request ?v=was is where that number
    was set; numbers only rise, so the earliest is the right one. If the asset
    changed after it, the bump was owed and this push pays it.
    """
    name = r"screenshot[^?\"' ]*" if asset == "screenshot" else re.escape(asset)
    set_at = subprocess.run(
        ["git", "log", "--reverse", "--format=%H", "-G", rf"{name}\?v={was}\b",
         base, "--", *VERSIONED],
        cwd=ROOT, text=True, capture_output=True,
    ).stdout.split()
    if not set_at:
        return False
    since = subprocess.run(
        ["git", "diff", "--name-only", f"{set_at[0]}..{base}", "--", *sorted(files)],
        cwd=ROOT, text=True, capture_output=True,
    ).stdout.split()
    return bool(since)


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
        elif was != is_now and stale_on_base(asset, files, was, base):
            notes.append(f"cache bust: {asset} {was} -> {is_now}, catching up a missed bump")
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
# The widths live in COMPACT_BITS and COMPACT_LAYER_NUMBERS in core.js, and
# the menus and sliders they must hold in index.html, so the three files
# are read as one text. A revision from before core.js and app.js existed
# had all of it in index.html, at a deeper indent, which the patterns
# below allow for.
LAYER_CONTROL = r'<(?:input|select)[^>]*\bclass="l-{}"[^>]*>'


def parse_link_format(html):
    """The format as data: bit widths, layer fields, and the option lists."""
    bits = dict(
        (m.group(1), int(m.group(2)))
        for m in re.finditer(
            r"^\s+(\w+): (\d+),$",
            re.search(r"const COMPACT_BITS = \{(.*?)\n\s*\};", html, re.S).group(1),
            re.M,
        )
    )
    layers = [
        (k, int(b), int(o), int(sc))
        for k, b, o, sc in re.findall(
            r'\["(\w+)", (\d+), (-?\d+), (\d+)\]',
            re.search(r"const COMPACT_LAYER_NUMBERS = \[(.*?)\n\s*\];", html, re.S).group(1),
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
    dirs = re.search(r"const SHAPE_MASK_DIRECTIONS = \{(.*?)\n\s*\};", html, re.S).group(1)
    choices["shapeMaskDirection"] = max(
        (re.findall(r'value: "([^"]*)"', shape.group(2)) for shape in
         re.finditer(r"(\w+): \[(.*?)\],\n", dirs, re.S)),
        key=len, default=[],
    )
    lock_src = re.search(
        r"const COMPACT_LOCK_IDS = \[(.*?)\n\s*\);", html, re.S
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
    tail_src = re.search(r"const COMPACT_TAIL_FIELDS = \[(.*?)\n\s*\];", html, re.S)
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


def app_source(show):
    """index.html, core.js and app.js as one text, read through show(rel)."""
    return "\n".join(show(rel) for rel in ("index.html", "core.js", "app.js"))


def check_link_format():
    html = app_source(read)
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

    # Four tail fields take a plain number of bits rather than a
    # COMPACT_BITS entry, so nothing above ties them to their controls.
    # Direction and each layer's Motion travel as a menu index; Collide
    # as its slider's value, zero for off; Depth as its slider's value
    # plus one, keeping zero for the default.
    tail_bits = dict(fmt["tail"])

    def menu_fits(field, pattern):
        block = re.search(pattern + r"(.*?)</select>", html, re.S)
        if not block:
            fail("link format", f"no menu found for tail field {field}")
            return
        options = re.findall(r'<option value="([^"]*)"', block.group(1))
        room = 2 ** tail_bits.get(field, 0)
        if len(options) > room:
            fail("link format", f"{field} has {len(options)} options, {tail_bits.get(field, 0)} tail bits hold {room}")

    def slider_fits(field, plus):
        tag = re.search(r'<input[^>]*\bid="%s"[^>]*>' % field, html)
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', tag.group(0))) if tag else {}
        if "max" not in attrs:
            fail("link format", f"no {field} slider with a max to check against its tail bits")
            return
        top = int(attrs["max"]) + plus
        room = 2 ** tail_bits.get(field, 0) - 1
        if top > room or int(attrs.get("min", 0)) < 0:
            fail("link format", f"{field} slider writes up to {top}, {tail_bits.get(field, 0)} tail bits hold {room}")

    menu_fits("direction", r'<select id="direction"')
    for prefix in ("layerA", "layerB"):
        menu_fits(f"{prefix}-motion", r'<select class="l-motion"')
    slider_fits("collide", 0)
    slider_fits("depth", 1)

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
# link ever shared. A menu or the tail may grow at its end. The lock ids
# and the layer fields may not grow at all: both sit ahead of the tail, so
# one more of either shifts every field behind it, and an old link's tail
# would be read from the wrong bits. A new one of those goes in the tail.
#
# Bumping COMPACT_VERSION is the way to say a break is deliberate; the
# decoder refuses a version it doesn't know, so old links stop rather than
# opening the wrong picture, and this check stands down.
def check_link_compat(base, current):
    if not base:
        notes.append("link compat: skipped, no base ref to compare against")
        return
    def show(rel):
        return subprocess.run(
            ["git", "show", f"{base}:{rel}"], cwd=ROOT, text=True, capture_output=True
        )

    before = show("index.html")
    if before.returncode != 0:
        notes.append("link compat: skipped, base ref unavailable")
        return
    try:
        old = parse_link_format(app_source(lambda rel: show(rel).stdout))
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
    for what, was, now in (
        ("lock ids", old["locks"], current["locks"]),
        ("layer fields", [f[0] for f in old["layers"]], [f[0] for f in current["layers"]]),
    ):
        appended_only(what, was, now)
        if now[: len(was)] == was and len(now) > len(was):
            fail(
                "link compat",
                f"{what}: {now[len(was)]!r} was added. These sit ahead of the "
                "tail, so every field after them shifts; add it as a tail field "
                "instead, or bump COMPACT_VERSION",
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


# 8. IndexNow ------------------------------------------------------------
# A push to main tells IndexNow which pages changed (indexnow.yml and
# indexnow.py). Three things have to agree and nothing else ties them
# together: the key file at the root must carry the key the script sends,
# every page the script can submit must be one the sitemap lists, and the
# workflow must trigger on exactly the files the script attributes to a
# page. A mismatch is silent: Bing is told about a page that does not
# exist, or a page changes and nothing is sent.
def check_indexnow():
    sys.path.insert(0, str(ROOT / ".github" / "scripts"))
    import indexnow

    key_file = ROOT / f"{indexnow.KEY}.txt"
    if not key_file.exists():
        fail("indexnow", f"key file {key_file.name} is missing from the repo root")
    elif key_file.read_text(encoding="utf-8").strip() != indexnow.KEY:
        fail("indexnow", f"{key_file.name} does not contain the key indexnow.py sends")

    locs = set(re.findall(r"<loc>https://flield\.com(/[^<]*)</loc>", read("sitemap.xml")))
    for path in indexnow.PAGES:
        if path not in locs:
            fail("indexnow", f"{path} can be submitted but is not in sitemap.xml")

    owned = set()
    for files in indexnow.PAGES.values():
        for rel in files:
            owned.add(rel)
            if not (ROOT / rel).exists():
                fail("indexnow", f"{rel} is in the PAGES table but not in the repo")

    workflow = read(".github/workflows/indexnow.yml")
    block = re.search(r"paths:\n((?:\s+- .*\n)+)", workflow)
    triggers = set(re.findall(r"- (\S+)", block.group(1))) if block else set()
    for rel in sorted(owned - triggers):
        fail("indexnow", f"{rel} is in the PAGES table but not in the workflow's paths")
    for rel in sorted(triggers - owned):
        fail("indexnow", f"{rel} triggers the workflow but no page claims it")

    if not any(f.startswith("indexnow") for f in failures):
        notes.append(
            f"indexnow: key file at root, {len(indexnow.PAGES)} pages in the sitemap, "
            f"{len(owned)} files agree with the workflow"
        )


# 9. Sitemap dates --------------------------------------------------------
# lastmod is what tells a search engine a page is worth fetching again.
# It was two changes behind on two pages and nothing noticed: the page
# ships, the date does not. Each page's lastmod must be no earlier than
# the last commit that touched it. Locally that commit is the previous
# one, so this passes before you commit; CI runs after, so it catches a
# page that shipped without its date.
SITEMAP_PAGES = {
    "/": "index.html",
    "/guide/": "guide/index.html",
    "/flow-fields/": "flow-fields/index.html",
    "/seamless-backgrounds/": "seamless-backgrounds/index.html",
    "/animated-backgrounds/": "animated-backgrounds/index.html",
}


def check_json_ld_dates():
    # A page's JSON-LD dateModified tells a search engine the same thing
    # the sitemap's lastmod does, and the two had drifted three weeks
    # apart. The sitemap is the one the check below keeps true, so the
    # JSON-LD follows it. Pages with no dateModified are left alone.
    entries = dict(re.findall(
        r"<loc>https://flield\.com(/[^<]*)</loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>",
        read("sitemap.xml"),
    ))
    checked = 0
    for path, rel in SITEMAP_PAGES.items():
        found = re.search(r'"dateModified":\s*"([^"]*)"', read(rel))
        if not found:
            continue
        checked += 1
        if found.group(1) != entries.get(path):
            fail("json-ld dates", f"{rel} dateModified {found.group(1)}, sitemap lastmod {entries.get(path)}")
    if not any(f.startswith("json-ld dates") for f in failures):
        notes.append(f"json-ld dates: dateModified matches lastmod on {checked} pages")


def check_sitemap_dates():
    # A shallow clone grafts history at its oldest commit, so git log names
    # that commit for every file and every page looks changed on its date.
    # The deploy build may clone shallow; CI clones at full depth and keeps
    # this check honest.
    shallow = subprocess.run(
        ["git", "rev-parse", "--is-shallow-repository"],
        cwd=ROOT, text=True, capture_output=True,
    ).stdout.strip()
    if shallow == "true":
        notes.append("sitemap dates: skipped, shallow clone")
        return
    sitemap = read("sitemap.xml")
    entries = dict(re.findall(
        r"<loc>https://flield\.com(/[^<]*)</loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>",
        sitemap,
    ))
    stale = []
    for path, rel in SITEMAP_PAGES.items():
        lastmod = entries.get(path)
        if not lastmod:
            fail("sitemap dates", f"{path} has no lastmod in sitemap.xml")
            continue
        changed = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", rel],
            cwd=ROOT, text=True, capture_output=True,
        ).stdout.strip()
        if changed and lastmod < changed:
            fail("sitemap dates", f"{path} changed {changed} but lastmod says {lastmod}")
            stale.append(path)
    if not stale and not any(f.startswith("sitemap dates") for f in failures):
        notes.append(f"sitemap dates: lastmod is current for all {len(SITEMAP_PAGES)} pages")


# 10. The GIF encoder ----------------------------------------------------
# gif-writer.js packs frames into a format with no slack in it: a code
# written one bit too wide, or a table restarted a code late, and every
# pixel after it is wrong. The page cannot tell. It hands over a file and
# the damage is only visible to whoever opens it, which is the kind of
# failure this script exists for. The test beside it writes frames, reads
# them back with a decoder that shares no code with the encoder, and
# compares every pixel.
def check_gif_writer():
    proc = subprocess.run(
        ["node", str(Path(__file__).with_name("gif-writer.test.js"))],
        cwd=ROOT, text=True, capture_output=True,
    )
    if proc.returncode != 0:
        for line in (proc.stderr.strip() or "the test did not run").splitlines()[:5]:
            fail("gif writer", line.strip())
        return
    notes.append(f"gif writer: {proc.stdout.strip()}")


# 11. The generator ------------------------------------------------------
# generator.js writes its noise three times over (the reference functions
# the explainer calls, the loop inlined into getFlowField for speed, and
# the warp's own sample), and every shared link and exported SVG rests on
# the three agreeing to the bit. A slip in one still draws a plausible
# picture, so nothing on screen says so. The test beside this script
# checks the copies against each other cell for cell and holds a spread
# of compositions to recorded checksums.
def check_generator():
    proc = subprocess.run(
        ["node", str(Path(__file__).with_name("generator.test.js"))],
        cwd=ROOT, text=True, capture_output=True,
    )
    if proc.returncode != 0:
        for line in (proc.stderr.strip() or "the test did not run").splitlines()[:5]:
            fail("generator", line.strip())
        return
    notes.append(f"generator: {proc.stdout.strip()}")


# 11b. The link codec and the app's arithmetic ----------------------------
# core.js holds what the app computes without the page: the shared link's
# bit stream, the speed and depth scales, the GIF frame cuts, the color
# conversions. The test beside this script holds the codec to links the
# app recorded, round-trips random compositions, reads links written
# before each tail field and links cut short, and checks the rest. A codec
# that goes wrong still writes a link that opens, to the wrong picture.
def check_core():
    proc = subprocess.run(
        ["node", str(Path(__file__).with_name("core.test.js"))],
        cwd=ROOT, text=True, capture_output=True,
    )
    if proc.returncode != 0:
        for line in (proc.stderr.strip() or "the test did not run").splitlines()[:5]:
            fail("core", line.strip())
        return
    notes.append(f"core: {proc.stdout.strip()}")


# 12. Script hashes ------------------------------------------------------
# The policy in _headers runs an inline script only if its sha256 is
# listed there, so an injected one does not run. The cost is that every
# edit to an inline script changes its hash, and a script whose hash is
# missing is blocked: the page serves 200 with a dead UI, the failure
# check 1 exists for. Every inline script on every page must be listed,
# and nothing else may be, so an old hash does not linger as an allowance.
# JSON-LD is data and never runs, so it needs none.
INLINE_SCRIPT = re.compile(
    r"<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>", re.S
)


def check_script_hashes():
    want = {}
    for page in PAGES:
        for i, code in enumerate(INLINE_SCRIPT.findall(read(page))):
            digest = base64.b64encode(hashlib.sha256(code.encode("utf-8")).digest()).decode()
            want.setdefault(f"'sha256-{digest}'", []).append(f"{page} block {i + 1}")
    policy = re.search(r"Content-Security-Policy: (.*)", read("_headers"))
    script_src = re.search(r"script-src ([^;]*)", policy.group(1)) if policy else None
    if not script_src:
        fail("script hashes", "no script-src in _headers")
        return
    listed = set(re.findall(r"'sha256-[A-Za-z0-9+/=]+'", script_src.group(1)))
    if "'unsafe-inline'" in script_src.group(1):
        fail("script hashes", "script-src allows 'unsafe-inline'; list hashes instead")
    for digest, where in sorted(want.items()):
        if digest not in listed:
            fail("script hashes", f"{', '.join(where)} is not in _headers; add {digest} to script-src")
    for digest in sorted(listed - set(want)):
        fail("script hashes", f"{digest} in _headers matches no inline script; remove it")
    if not any(f.startswith("script hashes") for f in failures):
        notes.append(f"script hashes: {len(want)} inline script(s), each listed in _headers")


# 13. Analytics ----------------------------------------------------------
# Cloudflare's edge injects nothing into a Worker's static assets, so a
# page is measured only if it carries the beacon itself. The app page had
# it and the other five did not, for two months, and nothing said so. A
# new page must carry it too, with the same token.
BEACON = re.compile(r"<script[^>]*src='https://static\.cloudflareinsights\.com/beacon\.min\.js'[^>]*data-cf-beacon='([^']*)'")


def check_analytics():
    tokens = {}
    for page in PAGES:
        found = BEACON.findall(read(page))
        if len(found) != 1:
            fail("analytics", f"{page} carries the beacon {len(found)} times, not once")
        else:
            tokens.setdefault(found[0], []).append(page)
    if len(tokens) > 1:
        fail("analytics", "pages disagree on the beacon's token: " + "; ".join(f"{v} {k}" for k, v in tokens.items()))
    if not any(f.startswith("analytics") for f in failures):
        notes.append(f"analytics: the beacon is on all {len(PAGES)} pages, one token")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else None
    check_inline_js()
    check_duplicate_ids()
    check_json_ld()
    check_anchors()
    check_cache_bust(base)
    check_link_compat(base, check_link_format())
    check_indexnow()
    check_sitemap_dates()
    check_json_ld_dates()
    check_gif_writer()
    check_generator()
    check_core()
    check_script_hashes()
    check_analytics()

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
