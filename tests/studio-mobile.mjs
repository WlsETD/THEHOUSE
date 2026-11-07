// Phone / tablet layout checks for the dock, header, studio sheet and walk pad.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'reports/screenshots';
const URL = process.env.URL || 'http://localhost:4180/';
const res = [];
const rec = (name, ok, detail = '') => { res.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [tag, dev] of [['mobile', devices['iPhone 13']], ['tablet', devices['iPad (gen 7)']]]) {
  const ctx = await b.newContext({ ...dev });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  await pg.goto(URL);
  await pg.waitForFunction(() => window.__wu?.manager?.tools, null, { timeout: 180000 });
  await pg.waitForSelector('.hbtn.is-accent'); await pg.waitForTimeout(1500);
  const click = sel => pg.locator(sel).first().dispatchEvent('click', {}, { timeout: 15000 });
  const lay = await pg.evaluate(() => {
    const r = s => document.querySelector(s)?.getBoundingClientRect();
    const hdr = [...document.querySelectorAll('.hbtn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect());
    const overflowX = document.documentElement.scrollWidth > innerWidth + 1;
    return { w: innerWidth, h: innerHeight, dock: r('.dock'), hdrRight: Math.max(...hdr.map(b => b.right)), hdrMinH: Math.min(...hdr.map(b => b.height)), overflowX };
  });
  rec(`${tag}: header buttons on screen, ≥ 34 px tall`, lay.hdrRight <= lay.w && lay.hdrMinH >= 34, JSON.stringify({ right: lay.hdrRight, w: lay.w, h: lay.hdrMinH }));
  rec(`${tag}: scene dock at the bottom, inside the screen`, lay.dock && lay.dock.bottom <= lay.h && lay.dock.bottom > lay.h - 60 && lay.dock.left >= 0 && lay.dock.right <= lay.w, JSON.stringify(lay.dock));
  rec(`${tag}: no horizontal page scroll`, !lay.overflowX, '');
  await pg.screenshot({ path: `${OUT}/${tag}_studio_00_hero.png` });
  await click('.dock-list'); await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${OUT}/${tag}_studio_01_sidebar.png` });
  await click('.sd-head button'); await pg.waitForTimeout(300);
  await click('.hbtn.is-accent');
  await pg.waitForFunction(() => document.querySelector('.studio')?.getAnimations().every(a => a.playState === 'finished'), null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const sheet = await pg.evaluate(() => { const r = document.querySelector('.studio').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: innerWidth, h: innerHeight }; });
  rec(`${tag}: studio fits the screen`, sheet.left >= 0 && sheet.right <= sheet.w + 0.5 && sheet.bottom <= sheet.h + 0.5, JSON.stringify(sheet));
  await click('.surf.is-open .dot[title^="雪梨"]'); await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${OUT}/${tag}_studio_02_panel.png` });
  await click('.st-sec-h:has-text("檢視模式")'); await pg.waitForTimeout(300);
  await click('.st-row:has-text("第一人稱") .switch'); await pg.waitForTimeout(800);
  const pad = await pg.evaluate(() => { const r = document.querySelector('.walkpad')?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: innerWidth } : null; });
  rec(`${tag}: walk pad shown on touch screens, on screen`, !!pad && pad.left >= 0 && pad.right <= pad.w, JSON.stringify(pad));
  // hold the forward arrow
  const fwd = pg.locator('.wp-grid button[aria-label="前進"]');
  const p0 = await pg.evaluate(() => window.__wu.manager.cam.camera.position.toArray());
  await fwd.dispatchEvent('pointerdown', { pointerId: 1 }); await pg.waitForTimeout(2500); await fwd.dispatchEvent('pointerup', { pointerId: 1 });
  const p1 = await pg.evaluate(() => window.__wu.manager.cam.camera.position.toArray());
  rec(`${tag}: on-screen forward walks`, Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.15, `${p0.map(v => v.toFixed(2))} → ${p1.map(v => v.toFixed(2))}`);
  await pg.screenshot({ path: `${OUT}/${tag}_studio_03_walk.png` });
  rec(`${tag}: no uncaught JS errors`, errors.length === 0, errors.join(' | ').slice(0, 200));
  await ctx.close();
}
fs.writeFileSync('reports/studio-mobile-results.json', JSON.stringify({ when: new Date().toISOString(), results: res }, null, 2));
await b.close();
