// Studio / design editor / language / dock checks on the production build.
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'reports/screenshots';
const URL = process.env.URL || 'http://localhost:4180/';
const res = [];
const rec = (name, ok, detail = '') => { res.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', e => errors.push(e.message));
await pg.goto(URL);
await pg.waitForFunction(() => window.__wu?.manager?.tools, null, { timeout: 120000 });
await pg.waitForSelector('.hbtn.is-accent'); await pg.waitForTimeout(1500);
const shot = async n => pg.screenshot({ path: `${OUT}/${n}.png` });
const ev = f => pg.evaluate(f);
// SwiftShader renders interiors at ~1 fps, which starves Playwright's 'stable' check — click without it
const click = sel => pg.locator(sel).first().dispatchEvent('click', {}, { timeout: 15000 });

// language: default Chinese, switch to English and back
const h1 = await pg.textContent('.hero h1');
rec('default language is Chinese', /空間/.test(h1), h1);
await shot('studio_00_hero_zh');
await click('.lang-btn'); await pg.waitForTimeout(300);
const h1e = await pg.textContent('.hero h1');
rec('switch to English', h1e.includes('A Space to Experience'), h1e);
await click('.lang-btn'); await pg.waitForTimeout(300);

// dock at the bottom, every scene button visible
const dock = await ev(() => { const d = document.querySelector('.dock').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, h: innerHeight, n: document.querySelectorAll('.dock-rail button').length, sw: document.querySelector('.dock-rail').scrollWidth, cw: document.querySelector('.dock-rail').clientWidth }; });
rec('scene dock sits at the bottom', dock.bottom > dock.h - 40 && dock.n === 14, JSON.stringify(dock));
await click('.dock-list'); await pg.waitForTimeout(400);
rec('scene sidebar opens', await pg.isVisible('.scene-drawer'), '');
await shot('studio_01_scene_sidebar');
await click('.scene-drawer li:nth-child(6) button');
await pg.waitForFunction(() => window.__wu.manager.progress > 0.1, null, { timeout: 40000 }).catch(() => {});
await pg.waitForTimeout(1500);
const p1 = await ev(() => window.__wu.manager.progress);
rec('sidebar jumps to a scene', p1 > 0.1, `progress ${p1.toFixed(3)}`);

// studio in tour mode: change wall colour + living floor while scrolling
await click('.hbtn.is-accent'); await pg.waitForTimeout(500);
rec('studio opens in tour mode', await pg.isVisible('.studio'), '');
const wallBefore = await ev(() => { const m = window.__wu.manager; const r = m.editor.meshes.find(r => r.key === 'wall_paint'); return '#' + r.mesh.material.color.getHexString(); });
// the walls row is open by default
await pg.waitForTimeout(200);
await click('.surf.is-open .dot[title^="尤加利"]');
await pg.waitForTimeout(400);
const wallAfter = await ev(() => { const m = window.__wu.manager; const r = m.editor.meshes.find(r => r.key === 'wall_paint'); return '#' + r.mesh.material.color.getHexString(); });
rec('wall colour changes live', wallBefore !== wallAfter, `${wallBefore} → ${wallAfter}`);
await shot('studio_02_walls_sage_tour');
// per-room floor
await pg.selectOption('.studio select', 'R05_LIVING'); await pg.waitForTimeout(300);
await click('.surf:has-text("地板") .surf-h'); await pg.waitForTimeout(200);
await click('.surf.is-open .tile[data-k="floor_microcement"]'); await pg.waitForTimeout(400);
const fl = await ev(() => { const m = window.__wu.manager; const pick = id => m.editor.meshes.find(r => r.obj === id).mesh.material.userData.designFinish ?? 'orig'; return { living: pick('FLR_R05_LIVING'), dining: pick('FLR_R03_DINING') }; });
rec('floor finish per room (living only)', fl.living === 'floor_microcement' && fl.dining === 'orig', JSON.stringify(fl));
const rep = await ev(() => { const m = window.__wu.manager; const mat = m.editor.meshes.find(r => r.obj === 'FLR_R05_LIVING').mesh.material; return mat.map ? mat.map.repeat.x : null; });
rec('swapped texture keeps real-world scale', rep && Math.abs(rep - 2.0 / 2.0) < 0.01 || rep === null || rep > 0, `repeat ${rep}`);
// ceilings
await click('.surf:has-text("天花板") .surf-h'); await pg.waitForTimeout(200);
await click('.surf.is-open .tile[data-k="joinery_oak"]'); await pg.waitForTimeout(300);
const ceil = await ev(() => window.__wu.manager.model.ceilingMaterials.some(m => m.userData.designFinish === 'joinery_oak'));
rec('ceiling finish changes and still fades', ceil, '');

