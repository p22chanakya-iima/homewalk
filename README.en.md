# Homewalk: brochure to 3D

A buyer-first viewer for real-estate brochures. Pick a project, pick a home type (shown as the brochure's own floor-plan snippet), then tour it in 3D with the real Hyderabad sun, per-room direct-sun hours and a Furnish mode.

```bash
python3 -m http.server 8765     # then open http://localhost:8765   (landing page; the Demo button opens /app.html)
node tools/build-plans.js       # plans/src/*.json -> plans/*.json + plans/index.json
python3 tools/overlay.py ira-type07 0.85            # draw the generated walls over the brochure page to check the trace
python3 tools/crop-snippets.py                      # cut each plan out of the brochure PDF -> plans/img/*.jpg (gallery tiles)
python3 tools/gridcrop.py <pdf> <page> <dpi> x0 y0 x1 y1 out.png [zoom]   # labelled pixel grid for reading coordinates
```

**Pages:** `index.html` is the landing page, `app.html` is the app. The landing page embeds a live, reduced view of the app with `app.html?embed=1&plan=<plan id>` (sun, orbit, iso/top, furniture and labels only). The landing screenshots in `assets/` are real captures of the running app.

**Projects in the gallery:** IRA Aspiration (all 13 typical-floor plans, from `IRA Aspiration final-4th April-2022 (2).pdf`).

**How a plan is made:** a spec in `plans/src/` lists room rectangles/polygons, doors, windows, furniture and the plan's north angle, read off the brochure page (pixels; optional `offset`/`zoom` so coordinates can be read straight off a grid image). `tools/build-plans.js` generates the walls and openings. Plans are indicative, not survey-grade: room sizes are read by eye from labels printed in raster images (OCR was tried and is not reliable on them), and window positions are only partly visible in the grayscale drawings.

**Roof:** the 3D view never draws a roof, but the sun treats the home as roofed (the floor above, over every room and over the sit-outs, as on a typical middle floor). Light enters only through windows, sliding doors and open arches. A `topFloor` flag on a plan removes the roof over its sit-outs.

**Direct-sun hours:** per room, for the chosen date, from real sun positions over Hyderabad (SunCalc), tested against walls, window sills/heads, closed doors and ceilings. They ignore neighbouring buildings, trees and balconies above, and are understated where windows are missing from a plan.

---

# Floor Plan Interior Designer

[中文](README.md) | English

A pure front-end tool for interior design on a floor plan: place furniture, remove or modify walls, and take measurements on a 2D plan, then switch to a Three.js 3D scene with one click — view it from above or walk through it in first person. The whole app is a single `index.html`: no build step, just open it.

## Features

**2D Floor Plan**
- Displays the original floor plan at 1:60 / 1:100 scale, dimensions in mm
- Move, rotate (hold Shift for free angle), and resize items, with automatic snapping to walls
- Measuring tool (snaps to nearby walls; hold Shift to lock horizontal / vertical)
- Remove or modify non-load-bearing walls; load-bearing walls are marked separately
- Layer toggles: dimensions, room names, furniture, grid, load-bearing walls

**3D Scene**
- Bird's-eye, oblique, and top-down views; click a room in the list to fly to it
- Walkthrough mode: WASD + mouse on desktop, virtual joystick on touch devices; click doors to open / close them
- Toggle between full-height and cut-away walls, time-of-day sunlight slider, night lighting
- Detailed furniture models: cabinet door gaps and handles, upholstered headboards, metal and ceramic materials with environment reflections, and more
- Select and drag furniture in 3D as well, kept in sync with the 2D plan in real time

**Plans & Statistics**
- Automatic calculation of room areas and net usable floor area
- Change the floor material of each room (wood, tiles, marble, terrazzo, carpet, etc.), with cost estimates based on area plus 5% wastage
- Undo / redo; plans are auto-saved in the browser's local storage
- Chinese / English UI toggle (button on the right of the top bar; defaults to Chinese and remembers your choice)
- Export to PNG, export / import plans as JSON

## Quick Start

```bash
git clone <repository-url>
cd <repository-directory>
```

Then simply open `index.html` in your browser. Alternatively, start a local static server:

```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

> Three.js is loaded from the jsDelivr CDN, so an internet connection is required the first time you open the 3D scene.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `T` | Toggle 2D / 3D |
| `V` / `M` / `X` | Select / Measure / Modify walls |
| `R` / `Shift+R` | Rotate selected furniture 90° clockwise / counterclockwise |
| `Delete` / `Backspace` | Delete selected furniture |
| `Ctrl/⌘ + D` | Duplicate selected furniture |
| `Ctrl/⌘ + Z`, `Ctrl/⌘ + Shift + Z` | Undo, redo |
| `F` | Fit to window |
| `+` / `-` | Zoom in / out |
| `Shift + F` | Fullscreen |
| `Esc` | Cancel current action |
| Walkthrough: `WASD` / arrow keys, `Shift`, `E` | Move, walk faster, open / close doors |

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- 2D floor plan rendered with SVG
- 3D scene built with [Three.js](https://threejs.org/) r160 (OrbitControls, PointerLockControls, RoundedBoxGeometry, RoomEnvironment, CSS2DRenderer)
- Data stored in `localStorage`

## Customizing the Floor Plan

The floor plan data lives in `index.html`:

- `ROOMS`: room polygons, names, and default floor materials
- `WALLS` / `WINS`: walls and window openings
- `MATS`: floor material names and unit prices
- `buildFurniture()`: 3D models for each furniture type

Edit this data to use your own floor plan.

## Social Media

- X (Twitter): [@akokoi1](https://x.com/akokoi1)

## License

[MIT](LICENSE)
