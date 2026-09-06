// Seeded, deterministic pixel-art generator.
// String seed -> 32-bit hash -> mulberry32 PRNG, so the same seed always
// produces the same image regardless of when/where it's regenerated.

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
function sampleFlowField(noise2D, x, y, { scale, angleRad, stretch, octaves }) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rx = x * cos + y * sin;
  const ry = -x * sin + y * cos;
  const nx = rx / stretch / scale;
  const ny = ry / scale;
  return fbm(noise2D, nx, ny, octaves); // -1..1
}

// Mirrors a region's columns outward: for each filled cell at (y, x) with
// x < fillCols, also sets its left-right reflection across the full width.
function mirrorHorizontal(grid, cols, fillRows, fillCols) {
  for (let y = 0; y < fillRows; y++) {
    for (let x = 0; x < fillCols; x++) {
      const mx = cols - 1 - x;
      if (mx >= 0 && mx < cols) grid[y][mx] = grid[y][x];
    }
  }
}

// Mirrors a top region of `fillRows` (already full-width) down to the
// bottom of the grid, top-bottom.
function mirrorVertical(grid, rows, cols, fillRows) {
  for (let y = 0; y < fillRows; y++) {
    const my = rows - 1 - y;
    if (my < 0 || my >= rows) continue;
    for (let x = 0; x < cols; x++) grid[my][x] = grid[y][x];
  }
}

// Point (180deg) rotation: the top region maps to the bottom with both
// axes flipped, giving a pinwheel feel instead of a plain reflection.
function mirrorRotational(grid, rows, cols, fillRows) {
  for (let y = 0; y < fillRows; y++) {
    const my = rows - 1 - y;
    if (my < 0 || my >= rows) continue;
    for (let x = 0; x < cols; x++) {
      const mx = cols - 1 - x;
      grid[my][mx] = grid[y][x];
    }
  }
}

// True diagonal reflection only exists for a square region, so this
// mirrors across the largest square centered in the given region and
// leaves any leftover rectangular margin (when cols != rows) untouched.
function mirrorDiagonal(grid, regionCols, regionRows) {
  const size = Math.min(regionCols, regionRows);
  const offX = Math.floor((regionCols - size) / 2);
  const offY = Math.floor((regionRows - size) / 2);
  for (let ly = 0; ly < size; ly++) {
    for (let lx = ly + 1; lx < size; lx++) {
      grid[offY + lx][offX + ly] = grid[offY + ly][offX + lx];
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
    for (let x = 0; x < cols; x++) {
      const sx = x % fillCols;
      if (sy !== y || sx !== x) grid[y][x] = grid[sy][sx];
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
function buildGrid({ seed, cols, rows, density, symmetry, smoothPasses, field }) {
  const rand = seededRandom(seed);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(false));

  const isTile = symmetry === "tile";
  const fillCols = isTile
    ? Math.ceil(cols / TILE_REPEATS)
    : HALF_COLS_SYMMETRIES.has(symmetry) ? Math.ceil(cols / 2) : cols;
  const fillRows = isTile
    ? Math.ceil(rows / TILE_REPEATS)
    : HALF_ROWS_SYMMETRIES.has(symmetry) ? Math.ceil(rows / 2) : rows;

  const useField = field && field.strength > 0;
  const noise2D = useField ? makePerlin(seed + "|field") : null;
  const angleRad = useField ? (field.angle * Math.PI) / 180 : 0;

  for (let y = 0; y < fillRows; y++) {
    for (let x = 0; x < fillCols; x++) {
      let p = density;
      if (useField) {
        const n = sampleFlowField(noise2D, x, y, {
          scale: field.scale,
          angleRad,
          stretch: field.stretch,
          octaves: field.octaves,
        });
        p = Math.min(1, Math.max(0, density + field.strength * n));
      }
      grid[y][x] = rand() < p;
    }
  }

  for (let pass = 0; pass < smoothPasses; pass++) {
    const next = grid.map((row) => row.slice());
    for (let y = 0; y < fillRows; y++) {
      for (let x = 0; x < fillCols; x++) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < fillRows && nx >= 0 && nx < fillCols && grid[ny][nx]) count++;
          }
        }
        if (count >= 5) next[y][x] = true;
        else if (count <= 2) next[y][x] = false;
        else next[y][x] = grid[y][x];
      }
    }
    for (let y = 0; y < fillRows; y++) {
      for (let x = 0; x < fillCols; x++) grid[y][x] = next[y][x];
    }
  }

  if (symmetry === "diagonal" || symmetry === "kaleidoscope") {
    mirrorDiagonal(grid, fillCols, fillRows);
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

function fillCells(ctx, grid, cols, rows, blockSize) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    }
  }
}

