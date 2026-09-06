# Flowgrain

A browser-based generative pixel art tool for creating unique two-color compositions from seeded flow fields and symmetry.

## Live demo

[https://simien.github.io/flowgrain/](https://simien.github.io/flowgrain/)

## Screenshot

![Flowgrain screenshot](screenshot.png)

## Features

- Two independently configurable color layers, each with its own seed, density, and directional flow field
- Seven symmetry modes: 4-way mirror, horizontal, vertical, 180-degree rotational, diagonal, 8-way kaleidoscope, and none
- Palette range controls (hue, saturation, lightness) with five presets, plus fully custom ranges
- Per-field locks, so a randomize pass can hold specific settings steady while re-rolling the rest
- Three save-state slots stored in the browser for revisiting a composition later
- Auto-randomize playback with an adjustable interval
- Export to PNG, SVG, or an animated GIF, with frame count and speed both configurable

## Running locally

Flowgrain is plain HTML, CSS, and JavaScript. No build step, no package manager.

1. Clone the repository
2. Serve the folder with any static file server, for example: `python3 -m http.server 8080`
3. Open `http://localhost:8080` in a browser

## How it works

Each layer's shape comes from a seeded value noise field (a small Perlin-style implementation in `generator.js`), rotated and stretched to create a directional flow instead of isolated static. That field biases each cell's fill probability rather than gating cells on or off directly, which produces smooth density gradients across the canvas. Symmetry modes apply as a final mirror or rotation pass over the generated grid.
