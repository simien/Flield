# Using Flowgrain

## The basics

Every composition is three colors: a background, and two independently generated artwork layers. Each layer runs on its own seed, so the same seed and settings always regenerate the same result. The canvas is on the right; every control that shapes it lives in the sidebar on the left.

Every page load opens on a freshly randomized composition instead of a fixed default, background color and block size aside (more on why below).

## Navigating the sidebar

The sidebar has three tabs:

- **General**: canvas width and height (with Web, Tablet, and Mobile presets), background color, and grid resolution (block size).
- **Layer A** and **Layer B**: each layer's own seed, color, palette range, density range, flow field, and symmetry mode.

On a narrow screen, the sidebar becomes a drawer instead of a permanent column. A toggle button in the top corner opens and closes it; tapping outside the drawer or pressing Escape closes it too.

Every randomizable field, background color and block size included, has a small lock icon next to it. A locked field holds its current value through a randomize pass instead of getting a new one. **Lock** and **Unlock** at the top of the sidebar apply to every field at once. Background color and block size start locked, which is why a fresh page load keeps its starting background and grid resolution steady while everything else randomizes around them; unlock either one to fold it into future randomize and Auto-randomize passes.

Saved States (on the General tab) hold three full snapshots, colors and both layers included, in the browser's local storage. Save a composition there to come back to it later, even after a reload. For sharing a composition with someone else (or on a different device), use **Copy Link** at the bottom of the sidebar instead: it encodes the exact current state into a URL, so opening that link reproduces the composition exactly rather than just leaving it in your own browser's storage.

## Exploring an art direction with Auto-randomize

Clicking **Random** rerolls every unlocked field at once. That is useful for a first look, but the more interesting move is the **Auto-randomize** button next to it (the ▶ icon), which does the same thing on a timer, from every 0.5 seconds up to every 10.

Left alone, this cycles through completely unrelated compositions. The technique worth knowing: **lock down what you want to keep, and let autoplay only touch the rest.** Lock a layer's seed and symmetry, leave density and flow field unlocked, and hit play. What comes through is a run of variations that share the same underlying structure, small differences in fill and texture on a shape that stays recognizable. It reads less like random noise and more like a designer trying variations on one idea.

If a randomize pass (manual or a fast Auto-randomize tick) takes you somewhere you didn't mean to go, **Undo** next to Random steps back through recent passes, most recent first, and grays out once there's nothing left to undo.

This is also exactly what GIF export renders. The step count option (1, 2, 3, 5, 8, 13) is that same randomize loop, captured frame by frame at the Auto-randomize interval as the per-frame delay. Whatever you see previewed live is what ends up in the exported GIF.

## Widening or narrowing an art direction with Palette Range and Density Range

Each layer has two collapsible range controls, both collapsed by default. **Palette Range** constrains the hue, saturation, and lightness a randomized color is allowed to land in, instead of picking from the full wheel. **Density Range** does the same for Base density, constraining how full or empty a randomized layer is allowed to get. Both are the other axis of control alongside locks:

- A **narrow range** (or one of the Palette Range presets, like Pastel or Monochrome) keeps every randomized value within a tight, cohesive family. Combined with locked structural settings and Auto-randomize, this produces a narrow, tasteful band of variations that all read as the same idea.
- A **wide range** (or Full spectrum, for Palette Range) lets that value drift much further between passes, so the same locked structure gets explored with far more contrast and variety.

Narrowing or widening a range does not change what is locked or unlocked. It changes how far a single unlocked field is allowed to wander, which makes it the difference between exploring a tight variation on one idea and exploring a much broader one. Density Range defaults to a window of 0 to 0.75 for exactly this reason: an unconstrained density can randomize all the way to 1.0, filling a layer with a solid, flat color.
