import { Color, HemisphereLight, MathUtils, PMREMGenerator, Scene, WebGLRenderer, Mesh, MeshStandardMaterial, Object3D, PointLight, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { LoadedModel } from './ModelLoader';

/** User-adjustable lighting. Defaults reproduce the Phase-1 calibration exactly. */
export interface LightState {
  /** solar time in hours (5 … 22); null = the Phase-1 calibrated sun */
  time: number | null;
  /** sky / ambient multiplier, 0 … 1.6 (1 = calibrated) */
  ambient: number;
  /** master switch for all interior lights */
  on: boolean;
  /** dimmer, 0 … 1.5 (1 = Phase-1 lumens) */
  dim: number;
  /** colour temperature override in K; null = as designed (3000 K downlights, 2700 K lamps, 3500 K mirrors) */
  cct: number | null;
  /** per-room switches; a room missing here is on */
  rooms: Record<string, boolean>;
}
export const DEFAULT_LIGHTS: LightState = { time: null, ambient: 1, on: true, dim: 1, cct: null, rooms: {} };

/** Xindian, New Taipei. Plan north is taken as page-up (−Z), as in Phase 1 — the drawing has no north arrow. */
const LAT = 24.97;
export interface SunPos { elevation: number; azimuth: number; dir: Vector3 }
/** simple solar geometry (declination + hour angle, solar time) for today's date */
export function sunAt(hours: number, date = new Date()): SunPos {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const n = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 864e5);
  const d = MathUtils.degToRad(23.44 * Math.sin(MathUtils.degToRad((360 / 365) * (284 + n))));
  const phi = MathUtils.degToRad(LAT), H = MathUtils.degToRad(15 * (hours - 12));
  const el = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI; // from north, clockwise
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  return { elevation: MathUtils.radToDeg(el), azimuth: MathUtils.radToDeg(az), dir };
}

/** Tanner Helland's black-body approximation, good to a few % over 1000–12000 K */
export function kelvinToColor(k: number, out = new Color()) {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => MathUtils.clamp(v, 0, 255) / 255;
  return out.setRGB(c(r), c(g), c(b), 'srgb');
}

interface LampRec { light: PointLight; base: number; color: Color; room: string | null }
interface GlowRec { mat: MeshStandardMaterial; base: number; color: Color; room: string | null }

const roomOf = (o: Object3D | null): string | null => {
  for (let n = o; n; n = n.parent) { const r = (n.userData as { room?: string | null }).room; if (r) return r; }
  return null;
};

/**
 * Keeps the model's own lights (KHR_lights_punctual) and blends between the two calibrations
 * recorded in scene.json.render_settings_threejs: interior (ceilings on) and exterior/cutaway (ceilings lifted).
 * On top of that, the design panel can switch rooms, dim, change colour temperature and move to night.
 */
export class Lighting {
  private hemi = new HemisphereLight(0xfff6ea, 0xd8d0c4, 0.4);
  private lamps: LampRec[] = [];
  private glows: GlowRec[] = [];
  private envMats: MeshStandardMaterial[] = [];
  private lastShadowCeiling = -1;
  private tmp = new Color();
  state: LightState = { ...DEFAULT_LIGHTS, rooms: {} };
  /** layers switched off in the studio (ceilings and ceiling fittings are driven here) */
  hiddenLayers: Set<string> = new Set();
  private sunHome: { pos: Vector3; target: Vector3; color: Color } | null = null;
  private lastTime: number | null | undefined = undefined;
  sun: SunPos | null = null;

