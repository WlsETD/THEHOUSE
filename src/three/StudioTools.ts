import {
  BoxHelper, BufferGeometry, Color, DoubleSide, FrontSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, MathUtils, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, PerspectiveCamera, Plane, PlaneGeometry, Raycaster,
  SRGBColorSpace, Texture, TextureLoader, Vector3, type Side,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneManager } from './SceneManager';
import type { ProjectData, Room, SceneObject } from '../data/types';

export type ViewMode = 'persp' | 'top' | 'front' | 'side' | 'walk';
export type Unit = 'mm' | 'm' | 'ft';

export function fmtLen(mm: number, u: Unit) {
  if (u === 'm') return `${(mm / 1000).toFixed(2)} m`;
  if (u === 'ft') return `${(mm / 304.8).toFixed(2)} ft`;
  return `${Math.round(mm).toLocaleString('en-US')} mm`;
}
export function fmtArea(m2: number, u: Unit) {
  return u === 'ft' ? `${(m2 * 10.7639).toFixed(1)} ft²` : `${m2.toFixed(2)} m²`;
}

export interface LayerDef { key: string; en: string; zh: string; match: (o: SceneObject) => boolean }
const isExt = (id: string) => /^(W_EXT|W_PAR|EXT_)/.test(id);
export const LAYERS: LayerDef[] = [
  { key: 'Floor', en: 'Floors & slab', zh: '地板與樓板', match: o => o.category === 'Floor' },
  { key: 'Column', en: 'Structural columns', zh: '結構大柱', match: o => o.category === 'Column' },
  { key: 'ExtWall', en: 'Exterior walls', zh: '建築外牆', match: o => o.category === 'Wall' && isExt(o.id) },
  { key: 'IntWall', en: 'Interior partitions', zh: '室內隔間牆', match: o => o.category === 'Wall' && !isExt(o.id) },
  { key: 'Opening', en: 'Doors, windows & sliders', zh: '門窗與橫拉門', match: o => ['Door', 'Window', 'Opening'].includes(o.category) },
  { key: 'Cabinet', en: 'Joinery', zh: '系統櫃與木作', match: o => o.category === 'Cabinet' },
  { key: 'Furniture', en: 'Furniture & beds', zh: '活動家具與床組', match: o => o.category === 'Furniture' },
  { key: 'Fixture', en: 'Kitchen, bath & AC', zh: '廚衛與冷氣設備', match: o => o.category === 'Fixture' },
  { key: 'Lighting', en: 'Light fittings', zh: '燈具', match: o => o.category === 'Lighting' },
  { key: 'Ceiling', en: 'Ceilings', zh: '平頂天花板', match: o => o.category === 'Ceiling' },
];

/** exploded view: how many "storeys" each category lifts (× 1.3 m at 100 %) */
const EXPLODE_LEVEL: Record<string, number> = { Floor: 0, Column: 1, Wall: 1, Door: 1, Window: 1, Opening: 1, Cabinet: 2, Fixture: 2, Furniture: 3, Lighting: 3.6, Ceiling: 4.4 };
const COLLIDE = new Set(['Wall', 'Column', 'Door', 'Window', 'Cabinet', 'Furniture', 'Fixture']);
const EYE = 1.65;

interface NodeRec { obj: Object3D; id: string; cat: string; layer: string; y0: number; data?: SceneObject }
export interface Label { key: string; text: string; sub?: string; pos: Vector3; kind: 'room' | 'dim' }

export class StudioTools {
  view: ViewMode = 'persp';
  section = false;
  sectionHeight = 0.9;
  overlay = false;
  dims = false;
  explode = 0;
  unit: Unit = 'mm';
  lang: 'zh' | 'en' = 'zh';
  readonly hidden = new Set<string>();
  readonly ortho: OrthographicCamera;
  readonly orthoControls: OrbitControls;
  readonly labels: Label[] = [];
  private nodes: NodeRec[] = [];
  private byId = new Map<string, NodeRec>();
  private collidables: Mesh[] = [];
  private wallMeshes: Mesh[] = [];
  private sides = new Map<object, Side>();
  private planMesh: Mesh | null = null;
  private dimGroup = new Group();
  private helper: BoxHelper | null = null;
  private selected: string | null = null;
  private ray = new Raycaster();
  private listeners = new Set<() => void>();
  private orthoH = 16;
  // walk state
  private yaw = 0; private pitch = 0;
  private keys = new Set<string>();
  readonly pad = { f: 0, s: 0 };
  private drag: [number, number] | null = null;

