// Seeded, deterministic pixel-art generator.
// String seed -> 32-bit hash -> mulberry32 PRNG, so the same seed always
// produces the same image regardless of when/where it's regenerated.
//
// Grids are flat Uint8Arrays indexed y * cols + x (1 = filled), which is
// several times faster to build, mirror, and draw than an array of row
// arrays and is what lets a full-resolution render stay under a frame at
// typical sizes. Every pass below is written to produce exactly the same
// cells as the earlier row-array version for the same inputs, so seeds
// and shared links keep rendering the same picture.

function hashStringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seedString) {
  return mulberry32(hashStringToSeed(seedString));
}

// Classic 2D gradient (Perlin) noise, seeded independently of the per-cell
// dither RNG so tweaking flow parameters doesn't reshuffle pixel texture.
function makePerlin(seedString) {
  const rand = seededRandom(seedString);
  const GRADIENTS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (hash, x, y) => {
    const g = GRADIENTS[hash & 7];
    return g[0] * x + g[1] * y;
  };

  return function noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ba = perm[perm[xi + 1] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v); // roughly -1..1
  };
}

// Fractal sum of octaves (turbulence) for more organic, less lattice-y noise.
function fbm(noise2D, x, y, octaves) {
  let total = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return maxAmp > 0 ? total / maxAmp : 0;
}

// Samples the flow field at a grid coordinate: rotates into flow-aligned
// space then stretches along the flow axis so features elongate into
// streaks pointing in the flow direction, like blown sand or cloud bands.
// `scale` here is in grid cells; callers convert from the pixel value the
// UI exposes (see buildGrid).
function sampleFlowField(noise2D, x, y, { scale, angleRad, stretch, octaves }) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rx = x * cos + y * sin;
  const ry = -x * sin + y * cos;
  const nx = rx / stretch / scale;
  const ny = ry / scale;
  return fbm(noise2D, nx, ny, octaves); // -1..1
}

// The fractal noise sum rarely gets far from zero (its typical magnitude
// is about 0.11, and 0.42 at the 99th percentile), so a field strength
// slider that multiplied it directly spent most of its travel on a
// barely visible effect. Strength is multiplied by this gain before it
// biases density, which puts clear banding at mid-slider. States saved
// before this existed carry their strength halved on load (see the
// state version handling in index.html), which reproduces the exact
// same multiplier and therefore the exact same cells.
const FIELD_GAIN = 2;

// The flow field for a layer's unique region, sampled once and reused
// across renders that only change something else (density, color,
// smoothing, symmetry within the same region size, the shape mask).
// Sampling the noise is by far the most expensive part of a render, and
// a slider drag on any of those other fields would otherwise recompute
// an identical field on every frame. Float64 so the cached values are
// bit-identical to a fresh sample. A handful of entries covers both
// layers plus the favicon and tutorial demos without growing unbounded.
const FIELD_CACHE_LIMIT = 6;
const fieldCache = new Map();

// Loops: a phase from 0 to 1 slides the field's sampling origin
// around a circle of this radius (in noise units) that passes through
// the origin, so phase 0 is exactly the still render and phase 1 lands
// back on it. Each cell's dither threshold is fixed by the seed, so as
// the field moves under it shapes grow, shrink, and drift instead of
// flickering. Sized so one full turn reads as a slow breath at the base
// octave; finer octaves travel proportionally further.
const LOOP_RADIUS = 0.2;

// Drift loops ("drift" mode) travel one noise unit along the flow axis
// per cycle instead of circling. A one-way loop can only close if the
// field is periodic along that axis with a period equal to the travel,
// so in drift mode the lattice wraps every DRIFT_PERIOD units along the
// flow axis (each octave wraps at DRIFT_PERIOD times its frequency, so
// all octaves close together). On screen the period is flow scale times
// stretch pixels, which is how far the pattern moves per loop; the
// per-cell dither does not repeat, so only the density envelope does.
const DRIFT_PERIOD = 1;

// Pulse loops swing density with one sine wave per cycle (so phase 0
// and 1 are the still), by this fraction of each layer's own density.
const PULSE_DEPTH = 0.4;

