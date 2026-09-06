# Using Flowgrain

## The basics

Every composition is three colors: a background, and two independently generated artwork layers. Each layer runs on its own seed, so the same seed and settings always regenerate the same result. The canvas is on the right; every control that shapes it lives in the sidebar on the left.

## Navigating the sidebar

The sidebar has three tabs:

- **General**: canvas width and height (with Web, Tablet, and Mobile presets), background color, and grid resolution (block size).
- **Layer A** and **Layer B**: each layer's own seed, color, palette range, density, flow field, and symmetry mode.

Every randomizable field has a small lock icon next to it. A locked field holds its current value through a randomize pass instead of getting a new one. **Lock** and **Unlock** at the top of the sidebar apply to every field at once.

Saved States (on the General tab) hold three full snapshots, colors and both layers included, in the browser's local storage. Save a composition there to come back to it later, even after a reload.

## Exploring an art direction with Auto-randomize

Clicking **Randomize** rerolls every unlocked field at once. That is useful for a first look, but the more interesting move is the **Auto-randomize** button next to it (the ▶ icon), which does the same thing on a timer, from every 0.5 seconds up to every 10.

Left alone, this cycles through completely unrelated compositions. The technique worth knowing: **lock down what you want to keep, and let autoplay only touch the rest.** Lock a layer's seed and symmetry, leave density and flow field unlocked, and hit play. What comes through is a run of variations that share the same underlying structure, small differences in fill and texture on a shape that stays recognizable. It reads less like random noise and more like a designer trying variations on one idea.

This is also exactly what GIF export renders. The step count option (1, 2, 3, 5, 8, 13) is that same randomize loop, captured frame by frame at the Auto-randomize interval as the per-frame delay. Whatever you see previewed live is what ends up in the exported GIF.

## Widening or narrowing an art direction with Palette Range

Each layer's **Palette Range** constrains the hue, saturation, and lightness a randomized color is allowed to land in, instead of picking from the full wheel. This is the other axis of control alongside locks:

- A **narrow range** (or one of the presets, like Pastel or Monochrome) keeps every randomized color within a tight, cohesive family. Combined with locked structural settings and Auto-randomize, this produces a narrow, tasteful band of variations that all read as the same palette.
- A **wide range** (or Full spectrum) lets color drift much further between passes, so the same locked structure gets explored with far more contrast and variety.

Narrowing or widening the range does not change what is locked or unlocked. It changes how far a single unlocked field, color, is allowed to wander, which makes it the difference between exploring a tight variation on one idea and exploring a much broader one.
