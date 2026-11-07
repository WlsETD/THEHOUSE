# Wu Residence — Scroll-Driven 3D Interior (Phase 2)

A cinematic, scroll-controlled walk through the **Phase-1 interior model** of project ACL16004
(新店吳公館, drawing A-D-11 rev.01), rendered live with Three.js. Scrolling moves the camera
along a fixed path: every scroll offset maps to exactly one camera pose, so scrolling up plays
the film backwards. A free-explore mode adds orbit / zoom / pan, an overview and a floor-plan view.

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
| Right-edge navigation, **Index** | jump to a space | — |
| `E` | enter free explore | back to the tour (camera glides back to your scroll position) |
| `F` | fullscreen | fullscreen |
| `Esc` | close index | leave explore |

## Assets (from Phase 1, unchanged)

| File | Use |
|---|---|
| `public/models/scene.glb` | original Phase-1 model (8.79 MB) — load it with `?model=original` |
| `public/models/scene.opt.glb` | same model, Draco geometry + WebP textures (2.56 MB). All 446 node names, transforms, `extras`, 21 KHR lights and 20 cameras are identical (verified) |
| `public/data/scene.json` | coordinate system, object IDs, sizes, render settings |
| `public/data/rooms.json` | room names, areas, polygons (navigation, index, loading-screen plan) |
| `public/data/materials.json` | material names, categories, where used (material section) |
| `public/data/cameras.json` | Phase-1 camera presets (kept for reference; the film uses `src/data/cameraPath.ts`) |
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
  components/   Header, RoomNavigation, RoomInformation, LoadingScreen, Overlays (hero, finale, index, explore toolbar)
  three/        SceneManager (renderer, loop, picking), ModelLoader (GLTF + Draco), CameraController (scroll / explore / fly-to), Lighting
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
