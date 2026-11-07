# Wu Residence — Scroll-Driven 3D Interior (Phase 2)

A cinematic, scroll-controlled walk through the **Phase-1 interior model** of project ACL16004
(新店吳公館, drawing A-D-11 rev.01), rendered live with Three.js. Scrolling moves the camera
along a fixed path: every scroll offset maps to exactly one camera pose, so scrolling up plays
the film backwards. A free-explore mode adds orbit / zoom / pan, an overview and a floor-plan view.

The site is in **Traditional Chinese by default** with an English switch (header **EN / 中文**, or `?lang=en`).

### Design Studio (設計工作室)

Open it from the header at any time — during the scroll tour or in free explore. Everything you change
is applied live to the Phase-1 model; geometry, IDs and coordinates never change, only finishes and light.

| Section | What it does |
|---|---|
| 01 材質 Materials | Walls, floors, ceilings, bathroom walls, oak / walnut / lacquered joinery, doors, benchtops, upholstery. Pick a finish (re-uses the model's own PBR materials, re-scaled to real size) and a colour (presets or any colour). Floors, ceilings, joinery and upholstery can be set **per room**; walls and doors are shared between rooms, so they apply to the whole home. Four themes from the design deck (p.7) plus "as designed". |
| 02 燈光 Lighting | Time of day (real sun position for Xindian, today's date; plan north = page-up), ambient light, interior lights on/off, brightness, colour temperature 2700–4000 K, and a switch per room. |
| 03 視角 Camera | Reset, perspective, top / front (south) / side (east) orthographic, rotate, zoom, four quick scenes (aerial, section, living & dining, master suite). |
| 04 模式 Modes | First-person walk at 1650 mm eye height (WASD / arrows / on-screen pad, walls block you), A-D-11 plan overlay at true scale, section cut at 900 mm, dimensions (overall + every room), exploded view 0–100 %. |
| 05 空間 Spaces | Fly to any of the 20 spaces (uses the Phase-1 room cameras). |
| 06 圖層 Layers | Show / hide floors, columns, exterior walls, partitions, openings, joinery, furniture, fixtures, light fittings, ceilings. |
| 07 物件 Inspector | Click any object: ID, room, W × D × H, centre coordinates, materials, source (drawn / derived / assumed) — and change that one object's finish. Units mm / m / ft. |
| 08 匯出 Export | glTF (.glb, with the current finishes and visible layers), OBJ, scene.json, PNG of the view, and a JSON record of every design choice. |

The dimension & validation report (button at the top of the studio) is read from `validation.json` and `scene.json.assumptions`.
Design choices are remembered in this browser (localStorage) until you reset them.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve dist/ at http://localhost:4173
npm run qa:path    # camera-path collision & smoothness check against scene.json
```

Node 18+ (tested on Node 22). No API keys, no backend.

## Controls

| Input | Scroll tour | Free explore |
|---|---|---|
| Mouse wheel / trackpad / touch swipe | moves the camera along the film | zoom |
| Drag | — | orbit (right-drag / two fingers: pan) |
| Bottom scene bar, its ☰ sidebar, **Index** | jump to a space | — |
| `E` | enter free explore | back to the tour (camera glides back to your scroll position) |
| `F` | fullscreen | fullscreen |
| `Esc` | close index | leave explore (or leave the walk) |
| `W A S D`, arrows, `Q` / `E` | — | walk mode: move, strafe, turn |

## Assets (from Phase 1, unchanged)

| File | Use |
|---|---|
| `public/models/scene.glb` | original Phase-1 model (8.79 MB) — load it with `?model=original` |
| `public/models/scene.opt.glb` | same model, Draco geometry + WebP textures (2.56 MB). All 446 node names, transforms, `extras`, 21 KHR lights and 20 cameras are identical (verified) |
| `public/data/scene.json` | coordinate system, object IDs, sizes, render settings |
| `public/data/rooms.json` | room names, areas, polygons (navigation, index, loading-screen plan) |
| `public/data/materials.json` | material names, categories, where used (material section) |
| `public/data/cameras.json` | Phase-1 camera presets (studio room fly-to and walk start points; the film uses `src/data/cameraPath.ts`) |
| `public/data/validation.json` | Phase-1 dimension audit and model checks (studio report) |
| `public/data/plan_A-D-11.png` + `plan_overlay.json` | A-D-11 rendered from the PDF, ink as alpha, with its extent in plan mm (plan overlay) |
| `public/textures/*_basecolor.jpg` | material swatches |
| `public/draco/` | Draco decoder (from three r160) |

Rebuild the optimised model after replacing `scene.glb`: `npm run optimize:model`.

## Coordinate system

Taken from `scene.json.coordinate_system` and never redefined: metres, +Y up, +X east, +Z south,
origin = centre of the 14,521 × 12,271 mm plan box at finished floor level.
Camera keyframes are authored in **plan millimetres** (same frame as the drawing) and converted at
runtime with `origin_plan_mm` (`src/animation/CameraPath.ts → planToModel`).

## Project structure

```
src/
  components/   Header, RoomNavigation (bottom dock + sidebar), RoomInformation, LoadingScreen, Overlays (hero, finale, index, explore toolbar),
                StudioPanel (design studio), StudioOverlays (dimension labels, walk pad, report)
  three/        SceneManager (renderer, loop, picking), ModelLoader (GLTF + Draco), CameraController (scroll / explore / fly-to),
                Lighting (calibration + switches, dimmer, CCT, sun position), DesignEditor (finish swaps), StudioTools (views, walk,
                section, overlay, dimensions, explode, layers, selection), exporters
  i18n.tsx      zh / en strings and language switch; chapter copy in data/roomData.zh.ts
  animation/    ScrollController (GSAP ScrollTrigger scrub), CameraPath (splines + time-warp), RoomTransitions (text sync)
  data/         cameraPath.ts (keyframes + shot types), roomData.ts (chapter copy), types.ts (Phase-1 data loaders)
  styles/       global.css, layout.css, animations.css
scripts/qa-path.ts   camera-path QA
tests/               Playwright end-to-end tests + report generator
reports/             test results and screenshots
```

## How the camera film works

1. `cameraPath.ts` lists 44 keyframes with a **shot type** (establishing, wide, medium, close-up,
   transition, final), a dwell weight and a ceiling flag.
2. `CameraPath` builds a centripetal Catmull-Rom spline for position and splines the **look
   direction** as unit vectors, so the view cannot whip round. FOV and ceiling factor are eased per segment.
3. Scroll budget per segment = dwell + distance + turn angle. A monotone cubic (Fritsch–Carlson)
   maps scroll progress to the path, giving C¹-continuous speed with gentle stops on each room.
4. `ScrollController` scrubs that progress with ScrollTrigger (`scrub: 1.1`). Reduced-motion
   visitors get direct cuts between resting frames instead of flights.
5. Ceilings fade out before the camera rises above 2.15 m, and the lighting blends between the two
   calibrations stored in `scene.json.render_settings_threejs` (interior / cutaway).

Edit keyframes, then run `npm run qa:path`. It replays the exact runtime path against every wall,
column, closed glazing, open door leaf and furniture box in `scene.json` (0.15 m camera radius)
and fails on any crossing.

## Deployment

`npm run build` produces a static site in `dist/` with relative paths (`base: './'`), so it works
from any sub-folder.

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output directory `dist`.
- **Any web server / S3 / GitHub Pages**: upload `dist/`. Make sure `.glb` is served as
  `model/gltf-binary` and `.wasm` as `application/wasm`; enable gzip/brotli for `.js`, `.json`, `.wasm`.
- Fonts load from Google Fonts; without network access the site falls back to Didot/Futura/system faces.

## Browser support

Any browser with WebGL 2 (current Chrome, Edge, Firefox, Safari 15+, iOS/iPadOS 15+, Android Chrome).
If WebGL is unavailable the loading screen says so instead of failing silently.