function renderToCanvas(canvas, { width, height, blockSize, bgColor, colorA, colorB, gridA, gridB, cols, rows }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colorA;
  fillCells(ctx, gridA, cols, rows, blockSize);
  ctx.fillStyle = colorB;
  fillCells(ctx, gridB, cols, rows, blockSize);
}

// Merges a boolean grid's filled cells into rectangles instead of one
// <rect> per cell: first collapses each row into horizontal runs of
// consecutive filled cells, then extends a run's rect downward through
// following rows as long as a later row has a run with the identical x
// and width. Keeps SVG file size practical at fine block sizes, where a
// naive per-cell approach can produce hundreds of thousands of elements.
// Every filled cell ends up covered by exactly one rect (open rects that
// fail to extend are closed immediately), so this never changes the
// rendered result, only how many <rect> elements represent it.
function mergeGridToRects(grid, cols, rows) {
  const closedRects = [];
  let openRects = [];

  for (let y = 0; y < rows; y++) {
    const runs = [];
    let x = 0;
    while (x < cols) {
      if (!grid[y][x]) {
        x++;
        continue;
      }
      const startX = x;
      while (x < cols && grid[y][x]) x++;
      runs.push({ x: startX, w: x - startX });
    }

    const usedRunIndexes = new Set();
    const stillOpen = [];

    for (const rect of openRects) {
      const matchIndex = runs.findIndex(
        (run, i) => !usedRunIndexes.has(i) && run.x === rect.x && run.w === rect.w
      );
      if (matchIndex === -1) {
        closedRects.push(rect);
      } else {
        rect.h += 1;
        stillOpen.push(rect);
        usedRunIndexes.add(matchIndex);
      }
    }

    runs.forEach((run, i) => {
      if (!usedRunIndexes.has(i)) {
        stillOpen.push({ x: run.x, y, w: run.w, h: 1 });
      }
    });

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
// where 0 is dead center and 1 is the boundary itself, inscribed with a
// small margin inside the full cols x rows rect (an ellipse or diamond
// matching the canvas's own aspect ratio, not a true circle that would
// leave large dead margins on a wide canvas). Values noticeably above 1
// are well outside; noticeably below 1 are well inside.
const SHAPE_MASK_MARGIN = 0.88;
function shapeDistance(shape, x, y, cols, rows) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const nx = (x - cx) / ((cols / 2) * SHAPE_MASK_MARGIN);
  const ny = (y - cy) / ((rows / 2) * SHAPE_MASK_MARGIN);
  if (shape === "circle") return Math.sqrt(nx * nx + ny * ny);
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
function applyShapeMask(grid, cols, rows, shape, seed) {
  if (!shape || shape === "none") return;
  const rand = seededRandom(seed + "|mask");
  const inner = 1 - SHAPE_MASK_FEATHER;
  const outer = 1 + SHAPE_MASK_FEATHER;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = shapeDistance(shape, x, y, cols, rows);
      if (d <= inner) continue;
      if (d >= outer || rand() > 1 - (d - inner) / (outer - inner)) {
        grid[y][x] = false;
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
// both layers leave behind.
function generate(options) {
  const cols = Math.ceil(options.width / options.blockSize);
  const rows = Math.ceil(options.height / options.blockSize);

  const gridA = buildGrid({
    seed: options.layerA.seed,
    cols,
    rows,
    density: options.layerA.density,
    symmetry: options.layerA.symmetry,
    smoothPasses: options.layerA.smoothPasses,
    field: layerOptionsToField(options.layerA),
  });

  const gridB = buildGrid({
    seed: options.layerB.seed,
    cols,
    rows,
    density: options.layerB.density,
    symmetry: options.layerB.symmetry,
    smoothPasses: options.layerB.smoothPasses,
    field: layerOptionsToField(options.layerB),
  });

  applyShapeMask(gridA, cols, rows, options.shapeMask, options.layerA.seed);
  applyShapeMask(gridB, cols, rows, options.shapeMask, options.layerB.seed);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (gridA[y][x]) gridB[y][x] = false;
    }
  }

  return { gridA, gridB, cols, rows };
}
