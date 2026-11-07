import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import type { Keyframe, Shot } from '../data/cameraPath';

export interface CoordinateFrame {
  /** plan-mm origin from scene.json.coordinate_system.origin_plan_mm */
  origin: [number, number, number];
}

export interface PathSample {
  position: Vector3;
  target: Vector3;
  fov: number;
  ceiling: number;
  /** index of the keyframe the camera is closest to / heading for */
  keyIndex: number;
  shot: Shot;
  chapter: string;
}

export interface ChapterWindow {
  chapter: string;
  /** progress where the chapter's first hold starts / last hold ends */
  start: number;
  end: number;
  /** progress where the chapter text should be fully visible */
  peak: number;
  keyIndices: number[];
}

/** plan millimetres → model metres, following scene.json (x=(X−ox)/1000, y=Y/1000, z=(Z−oz)/1000) */
export function planToModel(p: [number, number, number], f: CoordinateFrame): Vector3 {
  return new Vector3((p[0] - f.origin[0]) / 1000, p[1] / 1000, (p[2] - f.origin[2]) / 1000);
}

/** Fritsch–Carlson monotone cubic interpolation — C1-smooth, never overshoots (no speed reversal). */
class MonotoneCubic {
  private m: number[] = [];
  constructor(private xs: number[], private ys: number[]) {
    const n = xs.length;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m = new Array(n).fill(0);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    this.m = m;
  }
  at(x: number): number {
    const { xs, ys, m } = this;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 0;
    while (i < xs.length - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  }
}

export class CameraPath {
  readonly keys: Keyframe[];
  readonly positions: Vector3[];
  readonly targets: Vector3[];
  private posCurve: CatmullRomCurve3;
  private dirCurve: CatmullRomCurve3;
  private lookDist: number[];
  private warp: MonotoneCubic;
  /** progress at which each keyframe is reached (arrive) and left (leave) */
  readonly arrive: number[] = [];
  readonly leave: number[] = [];
  readonly chapters: ChapterWindow[] = [];

  constructor(keys: Keyframe[], frame: CoordinateFrame) {
    this.keys = keys;
    this.positions = keys.map(k => planToModel(k.pos, frame));
    this.targets = keys.map(k => planToModel(k.target, frame));
    this.posCurve = new CatmullRomCurve3(this.positions, false, 'centripetal');
    // Look direction is splined as unit vectors (not as a free target point) so the view can never
    // whip round when the target curve passes close to the camera.
    const dirs = keys.map((_, i) => this.targets[i].clone().sub(this.positions[i]));
    this.lookDist = dirs.map(d => d.length());
    this.dirCurve = new CatmullRomCurve3(dirs.map(d => d.normalize()), false, 'catmullrom', 0.5);

    // ---- scroll budget: dwell (hold) + travel (distance + turn angle) ----
    const budget: { x: number; u: number }[] = [];
    let acc = 0;
    const n = keys.length;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const dist = this.positions[i].distanceTo(this.positions[i - 1]);
        const d0 = this.targets[i - 1].clone().sub(this.positions[i - 1]).normalize();
        const d1 = this.targets[i].clone().sub(this.positions[i]).normalize();
        const ang = Math.acos(MathUtils.clamp(d0.dot(d1), -1, 1));
        acc += Math.max(0.45, 0.16 * dist + 1.3 * ang) * (keys[i].travel ?? 1);
      }
      this.arrive.push(acc);
      budget.push({ x: acc, u: i });
      if (keys[i].hold > 0) {
        acc += keys[i].hold;
        budget.push({ x: acc, u: i });
      }
      this.leave.push(acc);
    }
    const total = acc;
    for (let i = 0; i < n; i++) { this.arrive[i] /= total; this.leave[i] /= total; }
    // collapse duplicate x (zero-length) and normalise
    const xs: number[] = [], us: number[] = [];
    for (const b of budget) {
      const x = b.x / total;
      if (xs.length && Math.abs(x - xs[xs.length - 1]) < 1e-9) { us[us.length - 1] = b.u; continue; }
      xs.push(x); us.push(b.u);
    }
    this.warp = new MonotoneCubic(xs, us);

    // ---- chapters (consecutive keyframes sharing a chapter id) ----
    let cur: ChapterWindow | null = null;
    keys.forEach((k, i) => {
      if (!cur || cur.chapter !== k.chapter) {
        cur = { chapter: k.chapter, start: this.arrive[i], end: this.leave[i], peak: this.arrive[i], keyIndices: [] };
        this.chapters.push(cur);
      }
      cur.keyIndices.push(i);
      cur.end = this.leave[i];
    });
    // text windows follow the dwelling frames (holds), not the transition frames around them
    for (const c of this.chapters) {
      const holds = c.keyIndices.filter(j => keys[j].hold > 0);
      if (holds.length) {
        c.start = this.arrive[holds[0]];
        c.end = this.leave[holds[holds.length - 1]];
      }
      c.peak = (c.start + c.end) / 2;
    }
  }

  /** keyframe-index coordinate (0…n−1) for scroll progress p∈[0,1] */
  indexAt(p: number): number {
    return this.warp.at(MathUtils.clamp(p, 0, 1));
  }

  sample(p: number, out?: PathSample): PathSample {
    const n = this.keys.length;
    const k = this.indexAt(p);
    const u = k / (n - 1);
    const i0 = Math.min(n - 2, Math.floor(k));
    const f = k - i0;
    const s = f * f * (3 - 2 * f);
    const a = this.keys[i0], b = this.keys[i0 + 1];
    const o = out ?? ({ position: new Vector3(), target: new Vector3() } as PathSample);
    this.posCurve.getPoint(u, o.position);
    const dir = this.dirCurve.getPoint(u, new Vector3()).normalize();
    o.target.copy(o.position).addScaledVector(dir, MathUtils.lerp(this.lookDist[i0], this.lookDist[i0 + 1], s));
    o.fov = MathUtils.lerp(a.fov, b.fov, s);
    // ceilings fade out before the camera can reach them (bathroom ceilings sit at 2.4 m)
    const heightFade = MathUtils.clamp((2.15 - o.position.y) / 0.35, 0, 1);
    o.ceiling = Math.min(MathUtils.lerp(a.ceiling, b.ceiling, s), heightFade);
    const near = Math.round(k);
    o.keyIndex = near;
    o.shot = this.keys[near].shot;
    o.chapter = this.keys[near].chapter;
    return o;
  }

  /** progress value at which the camera rests on keyframe i (middle of its hold) */
  progressOf(i: number): number {
    return (this.arrive[i] + this.leave[i]) / 2;
  }

  chapterAt(p: number): number {
    let idx = 0;
    for (let i = 0; i < this.chapters.length; i++) if (p >= this.chapters[i].start - 1e-6) idx = i;
    return idx;
  }
}
