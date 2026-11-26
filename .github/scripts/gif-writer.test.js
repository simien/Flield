// Round-trip test for gif-writer.js, run by checks.py.
//
// An encoder that goes wrong still hands back a file, and the page that
// made it looks fine: the damage is only visible to whoever opens the
// GIF. So this writes frames, reads the bytes back with a decoder that
// shares no code with the encoder, and compares every pixel. The decoder
// is deliberately the plain textbook one; if the two ever disagree, the
// format's own description is the referee, not either of them.
//
//   node .github/scripts/gif-writer.test.js [path/to/gif-writer.js]
const fs = require("fs");
const path = require("path");

const source = process.argv[2] || path.join(__dirname, "..", "..", "gif-writer.js");
const createGifWriter = new Function(fs.readFileSync(source, "utf8") + "\nreturn createGifWriter;")();

// The pixel array holds a color as the canvas's ImageData would on this
// machine, which is what the encoder is given in the page.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const rgb = (r, g, b) => (LITTLE_ENDIAN ? (0xff000000 | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 0xff)) >>> 0;

// --- A decoder, by the book --------------------------------------------
function unlzw(data, minBits, count) {
  const clear = 1 << minBits;
  const end = clear + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  const out = new Uint8Array(count);
  let bits = minBits + 1;
  let next = end + 1;
  let prev = -1;
  let first = 0;
  let acc = 0;
  let accBits = 0;
  let pos = 0;
  let n = 0;
  const read = () => {
    while (accBits < bits) {
      if (pos >= data.length) throw new Error("LZW data ran out");
      acc |= data[pos++] << accBits;
      accBits += 8;
    }
    const code = acc & ((1 << bits) - 1);
    acc >>= bits;
    accBits -= bits;
    return code;
  };
  while (n < count) {
    const code = read();
    if (code === clear) {
      bits = minBits + 1;
      next = end + 1;
      prev = -1;
      continue;
    }
    if (code === end) throw new Error("LZW ended " + (count - n) + " pixels early");
    if (prev === -1) {
      if (code >= clear) throw new Error("first code after a clear is not a color");
      out[n++] = first = prev = code;
      continue;
    }
    let cur = code;
    let sp = 0;
    if (code >= next) {
      if (code !== next) throw new Error("LZW code " + code + " is past the table at " + next);
      stack[sp++] = first;
      cur = prev;
    }
    while (cur >= clear) {
      stack[sp++] = suffix[cur];
      cur = prefix[cur];
    }
    first = cur;
    stack[sp++] = cur;
    if (n + sp > count) throw new Error("LZW decoded past the frame");
    while (sp) out[n++] = stack[--sp];
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = first;
      next++;
      if (next === 1 << bits && bits < 12) bits++;
    }
    prev = code;
  }
  // The code after the last pixel has to be the end code, read at the
  // width the decoder has arrived at. An encoder that widened at the
  // wrong moment shows up here even when every pixel came out right.
  if (read() !== end) throw new Error("no end code after the last pixel");
  return out;
}

function decodeGif(bytes) {
  let p = 0;
  const byte = () => bytes[p++];
  const word = () => { const v = bytes[p] | (bytes[p + 1] << 8); p += 2; return v; };
  const table = (bits) => { const t = bytes.subarray(p, p + 3 * (1 << bits)); p += t.length; return t; };
  const blocks = () => {
    const chunks = [];
    for (let size = byte(); size; size = byte()) { chunks.push(bytes.subarray(p, p + size)); p += size; }
    return Buffer.concat(chunks);
  };
  if (Buffer.from(bytes.subarray(0, 6)).toString("latin1") !== "GIF89a") throw new Error("not a GIF89a");
  p = 6;
  const width = word();
  const height = word();
  const packed = byte();
  p += 2;
  const globalTable = packed & 0x80 ? table((packed & 7) + 1) : null;
  const screen = new Uint32Array(width * height);
  const frames = [];
  let loops = false;
  let control = null;
  for (;;) {
    const kind = byte();
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        if (byte() !== 4) throw new Error("graphic control block is not 4 bytes");
        const flags = byte();
        control = { disposal: (flags >> 2) & 7, transparent: flags & 1, delay: word() * 10, index: byte() };
        if (byte() !== 0) throw new Error("graphic control block is not terminated");
      } else {
        const data = blocks();
        if (label === 0xff && data.toString("latin1").startsWith("NETSCAPE2.0")) loops = data[12] === 0 && data[13] === 0;
      }
      continue;
    }
    if (kind !== 0x2c) throw new Error("unknown block 0x" + (kind || 0).toString(16) + " at byte " + (p - 1));
    const left = word();
    const top = word();
    const w = word();
    const h = word();
    const flags = byte();
    if (flags & 0x40) throw new Error("interlaced frames are not expected");
    const colors = flags & 0x80 ? table((flags & 7) + 1) : globalTable;
    if (!colors) throw new Error("a frame has no color table");
    if (!control || control.disposal > 1) throw new Error("a frame does not leave itself in place");
    if (left + w > width || top + h > height) throw new Error("a frame hangs off the canvas");
    const minBits = byte();
    const pixels = unlzw(blocks(), minBits, w * h);
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const k = pixels[i];
        if (control.transparent && k === control.index) continue;
        if (k * 3 + 2 >= colors.length) throw new Error("a pixel points past its color table");
        screen[(top + y) * width + left + x] = rgb(colors[k * 3], colors[k * 3 + 1], colors[k * 3 + 2]);
      }
    }
    frames.push({ delay: control.delay, pixels: Uint32Array.from(screen), ownTable: !!(flags & 0x80), area: w * h });
    control = null;
  }
  if (p !== bytes.length) throw new Error(bytes.length - p + " bytes after the trailer");
  return { width, height, loops, frames };
}

