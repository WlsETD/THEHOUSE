import { ACESFilmicToneMapping, Color, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PlaneGeometry, Raycaster, Scene, SRGBColorSpace, Vector2, WebGLRenderer, Object3D } from 'three';
import { loadModel, type LoadedModel } from './ModelLoader';
import { Lighting } from './Lighting';
import { CameraController } from './CameraController';
import { CameraPath } from '../animation/CameraPath';
import { KEYFRAMES } from '../data/cameraPath';
import { DesignEditor } from './DesignEditor';
import { StudioTools } from './StudioTools';
import type { ProjectData } from '../data/types';

export interface Quality { pixelRatio: number; shadows: boolean; shadowSize: number; antialias: boolean }

export function detectQuality(): Quality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const mobile = coarse && small;
  const tablet = coarse && !small;
  return {
    pixelRatio: Math.min(devicePixelRatio, mobile ? 1.5 : tablet ? 1.6 : 1.75),
    shadows: !mobile,
    shadowSize: tablet ? 2048 : 4096,
    antialias: !mobile,
  };
}

export interface FrameInfo { progress: number; ceiling: number; fps: number }

export class SceneManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  model!: LoadedModel;
  lighting!: Lighting;
  cam!: CameraController;
  path!: CameraPath;
  editor!: DesignEditor;
  tools!: StudioTools;
  readonly quality: Quality;
  progress = 0;
  private raf = 0;
  private last = performance.now();
  private frames = 0; private fpsT = 0; fps = 0;
  private listeners = new Set<(f: FrameInfo) => void>();
  private ro: ResizeObserver;
  private ray = new Raycaster();
  /** px covered on the right by the studio panel */
  private inset = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.quality = detectQuality();
    this.renderer = new WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color('#141412');
    const ground = new Mesh(new PlaneGeometry(240, 240), new MeshStandardMaterial({ color: '#1d1c1a', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true;
    this.scene.add(ground);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
  }

  async load(origin: [number, number, number], onProgress: (f: number) => void, reduced: boolean) {
    this.model = await loadModel(onProgress);
    this.scene.add(this.model.root);
    this.path = new CameraPath(KEYFRAMES, { origin });
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.cam = new CameraController(this.canvas, w / Math.max(1, h), this.path, origin, reduced);
    this.lighting = new Lighting(this.scene, this.renderer, this.model, this.quality.shadows, this.quality.shadowSize);
    this.resize();
    // compile shaders before the first visible frame to avoid a hitch when scrolling starts
    this.cam.applyProgress(0, 0);
    this.lighting.update(this.cam.ceiling);
    this.renderer.compile(this.scene, this.cam.camera);
  }

  /** live design editing + studio tools (needs the Phase-1 data files) */
  initStudio(data: ProjectData) {
    this.editor = new DesignEditor(this.model, data.materials.materials, new Map(data.scene.objects.map(o => [o.id, o])), () => {
      this.lighting.refreshMaterials();
      this.tools?.applyWallSides();
    });
    this.tools = new StudioTools(this, data);
  }

  /** current frame as an image (rendered again so the drawing buffer is fresh) */
  snapshot(type = 'image/png') {
    this.renderer.render(this.scene, this.tools?.activeCamera ?? this.cam.camera);
    return this.renderer.domElement.toDataURL(type, 0.92);
  }

  onFrame(fn: (f: FrameInfo) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  start() {
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      this.frames++; this.fpsT += dt;
      if (this.fpsT > 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
      if (this.cam.mode === 'scroll') this.cam.applyProgress(this.progress, dt);
      else if (!this.tools?.frame(dt)) this.cam.updateExplore();
      this.lighting.update(this.cam.ceiling);
      this.renderer.render(this.scene, this.tools?.activeCamera ?? this.cam.camera);
      const info = { progress: this.progress, ceiling: this.cam.ceiling, fps: this.fps };
      this.listeners.forEach(l => l(info));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** returns the Phase-1 object (with extras) under a canvas point */
  pick(x: number, y: number): Record<string, unknown> | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.tools?.activeCamera ?? this.cam.camera);
    const hits = this.ray.intersectObject(this.model.root, true);
    for (const h of hits) {
      if (this.tools ? !this.tools.visibleChain(h.object) : !h.object.visible) continue;
      // inside a section cut, ignore what was clipped away
      if (this.tools?.section && h.point.y > this.tools.sectionHeight) continue;
      const m = (h.object as Mesh).material as MeshStandardMaterial;
      if (m?.transparent && m.opacity < 0.5) continue;
      let o: Object3D | null = h.object;
      while (o && !(o.userData as { id?: string }).id) o = o.parent;
      if (o) return o.userData as Record<string, unknown>;
    }
    return null;
  }

  setInset(px: number) { this.inset = px; this.resize(); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const i = this.inset;
    // render a virtual frame (w + inset) wide and show its left w px: the optical centre moves left of the panel
    this.cam?.setAspect((w + i) / h);
    for (const c of [this.cam?.camera, this.tools?.ortho]) {
      if (!c) continue;
      if (i > 0) c.setViewOffset(w + i, h, i, 0, w, h); else c.clearViewOffset();
    }
    this.tools?.fitOrtho();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.cam?.dispose();
    this.tools?.dispose();
    this.editor?.dispose();
    this.scene.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh) { m.geometry.dispose(); const mat = m.material as MeshStandardMaterial; Object.values(mat).forEach(v => (v as { isTexture?: boolean })?.isTexture && (v as { dispose: () => void }).dispose()); mat.dispose(); }
    });
    this.renderer.dispose();
  }
}
