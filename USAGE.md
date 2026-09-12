# Using Flield

- [The basics](#the-basics)
- [In-app tutorial](#in-app-tutorial)
- [Navigating the sidebar](#navigating-the-sidebar)
- [Exploring an art direction with Auto-randomize](#exploring-an-art-direction-with-auto-randomize)
- [Widening or narrowing with Palette Range and Density Range](#widening-or-narrowing-an-art-direction-with-palette-range-and-density-range)

## The basics

- Every composition is **three colors**: a background, plus two independently generated artwork layers.
- Each layer runs on its own **seed**, so the same seed and settings always regenerate the same result.
- The canvas sits on the right, centered under the Flield name; every control that shapes it lives in the sidebar on the left.
- Every page load opens on a **freshly randomized** composition instead of a fixed default, background color, block size, and shape mask aside (more on why in [Locks](#locks)).

## In-app tutorial

Everything below is also built into the app itself. The **?** button (bottom of the sidebar, next to Copy Link) opens a thirteen-step tutorial, each step paired with a small live example of the control it's describing: what a flow field is, Random, sidebar navigation, layer settings, dimension presets and Tile, the shape mask, locks, Palette Range and Density Range, Auto-randomize, Undo, saving and sharing, exporting, and the animated exports, with a small canvas that runs one cycle of each kind.

On a first visit, a small **Take the tour** prompt appears above the canvas. Take it or dismiss it and it won't come back; the **?** button opens the tutorial anytime. Step through with the arrows or the dots at the bottom, or the left/right arrow keys.

## Navigating the sidebar

### Tabs

| Tab | What it holds |
|---|---|
| **General** | Canvas width and height (with Web, Tablet, Mobile, and Tile presets; a preset's chip stays lit while the values still match it), background color, grid resolution (block size), and shape mask |
| **Layer A** / **Layer B** | That layer's seed, color, palette range, density range, flow field, symmetry mode, and smoothing |

### On a narrow screen

The sidebar becomes a drawer instead of a permanent column. A toggle button in the top corner opens and closes it; tapping outside the drawer or pressing Escape closes it too.

### Sliders

The click and drag target reaches well past the thin line you see, so grabbing a slider doesn't take a precise hit.

**Flow scale** is measured in canvas pixels, so a setting reads the same at any block size. **Field strength** puts clear banding around the middle of its range; a link or saved slot from before this change loads with its strength halved and renders exactly as it did.

### Scrolling

A tab's content can run longer than the sidebar is tall. A soft fade shows up at whichever edge, top, bottom, or both, still has more to see, and clears once you've scrolled all the way to that edge.

### Confirmations

A few actions change something that might not be on screen right now, like **Lock All** changing icons on a layer tab that isn't open. Those show a brief confirmation above the canvas: **Lock All** / **Unlock All**, **Undo**, saving or loading a slot, and **Copy Link**.

### Locks

Every randomizable field, background color, block size, and shape mask included, has a small lock icon next to it.

- A **locked** field holds its current value through a randomize pass instead of getting a new one.
- **Lock** and **Unlock** (the row under Random) apply to every field at once.
- Each tab's button shows a small padlock when any of its fields are locked, solid once all of them are, and hovering it gives the exact count, so **Lock All** or a lock on another tab never goes unnoticed.
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
| Remembers which fields are locked | Yes | Yes |
| Can offer Auto-randomize on open | No | Yes, choose **Offers to play** in the menu beside Copy Link; the recipient gets a prompt to play it or keep the still |

Each saved slot shows its three colors and the time it was saved, so you can tell them apart before loading one. Both capture the exact same thing: colors, both layers, and the lock set, so a loaded slot or an opened link is ready for Random or Auto-randomize the way it was set up. Use Saved States to bookmark a composition for yourself; use **Copy Link** (bottom of the sidebar) to hand an exact reproduction to someone else, or to yourself on a different device.

### Keyboard shortcuts

| Key | Action |
|---|---|
| **R** | Random (reroll every unlocked field) |
| **Space** | Start or stop Auto-randomize |
| **Cmd+Z** / **Ctrl+Z** | Undo the last randomize pass |

All three stay out of the way while you're typing in a field, and the legend sits in the footer under the canvas.

## Exploring an art direction with Auto-randomize

1. Click **Random** to reroll every unlocked field at once. Good for a first look, but left alone this just cycles through unrelated compositions. A roll is steered, not blind: the two layers are kept apart in hue and both are kept apart from the background in lightness, as far as each layer's Palette Range allows, so three random colors still read as three.
2. **Lock down what you want to keep**, and let the rest stay unlocked. For example: lock a layer's seed and symmetry, leave density and flow field unlocked.
3. Click the **Auto-randomize** button (▶, next to Random) to repeat that reroll on a timer, from every 0.5 seconds up to every 10.

What comes through is a run of variations that share the same underlying structure, small differences in fill and texture on a shape that stays recognizable. It reads less like random noise and more like a designer trying variations on one idea.

> **Took a wrong turn?** **Undo** (the arrow at the left of the Random row) steps back through recent randomize passes, most recent first, and grays out once there's nothing left to undo.

**GIF export is the same loop, captured.** The step count option (3, 5, 8, 13) runs that same randomize sequence, frame by frame, at the Auto-randomize interval as the per-frame delay, the exact sequence Auto-randomize would generate rather than whatever the artboard happens to be showing at the moment.

**The animated kinds are a different animal.** The rest of the same menu holds every setting and both seeds and animates the composition on screen so the last frame flows straight into the first, with no visible cut:

- **Loop** breathes the flow field around a small closed path, one full turn across the frames. Each cell's dither is fixed by the seed, so shapes grow, shrink, and slide rather than flicker.
- **Drift** flows the field one way along its flow direction and travels exactly one period, so the pattern's density envelope repeats along that axis at flow scale times stretch pixels.
- **Wind** is Drift with weather. The field flows the same way and the same distance, but a second, much broader noise field bends where it's sampled, rising and settling once per cycle like a gust, and fine detail travels twice as far as the broad shapes, so wisps run ahead of the streaks they belong to. The gust starts and ends at nothing, so the cycle opens on Drift's first frame and the bending rises and settles once through it.
- **Pulse** swings density with one sine wave, 40% of each layer's density either way, so the composition inflates and thins. Cells appear and vanish in a stable order, so it breathes rather than sparkles. The one kind that moves without any field strength.

Each kind is one cycle of about three seconds. Its **×3** and **×5** entries are the two ideas combined: that many Auto-randomize passes, each held for the Auto-randomize interval and animated through one full cycle of that kind, then a cut to the next pass. It is the export of watching a preview with Auto-randomize running.

Layer B moves with Layer A rather than in lockstep, like two depths of one flow field: in Drift and Wind its heading is its own flow direction and its speed follows its own flow scale and stretch (and Wind's gust bends it from a point an eighth of a turn round, as in Loop), in Loop it circles the same way from a point an eighth of a turn further round, and in Pulse it swings the same way at 70% of the depth.

Picking any of them plays that kind on the canvas right away, at the export's own frame rate, so what you see is what the file will be; pick a step count to put the still back. Loop, Drift, and Wind need some field strength to have anything to move, and all make bigger files than a stepped GIF, since there are 38 frames per cycle instead of a handful; larger blocks bring it down.

## Widening or narrowing an art direction with Palette Range and Density Range

Each layer has two collapsible range controls, both collapsed by default:

- **Palette Range** constrains the hue, saturation, and lightness a randomized color is allowed to land in, instead of picking from the full wheel.
- **Density Range** does the same for Base density, constraining how full or empty a randomized layer is allowed to get. It defaults to a window of 0 to 0.5, since an unconstrained density can randomize all the way to 1.0 and fill a layer with a solid, flat color.

| | Effect |
|---|---|
| **Narrow range** (or a Palette Range preset like Pastel or Monochrome) | Every randomized value stays in a tight, cohesive family. Combined with locks and Auto-randomize, this produces a narrow, tasteful band of variations that all read as the same idea. |
| **Wide range** (or Full spectrum, for Palette Range) | The value drifts much further between passes, so the same locked structure gets explored with far more contrast and variety. |

Narrowing or widening a range doesn't change what's locked or unlocked; it changes how far a single *unlocked* field is allowed to wander. That's the difference between exploring a tight variation on one idea and exploring a much broader one.
