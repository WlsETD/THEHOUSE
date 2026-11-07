import { ACESFilmicToneMapping, Color, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PlaneGeometry, Raycaster, Scene, SRGBColorSpace, Vector2, WebGLRenderer, Object3D } from 'three';
import { loadModel, type LoadedModel } from './ModelLoader';
import { Lighting } from './Lighting';
import { CameraController } from './CameraController';
import { CameraPath } from '../animation/CameraPath';
import { KEYFRAMES } from '../data/cameraPath';

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
  readonly quality: Quality;
  progress = 0;
  private raf = 0;
  private last = performance.now();
  private frames = 0; private fpsT = 0; fps = 0;
  private listeners = new Set<(f: FrameInfo) => void>();
  private ro: ResizeObserver;
  private ray = new Raycaster();

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

  onFrame(fn: (f: FrameInfo) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  start() {
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      this.frames++; this.fpsT += dt;
      if (this.fpsT > 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
      if (this.cam.mode === 'scroll') this.cam.applyProgress(this.progress, dt);
      else this.cam.updateExplore();
      this.lighting.update(this.cam.ceiling);
      this.renderer.render(this.scene, this.cam.camera);
      const info = { progress: this.progress, ceiling: this.cam.ceiling, fps: this.fps };
      this.listeners.forEach(l => l(info));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** returns the Phase-1 object (with extras) under a canvas point */
  pick(x: number, y: number): Record<string, unknown> | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.cam.camera);
    const hits = this.ray.intersectObject(this.model.root, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      const m = (h.object as Mesh).material as MeshStandardMaterial;
      if (m?.transparent && m.opacity < 0.5) continue;
      let o: Object3D | null = h.object;
      while (o && !(o.userData as { id?: string }).id) o = o.parent;
      if (o) return o.userData as Record<string, unknown>;
    }
    return null;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.cam?.setAspect(w / h);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.cam?.dispose();
    this.scene.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh) { m.geometry.dispose(); const mat = m.material as MeshStandardMaterial; Object.values(mat).forEach(v => (v as { isTexture?: boolean })?.isTexture && (v as { dispose: () => void }).dispose()); mat.dispose(); }
    });
    this.renderer.dispose();
  }
}