// Layer B moves with layer A, not against it, the way two depths of one
// flow field would: in Loop it circles the same way but starts a
// quarter turn further round, so the two currents never point exactly
// alike; in Pulse it swings the same way at this fraction of A's depth.
// In Drift its heading and speed are already its own (its flow angle,
// and its flow scale times stretch per cycle).
const LAYER_B_PHASE_OFFSET = Math.PI / 4;
const LAYER_B_DEPTH = 0.7;

// Gradient table as two flat arrays, indexed by hash & 7; the same eight
// directions makePerlin uses.
const GRAD_X = new Float64Array([1, -1, 0, 0, 1, -1, 1, -1]);
const GRAD_Y = new Float64Array([0, 0, 1, -1, 1, 1, -1, -1]);

function getFlowField(seed, fillCols, fillRows, scale, angleRad, stretch, octaves, phase, mode, phaseOffset) {
  const drift = mode === "drift";
  const key = `${seed}|${fillCols}|${fillRows}|${scale}|${angleRad}|${stretch}|${octaves}|${phase || 0}|${mode || ""}|${phaseOffset || 0}`;
  const cached = fieldCache.get(key);
  if (cached) return cached;

  // This is makePerlin + fbm + sampleFlowField inlined into one loop:
  // the same permutation shuffle, the same expressions in the same order
  // (so every value is bit-identical to calling those functions), just
  // without a closure call, an object, and an array-of-arrays lookup per
  // octave per cell. Those three were most of a cold render's time.
  const rand = seededRandom(seed + "|field");
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  // Skipped entirely at phase 0 rather than adding a computed zero, so
  // a still render's arithmetic stays exactly what it was.
  // Circle: a loop around a circle through the origin, entered at
  // phaseOffset radians round from the default start; subtracting the
  // start point keeps phase 0 (and 1) exactly on the still.
  const looping = drift || (mode === "circle" && phase > 0 && phase < 1);
  const start = phaseOffset || 0;
  const offX = !looping ? 0 : drift ? (phase || 0) * DRIFT_PERIOD : LOOP_RADIUS * (Math.cos(2 * Math.PI * phase + start) - Math.cos(start));
  const offY = !looping || drift ? 0 : LOOP_RADIUS * (Math.sin(2 * Math.PI * phase + start) - Math.sin(start));
  let maxAmp = 0;
  for (let o = 0, amp = 1; o < octaves; o++, amp *= 0.5) maxAmp += amp;

  const values = new Float64Array(fillRows * fillCols);
  for (let y = 0; y < fillRows; y++) {
    const row = y * fillCols;
    for (let x = 0; x < fillCols; x++) {
      const rx = x * cos + y * sin;
      const ry = -x * sin + y * cos;
      const bx = looping ? rx / stretch / scale + offX : rx / stretch / scale;
      const by = looping ? ry / scale + offY : ry / scale;
      let total = 0;
      let amp = 1;
      let freq = 1;
      for (let o = 0; o < octaves; o++) {
        const sx = bx * freq;
        const sy = by * freq;
        const flx = Math.floor(sx);
        const fly = Math.floor(sy);
        // Drift mode wraps the lattice along the flow axis so the field
        // is periodic there (see DRIFT_PERIOD); circle mode and stills
        // use the plain 256-entry wrap.
        const period = DRIFT_PERIOD * freq;
        const xi = drift ? (((flx % period) + period) % period) & 255 : flx & 255;
        const xi1 = drift ? (((flx + 1) % period + period) % period) & 255 : xi + 1;
        const yi = fly & 255;
        const xf = sx - flx;
        const yf = sy - fly;
        const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
        const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
        const aa = perm[perm[xi] + yi] & 7;
        const ba = perm[perm[xi1] + yi] & 7;
        const ab = perm[perm[xi] + yi + 1] & 7;
        const bb = perm[perm[xi1] + yi + 1] & 7;
        const gaa = GRAD_X[aa] * xf + GRAD_Y[aa] * yf;
        const gba = GRAD_X[ba] * (xf - 1) + GRAD_Y[ba] * yf;
        const gab = GRAD_X[ab] * xf + GRAD_Y[ab] * (yf - 1);
        const gbb = GRAD_X[bb] * (xf - 1) + GRAD_Y[bb] * (yf - 1);
        const x1 = gaa + u * (gba - gaa);
        const x2 = gab + u * (gbb - gab);
        total += (x1 + v * (x2 - x1)) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      values[row + x] = maxAmp > 0 ? total / maxAmp : 0;
    }
  }

  if (fieldCache.size >= FIELD_CACHE_LIMIT) {
    fieldCache.delete(fieldCache.keys().next().value);
  }
  fieldCache.set(key, values);
  return values;
}

// Mirrors a region's columns outward: for each cell at (y, x) with
// x < fillCols, also sets its left-right reflection across the full width.
function mirrorHorizontal(grid, cols, fillRows, fillCols) {
  for (let y = 0; y < fillRows; y++) {
    const row = y * cols;
    for (let x = 0; x < fillCols; x++) {
      grid[row + (cols - 1 - x)] = grid[row + x];
    }
  }
}

// Mirrors a top region of `fillRows` (already full-width) down to the
// bottom of the grid, top-bottom.
function mirrorVertical(grid, rows, cols, fillRows) {
  for (let y = 0; y < fillRows; y++) {
    const my = rows - 1 - y;
    if (my === y) continue;
    grid.copyWithin(my * cols, y * cols, y * cols + cols);
  }
}

// Point (180deg) rotation: the top region maps to the bottom with both
// axes flipped, giving a pinwheel feel instead of a plain reflection.
function mirrorRotational(grid, rows, cols, fillRows) {
  for (let y = 0; y < fillRows; y++) {
    const my = rows - 1 - y;
    if (my < 0 || my >= rows) continue;
    const row = y * cols;
    const mrow = my * cols;
    for (let x = 0; x < cols; x++) {
      grid[mrow + (cols - 1 - x)] = grid[row + x];
    }
  }
}

// True diagonal reflection only exists for a square region, so this
// mirrors across the largest square centered in the given region and
// leaves any leftover rectangular margin (when cols != rows) untouched.
// `cols` is the grid's full stride; the region is regionCols x regionRows
// at the top-left.
function mirrorDiagonal(grid, cols, regionCols, regionRows) {
  const size = Math.min(regionCols, regionRows);
  const offX = Math.floor((regionCols - size) / 2);
  const offY = Math.floor((regionRows - size) / 2);
  for (let ly = 0; ly < size; ly++) {
    for (let lx = ly + 1; lx < size; lx++) {
      grid[(offY + lx) * cols + offX + ly] = grid[(offY + ly) * cols + offX + lx];
    }
  }
}

const HALF_COLS_SYMMETRIES = new Set(["horizontal", "quad", "kaleidoscope"]);
const HALF_ROWS_SYMMETRIES = new Set(["vertical", "quad", "rotational", "kaleidoscope"]);
const TILE_REPEATS = 3;

// Repeats the top-left fillCols x fillRows region across the whole grid
// by modulo indexing. Unlike every other symmetry mode (all mirrors or
// rotations of a unique region), this is a plain translation: the same
// tile shows up unchanged, over and over, wallpaper-style. Safe to run
// in simple row-major order because every source read stays inside the
// untouched top-left tile, which is never itself overwritten.
function tileGrid(grid, cols, rows, fillCols, fillRows) {
  for (let y = 0; y < rows; y++) {
    const sy = y % fillRows;
    const row = y * cols;
    const srow = sy * cols;
    for (let x = 0; x < cols; x++) {
      const sx = x % fillCols;
      if (sy !== y || sx !== x) grid[row + x] = grid[srow + sx];
    }
  }
}

// One cellular-automaton smoothing pass over the unique region: a cell
// with five or more filled neighbors fills, two or fewer empties, and
// anything in between stays. Reads from `src`, writes to `dst`.
function smoothPass(src, dst, cols, fillCols, fillRows) {
  for (let y = 0; y < fillRows; y++) {
    const y0 = y > 0 ? y - 1 : y;
    const y1 = y < fillRows - 1 ? y + 1 : y;
    for (let x = 0; x < fillCols; x++) {
      const x0 = x > 0 ? x - 1 : x;
      const x1 = x < fillCols - 1 ? x + 1 : x;
      let count = -src[y * cols + x];
      for (let ny = y0; ny <= y1; ny++) {
        const nrow = ny * cols;
        for (let nx = x0; nx <= x1; nx++) count += src[nrow + nx];
      }
      const i = y * cols + x;
      if (count >= 5) dst[i] = 1;
      else if (count <= 2) dst[i] = 0;
      else dst[i] = src[i];
    }
  }
}

// Builds a boolean grid (rows x cols) using seeded randomness, optional
// mirror/rotational/diagonal symmetry, an optional flow field that
// biases local density, and optional cellular-automaton smoothing.
//
// Only a "unique" region (fillRows x fillCols) is actually randomized;
// the rest of the grid is derived from it by the mirror passes below.
// "kaleidoscope" composes all three: the unique quadrant gets a diagonal
// mirror first, then that quadrant is mirrored out horizontally and
// vertically, producing 8-way symmetry.
function buildGrid({ seed, cols, rows, density, symmetry, smoothPasses, field, blockSize, phase, loopMode, phaseOffset }) {
  // mulberry32 inlined (see the function of that name above for the
  // readable form): the same state update and output arithmetic, so the
  // sequence is identical, minus a closure call per cell.
  let rngState = hashStringToSeed(seed) | 0;
  let grid = new Uint8Array(rows * cols);

  const isTile = symmetry === "tile";
  const fillCols = isTile
    ? Math.ceil(cols / TILE_REPEATS)
    : HALF_COLS_SYMMETRIES.has(symmetry) ? Math.ceil(cols / 2) : cols;
  const fillRows = isTile
    ? Math.ceil(rows / TILE_REPEATS)
    : HALF_ROWS_SYMMETRIES.has(symmetry) ? Math.ceil(rows / 2) : rows;

  const useField = field && field.strength > 0;
  if (useField) {
    // field.scale is in canvas pixels so the same setting reads the same
    // at any block size; the noise itself is sampled per cell.
    const values = getFlowField(
      seed,
      fillCols,
      fillRows,
      field.scale / blockSize,
      (field.angle * Math.PI) / 180,
      field.stretch,
      field.octaves,
      phase,
      loopMode,
      phaseOffset
    );
    const gain = field.strength * FIELD_GAIN;
    for (let y = 0; y < fillRows; y++) {
      const row = y * cols;
      const frow = y * fillCols;
      for (let x = 0; x < fillCols; x++) {
        const p = Math.min(1, Math.max(0, density + gain * values[frow + x]));
        rngState = (rngState + 0x6d2b79f5) | 0;
        let r = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        grid[row + x] = ((r ^ (r >>> 14)) >>> 0) / 4294967296 < p ? 1 : 0;
      }
    }
  } else {
    for (let y = 0; y < fillRows; y++) {
      const row = y * cols;
      for (let x = 0; x < fillCols; x++) {
        rngState = (rngState + 0x6d2b79f5) | 0;
        let r = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        grid[row + x] = ((r ^ (r >>> 14)) >>> 0) / 4294967296 < density ? 1 : 0;
      }
    }
  }

  if (smoothPasses > 0) {
    let next = new Uint8Array(rows * cols);
    for (let pass = 0; pass < smoothPasses; pass++) {
      smoothPass(grid, next, cols, fillCols, fillRows);
      const tmp = grid;
      grid = next;
      next = tmp;
    }
  }

  if (symmetry === "diagonal" || symmetry === "kaleidoscope") {
    mirrorDiagonal(grid, cols, fillCols, fillRows);
  }

  if (HALF_COLS_SYMMETRIES.has(symmetry)) {
    mirrorHorizontal(grid, cols, fillRows, fillCols);
  }

  if (symmetry === "vertical" || symmetry === "quad" || symmetry === "kaleidoscope") {
    mirrorVertical(grid, rows, cols, fillRows);
  }

  if (symmetry === "rotational") {
    mirrorRotational(grid, rows, cols, fillRows);
  }

  if (isTile) {
    tileGrid(grid, cols, rows, fillCols, fillRows);
  }

  return grid;
}

// Canvas pixel packing for the scratch ImageData below: one 32-bit write
// per cell instead of a fillRect per cell. Byte order in the buffer is
// the platform's, hence the endianness probe.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function packColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return LITTLE_ENDIAN
    ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

let scratchCanvas = null;

// Draws both grids in one pass: paints the composition at one pixel per
// cell into a scratch canvas, then scales it up by blockSize with image
// smoothing off, so each cell lands as a crisp blockSize square. Two
// draw calls regardless of grid size, versus one fillRect per filled
// cell before, which was most of a render's time at fine block sizes.
function renderToCanvas(canvas, { width, height, blockSize, bgColor, colorA, colorB, gridA, gridB, cols, rows }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (!scratchCanvas) scratchCanvas = document.createElement("canvas");
  if (scratchCanvas.width !== cols || scratchCanvas.height !== rows) {
    scratchCanvas.width = cols;
    scratchCanvas.height = rows;
  }
  const sctx = scratchCanvas.getContext("2d");
  const image = sctx.createImageData(cols, rows);
  const pixels = new Uint32Array(image.data.buffer);
  const bg = packColor(bgColor);
  const a = packColor(colorA);
  const b = packColor(colorB);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = gridA[i] ? a : gridB[i] ? b : bg;
  }
  sctx.putImageData(image, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, 0, 0, cols, rows, 0, 0, cols * blockSize, rows * blockSize);
}

