/**
 * Camera-path QA — runs the exact CameraPath used by the site against Phase-1 scene.json geometry.
 * Checks: wall / furniture / glazing / door-leaf penetration, keyframe clearance, smooth speed, smooth turning.
 * Usage: npm run qa:path   (writes reports/camera-path-qa.json)
 */
import fs from 'node:fs';
import { Vector3 } from 'three';
import { KEYFRAMES } from '../src/data/cameraPath';
import { CameraPath } from '../src/animation/CameraPath';

const scene = JSON.parse(fs.readFileSync('public/data/scene.json', 'utf8'));
const frame = { origin: scene.coordinate_system.origin_plan_mm as [number, number, number] };
const path = new CameraPath(KEYFRAMES, frame);
const R = 0.15; // camera collision radius (m)

type Box = { id: string; cat: string; min: number[]; max: number[] };
const boxes: Box[] = [];
for (const o of scene.objects) {
  if (['Floor', 'Ceiling'].includes(o.category)) continue;
  if (o.id.startsWith('DEC_RUG') || o.id.startsWith('FIN_') || o.id.startsWith('THR_')) continue;
  if (o.category === 'Lighting' && o.info?.type === 'downlight') continue; // flush with ceiling, hidden with it
  let min = [...o.bbox_m.min], max = [...o.bbox_m.max];
  if (o.yaw_deg && o.pivot_m) {
    const th = (o.yaw_deg * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const [px, , pz] = o.pivot_m;
    const xs: number[] = [], zs: number[] = [];
    for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) {
      const dx = x - px, dz = z - pz;
      xs.push(px + dx * c + dz * s); zs.push(pz - dx * s + dz * c);
    }
    min = [Math.min(...xs), min[1], Math.min(...zs)]; max = [Math.max(...xs), max[1], Math.max(...zs)];
  }
  if (o.id.endsWith('_FRAME')) {
    // a door frame is two 15 mm jambs + a head piece, not a solid block across the opening
    const op = scene.openings.find((x: any) => x.id === o.info.door);
    const [x0, z0, x1, z1] = op.rect.map((v: number, k: number) => (v - frame.origin[k % 2 === 0 ? 0 : 2]) / 1000);
    const alongZ = Math.abs(x1 - x0) < Math.abs(z1 - z0); const t = 0.015, h = op.height / 1000;
    const parts = alongZ
      ? [[x0, 0, z0, x1, h, z0 + t], [x0, 0, z1 - t, x1, h, z1], [x0, h, z0, x1, h + t, z1]]
      : [[x0, 0, z0, x0 + t, h, z1], [x1 - t, 0, z0, x1, h, z1], [x0, h, z0, x1, h + t, z1]];
    parts.forEach((q, j) => boxes.push({ id: `${o.id}#${j}`, cat: 'Door', min: [q[0], q[1], q[2]], max: [q[3], q[4], q[5]] }));
    continue;
  }
  boxes.push({ id: o.id, cat: o.category, min, max });
}
const ceilings = scene.objects.filter((o: any) => o.category === 'Ceiling');

function segHitsBox(a: Vector3, b: Vector3, bx: Box, r: number): boolean {
  let t0 = 0, t1 = 1;
  const d = [b.x - a.x, b.y - a.y, b.z - a.z], p = [a.x, a.y, a.z];
  for (let k = 0; k < 3; k++) {
    const lo = bx.min[k] - r, hi = bx.max[k] + r;
    if (Math.abs(d[k]) < 1e-12) { if (p[k] < lo || p[k] > hi) return false; continue; }
    let ta = (lo - p[k]) / d[k], tb = (hi - p[k]) / d[k];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

const N = 3000;
const S = Array.from({ length: N + 1 }, (_, i) => path.sample(i / N, { position: new Vector3(), target: new Vector3() } as any));
const hits: { p: number; id: string; cat: string }[] = [];
for (let i = 0; i < N; i++) {
  const a = S[i].position, b = S[i + 1].position;
  for (const bx of boxes) if (segHitsBox(a, b, bx, R)) hits.push({ p: +(i / N).toFixed(4), id: bx.id, cat: bx.cat });
  // ceilings are only obstacles while they are shown
  if (S[i].ceiling > 0.5) for (const c of ceilings) {
    const bx = { id: c.id, cat: 'Ceiling', min: c.bbox_m.min, max: c.bbox_m.max };
    if (segHitsBox(a, b, bx, 0.05)) hits.push({ p: +(i / N).toFixed(4), id: c.id, cat: 'Ceiling' });
  }
}
// clearance at hold keyframes
const clear = KEYFRAMES.map((k, i) => {
  const p = path.positions[i];
  let best = Infinity, who = '';
  for (const bx of boxes) {
    const dx = Math.max(bx.min[0] - p.x, 0, p.x - bx.max[0]);
    const dy = Math.max(bx.min[1] - p.y, 0, p.y - bx.max[1]);
    const dz = Math.max(bx.min[2] - p.z, 0, p.z - bx.max[2]);
    const d = Math.hypot(dx, dy, dz);
    if (d < best) { best = d; who = bx.id; }
  }
  return { id: k.id, shot: k.shot, clearance_m: +best.toFixed(3), nearest: who };
});
// speed and turn smoothness
const speeds: number[] = [], turns: number[] = [];
for (let i = 0; i < N; i++) {
  speeds.push(S[i + 1].position.distanceTo(S[i].position) * N);
  const d0 = S[i].target.clone().sub(S[i].position).normalize();
  const d1 = S[i + 1].target.clone().sub(S[i + 1].position).normalize();
  turns.push((Math.acos(Math.min(1, Math.max(-1, d0.dot(d1)))) * 180) / Math.PI);
}
let maxJump = 0, jumpAt = 0;
for (let i = 1; i < speeds.length; i++) {
  const j = Math.abs(speeds[i] - speeds[i - 1]) / N; // change in metres-per-progress per sample, in m
  if (j > maxJump) { maxJump = j; jumpAt = i / N; }
}
const maxTurn = Math.max(...turns);
const maxTurnPerPct = maxTurn * (N / 100);
const interiorHits = hits.filter(h => true);
const uniq = [...new Map(interiorHits.map(h => [h.id + '@' + Math.round(h.p * 100), h])).values()];
const report = {
  samples: N,
  keyframes: KEYFRAMES.length,
  chapters: path.chapters.map(c => ({ chapter: c.chapter, start: +c.start.toFixed(4), end: +c.end.toFixed(4) })),
  collisions: uniq,
  min_keyframe_clearance: clear.filter(c => c.shot !== 'establishing' && c.shot !== 'final').sort((a, b) => a.clearance_m - b.clearance_m).slice(0, 6),
  smoothness: {
    max_speed_change_between_samples_m: +maxJump.toFixed(4), at_progress: +jumpAt.toFixed(4),
    max_view_turn_per_sample_deg: +maxTurn.toFixed(3), max_view_turn_per_1pct_scroll_deg: +maxTurnPerPct.toFixed(1),
  },
  verdict: uniq.length === 0 ? 'PASS' : 'FAIL',
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/camera-path-qa.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify({ verdict: report.verdict, collisions: uniq.slice(0, 20), min_clear: report.min_keyframe_clearance, smooth: report.smoothness }, null, 1));
process.exit(uniq.length ? 1 : 0);
