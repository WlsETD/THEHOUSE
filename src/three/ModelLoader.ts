import { LoadingManager, Mesh, Object3D, PointLight, DirectionalLight, Camera, Material, MeshStandardMaterial } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface LoadedModel {
  gltf: GLTF;
  root: Object3D;
  ceilings: Object3D | null;
  ceilingMaterials: MeshStandardMaterial[];
  /** fixtures flush with the ceiling (downlights, cove strip) — hidden when ceilings are lifted */
  ceilingFixtures: Object3D[];
  designLayer: Object3D[];
  pointLights: PointLight[];
  sun: DirectionalLight | null;
  cameras: Record<string, Camera>;
  byId: Map<string, Object3D>;
  meshCount: number;
}

/**
 * Loads the Phase-1 model. Default is the Draco + WebP build (scene.opt.glb, node transforms and extras
 * identical to scene.glb); `?model=original` loads the untouched scene.glb.
 */
export async function loadModel(onProgress: (f: number) => void): Promise<LoadedModel> {
  const manager = new LoadingManager();
  const draco = new DRACOLoader(manager).setDecoderPath('./draco/');
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  const original = new URLSearchParams(location.search).get('model') === 'original';
  const url = original ? './models/scene.glb' : (import.meta.env.VITE_MODEL_URL as string | undefined) || './models/scene.opt.glb';
  const gltf = await loader.loadAsync(url, e => { if (e.total) onProgress(e.loaded / e.total); });
  draco.dispose();
  const root = gltf.scene;
  const out: LoadedModel = {
    gltf, root, ceilings: root.getObjectByName('Ceilings') ?? null, ceilingMaterials: [], ceilingFixtures: [],
    designLayer: [], pointLights: [], sun: null, cameras: {}, byId: new Map(), meshCount: 0,
  };
  const ceilMats = new Set<Material>();
  root.traverse(o => {
    const ud = o.userData as { id?: string; layer?: string; category?: string; info?: { type?: string } };
    if (ud.id) out.byId.set(ud.id, o);
    if (ud.layer === 'design') out.designLayer.push(o);
    if (ud.category === 'Lighting' && (ud.info?.type === 'downlight' || ud.info?.type === 'cove')) out.ceilingFixtures.push(o);
    if ((o as Mesh).isMesh) {
      const m = o as Mesh;
      out.meshCount++;
      m.castShadow = true; m.receiveShadow = true;
      const mat = m.material as MeshStandardMaterial;
      if (mat.transparent) { m.castShadow = false; mat.depthWrite = false; }
    }
    if ((o as PointLight).isPointLight) out.pointLights.push(o as PointLight);
    if ((o as DirectionalLight).isDirectionalLight) out.sun = o as DirectionalLight;
    if ((o as Camera).isCamera) out.cameras[o.name] = o as Camera;
  });
  // ceilings get their own material instance so they can fade without touching other surfaces
  out.ceilings?.traverse(o => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    m.material = mat; ceilMats.add(mat);
  });
  out.ceilingMaterials = [...ceilMats] as MeshStandardMaterial[];
  return out;
}