// Merges a grid's filled cells into rectangles instead of one <rect> per
// cell: first collapses each row into horizontal runs of consecutive
// filled cells, then extends a run's rect downward through following
// rows as long as a later row has a run with the identical x and width.
// Keeps SVG file size practical at fine block sizes, where a naive
// per-cell approach can produce hundreds of thousands of elements.
// Every filled cell ends up covered by exactly one rect (open rects that
// fail to extend are closed immediately), so this never changes the
// rendered result, only how many <rect> elements represent it.
function mergeGridToRects(grid, cols, rows) {
  const closedRects = [];
  let openRects = [];

  for (let y = 0; y < rows; y++) {
    const rowStart = y * cols;
    const runs = [];
    // Runs keyed by their x and width, so matching an open rect against
    // this row is a lookup rather than a scan of every run.
    const runByKey = new Map();
    let x = 0;
    while (x < cols) {
      if (!grid[rowStart + x]) {
        x++;
        continue;
      }
      const startX = x;
      while (x < cols && grid[rowStart + x]) x++;
      const run = { x: startX, w: x - startX, used: false };
      runs.push(run);
      runByKey.set(startX * (cols + 1) + run.w, run);
    }

    const stillOpen = [];
    for (const rect of openRects) {
      const run = runByKey.get(rect.x * (cols + 1) + rect.w);
      if (!run || run.used) {
        closedRects.push(rect);
      } else {
        rect.h += 1;
        run.used = true;
        stillOpen.push(rect);
      }
    }

    for (const run of runs) {
      if (!run.used) stillOpen.push({ x: run.x, y, w: run.w, h: 1 });
    }

    openRects = stillOpen;
  }

  closedRects.push(...openRects);
  return closedRects;
}

