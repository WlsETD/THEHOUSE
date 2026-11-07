import { Mesh, MeshStandardMaterial, Object3D, RepeatWrapping, Texture } from 'three';
import type { LoadedModel } from './ModelLoader';
import type { Material as MaterialData, SceneObject } from '../data/types';

/**
 * Live finish editor. Every change is a material swap or colour factor on the Phase-1 meshes —
 * geometry, IDs and coordinates are never touched. Finishes reuse the model's own PBR materials;
 * because UVs are world-scale (1 UV unit = tile_m metres), a swapped texture is re-scaled by
 * tile_original / tile_new so planks and stone keep their real size.
 */

export interface Swatch { hex: string; en: string; zh: string; note?: string }

export interface SurfaceDef {
  key: string;
  en: string;
  zh: string;
  /** Phase-1 material keys this surface covers */
  materials: string[];
  /** can be set per room (false: one setting for the whole home, e.g. walls shared by two rooms) */
  perRoom: boolean;
  finishes: string[];
  colors: Swatch[];
  /** restrict to some objects carrying those materials */
  only?: (o: SceneObject | undefined, id: string) => boolean;
}

export interface FinishState { finish?: string; color?: string }
export type SurfaceStates = Record<string, FinishState>;

/** paint colours. "As built" = the value in materials.json; the others are design options, not from the drawing. */
const PAINTS: Swatch[] = [
  { hex: '#ece8e1', en: 'Warm white', zh: '暖白（原設計）' },
  { hex: '#f7f6f2', en: 'Pure mineral white', zh: '淨白礦物' },
  { hex: '#e3d5c0', en: 'Sydney warm sand', zh: '雪梨暖沙' },
  { hex: '#ddd5c8', en: 'Greige', zh: '灰米' },
  { hex: '#a9b5a0', en: 'Eucalyptus sage', zh: '尤加利鼠尾草綠', note: 'named in the design deck; hex is an approximation' },
  { hex: '#c9a48a', en: 'Clay', zh: '陶土' },
  { hex: '#b8c0c4', en: 'Mist blue', zh: '霧藍灰' },
  { hex: '#6d6a65', en: 'Graphite', zh: '石墨灰' },
  { hex: '#3a3835', en: 'Charcoal', zh: '炭黑' },
];
/** tints multiply a textured finish (they can darken or shift a timber/stone, not lighten it) */
const TINTS: Swatch[] = [
  { hex: '#ffffff', en: 'Natural', zh: '原色' },
  { hex: '#f1e6d6', en: 'Bleached', zh: '淺漂白' },
  { hex: '#d9c3a5', en: 'Honey', zh: '蜂蜜色' },
  { hex: '#b9a28a', en: 'Smoked', zh: '煙燻' },
  { hex: '#8f7a68', en: 'Dark', zh: '深色' },
  { hex: '#c9c6c0', en: 'Grey wash', zh: '灰洗' },
  { hex: '#5a4f46', en: 'Espresso', zh: '咖啡深色' },
];
const LACQUER: Swatch[] = [
  { hex: '#e8e4dc', en: 'Warm white', zh: '暖白（原設計）' },
  { hex: '#f4f3ef', en: 'Pure white', zh: '純白' },
  { hex: '#e6dccb', en: 'Linen beige', zh: '亞麻米白' },
  { hex: '#cfc6b8', en: 'Stone', zh: '石色' },
  { hex: '#a9b5a0', en: 'Eucalyptus sage', zh: '尤加利鼠尾草綠', note: 'named in the design deck; hex is an approximation' },
  { hex: '#8b8f86', en: 'Olive grey', zh: '橄欖灰' },
  { hex: '#4a4743', en: 'Matte charcoal', zh: '霧面炭灰' },
  { hex: '#2a2928', en: 'Black', zh: '黑' },
];
const FABRIC_TINTS: Swatch[] = [
  { hex: '#ffffff', en: 'Natural', zh: '原色' },
  { hex: '#efe4d2', en: 'Oat linen', zh: '燕麥亞麻' },
  { hex: '#c9895a', en: 'Caramel', zh: '焦糖色' },
  { hex: '#aab6bd', en: 'Coastal blue-grey', zh: '海岸灰藍' },
  { hex: '#a9b5a0', en: 'Eucalyptus sage', zh: '尤加利綠' },
  { hex: '#8a8580', en: 'Pebble', zh: '卵石灰' },
  { hex: '#4d4844', en: 'Charcoal', zh: '炭灰' },
];

