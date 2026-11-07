/** Shapes of the Phase-1 shared data files (only the fields the site reads). */
export interface CoordinateSystem {
  units: string;
  origin_plan_mm: [number, number, number];
  plan_to_model: string;
}

export interface Room {
  id: string;
  name_zh: string;
  name_en: string;
  kind: 'interior' | 'balcony' | 'ledge';
  polygon_mm: [number, number][];
  polygon_m: [number, number][];
  area_m2: number;
  area_ping: number;
  ceiling_mm: number | null;
  floor_material: string;
  entries_exits: { opening: string | null; type: string; connects_to: string; clear_width_mm?: number }[];
  intro_zh: string;
  intro_en: string;
  objects: string[];
  alternatives: string[];
}

export interface RoomsFile {
  coordinate_system: CoordinateSystem;
  rooms: Room[];
  totals: { interior_m2: number; balcony_m2: number };
}

export interface Material {
  category: string;
  name_zh: string;
  name_en: string;
  pbr: { baseColor_srgb: string | null; roughness: number | null; metalness: number; opacity: number };
  used_by: string[];
  textures?: { baseColor: string | null; normal: string; occlusionRoughnessMetallic: string };
  tile_m?: number;
}

export interface MaterialsFile { materials: Record<string, Material> }

export interface SceneObject {
  id: string;
  name: string;
  category: string;
  room: string | null;
  layer: 'as_drawn' | 'design';
  size_mm: [number, number, number];
  materials: string[];
}

export interface SceneFile {
  meta: { project: string; project_no: string; drawing: string; scale: string; model_version: string; bbox_plan_mm: number[] };
  coordinate_system: CoordinateSystem;
  objects: SceneObject[];
  render_settings_threejs: Record<string, unknown>;
}

export interface ProjectData {
  scene: SceneFile;
  rooms: RoomsFile;
  materials: MaterialsFile;
  cameras: unknown;
}

export async function loadProjectData(base = './data/'): Promise<ProjectData> {
  const get = async <T,>(f: string): Promise<T> => {
    const r = await fetch(base + f);
    if (!r.ok) throw new Error(`Missing data file: ${f} (${r.status})`);
    return r.json() as Promise<T>;
  };
  const [scene, rooms, materials, cameras] = await Promise.all([
    get<SceneFile>('scene.json'), get<RoomsFile>('rooms.json'), get<MaterialsFile>('materials.json'), get<unknown>('cameras.json'),
  ]);
  return { scene, rooms, materials, cameras };
}
