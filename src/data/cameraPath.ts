/**
 * Cinematic camera keyframes — authored in PLAN millimetres (same frame as Phase-1 scene.json:
 * X → east, Z → south, Y → height). Converted to model metres at runtime with
 * scene.json.coordinate_system.origin_plan_mm, so the axis convention is never redefined here.
 *
 * Every interior keyframe and every segment between them is checked against walls, columns,
 * closed glazing, open door leaves and furniture by `npm run qa:path`.
 */
export type Shot = 'establishing' | 'wide' | 'medium' | 'closeup' | 'transition' | 'final';

export interface Keyframe {
  id: string;
  /** chapter id: room id from rooms.json, a material key from materials.json, or hero/finale */
  chapter: string;
  shot: Shot;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** scroll weight spent dwelling on this frame (0 = pass-through) */
  hold: number;
  /** 1 = ceilings shown (interior journey), 0 = ceilings removed (aerial / cutaway) */
  ceiling: 0 | 1;
  /** optional extra travel weight multiplier for the segment arriving at this frame */
  travel?: number;
}

export const KEYFRAMES: Keyframe[] = [
  // ── A. Establishing ────────────────────────────────────────────────────────
  { id: 'K00', chapter: 'hero', shot: 'establishing', pos: [25000, 19500, 26500], target: [4200, 0, 7500], fov: 28, hold: 1.6, ceiling: 0 },
  { id: 'K01', chapter: 'hero', shot: 'transition', pos: [-4500, 12500, 19000], target: [5000, 0, 6000], fov: 32, hold: 0, ceiling: 0, travel: 1.3 },
  { id: 'K02', chapter: 'hero', shot: 'transition', pos: [-6500, 5200, 4500], target: [1000, 800, 2000], fov: 38, hold: 0, ceiling: 0 },
  { id: 'K03', chapter: 'R01_ENTRY', shot: 'transition', pos: [-1200, 1600, 1745], target: [2500, 1300, 1900], fov: 50, hold: 0, ceiling: 1 },
  // ── B. Entry → public zone ─────────────────────────────────────────────────
  { id: 'K04', chapter: 'R01_ENTRY', shot: 'wide', pos: [1350, 1600, 1850], target: [1150, 1250, 5400], fov: 56, hold: 1.0, ceiling: 1 },
  { id: 'K05', chapter: 'R03_DINING', shot: 'wide', pos: [1100, 1650, 3150], target: [4700, 1100, 4200], fov: 50, hold: 1.0, ceiling: 1 },
  { id: 'K06', chapter: 'R03_DINING', shot: 'closeup', pos: [2000, 1250, 5350], target: [4300, 900, 4250], fov: 34, hold: 0.8, ceiling: 1 },
  { id: 'K07', chapter: 'R04_KITCHEN', shot: 'transition', pos: [4900, 1550, 3250], target: [6500, 1200, 2700], fov: 48, hold: 0, ceiling: 1 },
  { id: 'K08', chapter: 'R04_KITCHEN', shot: 'medium', pos: [5550, 1700, 3900], target: [6350, 1000, 1700], fov: 50, hold: 1.0, ceiling: 1 },
  { id: 'K08b', chapter: 'R04_KITCHEN', shot: 'transition', pos: [5300, 1550, 3300], target: [3500, 1200, 3200], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K09', chapter: 'R05_LIVING', shot: 'transition', pos: [4600, 1350, 3100], target: [2500, 1200, 7500], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K10', chapter: 'R05_LIVING', shot: 'wide', pos: [3600, 1650, 6350], target: [1400, 1100, 10300], fov: 54, hold: 1.2, ceiling: 1 },
  { id: 'K11', chapter: 'R05_LIVING', shot: 'closeup', pos: [2500, 1350, 9700], target: [250, 1400, 8600], fov: 40, hold: 0.8, ceiling: 1 },
  // ── C. Family wing ─────────────────────────────────────────────────────────
  { id: 'K11b', chapter: 'R07_PLAY', shot: 'transition', pos: [3300, 1550, 8300], target: [4700, 1200, 6600], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K12', chapter: 'R07_PLAY', shot: 'transition', pos: [4150, 1600, 6650], target: [6600, 1100, 8800], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K13', chapter: 'R07_PLAY', shot: 'wide', pos: [5300, 1650, 6500], target: [6700, 900, 10300], fov: 54, hold: 1.0, ceiling: 1 },
  { id: 'K14', chapter: 'R06_HALL', shot: 'wide', pos: [5450, 1600, 5500], target: [9900, 1350, 5520], fov: 48, hold: 0.6, ceiling: 1 },
  { id: 'K15', chapter: 'R06_HALL', shot: 'transition', pos: [9600, 1600, 5500], target: [11500, 1200, 3300], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K16', chapter: 'R10_KIDS', shot: 'wide', pos: [9800, 1650, 4250], target: [12700, 900, 2300], fov: 54, hold: 1.0, ceiling: 1 },
  { id: 'K17', chapter: 'R11_STUDY', shot: 'transition', pos: [9800, 1600, 5250], target: [12500, 1100, 6200], fov: 52, hold: 0, ceiling: 1 },
  { id: 'K18', chapter: 'R11_STUDY', shot: 'medium', pos: [10250, 1650, 5500], target: [13200, 1050, 6700], fov: 52, hold: 1.0, ceiling: 1 },
  // ── D. Master suite ────────────────────────────────────────────────────────
  { id: 'K20', chapter: 'R14_MASTER', shot: 'transition', pos: [10450, 1600, 6450], target: [11700, 1100, 9200], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K21', chapter: 'R14_MASTER', shot: 'wide', pos: [10350, 1650, 10500], target: [12950, 900, 8600], fov: 52, hold: 1.2, ceiling: 1 },
  { id: 'K22', chapter: 'R14_MASTER', shot: 'closeup', pos: [11700, 1350, 10300], target: [12950, 850, 9150], fov: 40, hold: 0.7, ceiling: 1 },
  { id: 'K22b', chapter: 'R14_MASTER', shot: 'transition', pos: [10450, 1600, 9900], target: [9200, 1300, 8000], fov: 50, hold: 0, ceiling: 1 },
  { id: 'K23', chapter: 'R12_CLOSET', shot: 'transition', pos: [10300, 1600, 8300], target: [8300, 1300, 7300], fov: 52, hold: 0, ceiling: 1 },
  { id: 'K24', chapter: 'R12_CLOSET', shot: 'medium', pos: [8450, 1650, 8450], target: [9750, 1100, 6800], fov: 56, hold: 0.9, ceiling: 1 },
  { id: 'K24b', chapter: 'R13_MBATH', shot: 'transition', pos: [8650, 1600, 8500], target: [10500, 1100, 9400], fov: 54, hold: 0, ceiling: 1, travel: 1.3 },
  { id: 'K25', chapter: 'R13_MBATH', shot: 'transition', pos: [8850, 1600, 8550], target: [9000, 1000, 11500], fov: 54, hold: 0, ceiling: 1, travel: 1.4 },
  { id: 'K26', chapter: 'R13_MBATH', shot: 'medium', pos: [8850, 1650, 9350], target: [9000, 750, 11900], fov: 56, hold: 1.0, ceiling: 1 },
  // ── E. Material experience (ceilings lifted, camera dips into rooms from above) ──
  { id: 'K27', chapter: 'materials', shot: 'transition', pos: [8850, 4200, 9600], target: [8800, 0, 10400], fov: 50, hold: 0, ceiling: 0 },
  { id: 'M1', chapter: 'microcement', shot: 'closeup', pos: [8000, 1900, 9900], target: [9500, 1000, 9600], fov: 42, hold: 0.9, ceiling: 0 },
  { id: 'M1u', chapter: 'microcement', shot: 'transition', pos: [8500, 4300, 9600], target: [11000, 600, 8600], fov: 46, hold: 0, ceiling: 0 },
  { id: 'M2a', chapter: 'joinery_walnut', shot: 'transition', pos: [11400, 4100, 7850], target: [12600, 700, 9000], fov: 44, hold: 0, ceiling: 0 },
  { id: 'M2', chapter: 'joinery_walnut', shot: 'closeup', pos: [12300, 1500, 7650], target: [13300, 1100, 8600], fov: 42, hold: 0.9, ceiling: 0 },
  { id: 'M2u', chapter: 'joinery_walnut', shot: 'transition', pos: [11300, 3900, 7700], target: [9500, 600, 9500], fov: 46, hold: 0, ceiling: 0 },
  { id: 'M3v', chapter: 'stone_travertine', shot: 'transition', pos: [6200, 4300, 5900], target: [4300, 800, 4400], fov: 44, hold: 0, ceiling: 0 },
  { id: 'M3', chapter: 'stone_travertine', shot: 'closeup', pos: [4300, 1700, 5400], target: [4300, 880, 4200], fov: 40, hold: 0.9, ceiling: 0 },
  { id: 'M3b', chapter: 'floor_oak', shot: 'transition', pos: [3700, 1500, 6200], target: [1000, 900, 6000], fov: 44, hold: 0, ceiling: 0, travel: 1.2 },
  { id: 'M4', chapter: 'floor_oak', shot: 'closeup', pos: [2900, 1100, 7000], target: [500, 300, 8600], fov: 44, hold: 0.9, ceiling: 0 },
  { id: 'M5', chapter: 'fabric_boucle', shot: 'closeup', pos: [1900, 1150, 9000], target: [2400, 500, 10200], fov: 40, hold: 0.9, ceiling: 0 },
  { id: 'M6', chapter: 'glass_clear', shot: 'closeup', pos: [1600, 1700, 9700], target: [3000, 1100, 11600], fov: 50, hold: 0.9, ceiling: 0 },
  // ── F. Final ──────────────────────────────────────────────────────────────
  { id: 'F1', chapter: 'finale', shot: 'transition', pos: [2900, 5500, 9500], target: [6000, 0, 6000], fov: 40, hold: 0, ceiling: 0 },
  { id: 'F2', chapter: 'finale', shot: 'final', pos: [-7500, 12500, 23500], target: [4200, 0, 6600], fov: 34, hold: 1.6, ceiling: 0, travel: 1.2 },
];