const FLOORS = ['floor_oak', 'joinery_walnut', 'timber_oak_solid', 'floor_stone', 'stone_travertine', 'floor_microcement', 'stone_quartzite', 'floor_paver'];
const WALLS = ['wall_paint', 'microcement', 'column_finish', 'wall_render', 'stone_travertine', 'joinery_oak', 'joinery_walnut'];
const CEILS = ['ceiling_paint', 'wall_paint', 'microcement', 'joinery_oak', 'joinery_walnut'];
const JOIN = ['joinery_oak', 'joinery_walnut', 'joinery_paint', 'timber_oak_solid', 'stone_travertine', 'microcement'];
const STONE = ['stone_quartzite', 'stone_travertine', 'floor_stone', 'microcement', 'joinery_walnut'];
const FABRIC = ['fabric_linen', 'fabric_boucle', 'fabric_white', 'leather_tan', 'leather_dark'];

export const SURFACES: SurfaceDef[] = [
  { key: 'walls', en: 'Walls', zh: '牆面', materials: ['wall_paint'], perRoom: false, finishes: WALLS, colors: PAINTS },
  { key: 'floors', en: 'Floors', zh: '地板', materials: ['floor_oak', 'floor_stone', 'floor_microcement'], perRoom: true, finishes: FLOORS, colors: TINTS,
    only: (_o, id) => id.startsWith('FLR_R') },
  { key: 'ceilings', en: 'Ceilings', zh: '天花板', materials: ['ceiling_paint'], perRoom: true, finishes: CEILS, colors: PAINTS },
  { key: 'bathwalls', en: 'Bathroom walls', zh: '浴室牆面', materials: ['microcement'], perRoom: true, finishes: ['microcement', 'wall_paint', 'stone_travertine', 'floor_stone', 'stone_quartzite'], colors: PAINTS },
  { key: 'oak', en: 'Oak joinery', zh: '橡木櫃體', materials: ['joinery_oak'], perRoom: true, finishes: JOIN, colors: TINTS },
  { key: 'walnut', en: 'Walnut joinery', zh: '胡桃木櫃體', materials: ['joinery_walnut'], perRoom: true, finishes: JOIN, colors: TINTS },
  { key: 'lacquer', en: 'Lacquered joinery & skirting', zh: '烤漆櫃體與踢腳板', materials: ['joinery_paint'], perRoom: true, finishes: JOIN, colors: LACQUER },
  { key: 'doors', en: 'Doors', zh: '門片', materials: ['door_oak', 'door_paint', 'door_walnut'], perRoom: false, finishes: ['door_oak', 'door_walnut', 'door_paint', 'joinery_paint'], colors: TINTS },
  { key: 'stone', en: 'Benchtops & vanities', zh: '檯面與浴櫃', materials: ['stone_quartzite', 'stone_travertine'], perRoom: true, finishes: STONE, colors: TINTS },
  { key: 'fabric', en: 'Upholstery', zh: '沙發與床組布料', materials: ['fabric_linen', 'fabric_boucle'], perRoom: true, finishes: FABRIC, colors: FABRIC_TINTS },
];

/** materials that are never offered for editing (emitters, glass, water, mirrors, shadow gaps) */
const LOCKED = new Set(['emissive_warm', 'glass_clear', 'glass_fluted', 'glass_opal', 'water', 'mirror', 'shadow', 'screen_black']);

interface MeshRec { mesh: Mesh; orig: MeshStandardMaterial; key: string; obj: string; room: string | null; ceiling: boolean }

const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const;

export class DesignEditor {
  readonly meshes: MeshRec[] = [];
  private donors = new Map<string, MeshStandardMaterial>();
  private cache = new Map<string, MeshStandardMaterial>();
  private clonedTextures = new Set<Texture>();
  states: SurfaceStates = {};
  private listeners = new Set<() => void>();

