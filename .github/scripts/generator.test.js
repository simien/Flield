// Golden test for generator.js, run by checks.py.
//
// The noise arithmetic is written out three times: makePerlin, fbm and
// sampleFlowField, which the flow-fields explainer calls; the octave
// loop inlined into getFlowField, which the app calls; and the warp's
// own sample inside it, which marble and Wind read. Every shared link
// and every exported SVG rests on those agreeing bit for bit, and a
// slip in one still draws a plausible picture. So this checks the
// copies against each other, cell for cell, and then holds a spread of
// compositions to checksums recorded from a known good generator.
//
//   node .github/scripts/generator.test.js [path/to/generator.js] [--print]
//
// A checksum that moves on purpose (a motion that now plays differently)
// is updated by running with --print and copying the line it names. The
// streaks stills are the exception: they are what every link and SVG made
// before textures existed renders as, so a change there is a break, not
// an update (see AGENTS.md, "Six textures share one field").
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const printing = args.includes("--print");
const source = args.find((arg) => arg !== "--print") || path.join(__dirname, "..", "..", "generator.js");
const G = new Function(
  fs.readFileSync(source, "utf8") +
    "\nreturn { generate, getFlowField, makePerlin, fbm, sampleFlowField, MARBLE_WARP, WIND_WARP_SCALE };"
)();

const failures = [];
let cells = 0;

// --- The copies agree ---------------------------------------------------
// The still field off getFlowField against the reference functions, and
// marble's warped field against the same reference read through the warp
// as getFlowField describes it. Object.is, so a -0 for a 0 counts too.
const FIELDS = [
  { seed: "alpha", cols: 97, rows: 53, scale: 13.7, angle: 0.61, stretch: 2.3, octaves: 4 },
  { seed: "kilo", cols: 64, rows: 40, scale: 41, angle: 2.9, stretch: 1, octaves: 1 },
  { seed: "zeta", cols: 50, rows: 70, scale: 6.25, angle: -1.2, stretch: 5, octaves: 6 },
];
for (const f of FIELDS) {
  const noise = G.makePerlin(f.seed + "|field");
  const cos = Math.cos(f.angle);
  const sin = Math.sin(f.angle);
  const still = G.getFlowField(f.seed, f.cols, f.rows, f.scale, f.angle, f.stretch, f.octaves, 0, null, 0, 0, null, 1, 1);
  const marble = G.getFlowField(f.seed, f.cols, f.rows, f.scale, f.angle, f.stretch, f.octaves, 0, null, 0, G.MARBLE_WARP, null, 1, 1);
  let stillBad = 0;
  let marbleBad = 0;
  for (let y = 0; y < f.rows; y++) {
    for (let x = 0; x < f.cols; x++) {
      const i = y * f.cols + x;
      const want = G.sampleFlowField(noise, x, y, { scale: f.scale, angleRad: f.angle, stretch: f.stretch, octaves: f.octaves });
      if (!Object.is(still[i], want)) stillBad++;
      const rx = x * cos + y * sin;
      const ry = -x * sin + y * cos;
      let bx = rx / f.stretch / f.scale;
      let by = ry / f.scale;
      const wx0 = bx * G.WIND_WARP_SCALE;
      const wy0 = by * G.WIND_WARP_SCALE;
      const wx = noise(wx0 + 13.7, wy0 + 5.3);
      const wy = noise(wx0 + 47.1, wy0 + 29.9);
      bx += G.MARBLE_WARP * wx;
      by += G.MARBLE_WARP * wy;
      if (!Object.is(marble[i], G.fbm(noise, bx, by, f.octaves))) marbleBad++;
      cells += 2;
    }
  }
  if (stillBad) failures.push(`copies: getFlowField's octave loop and sampleFlowField disagree on ${stillBad} of ${f.cols * f.rows} cells (${f.seed})`);
  if (marbleBad) failures.push(`copies: getFlowField's warp and makePerlin disagree on ${marbleBad} of ${f.cols * f.rows} marble cells (${f.seed})`);
}

// --- Golden checksums ---------------------------------------------------
const layer = (o) =>
  Object.assign({ seed: "alpha", density: 0.45, fieldStrength: 0.5, fieldScale: 180, flowAngle: 30, flowStretch: 3, fieldOctaves: 3, texture: "streaks", motion: "same", symmetry: "none", smoothPasses: 1 }, o);
const compose = (o) =>
  Object.assign({ width: 240, height: 160, blockSize: 2, shapeMask: "none", shapeMaskDirection: "left", layerA: layer({}), layerB: layer({ seed: "beta", flowAngle: 120, density: 0.3 }) }, o);
const checksum = (list) => {
  let h = 0;
  for (const o of list) {
    const g = G.generate(o);
    for (let i = 0; i < g.gridA.length; i++) h = (Math.imul(h, 31) + g.gridA[i] * 2 + g.gridB[i]) | 0;
    cells += g.gridA.length * 2;
  }
  return h >>> 0;
};
const SYMMETRIES = ["none", "horizontal", "vertical", "quad", "diagonal", "kaleidoscope", "rotational", "tile"];
const TEXTURES = ["nebula", "marble", "contours", "streamlines", "weave"];
const MOTIONS = ["circle", "drift", "wind", "pulse", "ripple", "tide"];
const GROUPS = {
  // Every symmetry, two masks, two block sizes, smoothing on and off.
  "streaks stills": () =>
    checksum([
      ...SYMMETRIES.map((symmetry, i) => compose({ layerA: layer({ symmetry, seed: "s" + i, smoothPasses: i % 3 }), layerB: layer({ seed: "t" + i, symmetry: SYMMETRIES[(i + 3) % 8] }) })),
      compose({ shapeMask: "circle", blockSize: 5 }),
      compose({ shapeMask: "vignette", shapeMaskDirection: "top", width: 200, height: 200 }),
    ]),
  "texture stills": () => checksum(TEXTURES.map((texture) => compose({ layerA: layer({ texture, density: 0.6 }), layerB: layer({ seed: "beta", texture: "weave", density: 0.3 }) }))),
  // Each motion partway through, both directions, one with Collide.
  "motion frames": () =>
    checksum(
      MOTIONS.flatMap((loopMode) => [
        compose({ loopMode, loopPhase: 0.3 }),
        compose({ loopMode, loopPhase: 0.71, direction: "reverse", collide: 0.5, layerA: layer({ texture: "marble" }) }),
      ])
    ),
  "per-layer motions": () => checksum([compose({ loopMode: "none", loopPhase: 0.4, layerA: layer({ motion: "drift", texture: "streamlines" }), layerB: layer({ seed: "beta", motion: "ripple", symmetry: "quad" }) })]),
};
// Recorded on 26 November 2026 from the generator after the review's
// fixes G1 to G7. The stills match the generator before them; the two
// motion groups differ from it only through Ripple's swell (G2).
const GOLDEN = {
  "streaks stills": 1771184840,
  "texture stills": 1220794875,
  "motion frames": 3871915884,
  "per-layer motions": 3455546191,
};
for (const [name, run] of Object.entries(GROUPS)) {
  const got = run();
  if (printing) console.log(`  ${JSON.stringify(name)}: ${got},`);
  else if (got !== GOLDEN[name]) failures.push(`golden: ${name} checksum ${got}, expected ${GOLDEN[name]}`);
}
if (printing) process.exit(0);

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`three noise copies agree and ${Object.keys(GOLDEN).length} golden checksums hold, ${cells} cells`);