  constructor(private mgr: SceneManager, private data: ProjectData) {
    const canvas = mgr.renderer.domElement;
    this.ortho = new OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
    this.orthoControls = new OrbitControls(this.ortho, canvas);
    this.orthoControls.enabled = false;
    this.orthoControls.enableDamping = true;
    this.orthoControls.screenSpacePanning = true;
    this.orthoControls.minZoom = 0.4; this.orthoControls.maxZoom = 12;

    const objs = new Map(data.scene.objects.map(o => [o.id, o]));
    mgr.model.root.traverse(o => {
      const ud = o.userData as { id?: string; category?: string };
      if (!ud.id || !objs.has(ud.id)) return; // scene.json objects only (room groups carry ids too)
      for (let p = o.parent; p; p = p.parent) { const pid = (p.userData as { id?: string }).id; if (pid && objs.has(pid)) return; } // top-most object node
      const d = objs.get(ud.id);
      const layer = d ? LAYERS.find(l => l.match(d))?.key ?? '' : '';
      const rec: NodeRec = { obj: o, id: ud.id, cat: ud.category ?? d?.category ?? '', layer, y0: o.position.y, data: d };
      this.nodes.push(rec); this.byId.set(ud.id, rec);
      o.traverse(c => {
        const m = c as Mesh;
        if (!m.isMesh) return;
        if (COLLIDE.has(rec.cat)) this.collidables.push(m);
        if (rec.cat === 'Wall' || rec.cat === 'Column') this.wallMeshes.push(m);
      });
    });
    mgr.scene.add(this.dimGroup);
    this.dimGroup.visible = false;
    mgr.lighting.hiddenLayers = this.hidden;

    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKey);
    canvas.addEventListener('pointerdown', this.onDown);
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerup', this.onUp);
  }

  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach(l => l()); }

  get activeCamera(): PerspectiveCamera | OrthographicCamera {
    return this.view === 'top' || this.view === 'front' || this.view === 'side' ? this.ortho : this.mgr.cam.camera;
  }
  get isOrtho() { return this.activeCamera === this.ortho; }

  // ── views ──────────────────────────────────────────────────────────────
  setView(v: ViewMode) {
    const cam = this.mgr.cam;
    if (v === 'walk') return this.enterWalk();
    this.view = v;
    if (v === 'persp') {
      this.orthoControls.enabled = false;
      cam.controls.enabled = cam.mode === 'explore';
    } else {
      cam.controls.enabled = false;
      const o = this.ortho;
      o.up.set(0, 1, 0);
      const pose = v === 'top' ? { p: [0, 40, 0.001], t: [0, 0, 0], h: 15.2 } : v === 'front' ? { p: [0, 1.5, 40], t: [0, 1.5, 0], h: 8 } : { p: [40, 1.5, 0], t: [0, 1.5, 0], h: 8 };
      o.position.set(pose.p[0], pose.p[1], pose.p[2]);
      this.orthoControls.target.set(pose.t[0], pose.t[1], pose.t[2]);
      this.orthoH = pose.h; o.zoom = 1;
      this.fitOrtho();
      o.lookAt(this.orthoControls.target);
      this.orthoControls.enabled = true;
      this.orthoControls.update();
    }
    this.emit();
  }

  fitOrtho() {
    const c = this.mgr.renderer.domElement;
    const full = this.ortho.view?.enabled ? this.ortho.view.fullWidth : c.clientWidth;
    const a = full / Math.max(1, c.clientHeight);
    const vis = c.clientWidth / Math.max(1, full);
    // front/side elevations need the plan width across the screen; top view needs the depth too
    const w = (this.view === 'side' ? 13.2 : 15.4) / vis;
    const h = Math.max(this.orthoH, w / a);
    Object.assign(this.ortho, { left: (-h * a) / 2, right: (h * a) / 2, top: h / 2, bottom: -h / 2 });
    this.ortho.updateProjectionMatrix();
  }

  rotate(deg: number) {
    if (this.view === 'walk') { this.yaw += MathUtils.degToRad(deg); return; }
    if (this.isOrtho) {
      const t = this.orthoControls.target, p = this.ortho.position.clone().sub(t);
      if (this.view === 'top') {
        const a = Math.atan2(p.x, p.z) + MathUtils.degToRad(deg);
        this.ortho.position.set(t.x + Math.sin(a) * 0.01, this.ortho.position.y, t.z + Math.cos(a) * 0.01);
      } else { p.applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(deg)); this.ortho.position.copy(t).add(p); }
      this.orthoControls.update();
      return;
    }
    const c = this.mgr.cam, t = c.controls.target.clone();
    const p = c.camera.position.clone().sub(t).applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(deg)).add(t);
    c.flyTo(p, t, c.camera.fov, 0.6);
  }

  zoom(f: number) {
    if (this.view === 'walk') { const c = this.mgr.cam.camera; c.fov = MathUtils.clamp(c.fov * f, 30, 90); c.updateProjectionMatrix(); return; }
    if (this.isOrtho) { this.ortho.zoom = MathUtils.clamp(this.ortho.zoom / f, 0.4, 12); this.ortho.updateProjectionMatrix(); return; }
    const c = this.mgr.cam, t = c.controls.target.clone();
    const p = c.camera.position.clone().sub(t).multiplyScalar(f).add(t);
    c.flyTo(p, t, c.camera.fov, 0.5);
  }

  // ── first-person walk ──────────────────────────────────────────────────
  enterWalk(start?: { pos: Vector3; target: Vector3 }) {
    const cam = this.mgr.cam;
    const rc = this.data.cameras as { room_cameras: Record<string, { position_m: number[]; target_m: number[] }> };
    const s = start ?? (() => { const r = rc.room_cameras.R01_ENTRY; return { pos: new Vector3(...r.position_m), target: new Vector3(...r.target_m) }; })();
    this.view = 'walk';
    (document.activeElement as HTMLElement | null)?.blur?.(); // keys go to the walk, not to a focused slider
    cam.controls.enabled = false; this.orthoControls.enabled = false;
    cam.camera.position.set(s.pos.x, EYE, s.pos.z);
    const d = s.target.clone().sub(s.pos);
    this.yaw = Math.atan2(-d.x, -d.z); this.pitch = 0;
    cam.camera.fov = 62; cam.camera.updateProjectionMatrix();
    this.emit();
  }

  /** walk from inside a room, using that room's Phase-1 camera */
  walkRoom(id: string) {
    const rc = (this.data.cameras as { room_cameras: Record<string, { position_m: number[]; target_m: number[] }> }).room_cameras[id];
    if (rc) this.enterWalk({ pos: new Vector3(...rc.position_m), target: new Vector3(...rc.target_m) });
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.view !== 'walk') return;
    const t = e.target as HTMLElement;
    if (t && ((t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k)) return;
    if (k.startsWith('arrow')) e.preventDefault();
    if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
  };
  private onDown = (e: PointerEvent) => { if (this.view === 'walk') this.drag = [e.clientX, e.clientY]; };
  private onMove = (e: PointerEvent) => {
    if (!this.drag || this.view !== 'walk') return;
    this.yaw -= (e.clientX - this.drag[0]) * 0.0042;
    this.pitch = MathUtils.clamp(this.pitch - (e.clientY - this.drag[1]) * 0.0036, -1.1, 1.1);
    this.drag = [e.clientX, e.clientY];
  };
  private onUp = () => { this.drag = null; };

  private blocked(from: Vector3, dir: Vector3, dist: number) {
    if (dist < 1e-5) return false;
    for (const h of [0.3, 1.2]) {
      this.ray.set(new Vector3(from.x, h, from.z), dir);
      this.ray.far = dist + 0.28;
      const hit = this.ray.intersectObjects(this.collidables, false).find(i => this.visibleChain(i.object));
      if (hit) return true;
    }
    return false;
  }

  private updateWalk(dt: number) {
    const cam = this.mgr.cam.camera;
    const k = this.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + this.pad.f;
    const s = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) + this.pad.s;
    const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
    this.yaw += turn * dt * 1.6;
    const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new Vector3(-fwd.z, 0, fwd.x);
    const mv = fwd.multiplyScalar(MathUtils.clamp(f, -1, 1)).add(right.multiplyScalar(MathUtils.clamp(s, -1, 1)));
    if (mv.lengthSq() > 0) {
      // 1.5 m/s in real time, in small sub-steps so a slow frame cannot tunnel through a wall
      mv.normalize();
      const p = cam.position;
      for (let left = Math.min(dt, 0.1); left > 1e-4; left -= 0.04) {
        const step = Math.min(left, 0.04) * 1.5;
        const d = mv.clone().multiplyScalar(step);
        if (!this.blocked(p, mv, step)) { p.add(d); continue; }
        // slide along whatever was hit
        let moved = false;
        for (const ax of [new Vector3(d.x, 0, 0), new Vector3(0, 0, d.z)]) {
          const l = ax.length(); if (l < 1e-5) continue;
          if (!this.blocked(p, ax.clone().normalize(), l)) { p.add(ax); moved = true; break; }
        }
        if (!moved) break;
      }
      p.y = EYE;
    }
    const look = new Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.mgr.cam.look.copy(cam.position).add(look);
    cam.lookAt(this.mgr.cam.look);
  }

  exitWalk() {
    if (this.view !== 'walk') return;
    this.view = 'persp';
    const cam = this.mgr.cam;
    cam.controls.target.copy(cam.look);
    cam.controls.enabled = cam.mode === 'explore';
    cam.controls.update();
    this.keys.clear(); this.pad.f = this.pad.s = 0;
    this.emit();
  }

  // ── modes ──────────────────────────────────────────────────────────────
  setSection(on: boolean) {
    this.section = on;
    const r = this.mgr.renderer;
    r.clippingPlanes = on ? [new Plane(new Vector3(0, -1, 0), this.sectionHeight)] : [];
    this.applyWallSides();
    r.shadowMap.needsUpdate = true;
    this.emit();
  }
  /** cut walls show their inside faces so the section reads as solid */
  applyWallSides() {
    for (const m of this.wallMeshes) {
      const mat = m.material as MeshStandardMaterial;
      if (!this.sides.has(mat)) this.sides.set(mat, mat.side);
      const want = this.section ? DoubleSide : this.sides.get(mat) ?? FrontSide;
      if (mat.side !== want) { mat.side = want; mat.needsUpdate = true; }
    }
  }

  async setOverlay(on: boolean) {
    this.overlay = on;
    if (on && !this.planMesh) {
      const tex: Texture = await new TextureLoader().loadAsync('./data/plan_A-D-11.png');
      tex.colorSpace = SRGBColorSpace; tex.anisotropy = 8;
      const meta = await fetch('./data/plan_overlay.json').then(r => r.json()) as { extent_plan_mm: [number, number, number, number] };
      const [x0, z0, x1, z1] = meta.extent_plan_mm;
      const o = this.data.scene.coordinate_system.origin_plan_mm;
      const mesh = new Mesh(new PlaneGeometry((x1 - x0) / 1000, (z1 - z0) / 1000),
        new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(((x0 + x1) / 2 - o[0]) / 1000, 0.004, ((z0 + z1) / 2 - o[2]) / 1000);
      mesh.renderOrder = 2;
      mesh.name = '__plan_overlay';
      this.planMesh = mesh;
      this.mgr.scene.add(mesh);
    }
    if (this.planMesh) this.planMesh.visible = this.overlay;
    this.emit();
  }

  setDims(on: boolean) {
    this.dims = on;
    if (on && !this.dimGroup.children.length) this.buildDims();
    this.dimGroup.visible = on;
    this.rebuildLabels();
    this.emit();
  }

  private buildDims() {
    const o = this.data.scene.coordinate_system.origin_plan_mm;
    const [bx, bz, bw, bh] = this.data.scene.meta.bbox_plan_mm;
    const P = (x: number, z: number, y = 0.03) => [(x - o[0]) / 1000, y, (z - o[2]) / 1000];
    const off = 700, tick = 180;
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    // north edge (overall width) and west edge (overall depth)
    seg(P(bx, bz - off), P(bx + bw, bz - off));
    seg(P(bx, bz - off - tick), P(bx, bz - off + tick)); seg(P(bx + bw, bz - off - tick), P(bx + bw, bz - off + tick));
    seg(P(bx - off, bz), P(bx - off, bz + bh));
    seg(P(bx - off - tick, bz), P(bx - off + tick, bz)); seg(P(bx - off - tick, bz + bh), P(bx - off + tick, bz + bh));
    // each interior room: its width and depth across the polygon bounding box
    for (const r of this.data.rooms.rooms) {
      if (r.kind !== 'interior') continue;
      const xs = r.polygon_mm.map(p => p[0]), zs = r.polygon_mm.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const zm = z0 + (z1 - z0) * 0.22, xm = x0 + (x1 - x0) * 0.18;
      seg(P(x0 + 40, zm, 0.02), P(x1 - 40, zm, 0.02));
      seg(P(xm, z0 + 40, 0.02), P(xm, z1 - 40, 0.02));
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const line = new LineSegments(g, new LineBasicMaterial({ color: new Color('#c19463'), transparent: true, opacity: 0.95, depthTest: false }));
    line.renderOrder = 5;
    this.dimGroup.add(line);
  }

  rebuildLabels() {
    this.labels.length = 0;
    if (!this.dims) return;
    const o = this.data.scene.coordinate_system.origin_plan_mm;
    const [bx, bz, bw, bh] = this.data.scene.meta.bbox_plan_mm;
    const V = (x: number, z: number, y = 0.05) => new Vector3((x - o[0]) / 1000, y, (z - o[2]) / 1000);
    this.labels.push({ key: 'W', kind: 'dim', text: fmtLen(bw, this.unit), sub: this.lang === 'zh' ? '總寬' : 'overall width', pos: V(bx + bw / 2, bz - 700) });
    this.labels.push({ key: 'D', kind: 'dim', text: fmtLen(bh, this.unit), sub: this.lang === 'zh' ? '總深' : 'overall depth', pos: V(bx - 700, bz + bh / 2) });
    for (const r of this.data.rooms.rooms as Room[]) {
      const xs = r.polygon_mm.map(p => p[0]), zs = r.polygon_mm.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cz = zs.reduce((a, b) => a + b, 0) / zs.length;
      this.labels.push({ key: r.id, kind: 'room', text: this.lang === 'zh' ? r.name_zh : r.name_en, sub: `${fmtArea(r.area_m2, this.unit)} · ${fmtLen(x1 - x0, this.unit)} × ${fmtLen(z1 - z0, this.unit)}`, pos: V(cx, cz, 0.9) });
    }
  }

  setUnit(u: Unit) { this.unit = u; this.rebuildLabels(); this.emit(); }
  setLang(l: 'zh' | 'en') { this.lang = l; this.rebuildLabels(); this.emit(); }

  setExplode(f: number) {
    this.explode = MathUtils.clamp(f, 0, 1);
    for (const n of this.nodes) n.obj.position.y = n.y0 + (EXPLODE_LEVEL[n.cat] ?? 0) * 1.3 * this.explode;
    this.mgr.model.ceilings && (this.mgr.model.ceilings.position.y = (EXPLODE_LEVEL.Ceiling * 1.3 * this.explode));
    this.mgr.renderer.shadowMap.needsUpdate = true;
    this.helper?.update();
    this.emit();
  }

  setLayer(key: string, visible: boolean) {
    if (visible) this.hidden.delete(key); else this.hidden.add(key);
    for (const n of this.nodes) if (n.layer === key && key !== 'Ceiling' && key !== 'Lighting') n.obj.visible = visible;
    // light fittings: ceiling-flush ones are switched by Lighting each frame, the rest here
    if (key === 'Lighting') for (const n of this.nodes) if (n.layer === 'Lighting' && !this.mgr.model.ceilingFixtures.includes(n.obj)) n.obj.visible = visible;
    this.mgr.renderer.shadowMap.needsUpdate = true;
    this.emit();
  }

  visibleChain(o: Object3D | null) { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; }

  // ── selection ──────────────────────────────────────────────────────────
  select(id: string | null) {
    this.selected = id;
    if (this.helper) { this.mgr.scene.remove(this.helper); this.helper.dispose(); this.helper = null; }
    const n = id ? this.byId.get(id) : undefined;
    if (n) {
      this.helper = new BoxHelper(n.obj, new Color('#c19463'));
      (this.helper.material as LineBasicMaterial).depthTest = false;
      this.helper.renderOrder = 6;
      this.mgr.scene.add(this.helper);
    }
    this.emit();
  }
  get selection() { return this.selected; }
  objectData(id: string) { return this.byId.get(id)?.data; }

  /** reset every inspection tool (views, cuts, layers) — design changes stay */
  resetTools() {
    if (this.view === 'walk') this.exitWalk();
    if (this.view !== 'persp') this.setView('persp');
    if (this.section) this.setSection(false);
    if (this.overlay) void this.setOverlay(false);
    if (this.dims) this.setDims(false);
    if (this.explode) this.setExplode(0);
    [...this.hidden].forEach(k => this.setLayer(k, true));
    this.select(null);
  }

  /** per-frame: drive the active camera and the ceiling factor */
  frame(dt: number) {
    const cam = this.mgr.cam;
    if (cam.mode === 'scroll') return false;
    if (this.view === 'walk') { this.updateWalk(dt); cam.ceiling += (1 - cam.ceiling) * 0.2; return true; }
    if (this.isOrtho) { this.orthoControls.update(); cam.ceiling += (0 - cam.ceiling) * 0.25; return true; }
    return false;
  }

  dispose() {
    removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey);
    this.mgr.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    removeEventListener('pointermove', this.onMove); removeEventListener('pointerup', this.onUp);
    this.orthoControls.dispose();
  }
}