  constructor(scene: Scene, private renderer: WebGLRenderer, private model: LoadedModel, shadows: boolean, shadowSize: number) {
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
    scene.add(this.hemi);
    model.pointLights.forEach(l => {
      l.castShadow = false;
      this.lamps.push({ light: l, base: l.intensity, color: l.color.clone(), room: roomOf(l) });
    });
    const sun = model.sun;
    if (sun) {
      sun.castShadow = shadows;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      sun.target.position.set(-3, 0, -6);
      scene.add(sun.target);
      this.sunHome = { pos: sun.position.clone(), target: sun.target.position.clone(), color: sun.color.clone() };
    }
    // light emitters (downlight lenses, lamp shades, cove, backlit mirrors): one material per room so each room switches alone
    const perRoom = new Map<string, MeshStandardMaterial>();
    model.root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = m.material as MeshStandardMaterial;
      if (mat.name !== 'emissive_warm' || !mat.emissive) return;
      const room = roomOf(m);
      const k = room ?? '*';
      let rm = perRoom.get(k);
      if (!rm) { rm = mat.clone(); perRoom.set(k, rm); this.glows.push({ mat: rm, base: mat.emissiveIntensity, color: mat.emissive.clone(), room }); }
      m.material = rm;
    });
    this.refreshMaterials();
    // static scene: render the shadow map only when what casts shadows changes
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  /** call after materials were swapped (design editor) so environment intensity reaches the new ones */
  refreshMaterials() {
    const set = new Set<MeshStandardMaterial>();
    this.model.root.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh) { const mat = m.material as MeshStandardMaterial; if ('envMapIntensity' in mat) set.add(mat); }
    });
    this.envMats = [...set];
  }

  /** rooms that own at least one light, for the panel */
  get lightRooms() { return [...new Set(this.lamps.map(l => l.room).filter((r): r is string => !!r))]; }

  roomOn(room: string | null) { return this.state.on && (room === null || this.state.rooms[room] !== false); }

  /** c = ceiling factor (1 interior, 0 cutaway / aerial) */
  update(c: number) {
    const k = MathUtils.clamp(c, 0, 1);
    const st = this.state;
    // time of day → sun direction, strength and colour; night = sun below the horizon
    const sun = this.model.sun;
    let n = 0, sunK = 1;
    if (st.time !== this.lastTime && sun && this.sunHome) {
      this.lastTime = st.time;
      if (st.time === null) {
        this.sun = null;
        sun.position.copy(this.sunHome.pos); sun.target.position.copy(this.sunHome.target); sun.color.copy(this.sunHome.color);
      } else {
        this.sun = sunAt(st.time);
        sun.target.position.set(0, 0, 0);
        sun.position.copy(this.sun.dir).multiplyScalar(35);
        kelvinToColor(MathUtils.lerp(2300, 5600, MathUtils.smoothstep(this.sun.elevation, 0, 35)), sun.color);
      }
      sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.sun) {
      n = 1 - MathUtils.smoothstep(this.sun.elevation, -5, 6);
      sunK = MathUtils.smoothstep(this.sun.elevation, -1, 12);
    }
    const amb = st.ambient;
    // night: sky and reflections drop, exposure opens a little (as an eye adapting)
    this.renderer.toneMappingExposure = MathUtils.lerp(1.0, 0.72, k) * MathUtils.lerp(1, 1.12, n);
    const env = MathUtils.lerp(0.55, 0.3, k) * MathUtils.lerp(1, 0.16, n) * amb;
    for (const m of this.envMats) m.envMapIntensity = env;
    this.hemi.intensity = MathUtils.lerp(0.4, 0.12, k) * MathUtils.lerp(1, 0.12, n) * amb;
    if (sun) { sun.intensity = MathUtils.lerp(3.2, 1.8, k) * sunK; sun.visible = sunK > 0.001; }
    // by day the interior lights only read with the ceilings on; at night they also light the cut-away views
    const reach = Math.max(k, n * 0.9);
    for (const l of this.lamps) {
      const i = this.roomOn(l.room) ? l.base * reach * st.dim : 0;
      l.light.intensity = i;
      l.light.visible = i > 1e-3;
      if (st.cct) kelvinToColor(st.cct, l.light.color); else l.light.color.copy(l.color);
    }
    for (const g of this.glows) {
      g.mat.emissiveIntensity = this.roomOn(g.room) ? g.base * MathUtils.clamp(st.dim, 0.15, 1.5) : 0;
      if (st.cct) g.mat.emissive.copy(kelvinToColor(st.cct, this.tmp).lerp(new Color(1, 1, 1), 0.35)); else g.mat.emissive.copy(g.color);
    }
    // ceilings: fade, and stop casting shadows once lifted
    const on = k > 0.5 ? 1 : 0;
    for (const mat of this.model.ceilingMaterials) {
      mat.transparent = k < 0.999; mat.opacity = k; mat.depthWrite = k >= 0.999;
    }
    const hide = this.hiddenLayers;
    if (this.model.ceilings) this.model.ceilings.visible = k > 0.005 && !hide.has('Ceiling');
    for (const f of this.model.ceilingFixtures) f.visible = k > 0.5 && !hide.has('Lighting') && !hide.has('Ceiling');
    if (on !== this.lastShadowCeiling) {
      this.model.ceilings?.traverse(o => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = on === 1; });
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowCeiling = on;
    }
  }

  setDesignLayer(visible: boolean) {
    this.model.designLayer.forEach(o => (o.visible = visible));
    this.renderer.shadowMap.needsUpdate = true;
  }
}
