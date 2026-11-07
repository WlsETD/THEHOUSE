import { HemisphereLight, MathUtils, PMREMGenerator, Scene, WebGLRenderer, Mesh, MeshStandardMaterial } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { LoadedModel } from './ModelLoader';

/**
 * Keeps the model's own lights (KHR_lights_punctual) and blends between the two calibrations
 * recorded in scene.json.render_settings_threejs: interior (ceilings on) and exterior/cutaway (ceilings lifted).
 */
export class Lighting {
  private hemi = new HemisphereLight(0xfff6ea, 0xd8d0c4, 0.4);
  private baseIntensity = new Map<object, number>();
  private envMats: MeshStandardMaterial[] = [];
  private lastShadowCeiling = -1;

  constructor(scene: Scene, private renderer: WebGLRenderer, private model: LoadedModel, shadows: boolean, shadowSize: number) {
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
    scene.add(this.hemi);
    model.pointLights.forEach(l => { this.baseIntensity.set(l, l.intensity); l.castShadow = false; });
    const sun = model.sun;
    if (sun) {
      this.baseIntensity.set(sun, sun.intensity);
      sun.castShadow = shadows;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      sun.target.position.set(-3, 0, -6);
      scene.add(sun.target);
    }
    model.root.traverse(o => {
      const m = o as Mesh;
      if (m.isMesh) {
        const mat = m.material as MeshStandardMaterial;
        if ('envMapIntensity' in mat && !this.envMats.includes(mat)) this.envMats.push(mat);
      }
    });
    // static scene: render the shadow map only when what casts shadows changes
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  /** c = ceiling factor (1 interior, 0 cutaway / aerial) */
  update(c: number) {
    const k = MathUtils.clamp(c, 0, 1);
    this.renderer.toneMappingExposure = MathUtils.lerp(1.0, 0.72, k);
    const env = MathUtils.lerp(0.55, 0.3, k);
    for (const m of this.envMats) m.envMapIntensity = env;
    this.hemi.intensity = MathUtils.lerp(0.4, 0.12, k);
    const sun = this.model.sun;
    if (sun) sun.intensity = MathUtils.lerp(3.2, 1.8, k);
    for (const l of this.model.pointLights) {
      l.intensity = (this.baseIntensity.get(l) ?? 1) * k;
      l.visible = k > 0.01;
    }
    // ceilings: fade, and stop casting shadows once lifted
    const on = k > 0.5 ? 1 : 0;
    for (const mat of this.model.ceilingMaterials) {
      mat.transparent = k < 0.999; mat.opacity = k; mat.depthWrite = k >= 0.999;
    }
    if (this.model.ceilings) this.model.ceilings.visible = k > 0.005;
    for (const f of this.model.ceilingFixtures) f.visible = k > 0.5;
    if (on !== this.lastShadowCeiling) {
      this.model.ceilings?.traverse(o => { if ((o as Mesh).isMesh) (o as Mesh).castShadow = on === 1; });
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowCeiling = on;
    }
  }

  setDesignLayer(visible: boolean) {
    this.model.designLayer.forEach(o => (o.visible = visible));
    this.renderer.shadowMap.needsUpdate = true;
  }
}
