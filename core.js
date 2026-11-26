// Flield's logic that needs no page: the shared link's bit stream, the
// speed and depth scales, how a GIF cuts a cycle into frames, and the
// color conversions. app.js reads it all from FlieldCore and supplies
// what only the page knows (the menus' option order, the sliders'
// bounds, the canvas size) as arguments, so node can run every line of
// it. .github/scripts/core.test.js does, and checks.py runs that.
//
// Like generator.js, this file stands alone: no DOM, no state, nothing
// from app.js. A function that needs the page belongs in app.js.
const FlieldCore = (() => {
  // --- Numbers -----------------------------------------------------------

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  // --- Speed and depth -----------------------------------------------------

  // Two durations on one scale: how long a motion cycle lasts, and how
  // long Auto-randomize waits before rerolling. They were one number
  // for a while, which was wrong. They answer different questions, and
  // a GIF only needs them reconciled in the one case where both are
  // running, which exportPlan settles by making a pass a whole motion
  // cycle rather than a reroll interval.
  //
  // Both sliders carry a step index, not milliseconds. The useful
  // range covers two orders of magnitude, and a linear millisecond
  // slider would spend four fifths of its travel above four seconds;
  // eight steps to a doubling puts the same amount of travel between
  // a quarter second and a half as between eight seconds and sixteen.
  const SPEED_BASE_MS = 250;
  const SPEED_PER_DOUBLING = 8;
  // 250ms doubled six times. Its own constant because the link's tail
  // has to be wide enough to hold every step (checks.py verifies it).
  const SPEED_MAX_STEP = 48;

  const DEPTH_STEPS_PER_UNIT = 4;
  const depthValue = (index) => index / DEPTH_STEPS_PER_UNIT;
  // The slider's index for a depth, inside the slider's own bounds, which
  // the page passes in from the markup.
  const depthIndex = (value, min, max) => Math.min(max, Math.max(min, Math.round(value * DEPTH_STEPS_PER_UNIT)));
  const formatDepth = (value) => String(value).replace(/\.?0+$/, "") + "\u00d7";
  const speedMs = (step) => Math.round(SPEED_BASE_MS * 2 ** (step / SPEED_PER_DOUBLING));
  const speedStep = (ms) =>
    Math.min(SPEED_MAX_STEP, Math.max(0, Math.round(Math.log2(ms / SPEED_BASE_MS) * SPEED_PER_DOUBLING)));
  // Two decimals below a second, where the steps are 30ms apart and a
  // single one would show two of them as the same number.
  const formatSpeed = (ms) => (ms / 1000).toFixed(ms < 1000 ? 2 : 1) + "s";

  // --- GIF frames ----------------------------------------------------------

  // The slowest the preview is allowed to repaint, 12.5 fps. It is
  // also what counts as a smooth export before the budget below trims
  // it; the cycle's length comes from the Speed slider, not from here.
  const CYCLE_FRAME_MS = 80;

  // How finely the preview samples a cycle, and the floor on how often
  // it may repaint to manage it. A fixed cadence is wrong at both ends
  // of the Speed slider: at its fastest, 80ms apart is three frames to
  // a cycle, which strobes rather than moves, and the composition
  // looks the same at every speed because the phase jumps a third of
  // a turn either way. Twenty-five to a cycle is exactly the old fixed
  // cadence at a two second beat, so nothing at or above that changes.
  const PREVIEW_FRAMES_PER_CYCLE = 25;
  const PREVIEW_MIN_FRAME_MS = 16;

  // A whole export is capped at this many frames however it is
  // configured. Without it the cost is the product of two menus: five
  // beats of Wind at 10s used to come to 625 frames of a full canvas,
  // which is minutes of in-browser encoding for a file nobody can
  // use. What gives when the cap binds is smoothness on the longest
  // exports, which is the right thing to trade: a ten second cycle is
  // slow motion, where a low frame rate reads fine.
  const GIF_FRAME_BUDGET = 240;
  // Counting frames cannot see the canvas. An export's wait and its
  // file both grow with the pixels in it, frames x width x height,
  // and canvas size is a free text field, so there is no size this
  // can assume. The frame budget above is what the default 1200x630
  // canvas gets, and a larger canvas gets fewer in proportion: 87 at
  // 1920x1080, 21 at 4K. Whichever of the two binds first wins, and
  // MIN_FRAMES_PER_BEAT still overrides both rather than let a pass
  // stop reading as motion.
  //
  // This was a memory budget while the encoder was gif.js, which held
  // every frame as raw RGBA until the encode finished: 3MB a frame on
  // the default canvas, and the 200MB it was allowed left a thirteen
  // second cycle at 69 frames, 5fps in the file against 12.5 on the
  // canvas. gif-writer.js keeps only what it has compressed, so
  // memory is no longer what runs out.
  const GIF_PIXEL_BUDGET = GIF_FRAME_BUDGET * 1200 * 630;
  // Below this a beat stops reading as motion at all, so the budget is
  // allowed to be exceeded rather than go under it. The frame budget
  // alone only reached it past twenty beats, which the menu has never
  // offered; the pixel budget reaches it on a hand-typed canvas past
  // fifteen million pixels, around 5200x2900. Still a floor rather
  // than an operating point, and the one place an export can go over
  // budget.
  const MIN_FRAMES_PER_BEAT = 12;

  // A GIF frame delay is written in hundredths of a second, and
  // browsers replace anything under two of them with a tenth, so a
  // beat is never cut into more frames than it has 20ms slices for.
  // The Speed slider's fastest beat is a second, which buys fifty
  // frames against the twelve above, so this never binds today. It is
  // here so that lowering SPEED_BASE_MS, or the slider's floor back
  // under it, shortens the GIF rather than silently changing the
  // speed it plays back at.
  const MIN_GIF_DELAY_MS = 20;

  // One beat's worth of frames: as many as the preview draws in that
  // time, until the budget can't afford it, then as many as it can.
  // The cadence is the preview's own (syncSeamlessPreview's tick in
  // app.js), floored at
  // what a GIF can hold. It was the fixed 80ms the preview had before
  // PREVIEW_FRAMES_PER_CYCLE, which left a one second cycle at 13
  // frames in the file against 25 on screen. `pixels` is the canvas's
  // width times its height.
  function beatFrames(beats, beatMs, pixels) {
    const cadence = Math.max(MIN_GIF_DELAY_MS, Math.min(CYCLE_FRAME_MS, beatMs / PREVIEW_FRAMES_PER_CYCLE));
    const smooth = Math.round(beatMs / cadence);
    const budget = Math.min(GIF_FRAME_BUDGET, Math.floor(GIF_PIXEL_BUDGET / pixels));
    const affordable = Math.floor(budget / beats);
    const honored = Math.floor(beatMs / MIN_GIF_DELAY_MS);
    return Math.max(2, Math.min(Math.max(MIN_FRAMES_PER_BEAT, Math.min(smooth, affordable)), honored));
  }

  // How long frame `i` of a cycle is held, in milliseconds. A GIF
  // stores a delay in whole hundredths of a second, so a cycle cut
  // into equal frames almost never adds up to the cycle: 13454ms over
  // 69 frames is 195ms each, written as 200, and the file ran 13.8s
  // against 13.45s on screen. Each frame instead takes the hundredths
  // between its own start and the next one's, both rounded, so the
  // rounding is carried forward rather than repeated and a pass lands
  // within 5ms of the cycle. Two frames never differ by more than one
  // hundredth, and beatFrames' 20ms floor keeps every one at two or
  // more.
  //
  // A frame held a hundredth longer than its neighbor has to show a
  // moment a hundredth later too, or the motion would speed up and
  // slow down with the rounding. So the phase is read off the same
  // edges the delays are: where frame `i` starts, over where the
  // cycle ends.
  function frameEdge(n, frames, cycleMs) {
    return Math.round((n * cycleMs) / frames / 10);
  }

  function frameDelay(i, frames, cycleMs) {
    return (frameEdge(i + 1, frames, cycleMs) - frameEdge(i, frames, cycleMs)) * 10;
  }

  function framePhase(i, frames, cycleMs) {
    return frameEdge(i, frames, cycleMs) / frameEdge(frames, frames, cycleMs);
  }

  // --- Color ---------------------------------------------------------------

  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }

  function rgbToHex(r, g, b) {
    const toHex = (n) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function hslToHex(h, s, l) {
    return rgbToHex(...hslToRgb(h, s, l));
  }

  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  // Renders a hex color in whichever format a swatch should currently
  // display it in, using each format's own standard CSS notation
  // (rgb()/hsl() with comma-separated channels) rather than a bare
  // list of numbers.
  function formatColorValue(hex, format) {
    if (format === "rgb") {
      const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) => parseInt(c, 16));
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (format === "hsl") {
      const { h, s, l } = hexToHsl(hex);
      return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
    }
    return hex.toUpperCase();
  }

  // --- The shared link -----------------------------------------------------

  // Corner/side vignette and stripes need a direction the plain circle,
  // diamond, and center vignette don't; the field's options are swapped
  // to match whichever of these is selected, see updateShapeMaskDirectionUI
  // in app.js.
  const SHAPE_MASK_DIRECTIONS = {
    cornerVignette: [
      { value: "topLeft", label: "Top-left" },
      { value: "topRight", label: "Top-right" },
      { value: "bottomLeft", label: "Bottom-left" },
      { value: "bottomRight", label: "Bottom-right" },
    ],
    sideVignette: [
      { value: "top", label: "Top" },
      { value: "right", label: "Right" },
      { value: "bottom", label: "Bottom" },
      { value: "left", label: "Left" },
    ],
    stripes: [
      { value: "horizontal", label: "Horizontal" },
      { value: "vertical", label: "Vertical" },
      { value: "diagonal", label: "Diagonal" },
    ],
  };

  // Shareable links: the full state (background, block size, shape mask,
  // both layers) round-trips through readOptions()/applyGeneral()/
  // applyDefaults(), the same functions save-state slots already use,
  // just encoded into a URL instead of localStorage.
  //
  // A link is a bit stream rather than JSON. Every value the UI can
  // hold is a color, a menu choice, or a number on a known step and
  // range, so each takes exactly the bits its range needs (hue 9,
  // symmetry 3, octaves 2), written end to end with nothing in
  // between, then base64url'd. That is 84 characters where base64'd
  // JSON ran past a thousand, most of which went on spelling out
  // "fieldStrength" and its neighbours twice.
  //
  // Two things are load-bearing here, and both fail silently:
  //
  //   - The order of the <option>s for shape mask, motion, symmetry
  //     and LEGACY_AUTO_SPEEDS, and of COMPACT_LOCK_IDS below. A
  //     choice travels as its index, so appending to any of them is
  //     free, and reordering one quietly repaints every link already
  //     shared.
  //   - Every width below. They are the format, not a tuning knob:
  //     widening a slider past what its width holds needs a new
  //     COMPACT_VERSION, or old links decode into the wrong fields
  //     from that point on.
  //
  // Links shared as ?state= base64 JSON, including the one inside
  // every SVG exported before this, still open. See loadStateFromURL.
  const COMPACT_VERSION = 1;

  // Each layer field that is a plain number: the bits it gets, what to
  // subtract so its range starts at zero, and what to multiply by so a
  // fractional step lands on a whole number. Field strength steps by
  // 0.005, so x200 makes it 0-200 and eight bits; scale starts at 8,
  // so the offset buys back the eight values below it.
  const COMPACT_LAYER_NUMBERS = [
    // key, bits, offset, scale
    ["hueMin", 9, 0, 1],
    ["hueMax", 9, 0, 1],
    ["satMin", 7, 0, 1],
    ["satMax", 7, 0, 1],
    ["lightMin", 7, 0, 1],
    ["lightMax", 7, 0, 1],
    ["density", 7, 0, 100],
    ["densityMin", 7, 0, 100],
    ["densityMax", 7, 0, 100],
    ["fieldStrength", 8, 0, 200],
    ["fieldScale", 10, 8, 1],
    ["flowAngle", 9, 0, 1],
    ["flowStretch", 7, 10, 10],
    ["fieldOctaves", 2, 1, 1],
    ["smoothPasses", 3, 0, 1],
  ];

  // Every width outside the layer table, in one place so the format is
  // readable at a glance and checks.py can read it too. A menu that
  // outgrows its width doesn't error, it wraps: option 8 in a 3-bit
  // field decodes as option 0. The link-format check fails the build
  // before that can ship, and each choice here carries roughly double
  // the room it needs today.
  //
  // size is width and height. The markup stops both at 8192, but a link
  // or a slot can carry any number, so they are clamped to what their
  // bits hold. A canvas a
  // million pixels down one side runs out of memory long before it
  // runs out of link.
  const COMPACT_BITS = {
    version: 4,
    bgColor: 24,
    size: 20,
    blockSize: 7,
    shapeMask: 4,
    shapeMaskDirection: 3,
    motion: 3,
    autoSpeed: 4,
    seedFlag: 1,
    seedPacked: 42,
    seedLength: 8,
    byte: 8,
    color: 24,
    symmetry: 4,
    texture: 3,
    speed: 6,
  };
  const COMPACT_SIZE_MAX = 2 ** COMPACT_BITS.size - 1;

  // A generated seed is eight base-36 characters, which packs into 42
  // bits instead of the 64 the same text costs a byte at a time.
  // Anything else (typed by hand, or a short one from an unlucky
  // Math.random) goes the long way, behind the flag bit.
  const COMPACT_SEED_PACKED = /^[0-9a-z]{8}$/;

  // One bit each, in this order. Built rather than listed so the two
  // layers cannot drift apart.
  const COMPACT_LOCK_IDS = ["bgColor", "blockSize", "shapeMask"].concat(
    ["layerA", "layerB"].flatMap((prefix) =>
      ["seed", "color", "density", "fieldStrength", "fieldScale", "flowAngle",
        "flowStretch", "fieldOctaves", "symmetry", "smoothPasses"]
        .map((key) => `${prefix}-${key}`)
    )
  );

  // The tail: everything added to the format after links were already
  // in the wild. It is written last and read back with a fallback, so
  // a link that stops before it decodes to that fallback instead of
  // throwing, which is how the format can grow without a new
  // COMPACT_VERSION while nothing ahead of the tail may move.
  //
  // Two rules keep that true. Append only, same as the lists above;
  // and every field's fallback must be zero, because base64 pads the
  // last byte with up to seven zero bits and an old link's tail is
  // read straight out of that padding.
  //
  // A tail that is all zeros is left off entirely rather than written
  // out, so a composition using none of it encodes to exactly the
  // string it did before the tail existed.
  // The speed menu this replaced held five entries, and an old link
  // carries its speed as an index into them, so the list outlives the
  // menu and its order is still part of the format. New links carry
  // the exact beat in the tail; this field keeps its other job, which
  // is saying whether the link offers to play at all.
  const LEGACY_AUTO_SPEEDS = ["1000", "2000", "3000", "5000", "10000"];

  const COMPACT_TAIL_FIELDS = [
    // key, bits
    ["layerA-texture", COMPACT_BITS.texture],
    ["layerB-texture", COMPACT_BITS.texture],
    ["lock:layerA-texture", 1],
    ["lock:layerB-texture", 1],
    ["speed", COMPACT_BITS.speed],
    ["interval", COMPACT_BITS.speed],
    // Zero is the default 1x, what every earlier link meant; any
    // other depth is written as its slider index plus one.
    ["depth", 4],
    ["direction", 1],
    ["collide", 4],
    // Index into the layer's Motion menu, whose first entry is "same".
    ["layerA-motion", 4],
    ["layerB-motion", 4],
  ];

  // Bits go in and out with arithmetic rather than << and >>, which
  // look like the obvious tools and are not: JS bitwise operators
  // truncate to 32 bits, and a seed packed as base 36 needs 42.
  function bitWriter() {
    const bits = [];
    return {
      add(value, width) {
        for (let i = width - 1; i >= 0; i--) bits.push(Math.floor(value / 2 ** i) % 2);
      },
      finish() {
        const bytes = new Uint8Array(Math.ceil(bits.length / 8));
        bits.forEach((bit, i) => {
          if (bit) bytes[i >> 3] |= 128 >> i % 8;
        });
        let binary = "";
        bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      },
    };
  }

  function bitReader(encoded) {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    let at = 0;
    // Running out of bits means the link was cut short on its way
    // here; the caller drops it rather than render half a picture.
    function read(width) {
      if (at + width > bytes.length * 8) throw new Error("truncated link");
      let value = 0;
      for (let i = 0; i < width; i++, at++) value = value * 2 + ((bytes[at >> 3] >> (7 - (at % 8))) & 1);
      return value;
    }
    return {
      read,
      // The same, for the tail, where running out is not damage but a
      // link written before the field existed. See COMPACT_TAIL_FIELDS.
      // Running out ends the tail: the cursor goes to the end, so the
      // bits a field was too wide for are not handed to the next,
      // narrower one as if they were its own.
      tail(width) {
        if (at + width > bytes.length * 8) {
          at = bytes.length * 8;
          return 0;
        }
        return read(width);
      },
    };
  }

  // What the codec needs from the page, passed as `page` to encodeCompact
  // and decodeCompact rather than written out here, so there is only ever
  // one copy of each option order: the live <select>s (see linkPage in
  // app.js). Both layers share one control template, so layerA's
  // symmetry list is layerB's too.
  //   options: { shapeMask, motion, symmetry, texture, layerMotion }, each
  //            a menu's option values in order
  //   depth:   { min, max, defaultIndex }, the Depth slider's bounds and
  //            default index
  //   defaultSpeedStep: the Speed slider's default index
  const optionIndex = (values, value) => Math.max(0, values.indexOf(value));
  // An index this build doesn't have yet (a link from a newer Flield)
  // falls back to the first option rather than throwing the link away.
  const optionAt = (values, index) => values[index] || values[0];
  const compactColor = (value) => "#" + value.toString(16).padStart(6, "0");

  // Index of the closest entry in LEGACY_AUTO_SPEEDS to a beat in ms.
  function nearestLegacySpeed(ms) {
    let best = 0;
    LEGACY_AUTO_SPEEDS.forEach((value, i) => {
      if (Math.abs(parseInt(value, 10) - ms) < Math.abs(parseInt(LEGACY_AUTO_SPEEDS[best], 10) - ms)) best = i;
    });
    return best;
  }

  function addCompactSeed(out, seed) {
    const packed = COMPACT_SEED_PACKED.test(seed);
    out.add(packed ? 1 : 0, COMPACT_BITS.seedFlag);
    if (packed) {
      out.add(parseInt(seed, 36), COMPACT_BITS.seedPacked);
      return;
    }
    const bytes = new TextEncoder().encode(seed).slice(0, 255);
    out.add(bytes.length, COMPACT_BITS.seedLength);
    bytes.forEach((byte) => out.add(byte, COMPACT_BITS.byte));
  }

  function readCompactSeed(input) {
    // Base 36 drops leading zeros; the fixed eight-character width of
    // the packed form is what puts them back.
    if (input.read(COMPACT_BITS.seedFlag)) {
      return input.read(COMPACT_BITS.seedPacked).toString(36).padStart(8, "0");
    }
    const bytes = new Uint8Array(input.read(COMPACT_BITS.seedLength));
    for (let i = 0; i < bytes.length; i++) bytes[i] = input.read(COMPACT_BITS.byte);
    return new TextDecoder().decode(bytes);
  }

  function addCompactLayer(out, layer, page) {
    addCompactSeed(out, layer.seed);
    out.add(parseInt(layer.color.slice(1), 16), COMPACT_BITS.color);
    out.add(optionIndex(page.options.symmetry, layer.symmetry), COMPACT_BITS.symmetry);
    COMPACT_LAYER_NUMBERS.forEach(([key, bits, offset, scale]) =>
      out.add(Math.max(0, Math.round(layer[key] * scale) - offset), bits)
    );
  }

  function readCompactLayer(input, page) {
    const layer = {
      seed: readCompactSeed(input),
      color: compactColor(input.read(COMPACT_BITS.color)),
      symmetry: optionAt(page.options.symmetry, input.read(COMPACT_BITS.symmetry)),
    };
    COMPACT_LAYER_NUMBERS.forEach(([key, bits, offset, scale]) => {
      layer[key] = (input.read(bits) + offset) / scale;
    });
    return layer;
  }

  function encodeCompact(snapshot, page) {
    const out = bitWriter();
    const directions = SHAPE_MASK_DIRECTIONS[snapshot.shapeMask] || [];
    out.add(COMPACT_VERSION, COMPACT_BITS.version);
    out.add(parseInt(snapshot.bgColor.slice(1), 16), COMPACT_BITS.bgColor);
    out.add(Math.min(COMPACT_SIZE_MAX, Math.max(0, snapshot.width)), COMPACT_BITS.size);
    out.add(Math.min(COMPACT_SIZE_MAX, Math.max(0, snapshot.height)), COMPACT_BITS.size);
    out.add(snapshot.blockSize, COMPACT_BITS.blockSize);
    out.add(optionIndex(page.options.shapeMask, snapshot.shapeMask), COMPACT_BITS.shapeMask);
    // Written even for the shapes that have no direction to point in:
    // three bits cost nothing next to a decoder that has to know which
    // shapes those are.
    out.add(Math.max(0, directions.findIndex((d) => d.value === snapshot.shapeMaskDirection)), COMPACT_BITS.shapeMaskDirection);
    out.add(optionIndex(page.options.motion, snapshot.motion || "none"), COMPACT_BITS.motion);
    COMPACT_LOCK_IDS.forEach((id) => out.add((snapshot.locks || []).includes(id) ? 1 : 0, 1));
    // Zero means a still link. Otherwise the speed's place in the
    // menu, one higher, so the first entry can't read as "still".
    // The nearest of the five, since the beat is no longer restricted
    // to them. Only a link that offers to play writes anything here;
    // the tail below carries the beat itself either way.
    out.add(snapshot.autoplay ? nearestLegacySpeed(snapshot.autoplay) + 1 : 0, COMPACT_BITS.autoSpeed);
    addCompactLayer(out, snapshot.layerA, page);
    addCompactLayer(out, snapshot.layerB, page);
    const textures = page.options.texture;
    // Zero means "this link says nothing about it", so the speed is
    // written one higher, the way the autoSpeed field above is.
    const tail = COMPACT_TAIL_FIELDS.map(([key]) =>
      key === "speed" || key === "interval"
        ? speedStep(snapshot[key] || speedMs(page.defaultSpeedStep)) + 1
        : key === "depth"
          ? (snapshot.depth > 0 && depthIndex(snapshot.depth, page.depth.min, page.depth.max) !== page.depth.defaultIndex
              ? depthIndex(snapshot.depth, page.depth.min, page.depth.max) + 1
              : 0)
          : key === "direction"
            ? (snapshot.direction === "reverse" ? 1 : 0)
            : key === "collide"
              ? (snapshot.collide > 0 ? Math.min(10, Math.round(snapshot.collide * 10)) : 0)
              : key.endsWith("-motion")
                ? optionIndex(page.options.layerMotion, snapshot[key.split("-")[0]].motion || "same")
            : key.startsWith("lock:")
              ? (snapshot.locks || []).includes(key.slice(5)) ? 1 : 0
              : optionIndex(textures, snapshot[key.split("-")[0]].texture)
    );
    if (tail.some((value) => value)) {
      tail.forEach((value, i) => out.add(value, COMPACT_TAIL_FIELDS[i][1]));
    }
    return out.finish();
  }

  function decodeCompact(encoded, page) {
    const input = bitReader(encoded);
    // A format this build doesn't know cannot be guessed at; the
    // caller drops the link and opens a fresh composition instead.
    if (input.read(COMPACT_BITS.version) !== COMPACT_VERSION) throw new Error("unknown link format");
    const bgColor = compactColor(input.read(COMPACT_BITS.bgColor));
    const width = input.read(COMPACT_BITS.size);
    const height = input.read(COMPACT_BITS.size);
    const blockSize = input.read(COMPACT_BITS.blockSize);
    const shapeMask = optionAt(page.options.shapeMask, input.read(COMPACT_BITS.shapeMask));
    const directions = SHAPE_MASK_DIRECTIONS[shapeMask] || [];
    const direction = input.read(COMPACT_BITS.shapeMaskDirection);
    const motion = optionAt(page.options.motion, input.read(COMPACT_BITS.motion));
    // Spelled out as a loop, not a filter: every read moves the cursor,
    // so the order these come off the stream is the whole game.
    const locks = [];
    COMPACT_LOCK_IDS.forEach((id) => {
      if (input.read(1)) locks.push(id);
    });
    const speed = input.read(COMPACT_BITS.autoSpeed);
    const layerA = readCompactLayer(input, page);
    const layerB = readCompactLayer(input, page);
    const textures = page.options.texture;
    const beats = {};
    let depth = 0;
    let motionDirection = "forward";
    let collide = 0;
    COMPACT_TAIL_FIELDS.forEach(([key, bits]) => {
      const value = input.tail(bits);
      if (key === "speed" || key === "interval") beats[key] = value ? speedMs(value - 1) : 0;
      else if (key === "depth") depth = value ? depthValue(value - 1) : 0;
      else if (key === "direction") motionDirection = value ? "reverse" : "forward";
      else if (key === "collide") collide = value / 10;
      else if (key.endsWith("-motion")) {
        (key.startsWith("layerA") ? layerA : layerB).motion = optionAt(page.options.layerMotion, value);
      } else if (key.startsWith("lock:")) {
        if (value) locks.push(key.slice(5));
      } else {
        (key.startsWith("layerA") ? layerA : layerB).texture = optionAt(textures, value);
      }
    });
    const data = {
      // Version 1 carries what STATE_VERSION 2 means. A later bump
      // takes the next COMPACT_VERSION and leaves this branch reading
      // 2, so upgradeState() converts these links like any old one.
      v: 2,
      bgColor,
      width,
      height,
      blockSize,
      shapeMask,
      shapeMaskDirection: directions.length ? (directions[direction] || directions[0]).value : "",
      motion,
      depth,
      direction: motionDirection,
      collide,
      locks,
      layerA,
      layerB,
    };
    if (speed && LEGACY_AUTO_SPEEDS[speed - 1]) data.autoplay = parseInt(LEGACY_AUTO_SPEEDS[speed - 1], 10);
    // A link from before the tail says nothing about either duration
    // unless it offered to play, in which case the one speed it
    // recorded is what it meant by both.
    if (beats.speed || data.autoplay) data.speed = beats.speed || data.autoplay;
    if (beats.interval || data.autoplay) data.interval = beats.interval || data.autoplay;
    return data;
  }

  // The brand mark ("B8 Turn", chosen 25 November 2026): a wave with a
  // field dissolving away from it on each side through a 4 by 4 ordered
  // dither. Field B reads the threshold from the rotated cell, which is
  // what gives the mark exact point symmetry. Returns n by n codes, row
  // by row: 0 ground, 1 field A, 2 field B. favicon.svg is this at 16
  // cells in the brand colors, and core.test.js holds the two equal.
  const MARK_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function brandMarkCells(n) {
    const cells = new Uint8Array(n * n);
    const threshold = (x, y) => (MARK_BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = (x + 0.5) / n;
        const d = (y + 0.5) / n - (0.5 + 0.16 * Math.sin(2 * Math.PI * (u - 0.5)));
        const above = -d - 0.06;
        const below = d - 0.06;
        if (above > 0 && 1.05 - above / 0.42 > threshold(x, y)) cells[y * n + x] = 1;
        else if (below > 0 && 1.05 - below / 0.42 > threshold(n - 1 - x, n - 1 - y)) cells[y * n + x] = 2;
      }
    }
    return cells;
  }

  return {
    clamp,
    brandMarkCells,
    SPEED_BASE_MS, SPEED_PER_DOUBLING, SPEED_MAX_STEP, speedMs, speedStep, formatSpeed,
    DEPTH_STEPS_PER_UNIT, depthValue, depthIndex, formatDepth,
    CYCLE_FRAME_MS, PREVIEW_FRAMES_PER_CYCLE, PREVIEW_MIN_FRAME_MS,
    GIF_FRAME_BUDGET, GIF_PIXEL_BUDGET, MIN_FRAMES_PER_BEAT, MIN_GIF_DELAY_MS,
    beatFrames, frameEdge, frameDelay, framePhase,
    hslToRgb, rgbToHex, hslToHex, hueDistance, hexToHsl, formatColorValue,
    SHAPE_MASK_DIRECTIONS,
    COMPACT_VERSION, COMPACT_LAYER_NUMBERS, COMPACT_BITS, COMPACT_LOCK_IDS, COMPACT_TAIL_FIELDS,
    LEGACY_AUTO_SPEEDS, bitWriter, bitReader, encodeCompact, decodeCompact,
  };
})();