  constructor(private model: LoadedModel, private mats: Record<string, MaterialData>, private objects: Map<string, SceneObject>, private onMaterialsChanged: () => void) {
    const ceilingRoot = model.ceilings;
    model.root.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = m.material as MeshStandardMaterial;
      const key = mat.name;
      if (!this.donors.has(key)) this.donors.set(key, mat);
      let n: Object3D | null = m, id = '', room: string | null = null;
      while (n) { const ud = n.userData as { id?: string; room?: string | null }; if (ud.id) { id = ud.id; room = ud.room ?? null; break; } n = n.parent; }
      let ceiling = false;
      for (let p: Object3D | null = m; p; p = p.parent) if (p === ceilingRoot) { ceiling = true; break; }
      this.meshes.push({ mesh: m, orig: mat, key, obj: id, room, ceiling });
    });
  }

  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  editable(key: string) { return !LOCKED.has(key) && !!this.mats[key]; }

  /** surfaces that exist in a room (or the whole home when room is null) */
  surfacesIn(room: string | null) {
    return SURFACES.filter(s => this.meshes.some(r => this.covers(s, r) && (room === null || !s.perRoom || r.room === room)));
  }

  /** material keys on one object that can be edited */
  objectMaterials(id: string) {
    return [...new Set(this.meshes.filter(r => r.obj === id && this.editable(r.key)).map(r => r.key))];
  }

  private covers(s: SurfaceDef, r: MeshRec) {
    return s.materials.includes(r.key) && (!s.only || s.only(this.objects.get(r.obj), r.obj));
  }

  static stateKey(surface: string, room: string | null) { return `${surface}@${room ?? '*'}`; }
  static objectKey(id: string, mat: string) { return `obj:${id}|${mat}`; }

  /** the effective state for a surface in a scope (room setting falls back to the whole-home one) */
  stateFor(surface: string, room: string | null): FinishState {
    return this.states[DesignEditor.stateKey(surface, room)] ?? (room ? this.states[DesignEditor.stateKey(surface, null)] : undefined) ?? {};
  }

  set(key: string, patch: FinishState | null) {
    if (patch === null) delete this.states[key];
    else {
      const next = { ...this.states[key], ...patch };
      (Object.keys(next) as (keyof FinishState)[]).forEach(k => next[k] === undefined && delete next[k]);
      if (Object.keys(next).length) this.states[key] = next; else delete this.states[key];
    }
    this.apply();
  }

  /** clear a whole-home setting and every per-room override of the same surface */
  resetSurface(surface: string) {
    Object.keys(this.states).forEach(k => k.startsWith(surface + '@') && delete this.states[k]);
    this.apply();
  }

  setAll(s: SurfaceStates) { this.states = { ...s }; this.apply(); }

  apply() {
    for (const r of this.meshes) {
      if (!this.editable(r.key)) continue;
      const st = this.resolve(r);
      const target = st ? this.material(r, st) : r.orig;
      if (r.mesh.material !== target) r.mesh.material = target;
    }
    // the ceiling fade in Lighting works on whatever materials the ceiling meshes now carry
    this.model.ceilingMaterials = [...new Set(this.meshes.filter(r => r.ceiling).map(r => r.mesh.material as MeshStandardMaterial))];
    this.onMaterialsChanged();
    this.listeners.forEach(l => l());
  }

  private resolve(r: MeshRec): FinishState | null {
    const o = this.states[DesignEditor.objectKey(r.obj, r.key)];
    if (o) return o;
    for (const s of SURFACES) {
      if (!this.covers(s, r)) continue;
      const st = (s.perRoom && r.room ? this.states[DesignEditor.stateKey(s.key, r.room)] : undefined) ?? this.states[DesignEditor.stateKey(s.key, null)];
      if (st) return st;
    }
    return null;
  }

  tile(key: string) { return this.mats[key]?.tile_m ?? 1; }

  private material(r: MeshRec, st: FinishState): MeshStandardMaterial {
    const finish = st.finish && this.donors.has(st.finish) ? st.finish : r.key;
    const ck = `${r.key}>${finish}|${st.color ?? ''}|${r.ceiling ? 'c' : ''}`;
    const hit = this.cache.get(ck);
    if (hit) return hit;
    const donor = finish === r.key ? r.orig : this.donors.get(finish)!;
    const m = donor.clone();
    const k = this.tile(r.key) / this.tile(finish);
    if (Math.abs(k - 1) > 1e-3) {
      for (const slot of MAP_SLOTS) {
        const t = m[slot] as Texture | null;
        if (!t) continue;
        const c = t.clone();
        c.wrapS = c.wrapT = RepeatWrapping;
        c.repeat.set(t.repeat.x * k, t.repeat.y * k);
        c.needsUpdate = true;
        this.clonedTextures.add(c);
        m[slot] = c;
      }
    }
    if (st.color) m.color.set(st.color);
    if (r.ceiling) { m.transparent = false; m.opacity = 1; m.depthWrite = true; }
    m.userData = { ...m.userData, designFinish: finish, designColor: st.color ?? null };
    this.cache.set(ck, m);
    return m;
  }

  /** what a scope currently shows, for the panel (first matching mesh decides) */
  current(surface: SurfaceDef, room: string | null): { finish: string; color: string | null; mixed: boolean } {
    const recs = this.meshes.filter(r => this.covers(surface, r) && (room === null || !surface.perRoom || r.room === room));
    const keys = new Set(recs.map(r => ((r.mesh.material as MeshStandardMaterial).userData.designFinish as string | undefined) ?? r.key));
    const first = recs[0];
    const mat = first?.mesh.material as MeshStandardMaterial | undefined;
    return { finish: [...keys][0] ?? surface.materials[0], color: (mat?.userData.designColor as string | null) ?? null, mixed: keys.size > 1 };
  }

  dispose() {
    this.clonedTextures.forEach(t => t.dispose());
    this.cache.forEach(m => m.dispose());
  }
}