function rectsForGrid(grid, cols, rows, blockSize) {
  let rects = "";
  for (const r of mergeGridToRects(grid, cols, rows)) {
    rects += `<rect x="${r.x * blockSize}" y="${r.y * blockSize}" width="${r.w * blockSize}" height="${r.h * blockSize}"/>`;
  }
  return rects;
}

function gridToSVG({ width, height, blockSize, bgColor, colorA, colorB, gridA, gridB, cols, rows }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bgColor}"/>` +
    `<g fill="${colorA}">${rectsForGrid(gridA, cols, rows, blockSize)}</g>` +
    `<g fill="${colorB}">${rectsForGrid(gridB, cols, rows, blockSize)}</g>` +
    `</svg>`
  );
}

// Distance from grid cell (x, y) to the shape's own boundary, in units
// where 0 is dead center and 1 is the boundary itself. Values noticeably
// above 1 are well outside; noticeably below 1 are well inside. Diamond
// stays inscribed to the canvas's own aspect ratio (a stretched rhombus
// reads fine); circle uses the shorter dimension for both axes so it's an
// actual circle rather than an ellipse stretched wide on the typical
// wider-than-tall canvas, even though that leaves dead margin on the
// longer axis.
const SHAPE_MASK_MARGIN = 0.88;
function shapeDistance(shape, x, y, cols, rows) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  if (shape === "circle") {
    const r = (Math.min(cols, rows) / 2) * SHAPE_MASK_MARGIN;
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    return Math.sqrt(nx * nx + ny * ny);
  }
  const nx = (x - cx) / ((cols / 2) * SHAPE_MASK_MARGIN);
  const ny = (y - cy) / ((rows / 2) * SHAPE_MASK_MARGIN);
  if (shape === "diamond") return Math.abs(nx) + Math.abs(ny);
  return 0; // "none"
}

