// Quick smoke: loads the built site, reports errors and a hero screenshot.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4173/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
const t0 = Date.now();
await pg.goto(URL);
await pg.waitForFunction(() => window.__wu && document.querySelector('.loading.is-done'), null, { timeout: 240000 });
console.log('loaded in', (Date.now() - t0) / 1000, 's');
await pg.waitForTimeout(3000);
await pg.screenshot({ path: 'reports/screenshots/smoke_hero.png' });
console.log(JSON.stringify(await pg.evaluate(() => { const m = window.__wu.manager; return { meshes: m.model.meshCount, calls: m.renderer.info.render.calls, tris: m.renderer.info.render.triangles, fps: m.fps, chapters: m.path.chapters.length }; })));
console.log('errors', errs);
await b.close();
