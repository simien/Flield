// Flield's GIF encoder. It replaces gif.js, a general encoder that
// suited this picture badly in two ways.
//
// It held every frame as raw RGBA until the last one was added, so an
// export's memory was frames x width x height x 4. On the default
// canvas that is 3MB a frame, and the cap it forced left a thirteen
// second cycle at 69 frames, 5fps in the file against 12.5 on screen.
//
// And it trained a 256 color palette for every frame, on a picture
// that has three colors and knows which three.
//
// This one is written for what the canvas actually holds: a handful of
// flat colors, most of them where they were a frame ago. Each frame is
// compressed as it arrives and only the compressed bytes are kept, so
// memory no longer grows with the frame count. The colors are read
// from the pixels and written as they are, with no quantizing, so a
// brand color in the file is the brand color. A pixel that did not
// change since the last frame is written as transparent, which LZW
// packs into almost nothing. What that saves depends on how much of
// the canvas moves: on one composition at the default speed a frame
// came to 37KB where gif.js wrote 85KB, so 168 frames cost about what
// 69 used to.
//
// It knows nothing about the page. A frame is a Uint32Array of pixels
// (the view a canvas's ImageData gives) and a delay, and what comes
// back is a list of byte chunks ready for a Blob. One global name, like
// generator.js keeps its own.
//
// createGifWriter(width, height) returns:
//   addFrame(pixels, delayMs)  one frame, width x height pixels
//   finish()                   the file, as an array of Uint8Array
function createGifWriter(width, height) {
  // A color is carried as the 32 bit value the pixel array holds, and
  // which byte of it is red depends on the machine.
  const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  // A GIF color table holds 256 entries and entry 0 is kept for
  // "unchanged", so a frame may use this many colors of its own. The
  // canvas uses three. A picture past the limit is refused rather than
  // quantized: it would mean the canvas had stopped being flat color,
  // and that wants noticing, not hiding.
  const MAX_COLORS = 255;
  // LZW codes are twelve bits at most, 4096 of them, and the table is
  // looked up by hashing into twice that many slots.
  const MAX_CODES = 4096;
  const HASH_SIZE = 8192;
  const hashKeys = new Int32Array(HASH_SIZE);
  const hashCodes = new Uint16Array(HASH_SIZE);

  // What has been written, one chunk per frame, and the buffer the
  // current frame is being written into.
  const parts = [];
  let buf = new Uint8Array(1 << 16);
  let len = 0;

  // The previous frame's pixels, to tell what changed, and the first
  // frame's colors, which become the file's global table. One index per
  // pixel for the frame in hand: 0 for unchanged, otherwise a color's
  // place in this frame's list, counted from 1.
  let prev = null;
  let globalColors = null;
  const indices = new Uint8Array(width * height);

  function need(extra) {
    if (len + extra <= buf.length) return;
    const bigger = new Uint8Array(Math.max(buf.length * 2, len + extra));
    bigger.set(buf.subarray(0, len));
    buf = bigger;
  }

  function byte(value) {
    need(1);
    buf[len++] = value;
  }

  function word(value) {
    need(2);
    buf[len++] = value & 255;
    buf[len++] = (value >> 8) & 255;
  }

  // The smallest table that holds the colors and the unchanged slot.
  // Never under two bits: LZW's minimum code size is two, and a table's
  // size and its code size are the same number here.
  function bitsFor(colorCount) {
    return Math.max(2, Math.ceil(Math.log2(colorCount + 1)));
  }

  function colorTable(colors, bits) {
    const entries = 1 << bits;
    need(entries * 3);
    // Entry 0 is never shown: it is the transparent index on every
    // frame after the first, and the first frame does not use it.
    len += 3;
    buf.fill(0, len - 3, len);
    for (let i = 1; i < entries; i++) {
      const c = i <= colors.length ? colors[i - 1] : 0;
      if (LITTLE_ENDIAN) {
        buf[len++] = c & 255;
        buf[len++] = (c >> 8) & 255;
        buf[len++] = (c >> 16) & 255;
      } else {
        buf[len++] = c >>> 24;
        buf[len++] = (c >> 16) & 255;
        buf[len++] = (c >> 8) & 255;
      }
    }
  }

  function header(colors) {
    const bits = bitsFor(colors.length);
    for (const ch of "GIF89a") byte(ch.charCodeAt(0));
    word(width);
    word(height);
    // A global table of 2^bits entries at full color resolution, then
    // the background index and the pixel aspect ratio, both unused.
    byte(0x80 | 0x70 | (bits - 1));
    byte(0);
    byte(0);
    colorTable(colors, bits);
    // The application extension every player reads as "loop forever".
    for (const b of [0x21, 0xff, 0x0b]) byte(b);
    for (const ch of "NETSCAPE2.0") byte(ch.charCodeAt(0));
    for (const b of [0x03, 0x01, 0x00, 0x00, 0x00]) byte(b);
  }

  // GIF's variable width LZW over indices[0..count), each passed
  // through `remap` first when the frame's own color order is not the
  // table's. Output goes out in the sub-blocks the format wants: a
  // length byte, up to 255 bytes, and a zero length to end.
  function lzw(count, minBits, remap) {
    const clear = 1 << minBits;
    const end = clear + 1;
    let codeBits = minBits + 1;
    let next = end + 1;
    let acc = 0;
    let accBits = 0;

    need(257);
    let blockStart = len++;
    let blockLen = 0;
    const out = (value) => {
      if (blockLen === 255) {
        buf[blockStart] = 255;
        need(257);
        blockStart = len++;
        blockLen = 0;
      }
      buf[len++] = value;
      blockLen++;
    };
    const put = (code) => {
      acc |= code << accBits;
      accBits += codeBits;
      while (accBits >= 8) {
        out(acc & 255);
        acc >>>= 8;
        accBits -= 8;
      }
    };
    // A decoder widens its codes when the table it has rebuilt reaches
    // the current width, and it is always one entry behind the encoder.
    // Checking after a code is written and before its entry is added
    // is what keeps the two in step.
    const widen = () => {
      if (next === 1 << codeBits && codeBits < 12) codeBits++;
    };

    hashKeys.fill(-1);
    put(clear);
    let prefix = remap ? remap[indices[0]] : indices[0];
    for (let i = 1; i < count; i++) {
      const k = remap ? remap[indices[i]] : indices[i];
      const key = (prefix << 8) | k;
      let h = Math.imul(key, 0x9e3779b1) >>> 19;
      let known = false;
      while (hashKeys[h] !== -1) {
        if (hashKeys[h] === key) {
          prefix = hashCodes[h];
          known = true;
          break;
        }
        h = (h + 1) & (HASH_SIZE - 1);
      }
      if (known) continue;
      put(prefix);
      widen();
      if (next < MAX_CODES) {
        hashKeys[h] = key;
        hashCodes[h] = next++;
      } else {
        // The table is full. Say so and start a new one; the decoder
        // does the same on reading the clear code.
        put(clear);
        hashKeys.fill(-1);
        codeBits = minBits + 1;
        next = end + 1;
      }
      prefix = k;
    }
    put(prefix);
    widen();
    put(end);
    if (accBits > 0) out(acc & 255);
    buf[blockStart] = blockLen;
    // An empty last block is already the terminator.
    if (blockLen > 0) byte(0);
  }

  function addFrame(pixels, delayMs) {
    if (pixels.length !== width * height) throw new Error("GIF frame is not " + width + "x" + height);
    const first = !prev;

    // The smallest rectangle holding every pixel that changed. Around a
    // dithered canvas in motion that is nearly the whole frame, and it
    // is the transparent pixels inside it that save the bytes; but a
    // motion that only touches part of the canvas gets the crop too.
    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;
    if (!first) {
      top = height;
      bottom = -1;
      left = width;
      right = -1;
      for (let y = 0, i = 0; y < height; y++) {
        for (let x = 0; x < width; x++, i++) {
          if (pixels[i] === prev[i]) continue;
          if (top === height) top = y;
          bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
      // Nothing changed. The frame still has to exist to carry its
      // delay, so it is one unchanged pixel.
      if (bottom < 0) top = bottom = left = right = 0;
    }
    const w = right - left + 1;
    const h = bottom - top + 1;

    // This frame's colors, in the order they first appear. Runs are
    // long, so the last color's index is remembered and the list is
    // only searched when the color changes.
    const colors = [];
    let lastColor = 0;
    let lastIndex = 0;
    let count = 0;
    for (let y = top; y <= bottom; y++) {
      let i = y * width + left;
      for (let x = 0; x < w; x++, i++) {
        const c = pixels[i];
        if (!first && c === prev[i]) {
          indices[count++] = 0;
          continue;
        }
        if (lastIndex === 0 || c !== lastColor) {
          let at = colors.indexOf(c);
          if (at < 0) {
            if (colors.length === MAX_COLORS) throw new Error("GIF frame has more than " + MAX_COLORS + " colors");
            at = colors.push(c) - 1;
          }
          lastColor = c;
          lastIndex = at + 1;
        }
        indices[count++] = lastIndex;
      }
    }

    // The first frame's colors are the file's global table. A later
    // frame uses it when every color it needs is in there, through a
    // remap from its own order to the table's, and carries a table of
    // its own when not: a reroll between passes changes the palette.
    let remap = null;
    let local = false;
    if (first) {
      globalColors = colors;
      header(colors);
    } else {
      remap = new Uint8Array(colors.length + 1);
      for (let j = 0; j < colors.length; j++) {
        const at = globalColors.indexOf(colors[j]);
        if (at < 0) {
          local = true;
          remap = null;
          break;
        }
        remap[j + 1] = at + 1;
      }
    }
    const bits = bitsFor(local ? colors.length : globalColors.length);

    // Graphic control: leave the frame in place when the next one is
    // drawn over it, and from the second frame on read index 0 as
    // "what was already there". The delay is in hundredths of a second.
    for (const b of [0x21, 0xf9, 0x04, first ? 0x04 : 0x05]) byte(b);
    word(Math.min(65535, Math.max(0, Math.round(delayMs / 10))));
    byte(0);
    byte(0);
    // Image descriptor: where the rectangle sits, then whether a table
    // of its own follows.
    byte(0x2c);
    word(left);
    word(top);
    word(w);
    word(h);
    byte(local ? 0x80 | (bits - 1) : 0);
    if (local) colorTable(colors, bits);
    byte(bits);
    lzw(count, bits, remap);

    if (!prev) prev = new Uint32Array(pixels.length);
    prev.set(pixels);
    parts.push(buf.slice(0, len));
    len = 0;
  }

  function finish() {
    if (!prev) throw new Error("GIF has no frames");
    parts.push(Uint8Array.of(0x3b));
    return parts;
  }

  return { addFrame, finish };
}