// Clears cells outside the mask shape, dithering the boundary instead of
// cutting it off sharply: cells well inside always survive, cells well
// outside are always cleared, and cells in between get a random chance
// that fades from "almost certain" to "almost none" across the band. A
// hard geometric edge read as pasted-on against the layer's own organic
// texture, especially at fine block sizes. Uses the layer's own seed (a
// separate stream from its fill/smoothing randomness) so the dither
// pattern is deterministic and specific to that layer, not shared noise
// reused wholesale from somewhere else. Applied to both layers before
// the layer-A-over-B exclusion below, so a masked composition still keeps
// both layers mutually exclusive inside the visible shape.
const SHAPE_MASK_FEATHER = 0.18;

// Gradient-family masks (vignette, corner/side vignette, stripes) skip the
// circle/diamond path entirely: rather than a hard shape boundary with a
// narrow feathered band around it, every cell gets a keep-probability that
// varies continuously across the whole canvas, from the mask's own
// reference point (center, a chosen corner or side, a stripe's own center
// line) out to wherever it fades to nothing. Same rand()-per-cell dither
// as the boundary band above, just applied over the full frame instead of
// a narrow ring, since these are continuously fading rather than a shape
// with an inside and an outside.
const GRADIENT_SHAPE_MASKS = new Set(["vignette", "vignetteInverse", "cornerVignette", "sideVignette", "stripes"]);