// --- Cases ----------------------------------------------------------------
let seed = 20261125;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const noise = (w, h, palette, base, share) => {
  const frame = base ? Uint32Array.from(base) : new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) if (!base || random() < share) frame[i] = palette[(random() * palette.length) | 0];
  return frame;
};
const THREE = [rgb(20, 11, 47), rgb(91, 162, 234), rgb(75, 215, 52)];
const OTHER = [rgb(250, 250, 250), rgb(10, 200, 100), rgb(200, 10, 100)];

let frameCount = 0;
const failures = [];
function roundTrip(name, w, h, frames, delays, expect) {
  try {
    const writer = createGifWriter(w, h);
    frames.forEach((frame, i) => writer.addFrame(frame, delays ? delays[i] : 80));
    const file = Buffer.concat(writer.finish().map((part) => Buffer.from(part.buffer, part.byteOffset, part.length)));
    const gif = decodeGif(file);
    if (gif.width !== w || gif.height !== h) throw new Error("size came back " + gif.width + "x" + gif.height);
    if (!gif.loops) throw new Error("the file does not loop forever");
    if (gif.frames.length !== frames.length) throw new Error(gif.frames.length + " frames came back from " + frames.length);
    gif.frames.forEach((frame, f) => {
      for (let i = 0; i < w * h; i++) {
        if (frame.pixels[i] !== frames[f][i]) throw new Error("frame " + f + ", pixel " + i + " changed color");
      }
      if (delays && frame.delay !== delays[f]) throw new Error("frame " + f + " is held " + frame.delay + "ms, not " + delays[f]);
    });
    if (expect) expect(gif, file);
    frameCount += frames.length;
  } catch (err) {
    failures.push(name + ": " + err.message);
  }
}

// What the canvas makes: three colors, a little of it changing each frame.
{
  const frames = [noise(64, 48, THREE)];
  for (let i = 1; i < 6; i++) frames.push(noise(64, 48, THREE, frames[i - 1], 0.05));
  roundTrip("small changes", 64, 48, frames, null, (gif) => {
    if (gif.frames.some((frame) => frame.ownTable)) throw new Error("a frame carried its own table for the global colors");
  });
}
// Enough noise to fill the code table several times over, which is the
// only way the clear-and-start-again path is reached.
{
  const frames = [noise(240, 180, THREE)];
  for (let i = 1; i < 4; i++) frames.push(noise(240, 180, THREE, frames[i - 1], 0.3));
  roundTrip("full code table", 240, 180, frames);
}
// Nothing changed, then one pixel in the last corner.
{
  const a = noise(40, 30, THREE);
  const c = Uint32Array.from(a);
  c[c.length - 1] = c[c.length - 1] === THREE[0] ? THREE[1] : THREE[0];
  roundTrip("unchanged frames", 40, 30, [a, Uint32Array.from(a), c, a], null, (gif) => {
    if (gif.frames[1].area !== 1 || gif.frames[2].area !== 1) throw new Error("an unchanged frame was not cropped to one pixel");
  });
}
// A reroll between passes: new colors arrive, then the old ones return.
{
  const a = noise(50, 50, THREE);
  const b = noise(50, 50, OTHER);
  const c = noise(50, 50, OTHER, b, 0.1);
  roundTrip("palette change", 50, 50, [a, b, c, noise(50, 50, THREE, c, 0.5)], null, (gif) => {
    if (!gif.frames[1].ownTable) throw new Error("new colors did not bring their own table");
  });
}
// Table sizes: one color, four (the first count that needs a bigger
// table than the canvas's three), and two hundred.
{
  const flat = new Uint32Array(33 * 17).fill(THREE[0]);
  roundTrip("one color", 33, 17, [flat, Uint32Array.from(flat)]);
  const four = [...THREE, rgb(1, 2, 3)];
  roundTrip("four colors", 33, 17, [noise(33, 17, four), noise(33, 17, four)]);
  const many = Array.from({ length: 200 }, (_, i) => rgb(i, 255 - i, (i * 7) & 255));
  const first = noise(33, 17, many);
  roundTrip("two hundred colors", 33, 17, [first, noise(33, 17, many, first, 0.2), noise(33, 17, THREE)]);
}
// Long flat runs that shift sideways, the shape real compositions have.
{
  const frames = [];
  for (let f = 0; f < 5; f++) {
    const frame = new Uint32Array(300 * 200);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 300; x++) frame[y * 300 + x] = THREE[(((x + f * 3) >> 4) + (y >> 3)) % 3];
    frames.push(frame);
  }
  roundTrip("flat runs", 300, 200, frames);
}
// Delays are whole hundredths and come back as written.
roundTrip("delays", 8, 8, [noise(8, 8, THREE), noise(8, 8, THREE), noise(8, 8, THREE)], [190, 200, 4000]);
// A canvas that is not flat color is refused, not quietly quantized.
try {
  const frame = new Uint32Array(400);
  for (let i = 0; i < 400; i++) frame[i] = rgb(i & 255, i >> 8, 9);
  createGifWriter(20, 20).addFrame(frame, 80);
  failures.push("too many colors: 400 colors were accepted");
} catch (err) {
  if (!/255 colors/.test(err.message)) failures.push("too many colors: " + err.message);
}

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(frameCount + " frames read back pixel for pixel");
