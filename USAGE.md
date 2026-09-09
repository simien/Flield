# Using Flield

- [The basics](#the-basics)
- [In-app tutorial](#in-app-tutorial)
- [Navigating the sidebar](#navigating-the-sidebar)
- [Exploring an art direction with Auto-randomize](#exploring-an-art-direction-with-auto-randomize)
- [Widening or narrowing with Palette Range and Density Range](#widening-or-narrowing-an-art-direction-with-palette-range-and-density-range)

## The basics

- Every composition is **three colors**: a background, plus two independently generated artwork layers.
- Each layer runs on its own **seed**, so the same seed and settings always regenerate the same result.
- The canvas sits on the right; every control that shapes it lives in the sidebar on the left.
- Every page load opens on a **freshly randomized** composition instead of a fixed default, background color, block size, and shape mask aside (more on why in [Locks](#locks)).

## In-app tutorial

Everything below is also built into the app itself. The **?** button (bottom of the sidebar, next to Copy Link) opens a thirteen-step tutorial, each step paired with a small live example of the control it's describing: what the tool does, sidebar navigation, dimension presets and Tile, the shape mask, layer settings, Palette Range and Density Range, locks, Random and Auto-randomize, Undo, and saving, sharing, and exporting.

It opens on its own the first time you visit. Check **Don't show this automatically on future visits** before closing it to skip that going forward; the **?** button still opens it anytime. Step through with the arrows or the dots at the bottom, or the left/right arrow keys.

## Navigating the sidebar

### Tabs

| Tab | What it holds |
|---|---|
| **General** | Canvas width and height (with Web, Tablet, Mobile, and Tile presets), background color, grid resolution (block size), and shape mask |
| **Layer A** / **Layer B** | That layer's seed, color, palette range, density range, flow field, symmetry mode, and smoothing |

### On a narrow screen

The sidebar becomes a drawer instead of a permanent column. A toggle button in the top corner opens and closes it; tapping outside the drawer or pressing Escape closes it too.

### Sliders

The click and drag target reaches well past the thin line you see, so grabbing a slider doesn't take a precise hit.

### Scrolling

A tab's content can run longer than the sidebar is tall. A soft fade shows up at whichever edge, top, bottom, or both, still has more to see, and clears once you've scrolled all the way to that edge.

### Confirmations

A few actions change something that might not be on screen right now, like **Lock All** changing icons on a layer tab that isn't open. Those show a brief confirmation above the canvas: **Lock All** / **Unlock All**, **Undo**, loading a saved state, and **Copy Link**.

### Locks

Every randomizable field, background color, block size, and shape mask included, has a small lock icon next to it.

- A **locked** field holds its current value through a randomize pass instead of getting a new one.
- **Lock** and **Unlock** at the top of the sidebar apply to every field at once.
- Background color, block size, and shape mask **start locked**. That's why a fresh page load keeps its starting background, grid resolution, and shape steady while everything else randomizes around them. Unlock any of the three to fold it into future randomize and Auto-randomize passes.

### Tiling without a seam

The **Tile** preset (General tab, next to Web/Tablet/Mobile) sets up a square canvas that repeats without a visible seam: it turns off the shape mask and switches both layers to 4-way mirror symmetry, which makes each layer's left edge match its right edge and its top edge match its bottom edge exactly. Both settings get locked automatically, so Random and Auto-randomize keep exploring colors, density, and flow field without breaking the seam.

### Saving and sharing a composition

| | Saved States | Copy Link |
|---|---|---|
| Where it lives | Your browser's local storage | A URL |
| How many | 3 slots (General tab) | Unlimited |
| Works across devices/people | No | Yes |
| Survives a reload | Yes | Yes, and forever |

Both capture the exact same thing: colors, both layers, everything. Use Saved States to bookmark a composition for yourself; use **Copy Link** (bottom of the sidebar) to hand an exact reproduction to someone else, or to yourself on a different device.

## Exploring an art direction with Auto-randomize

1. Click **Random** to reroll every unlocked field at once. Good for a first look, but left alone this just cycles through unrelated compositions.
2. **Lock down what you want to keep**, and let the rest stay unlocked. For example: lock a layer's seed and symmetry, leave density and flow field unlocked.
3. Click the **Auto-randomize** button (▶, next to Random) to repeat that reroll on a timer, from every 0.5 seconds up to every 10.

What comes through is a run of variations that share the same underlying structure, small differences in fill and texture on a shape that stays recognizable. It reads less like random noise and more like a designer trying variations on one idea.

> **Took a wrong turn?** **Undo** (next to Random) steps back through recent randomize passes, most recent first, and grays out once there's nothing left to undo.

**GIF export is the same loop, captured.** The step count option (1, 2, 3, 5, 8, 13) runs that same randomize sequence, frame by frame, at the Auto-randomize interval as the per-frame delay, the exact sequence Auto-randomize would generate rather than whatever the artboard happens to be showing at the moment.

## Widening or narrowing an art direction with Palette Range and Density Range

Each layer has two collapsible range controls, both collapsed by default:

- **Palette Range** constrains the hue, saturation, and lightness a randomized color is allowed to land in, instead of picking from the full wheel.
- **Density Range** does the same for Base density, constraining how full or empty a randomized layer is allowed to get. It defaults to a window of 0 to 0.5, since an unconstrained density can randomize all the way to 1.0 and fill a layer with a solid, flat color.

| | Effect |
|---|---|
| **Narrow range** (or a Palette Range preset like Pastel or Monochrome) | Every randomized value stays in a tight, cohesive family. Combined with locks and Auto-randomize, this produces a narrow, tasteful band of variations that all read as the same idea. |
| **Wide range** (or Full spectrum, for Palette Range) | The value drifts much further between passes, so the same locked structure gets explored with far more contrast and variety. |

Narrowing or widening a range doesn't change what's locked or unlocked; it changes how far a single *unlocked* field is allowed to wander. That's the difference between exploring a tight variation on one idea and exploring a much broader one.
