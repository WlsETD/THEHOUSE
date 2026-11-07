import type { SceneManager } from './SceneManager';

export function download(data: Blob | string, name: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

/** exports what the model looks like now: edited materials, visible layers, assembled (not exploded), ceilings on */
async function withAssembled<T>(m: SceneManager, fn: () => Promise<T>): Promise<T> {
  const ex = m.tools.explode;
  if (ex) m.tools.setExplode(0);
  m.lighting.update(1);
  try { return await fn(); } finally { if (ex) m.tools.setExplode(ex); }
}

export async function exportGLB(m: SceneManager) {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const buf = await withAssembled(m, () => new GLTFExporter().parseAsync(m.model.root, { binary: true, onlyVisible: true }));
  download(new Blob([buf as ArrayBuffer], { type: 'model/gltf-binary' }), `ACL16004_design_${stamp()}.glb`);
}

export async function exportOBJ(m: SceneManager) {
  const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
  const txt = await withAssembled(m, async () => new OBJExporter().parse(m.model.root));
  download(new Blob([txt], { type: 'text/plain' }), `ACL16004_model_${stamp()}.obj`);
}

export async function exportSceneJson() {
  const r = await fetch('./data/scene.json');
  download(await r.blob(), 'scene.json');
}

export function exportPNG(m: SceneManager) {
  download(m.snapshot('image/png'), `ACL16004_view_${stamp()}.png`);
}

export function exportDesign(state: unknown) {
  download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `ACL16004_design-options_${stamp()}.json`);
}
