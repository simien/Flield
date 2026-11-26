// Test for core.js, run by checks.py.
//
// A shared link is out of reach the moment someone pastes it, and a codec
// that goes wrong still hands back a link and still opens a picture, just
// not the one that was shared. So this holds the codec to links recorded
// from the app, round-trips random compositions through it, and reads
// links written before each tail field existed. It also checks the speed
// and depth scales, the GIF frame cuts and the color conversions, which
// links and exports both lean on.
//
//   node .github/scripts/core.test.js [--print]
//
// The menus' option orders and the sliders' bounds come from index.html,
// as the app reads them off the page, so the test sees the format the
// site serves. A golden line that stops matching is a broken link format,
// not something to re-record: every link already shared reads that way.
// --print writes the lines for a link added to the list on purpose.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const printing = process.argv.includes("--print");
const C = new Function(fs.readFileSync(path.join(ROOT, "core.js"), "utf8") + "\nreturn FlieldCore;")();
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const failures = [];
const fail = (what) => failures.push(what);

// --- The page, as linkPage() in app.js reads it -------------------------
function options(tag) {
  const block = html.match(new RegExp(tag + "[^>]*>([\\s\\S]*?)</select>"));
  if (!block) throw new Error(`no ${tag} in index.html`);
  return [...block[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
}
function slider(id) {
  const tag = html.match(new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`));
  if (!tag) throw new Error(`no #${id} slider in index.html`);
  const attr = (name) => parseInt(tag[0].match(new RegExp(`\\b${name}="(-?\\d+)"`))[1], 10);
  return { min: attr("min"), max: attr("max"), value: attr("value") };
}
const depth = slider("depth");
const page = {
  options: {
    shapeMask: options('<select id="shapeMask"'),
    motion: options('<select id="motion"'),
    symmetry: options('<select class="l-symmetry"'),
    texture: options('<select class="l-texture"'),
    layerMotion: options('<select class="l-motion"'),
  },
  depth: { min: depth.min, max: depth.max, defaultIndex: depth.value },
  defaultSpeedStep: slider("speed").value,
};

// FNV-1a over a decoded link's JSON: short enough to keep a line each.
function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

// --- Recorded links ------------------------------------------------------
// Ten links the app wrote on 26 November 2026 (881c478, before core.js
// existed), each with the checksum of what the app decoded it to. Between
// them they cover a link that offers to play at a legacy speed and at one
// between them, a reversed motion with collide, a layer's own motion, a
// seed packed and a seed spelled out in three-byte characters, a texture
// lock, a shape with a direction, and the longest of 400.
const GOLDEN = [
  ["plain, packed seeds", "FidSEAfzABAVxBAIzFCi0hem6kp9MiAAtDeqtggwDJgEpLn53fZRYHBusVYwAFob1VsEkAZR7MMNIGsrRK7E", "ef207b4b"],
  ["autoplay at a legacy speed", "EhJj4AfdAJwAiuxSAgODtioiP-YaC44AtDeqtgnQDKqC9Oqg5C3IqisOxdQAAFob1VsEKAZNzzVQluKTRMBI", "ccfa0886"],
  ["autoplay between legacy speeds", "EHODcAdNAE7QpCQgIBHIOK9MV3hFrGAAtDeqtgowDJOARCJpTEmbqhIDZR0XAFob1VsEcAZTZByFOpWWxYAC", "81c14e3b"],
  ["reverse with collide", "EcthsAugAFYVyhRGDBSPIbDhyCp9MioAtDeqtgggDKcEpWgx5eU1oubnCy1wAFob1VsEkAZXjMUtISMYpPRA", "2ef16825"],
  ["a layer with its own motion", "FZC04AP3AEKBZjcAIIS8Ubx4oqebdOAAtDeqtgmgDJgD5FyoCNzZWVkIHdpdGggc3BhY2VzIDAuMzY3Njc4MDg5NTA0MDI5OdXYJkAFob1VsE0AZJptUZgQTwRODCA", "50c0f5ea"],
  ["a three-byte seed", "EkIhQA7fAEAAShCg4SBe88rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGXqfuEALQ3qrYIgAyIBlMS0MS_QfdS9070kABaG9VbBTgGQWJNGV8TFWWOTg", "542770d6"],
  ["a seed typed with spaces", "FiM0EAZLADfQZDEhcgCK3MCKsVEbBioAtDeqtgggDJrCE8SoCNzZWVkIHdpdGggc3BhY2VzIDAuNzgzMTY1MjIwNTE5NzUxOegsPEAFob1VsEkAZXgFy-I2wYhMQOA", "c6fe0025"],
  ["a texture lock", "FidSEAIeAK41yhLAReCZ6N0zLaiqHUYAtDeqtgnwDJgAVLyoXfZRYHBtIu7AAFob1VsEUAZJptMOey1Yxiao", "10e9c49a"],
  ["a shape with a direction", "FZC04BDUAJbAqrNKoFDFCkey1zxrRiQAtDeqtgqgDKDGlnukCNzZWVkIHdpdGggc3BhY2VzIDAuMzY3Njc4MDg5NTA0MDI5OYvebRAFob1VsE0AZRgbHRhE3gxOBMA", "14054329"],
  ["the longest", "ExNiIAwzAK9gbghUCGBz88rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGc8rGW3IROALQ3qrYIQAyDxTKiFQjc2VlZCB3aXRoIHNwYWNlcyAwLjI3ODM0NzU0NzQxMjY4NjLxYlhwBaG9VbBNAGUTEILeZcWWWSDA", "a9775c4a"],
];
for (const [label, link, want] of GOLDEN) {
  let decoded;
  try {
    decoded = C.decodeCompact(link, page);
  } catch (err) {
    fail(`golden "${label}": ${err.message}`);
    continue;
  }
  const got = fnv(JSON.stringify(decoded));
  if (printing) console.log(`  [${JSON.stringify(label)}, ${JSON.stringify(link)}, "${got}"],`);
  else if (got !== want) fail(`golden "${label}" decodes to ${got}, recorded ${want}`);
  if (C.encodeCompact(decoded, page) !== link) fail(`golden "${label}" does not encode back to its own link`);
}
if (printing) process.exit(0);

// --- Random compositions -------------------------------------------------
// mulberry32, as generator.js seeds with, so a failure names a composition
// that can be made again.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function composition(random) {
  const int = (n) => Math.floor(random() * n);
  const one = (list) => list[int(list.length)];
  const color = () => "#" + int(0x1000000).toString(16).padStart(6, "0");
  const seed = () =>
    random() < 0.7
      ? int(36 ** 8).toString(36).padStart(8, "0")
      : random() < 0.5
        ? "界".repeat(1 + int(85))
        : "typed seed " + int(1e6);
  const layer = () => {
    const out = { seed: seed(), color: color(), symmetry: one(page.options.symmetry) };
    // Any value a field's bits can hold, on its own step.
    C.COMPACT_LAYER_NUMBERS.forEach(([key, bits, offset, scale]) => {
      out[key] = (int(2 ** bits) + offset) / scale;
    });
    out.texture = one(page.options.texture);
    out.motion = one(page.options.layerMotion);
    return out;
  };
  const shapeMask = one(page.options.shapeMask);
  const directions = C.SHAPE_MASK_DIRECTIONS[shapeMask] || [];
  const snapshot = {
    v: 2,
    bgColor: color(),
    width: int(2 ** C.COMPACT_BITS.size),
    height: 1 + int(2 ** C.COMPACT_BITS.size - 1),
    blockSize: int(2 ** C.COMPACT_BITS.blockSize),
    shapeMask,
    shapeMaskDirection: directions.length ? one(directions).value : "",
    motion: one(page.options.motion),
    depth: C.depthValue(page.depth.min + int(page.depth.max - page.depth.min + 1)),
    direction: one(["forward", "reverse"]),
    collide: int(11) / 10,
    locks: C.COMPACT_LOCK_IDS.concat(["layerA-texture", "layerB-texture"]).filter(() => random() < 0.3),
    layerA: layer(),
    layerB: layer(),
    speed: C.speedMs(int(C.SPEED_MAX_STEP + 1)),
    interval: C.speedMs(int(C.SPEED_MAX_STEP + 1)),
  };
  if (random() < 0.3) snapshot.autoplay = Number(one(C.LEGACY_AUTO_SPEEDS));
  return snapshot;
}

// Every field a composition carries must come back as it went in. The
// lock order is the stream's, not the composition's, so locks compare as
// a set; depth's default comes back as 0, "this link says nothing".
function sameAsWritten(snapshot, decoded) {
  const differs = [];
  for (const key of ["bgColor", "width", "height", "blockSize", "shapeMask", "shapeMaskDirection", "motion", "direction", "collide", "speed", "interval", "autoplay"]) {
    if (decoded[key] !== snapshot[key]) differs.push(key);
  }
  const wantDepth = C.depthIndex(snapshot.depth, page.depth.min, page.depth.max) === page.depth.defaultIndex ? 0 : snapshot.depth;
  if (decoded.depth !== wantDepth) differs.push("depth");
  if ([...decoded.locks].sort().join() !== [...snapshot.locks].sort().join()) differs.push("locks");
  for (const prefix of ["layerA", "layerB"]) {
    for (const [key, value] of Object.entries(snapshot[prefix])) {
      if (decoded[prefix][key] !== value) differs.push(`${prefix}.${key}`);
    }
  }
  return differs;
}

const ROUNDS = 3000;
const random = rng(20261126);
let lengths = new Set();
for (let i = 0; i < ROUNDS; i++) {
  const snapshot = composition(random);
  const link = C.encodeCompact(snapshot, page);
  lengths.add(link.length);
  const decoded = C.decodeCompact(link, page);
  const differs = sameAsWritten(snapshot, decoded);
  if (differs.length) {
    fail(`composition ${i}: ${differs.slice(0, 4).join(", ")} came back different`);
    if (failures.length > 8) break;
  }
  if (C.encodeCompact(decoded, page) !== link) fail(`composition ${i}: its decoded link encodes to a different link`);
}

// --- Older links ---------------------------------------------------------
// A link written before a tail field existed stops short of it, and the
// field must read as zero: what the link meant before the field was added.
// Each composition is written with only the first k tail fields, as an
// older Flield wrote it, and read by today's decoder.
const TAIL = C.COMPACT_TAIL_FIELDS.slice();
function zeroMeaning(key, decoded, snapshot) {
  if (key === "speed" || key === "interval") return decoded[key] === snapshot.autoplay;
  if (key === "depth") return decoded.depth === 0;
  if (key === "direction") return decoded.direction === "forward";
  if (key === "collide") return decoded.collide === 0;
  if (key.startsWith("lock:")) return !decoded.locks.includes(key.slice(5));
  const layer = decoded[key.split("-")[0]];
  if (key.endsWith("-motion")) return layer.motion === page.options.layerMotion[0];
  return layer.texture === page.options.texture[0];
}
let older = 0;
const olderRandom = rng(1126);
for (let k = 0; k < TAIL.length; k++) {
  for (let i = 0; i < 40; i++) {
    const snapshot = composition(olderRandom);
    C.COMPACT_TAIL_FIELDS.length = k;
    let short;
    try {
      short = C.encodeCompact(snapshot, page);
    } finally {
      C.COMPACT_TAIL_FIELDS.length = 0;
      C.COMPACT_TAIL_FIELDS.push(...TAIL);
    }
    let decoded;
    try {
      decoded = C.decodeCompact(short, page);
    } catch (err) {
      fail(`a link written with ${k} tail field(s) does not open: ${err.message}`);
      continue;
    }
    older++;
    const full = C.decodeCompact(C.encodeCompact(snapshot, page), page);
    // What the older link carried reads as it does in today's link.
    for (const key of ["bgColor", "width", "height", "shapeMask", "motion"]) {
      if (decoded[key] !== full[key]) fail(`a link with ${k} tail field(s) reads ${key} differently`);
    }
    // What it never carried reads as zero, however its padding fell.
    TAIL.slice(k).forEach(([key]) => {
      if (!zeroMeaning(key, decoded, snapshot)) fail(`a link with ${k} tail field(s) reads ${key} out of its padding`);
    });
  }
}

// A link cut short by hand or by a chat app ends partway through a field,
// and the bits left over belong to that field, not to the next. Every
// field the cut reaches, and every one after it, must read as zero; the
// fields it leaves whole read as written. Packed seeds only, so where each
// tail field starts in the stream can be counted.
const layerBits = 1 + C.COMPACT_BITS.seedPacked + C.COMPACT_BITS.color + C.COMPACT_BITS.symmetry +
  C.COMPACT_LAYER_NUMBERS.reduce((sum, [, bits]) => sum + bits, 0);
const headBits = ["version", "bgColor", "size", "size", "blockSize", "shapeMask", "shapeMaskDirection", "motion", "autoSpeed"]
  .reduce((sum, key) => sum + C.COMPACT_BITS[key], 0) + C.COMPACT_LOCK_IDS.length + 2 * layerBits;
let cut = 0;
const cutRandom = rng(2611);
for (let i = 0; i < 300; i++) {
  const snapshot = composition(cutRandom);
  snapshot.layerA.seed = "a1b2c3d4";
  snapshot.layerB.seed = "z9y8x7w6";
  const link = C.encodeCompact(snapshot, page);
  const full = C.decodeCompact(link, page);
  for (let drop = 1; drop <= 7; drop++) {
    const short = link.slice(0, link.length - drop);
    // One character past a multiple of four is not base64 at all: no
    // byte ends there. The app refuses those with "Couldn't open that
    // link", which is right, so they are not the case here.
    if (short.length % 4 === 1) continue;
    const available = Math.floor((short.length * 6) / 8) * 8;
    if (available < headBits) break;
    let decoded;
    try {
      decoded = C.decodeCompact(short, page);
    } catch (err) {
      fail(`a link cut ${drop} character(s) short does not open: ${err.message}`);
      continue;
    }
    cut++;
    let at = headBits;
    let reached = false;
    TAIL.forEach(([key, bits]) => {
      reached = reached || at + bits > available;
      at += bits;
      const zero = zeroMeaning(key, decoded, snapshot);
      if (reached && !zero) fail(`a link cut ${drop} character(s) short reads ${key} from bits that are not its own`);
      if (!reached && JSON.stringify(tailValue(key, decoded)) !== JSON.stringify(tailValue(key, full))) {
        fail(`a link cut ${drop} character(s) short loses ${key}, which it still holds whole`);
      }
    });
  }
}
function tailValue(key, decoded) {
  if (key.startsWith("lock:")) return decoded.locks.includes(key.slice(5));
  if (key.includes("-")) return decoded[key.split("-")[0]][key.endsWith("-motion") ? "motion" : "texture"];
  return decoded[key];
}

// --- Speed and depth -------------------------------------------------------
for (let step = 0; step <= C.SPEED_MAX_STEP; step++) {
  if (C.speedStep(C.speedMs(step)) !== step) fail(`speed step ${step} does not survive speedMs and back`);
}
if (C.speedMs(0) !== C.SPEED_BASE_MS || C.speedMs(C.SPEED_PER_DOUBLING) !== 2 * C.SPEED_BASE_MS) {
  fail("speedMs no longer doubles every SPEED_PER_DOUBLING steps from SPEED_BASE_MS");
}
for (let i = page.depth.min; i <= page.depth.max; i++) {
  if (C.depthIndex(C.depthValue(i), page.depth.min, page.depth.max) !== i) fail(`depth index ${i} does not survive depthValue and back`);
}

// --- GIF frames --------------------------------------------------------------
// The delays are cut from rounded edges so a pass adds up to its cycle:
// within 5 ms, no frame under the 20 ms a browser honors, and the phases
// rising from 0 to under 1.
let cuts = 0;
for (let step = 0; step <= C.SPEED_MAX_STEP; step++) {
  const cycleMs = C.speedMs(step);
  for (const [beats, pixels] of [[1, 1200 * 630], [3, 1200 * 630], [5, 1920 * 1080], [1, 4096 * 4096]]) {
    const frames = C.beatFrames(beats, cycleMs, pixels);
    let total = 0;
    let last = -1;
    for (let i = 0; i < frames; i++) {
      const delay = C.frameDelay(i, frames, cycleMs);
      const phase = C.framePhase(i, frames, cycleMs);
      if (delay < C.MIN_GIF_DELAY_MS) fail(`${cycleMs} ms over ${frames} frames holds frame ${i} for ${delay} ms`);
      if (!(phase > last && phase < 1)) fail(`${cycleMs} ms over ${frames} frames puts frame ${i} at phase ${phase}`);
      total += delay;
      last = phase;
    }
    if (Math.abs(total - cycleMs) > 5) fail(`${cycleMs} ms over ${frames} frames adds up to ${total} ms`);
    cuts++;
  }
}

// --- Color -------------------------------------------------------------------
// The picker shows a hex as HSL and writes HSL back as hex; a color that
// does not survive the trip drifts a step each time it is opened.
let colors = 0;
for (let r = 0; r < 256; r += 15) {
  for (let g = 0; g < 256; g += 15) {
    for (let b = 0; b < 256; b += 15) {
      const hex = C.rgbToHex(r, g, b);
      const { h, s, l } = C.hexToHsl(hex);
      if (C.hslToHex(h, s, l) !== hex) fail(`${hex} comes back from HSL as ${C.hslToHex(h, s, l)}`);
      colors++;
    }
  }
}
if (C.formatColorValue("#ff8000", "rgb") !== "rgb(255, 128, 0)") fail("formatColorValue rgb");
if (C.formatColorValue("#ff8000", "hsl") !== "hsl(30, 100%, 50%)") fail("formatColorValue hsl");
if (C.hueDistance(350, 10) !== 20) fail("hueDistance does not wrap at 360");

// --- The brand mark ------------------------------------------------------
// favicon.svg and the app's tab icon are one shape: the file is drawn in
// the brand colors, the app paints brandMarkCells in the composition's.
// Read the file's cells back and hold them to the function, so neither
// can be redrawn without the other.
{
  const svg = fs.readFileSync(path.join(ROOT, "favicon.svg"), "utf8");
  const fileCells = new Uint8Array(256);
  const codes = { "#d9f25a": 1, "#1fa97a": 2 };
  for (const m of svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"/gi)) {
    for (const r of m[2].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)/g)) {
      const [x, y, w, h] = r.slice(1).map(Number);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) fileCells[(y + j) * 16 + x + i] = codes[m[1].toLowerCase()];
    }
  }
  const mark = C.brandMarkCells(16);
  const differ = mark.reduce((n, c, i) => n + (c !== fileCells[i]), 0);
  if (differ) fail(`favicon.svg differs from brandMarkCells(16) in ${differ} of 256 cells`);
  const marked = mark.reduce((n, c) => n + (c > 0), 0);
  if (marked < 64) fail(`brandMarkCells(16) fills only ${marked} cells`);
  for (let i = 0; i < 256; i++) {
    if (mark[i] && mark[255 - i] !== 3 - mark[i]) { fail("brandMarkCells(16) lost its point symmetry"); break; }
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 12)) console.error(f);
  process.exit(1);
}
console.log(
  `${GOLDEN.length} recorded links hold, ${ROUNDS} compositions round-trip (${Math.min(...lengths)} to ${Math.max(...lengths)} characters), ` +
    `${older} older links and ${cut} cut ones read, ${cuts} GIF cuts add up, ${colors} colors survive HSL`
);
