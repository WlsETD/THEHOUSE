import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import type { CameraPath, PathSample } from '../animation/CameraPath';
import { planToModel } from '../animation/CameraPath';

export type CameraMode = 'scroll' | 'explore' | 'transition';

/** Model-space footprint of the dwelling (plan bbox), used to decide when ceilings belong on in explore mode */
const INTERIOR_PLAN = { x0: 0, x1: 13600, z0: 430, z1: 11230 };

/**
 * Keyframe FOVs are composed for a 16:10 frame. On narrower (portrait) screens the vertical FOV is widened
 * so most of the horizontal composition survives, capped to avoid wide-angle distortion.
 */
export function adaptFov(fov: number, aspect: number, ref = 1.6): number {
  if (aspect >= 1.3) return fov;
  const t = Math.tan(MathUtils.degToRad(fov / 2)) * Math.pow(ref / aspect, 0.62);
  return Math.min(80, MathUtils.radToDeg(2 * Math.atan(t)));
}

export class CameraController {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  mode: CameraMode = 'scroll';
  /** ceiling factor computed for the current frame (0…1) */
  ceiling = 0;
  readonly look = new Vector3();
  private sample: PathSample = { position: new Vector3(), target: new Vector3() } as PathSample;
  private idleT = 0;
  private reduced: boolean;
  private origin: [number, number, number];
  private tween: gsap.core.Tween | null = null;

  constructor(dom: HTMLElement, aspect: number, private path: CameraPath, origin: [number, number, number], reduced: boolean) {
    this.camera = new PerspectiveCamera(30, aspect, 0.05, 300);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.maxDistance = 45;
    this.controls.minDistance = 0.4;
    this.reduced = reduced;
    this.origin = origin;
  }

  /** scroll mode: place camera on the path at progress p */
  applyProgress(p: number, dt: number) {
    if (this.mode !== 'scroll') return;
    let q = p;
    if (this.reduced) {
      // reduced motion: hold on the nearest dwelling keyframe instead of flying between them
      const k = Math.round(this.path.indexAt(p));
      let best = k;
      for (let d = 0; d < this.path.keys.length; d++) {
        if (this.path.keys[k - d]?.hold > 0) { best = k - d; break; }
        if (this.path.keys[k + d]?.hold > 0) { best = k + d; break; }
      }
      q = this.path.progressOf(best);
    }
    const s = this.path.sample(q, this.sample);
    // establishing shot: a very slow breathing drift while the visitor takes in the plan
    this.idleT += dt;
    const idle = this.reduced ? 0 : 1 - MathUtils.smoothstep(p, 0, 0.025);
    const pos = s.position.clone();
    if (idle > 0) {
      const a = Math.sin(this.idleT * 0.12) * 0.035 * idle;
      const rel = pos.clone().sub(s.target);
      rel.applyAxisAngle(new Vector3(0, 1, 0), a);
      pos.copy(s.target).add(rel);
      pos.y += Math.sin(this.idleT * 0.17) * 0.12 * idle;
    }
    this.camera.position.copy(pos);
    this.look.copy(s.target);
    this.camera.lookAt(s.target);
    const fov = adaptFov(s.fov, this.camera.aspect);
    if (Math.abs(this.camera.fov - fov) > 1e-3) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.ceiling = s.ceiling;
  }

  /** explore mode: ceilings only while the camera is inside the dwelling below ceiling height */
  updateExplore() {
    if (this.mode === 'scroll') return;
    if (this.mode === 'explore') this.controls.update();
    const p = this.camera.position;
    const X = p.x * 1000 + this.origin[0], Z = p.z * 1000 + this.origin[2];
    const inside = X > INTERIOR_PLAN.x0 && X < INTERIOR_PLAN.x1 && Z > INTERIOR_PLAN.z0 && Z < INTERIOR_PLAN.z1;
    const target = inside ? MathUtils.clamp((2.15 - p.y) / 0.35, 0, 1) : 0;
    this.ceiling += (target - this.ceiling) * 0.15;
  }

  enterExplore() {
    this.tween?.kill();
    this.mode = 'explore';
    this.controls.target.copy(this.look);
    this.controls.enabled = true;
    this.controls.update();
  }

  /** animate to a pose (plan-mm or model-m), keeping orbit controls in sync */
  flyTo(pos: Vector3, target: Vector3, fov: number, duration = 1.6, onDone?: () => void) {
    this.tween?.kill();
    const wasExplore = this.mode === 'explore';
    this.mode = 'transition';
    this.controls.enabled = false;
    const from = { p: this.camera.position.clone(), t: this.look.clone(), f: this.camera.fov };
    const st = { k: 0 };
    this.tween = gsap.to(st, {
      k: 1, duration: this.reduced ? 0.01 : duration, ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.position.lerpVectors(from.p, pos, st.k);
        this.look.lerpVectors(from.t, target, st.k);
        this.camera.lookAt(this.look);
        this.camera.fov = MathUtils.lerp(from.f, fov, st.k); this.camera.updateProjectionMatrix();
      },
      onComplete: () => {
        if (wasExplore) { this.mode = 'explore'; this.controls.target.copy(this.look); this.controls.enabled = true; this.controls.update(); }
        onDone?.();
      },
    });
  }

  flyToPlan(pos: [number, number, number], target: [number, number, number], fov: number, duration?: number, onDone?: () => void) {
    const f = { origin: this.origin };
    this.flyTo(planToModel(pos, f), planToModel(target, f), fov, duration, onDone);
  }

  /** leave explore: glide back onto the scroll path at progress p, then hand control back */
  exitExplore(p: number, onDone: () => void) {
    const s = this.path.sample(p, { position: new Vector3(), target: new Vector3() } as PathSample);
    this.controls.enabled = false;
    this.mode = 'transition';
    this.flyTo(s.position, s.target, adaptFov(s.fov, this.camera.aspect), 1.4, () => { this.mode = 'scroll'; onDone(); });
  }

  setAspect(a: number) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
  dispose() { this.tween?.kill(); this.controls.dispose(); }
}