const CORNER_POINTS = {
  topLeft: [0, 0],
  topRight: [1, 0],
  bottomLeft: [0, 1],
  bottomRight: [1, 1],
};

const STRIPE_COUNT = 5;

// Circular (not aspect-stretched) distance from (originX, originY) to
// (x, y), scaled by the canvas's shorter dimension and normalized so 0 is
// right at the origin and 1 lands on whichever canvas corner is farthest
// from it. Shared by vignette (origin at center) and cornerVignette
// (origin at the chosen corner) so both read as a real circular falloff,
// the same fix shapeDistance's "circle" uses, rather than an ellipse
// stretched to the canvas's own aspect ratio.
function radialFade(x, y, cols, rows, originX, originY) {
  const r = Math.min(cols, rows) / 2 || 1;
  const dx = (x - originX) / r;
  const dy = (y - originY) / r;
  const corners = [
    [0, 0],
    [cols - 1, 0],
    [0, rows - 1],
    [cols - 1, rows - 1],
  ];
  let maxD = 0;
  for (const [cornerX, cornerY] of corners) {
    const fx = (cornerX - originX) / r;
    const fy = (cornerY - originY) / r;
    maxD = Math.max(maxD, Math.sqrt(fx * fx + fy * fy));
  }
  return Math.min(1, Math.sqrt(dx * dx + dy * dy) / (maxD || 1));
}

function maskKeepProbability(shape, direction, x, y, cols, rows) {
  const nx = x / Math.max(1, cols - 1);
  const ny = y / Math.max(1, rows - 1);

  if (shape === "vignette" || shape === "vignetteInverse") {
    const d = radialFade(x, y, cols, rows, (cols - 1) / 2, (rows - 1) / 2);
    return shape === "vignette" ? 1 - d : d;
  }

  if (shape === "cornerVignette") {
    const [fx, fy] = CORNER_POINTS[direction] || CORNER_POINTS.topLeft;
    const d = radialFade(x, y, cols, rows, fx * (cols - 1), fy * (rows - 1));
    return 1 - d;
  }

  if (shape === "sideVignette") {
    let d;
    if (direction === "top") d = ny;
    else if (direction === "bottom") d = 1 - ny;
    else if (direction === "right") d = 1 - nx;
    else d = nx; // "left" (also the fallback)
    return 1 - d;
  }

  if (shape === "stripes") {
    let t;
    if (direction === "horizontal") t = ny;
    else if (direction === "diagonal") t = (nx + ny) / 2;
    else t = nx; // "vertical" (also the fallback)
    const phase = (t * STRIPE_COUNT) % 1;
    // Triangle wave: 0 at each stripe's own boundary, 1 at its center, so
    // the band fades out on both sides instead of cutting off sharply.
    return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  }

  return 1;
}