export const SWATCHES = { PAINTS, TINTS, LACQUER, FABRIC_TINTS };
/** finishes offered for a single picked object */
export const ANY_FINISH = [...new Set([...WALLS, ...FLOORS, ...JOIN, ...STONE, ...FABRIC, 'metal_black', 'metal_brushed', 'ceramic_white'])];

/**
 * Themes. The four named in the design deck (p.7: Melbourne oak, Sydney smoked walnut, eucalyptus sage, microcement).
 * The deck gives names only, so the colour values here are this site's interpretation.
 */
export interface Theme { key: string; en: string; zh: string; states: SurfaceStates }
const k = DesignEditor.stateKey;
export const THEMES: Theme[] = [
  { key: 'asbuilt', en: 'As designed', zh: '原設計', states: {} },
  { key: 'melbourne', en: 'Melbourne natural oak', zh: '墨爾本天然橡木', states: {
    [k('floors', null)]: { finish: 'floor_oak', color: '#f1e6d6' }, [k('walls', null)]: { color: '#f7f6f2' }, [k('oak', null)]: { color: '#f1e6d6' } } },
  { key: 'sydney', en: 'Sydney smoked walnut', zh: '雪梨煙燻胡桃木', states: {
    [k('floors', null)]: { finish: 'joinery_walnut' }, [k('walls', null)]: { color: '#e3d5c0' }, [k('oak', null)]: { finish: 'joinery_walnut' }, [k('fabric', null)]: { finish: 'leather_tan' } } },
  { key: 'eucalyptus', en: 'Eucalyptus sage', zh: '尤加利鼠尾草綠', states: {
    [k('walls', null)]: { color: '#a9b5a0' }, [k('lacquer', null)]: { color: '#a9b5a0' }, [k('fabric', null)]: { color: '#efe4d2' } } },
  { key: 'micro', en: 'Microcement', zh: '微水泥', states: {
    [k('floors', null)]: { finish: 'floor_microcement' }, [k('walls', null)]: { finish: 'microcement' }, [k('oak', null)]: { finish: 'joinery_paint', color: '#cfc6b8' } } },
];