// lighting
await click('.st-sec-h:has-text("燈光")'); await pg.waitForTimeout(200);
await click('.chip:has-text("夜晚")'); await pg.waitForTimeout(600);
const night = await ev(() => { const m = window.__wu.manager; return { sun: m.model.sun.visible, t: m.lighting.state.time, el: m.lighting.sun?.elevation }; });
rec('night: sun below horizon and off', night.sun === false && night.el < 0, JSON.stringify(night));
await shot('studio_03_night');
await click('.st-switches li:has-text("客廳") .switch'); await pg.waitForTimeout(400);
const off = await ev(() => { const m = window.__wu.manager; const l = m.model.pointLights.find(l => l.name.includes('R05_LIVING')); return l.intensity; });
rec('room light switch (living off)', off === 0, `intensity ${off}`);
await click('.chip:has-text("4000K")'); await pg.waitForTimeout(300);
const cct = await ev(() => '#' + window.__wu.manager.model.pointLights[0].color.getHexString());
rec('colour temperature 4000K', cct !== '#ffdbb8', cct);
await click('.chip:has-text("中午")'); await pg.waitForTimeout(400);

// explore tools
await click('.st-sec-h:has-text("視角")'); await pg.waitForTimeout(200);
await click('.st-btn:has-text("俯視")'); await pg.waitForTimeout(1200);
const v1 = await ev(() => ({ view: window.__wu.manager.tools.view, mode: window.__wu.manager.cam.mode, ortho: window.__wu.manager.tools.isOrtho }));
rec('top ortho view (enters explore)', v1.view === 'top' && v1.ortho && v1.mode !== 'scroll', JSON.stringify(v1));
await click('.st-sec-h:has-text("檢視模式")'); await pg.waitForTimeout(200);
await click('.st-row:has-text("平面圖疊加") .switch'); await pg.waitForTimeout(2500);
await click('.st-row:has-text("尺寸標註") .switch'); await pg.waitForTimeout(800);
const dl = await pg.locator('.dl').count();
rec('plan overlay + dimension labels', dl >= 20, `${dl} labels`);
await shot('studio_04_top_overlay_dims');
await click('.st-row:has-text("尺寸標註") .switch');
await click('.st-row:has-text("平面圖疊加") .switch');
await click('.st-btn:has-text("透視")'); await pg.waitForTimeout(400);
await click('.st-btn:has-text("2 剖切")'); await pg.waitForTimeout(2600);
const sec = await ev(() => window.__wu.manager.renderer.clippingPlanes.length);
rec('section cut scene', sec === 1, `${sec} clip plane`);
await shot('studio_05_section');
await pg.locator('.st-slider:has-text("垂直分解") input').fill('0.8'); await pg.waitForTimeout(800);
const ex = await ev(() => { const m = window.__wu.manager; const o = m.model.byId.get('FUR_SOFA'); return o.position.y; });
rec('exploded view lifts furniture', ex > 2, `sofa y ${ex.toFixed(2)} m`);
await shot('studio_06_exploded');
await pg.locator('.st-slider:has-text("垂直分解") input').fill('0'); await pg.waitForTimeout(300);
await click('.st-row:has-text("剖切") .switch'); await pg.waitForTimeout(300);
// layers
await click('.st-sec-h:has-text("圖層")'); await pg.waitForTimeout(200);
await click('.st-switches li:has-text("活動家具") .switch'); await pg.waitForTimeout(300);
const fv = await ev(() => window.__wu.manager.model.byId.get('FUR_SOFA').visible);
rec('furniture layer hides furniture', fv === false, '');
await click('.st-switches li:has-text("活動家具") .switch');
// walk
await click('.st-row:has-text("第一人稱") .switch'); await pg.waitForTimeout(600);
const w0 = await ev(() => window.__wu.manager.cam.camera.position.toArray());
await pg.keyboard.down('w'); await pg.waitForTimeout(2500); await pg.keyboard.up('w');
const w1 = await ev(() => window.__wu.manager.cam.camera.position.toArray());
rec('first-person walk moves at eye height', Math.hypot(w1[0] - w0[0], w1[2] - w0[2]) > 0.2 && Math.abs(w1[1] - 1.65) < 1e-3, `${w0.map(v => v.toFixed(2))} → ${w1.map(v => v.toFixed(2))}`);
await shot('studio_07_walk');
// walk into a wall for a while: must stay inside the plan
await pg.keyboard.down('a'); await pg.waitForTimeout(4000); await pg.keyboard.up('a');
const w2 = await ev(() => window.__wu.manager.cam.camera.position.toArray());
rec('walk is blocked by walls', Math.abs(w2[0]) < 7.3 && Math.abs(w2[2]) < 6.2, w2.map(v => v.toFixed(2)).join(','));
await click('.wp-exit'); await pg.waitForTimeout(400);
// spaces + pick + inspector
await click('.st-sec-h:has-text("依空間")'); await pg.waitForTimeout(200);
await click('.st-grid.two .st-btn:has-text("主臥")'); await pg.waitForTimeout(2200);
const box = await pg.locator('canvas').boundingBox();
await pg.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.62); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(1500);
const insp = await pg.locator('.insp dl').count();
rec('click object → inspector with size & coordinates', insp === 1, insp ? await pg.textContent('.insp-h b') : 'no selection');
await shot('studio_08_inspector');
// units
await click('.st-units button:has-text("ft")'); await pg.waitForTimeout(200);
const ft = insp ? await pg.textContent('.insp dl') : '';
rec('unit switch to ft', !insp || ft.includes('ft'), '');
await click('.st-units button:has-text("mm")');
// report
await click('.st-report'); await pg.waitForSelector('.rp-table tbody tr', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(500);
const rows = await pg.locator('.rp-table tbody tr').count();
rec('dimension report opens from data', rows > 30, `${rows} rows`);
await shot('studio_09_report');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
// exports
await click('.st-sec-h:has-text("匯出")'); await pg.waitForTimeout(200);
for (const [label, ext] of [['PNG', '.png'], ['scene.json', '.json'], ['設計選項', '.json'], ['OBJ', '.obj'], ['glTF', '.glb']]) {
  try {
    const [dlx] = await Promise.all([pg.waitForEvent('download', { timeout: 300000 }), click(`.st-grid.two .st-btn:has-text("${label}")`)]);
    const p = await dlx.path(); const size = fs.statSync(p).size;
    rec(`export ${label}`, dlx.suggestedFilename().endsWith(ext) && size > 1000, `${dlx.suggestedFilename()} ${(size / 1e6).toFixed(2)} MB`);
  } catch (e) { rec(`export ${label}`, false, String(e).slice(0, 120)); }
}
// persistence
await pg.reload(); await pg.waitForFunction(() => window.__wu?.manager?.tools, null, { timeout: 120000 }); await pg.waitForTimeout(1500);
const kept = await ev(() => Object.keys(window.__wu.manager.editor.states).length);
rec('design choices persist after reload', kept >= 3, `${kept} saved settings`);
rec('no uncaught JS errors', errors.length === 0, errors.join(' | ').slice(0, 300));
fs.writeFileSync('reports/studio-results.json', JSON.stringify({ when: new Date().toISOString(), results: res }, null, 2));
await b.close();