function applyShapeMask(grid, cols, rows, shape, seed, direction) {
  if (!shape || shape === "none") return;
  const rand = seededRandom(seed + "|mask");

  if (GRADIENT_SHAPE_MASKS.has(shape)) {
    for (let y = 0; y < rows; y++) {
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        if (rand() > maskKeepProbability(shape, direction, x, y, cols, rows)) {
          grid[row + x] = 0;
        }
      }
    }
    return;
  }

  const inner = 1 - SHAPE_MASK_FEATHER;
  const outer = 1 + SHAPE_MASK_FEATHER;
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const d = shapeDistance(shape, x, y, cols, rows);
      if (d <= inner) continue;
      if (d >= outer || rand() > 1 - (d - inner) / (outer - inner)) {
        grid[row + x] = 0;
      }
    }
  }
}

function layerOptionsToField(layer) {
  return {
    strength: layer.fieldStrength,
    scale: layer.fieldScale,
    angle: layer.flowAngle,
    stretch: layer.flowStretch,
    octaves: layer.fieldOctaves,
  };
}

// Generates two independent, seeded layers on a shared grid, then masks
// layer B so it only occupies cells layer A left empty. That keeps the two
// shapes mutually exclusive (no color mixing) and, since layer A rarely
// covers 100% of the canvas, leaves the background visible in the gaps
// both layers leave behind. `options.loopPhase` (0 to 1, optional) is
// the loop phase, and `options.loopMode` picks the kind:
// "circle" (see LOOP_RADIUS), "drift" (DRIFT_PERIOD), or "pulse"
// (PULSE_DEPTH). Circle and drift move the field, so a layer with no
// field strength stays still through them.
function generate(options) {
  // Floor rather than ceil, so cols/rows * blockSize never exceeds the
  // canvas: a block that only partly fit would otherwise get clipped
  // by the canvas edge instead of just leaving a sliver of background
  // showing past the last whole block. Math.max(1, ...) keeps a small
  // canvas with a large block size from flooring to zero blocks.
  const cols = Math.max(1, Math.floor(options.width / options.blockSize));
  const rows = Math.max(1, Math.floor(options.height / options.blockSize));

  const mode = options.loopMode;
  const phase = options.loopPhase || 0;
  const wave = Math.sin(2 * Math.PI * phase);
  // See LAYER_B_PHASE_OFFSET / LAYER_B_DEPTH: B moves with A, offset
  // and gentler, rather than in lockstep or against it.
  const buildLayer = (layer, isB) => {
    const depth = isB ? LAYER_B_DEPTH : 1;
    const field = layerOptionsToField(layer);
    let density = layer.density;
    if (mode === "pulse") density = Math.min(1, Math.max(0, density * (1 + PULSE_DEPTH * depth * wave)));
    return buildGrid({
      seed: layer.seed,
      cols,
      rows,
      density,
      symmetry: layer.symmetry,
      smoothPasses: layer.smoothPasses,
      field,
      blockSize: options.blockSize,
      phase,
      loopMode: mode,
      phaseOffset: isB ? LAYER_B_PHASE_OFFSET : 0,
    });
  };

  const gridA = buildLayer(options.layerA, false);
  const gridB = buildLayer(options.layerB, true);

  applyShapeMask(gridA, cols, rows, options.shapeMask, options.layerA.seed, options.shapeMaskDirection);
  applyShapeMask(gridB, cols, rows, options.shapeMask, options.layerB.seed, options.shapeMaskDirection);

  for (let i = 0; i < gridA.length; i++) {
    if (gridA[i]) gridB[i] = 0;
  }

  return { gridA, gridB, cols, rows };
}
