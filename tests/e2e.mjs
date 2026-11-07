// End-to-end test: scroll film, navigation, reverse scroll, explore, fullscreen, mobile/tablet, memory.
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:4173/';
const ONLY = process.env.ONLY || 'all';
const OUT = 'reports/screenshots';
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = []; const errors = [];
const rec = (name, ok, detail) => { results.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail ?? ''); };
const b = await chromium.launch({ args });

async function open(viewport, opts = {}) {
  const ctx = await b.newContext({ viewport, ...opts });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(240000);
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errors.push(`[${viewport.width}] ${m.text()}`); });
  pg.on('pageerror', e => errors.push(`[${viewport.width}] PAGEERROR ${e.message}`));
  // the regression suite reads English labels
  await pg.goto(URL + (URL.includes('?') ? '&' : '?') + 'lang=en');
  await pg.waitForFunction(() => window.__wu && document.querySelector('.loading.is-done'), null, { timeout: 240000 });
  await pg.waitForTimeout(1500);
  return { ctx, pg };
}
async function goP(pg, p) {
  await pg.evaluate(p => window.scrollTo(0, window.__wu.scroll.yFor(p)), p);
  await pg.waitForFunction(p => Math.abs(window.__wu.manager.progress - p) < 0.0008, p, { timeout: 240000 });
  await pg.waitForTimeout(700);
}
// read after two animation frames, so the render loop has applied the current progress (software GL runs at ~1 fps)
const state = pg => pg.evaluate(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const m = window.__wu.manager; const c = m.cam.camera; return { p: m.progress, mode: m.cam.mode, pos: c.position.toArray().map(v => +v.toFixed(3)), fov: +c.fov.toFixed(2), ceiling: +m.cam.ceiling.toFixed(2), active: document.querySelector('.dock-rail [aria-current=step] .nm')?.textContent, counter: document.querySelector('.dock-list .num')?.textContent }; });

if (ONLY === 'all' || ONLY === 'desktop') {
  const { ctx, pg } = await open({ width: 1440, height: 900 });
  const chapters = await pg.evaluate(() => window.__wu.manager.path.chapters.map(c => ({ chapter: c.chapter, peak: c.peak })));
  // 1. film stills at every chapter peak
  for (const c of chapters) {
    const p = c.chapter === 'hero' ? 0 : c.chapter === 'finale' ? 1 : c.peak;
    await goP(pg, p);
    const s = await state(pg);
    // camera must sit on the path sample for p
    const exp = await pg.evaluate(p => { const m = window.__wu.manager; const s = m.path.sample(p); return s.position.toArray(); }, s.p);
    const d = Math.hypot(...exp.map((v, i) => v - s.pos[i]));
    const vis = await pg.evaluate(() => [...document.querySelectorAll('.chapters > *')].filter(e => +getComputedStyle(e).opacity > 0.6).map(e => e.querySelector('h2')?.textContent || e.className));
    rec(`chapter ${c.chapter} @${p.toFixed(3)}`, c.chapter === 'hero' || c.chapter === 'finale' || d < 0.6, `cam-on-path Δ=${d.toFixed(3)} m · nav=${s.active} · ${s.counter} · text=${JSON.stringify(vis)}`);
    await pg.screenshot({ path: `${OUT}/desktop_${String(chapters.indexOf(c)).padStart(2, '0')}_${c.chapter}.png` });
  }
  // 2. reverse scroll: progress decreases and camera follows
  await goP(pg, 0.62); const a = await state(pg);
  await goP(pg, 0.31); const bb = await state(pg);
  rec('scroll up plays backwards', bb.p < a.p && Math.hypot(...a.pos.map((v, i) => v - bb.pos[i])) > 0.5, `p ${a.p.toFixed(3)} → ${bb.p.toFixed(3)}`);
  // 3. deterministic: same scroll offset → same camera pose
  await goP(pg, 0.45); const s1 = await state(pg); await goP(pg, 0.2); await goP(pg, 0.45); const s2 = await state(pg);
  rec('scroll position ↔ camera pose is deterministic', Math.hypot(...s1.pos.map((v, i) => v - s2.pos[i])) < 0.02, JSON.stringify([s1.pos, s2.pos]));
  // 4. wheel input
  await goP(pg, 0.1); const w0 = await state(pg);
  for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, 240); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(2500); const w1 = await state(pg);
  rec('mouse wheel advances the film', w1.p > w0.p, `p ${w0.p.toFixed(4)} → ${w1.p.toFixed(4)}`);
  // 5. nav click
  await pg.locator('.dock-rail button:nth-child(5)').dispatchEvent('click');
  await pg.waitForTimeout(4000);
  await pg.waitForFunction(() => Math.abs(window.__wu.manager.progress - window.__wu.scroll.raw) < 0.001, null, { timeout: 240000 });
  const n = await state(pg);
  rec('navigation click scrolls to the room', /Living/i.test(n.active || ''), `active=${n.active} p=${n.p.toFixed(3)}`);
  // 6. index menu
  await pg.click('text=Index'); await pg.waitForTimeout(500);
  const rows = await pg.locator('.index-menu li').count();
  await pg.screenshot({ path: `${OUT}/desktop_index_menu.png` });
  await pg.click('.index-menu li:has-text("Master Bedroom") button'); await pg.waitForTimeout(4000);
  await pg.waitForFunction(() => Math.abs(window.__wu.manager.progress - window.__wu.scroll.raw) < 0.001, null, { timeout: 240000 });
  const im = await state(pg);
  rec('index menu lists rooms.json and jumps', rows === 20 && /Master/i.test(im.active || ''), `${rows} rows · active=${im.active}`);
  // 7. explore mode
  const before = await state(pg);
  await pg.keyboard.press('e'); await pg.waitForTimeout(800);
  const ex = await state(pg);
  const scrollY0 = await pg.evaluate(() => scrollY);
  await pg.mouse.move(720, 450); await pg.mouse.down(); await pg.mouse.move(900, 470, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(800);
  const orbit = await state(pg);
  await pg.mouse.wheel(0, 400); await pg.waitForTimeout(800);
  const scrollY1 = await pg.evaluate(() => scrollY);
  rec('free explore: orbit moves camera, page scroll locked', ex.mode === 'explore' && Math.hypot(...orbit.pos.map((v, i) => v - ex.pos[i])) > 0.05 && scrollY0 === scrollY1, `mode=${ex.mode} scrollY ${scrollY0}→${scrollY1}`);
  await pg.click('text=Floor plan'); await pg.waitForTimeout(2600);
  const plan = await state(pg);
  await pg.screenshot({ path: `${OUT}/desktop_explore_floorplan.png` });
  rec('floor plan view', plan.pos[1] > 15 && plan.ceiling < 0.1, JSON.stringify(plan.pos));
  await pg.click('.toolbar >> text=Overview'); await pg.waitForTimeout(2600);
  await pg.screenshot({ path: `${OUT}/desktop_explore_overview.png` });
  await pg.mouse.click(1000, 520); await pg.waitForTimeout(600);
  const picked = await pg.locator('.pick').count();
  rec('click identifies a model object', picked === 1, picked ? await pg.locator('.pick').innerText() : 'nothing picked');
  await pg.click('.toolbar >> text=Reset view'); await pg.waitForTimeout(2400);
  await pg.click('text=Back to tour'); await pg.waitForTimeout(2600);
  const back = await state(pg);
  rec('return to tour restores the scroll pose', back.mode === 'scroll' && Math.abs(back.p - before.p) < 0.002 && Math.hypot(...back.pos.map((v, i) => v - before.pos[i])) < 0.15, `p ${before.p.toFixed(4)}→${back.p.toFixed(4)}`);
  // 8. fullscreen
  const fsOk = await pg.evaluate(async () => { try { await document.documentElement.requestFullscreen(); const ok = !!document.fullscreenElement; await document.exitFullscreen(); return ok; } catch (e) { return 'err ' + e.message; } });
  rec('fullscreen API', fsOk === true, String(fsOk));
  // 9. memory stability across 3 full passes
  const mem = async () => pg.evaluate(() => { const i = window.__wu.manager.renderer.info; return { heap: performance.memory?.usedJSHeapSize, geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs?.length }; });
  const m0 = await mem();
  for (let k = 0; k < 3; k++) { await goP(pg, 1); await goP(pg, 0); }
  await pg.evaluate(() => window.gc?.()); const m1 = await mem();
  rec('no growth in GPU resources over 3 passes', m1.geo === m0.geo && m1.tex === m0.tex && m1.prog === m0.prog, JSON.stringify({ before: m0, after: m1 }));
  const perf = await pg.evaluate(() => { const i = window.__wu.manager.renderer.info.render; return { calls: i.calls, triangles: i.triangles, fps_swiftshader: +window.__wu.manager.fps.toFixed(1) }; });
  results.push({ name: 'render stats (desktop, SwiftShader CPU renderer)', status: 'INFO', detail: JSON.stringify(perf) });
  await ctx.close();
}

if (ONLY === 'all' || ONLY === 'mobile') {
  // mobile: iPhone-sized, touch
  const { ctx, pg } = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.screenshot({ path: `${OUT}/mobile_00_hero.png` });
  const cdp = await ctx.newCDPSession(pg);
  const t0 = await state(pg);
  // real touch sequence (touchStart → touchMove × 14 → touchEnd), i.e. a finger swiping up
  for (let k = 0; k < 3; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 720 }] });
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 720 - i * 36 }] }); await pg.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(400);
  }
  await pg.waitForTimeout(3000);
  const t1 = await state(pg);
  rec('mobile: touch swipe drives camera progress', t1.p > t0.p, `p ${t0.p.toFixed(4)} → ${t1.p.toFixed(4)}`);
  const peaks = await pg.evaluate(() => window.__wu.manager.path.chapters.filter(c => ['R03_DINING', 'R05_LIVING', 'R14_MASTER', 'stone_travertine'].includes(c.chapter)).map(c => c.peak));
  const overlap = [];
  for (const [i, p] of peaks.entries()) {
    await goP(pg, p); await pg.screenshot({ path: `${OUT}/mobile_0${i + 1}.png` });
    overlap.push(...await pg.evaluate(() => [...document.querySelectorAll('.chapter,.material')].filter(e => +getComputedStyle(e).opacity > 0.5).map(e => +(e.getBoundingClientRect().height / innerHeight).toFixed(2))));
  }
  rec('mobile: text leaves the 3D view visible', overlap.length === 4 && overlap.every(h => h < 0.45), `visible panel height / viewport = ${JSON.stringify(overlap)}`);
  const q = await pg.evaluate(() => window.__wu.manager.quality);
  results.push({ name: 'mobile quality profile', status: 'INFO', detail: JSON.stringify(q) });
  await ctx.close();
}
if (ONLY === 'all' || ONLY === 'tablet') {
  const { ctx, pg } = await open({ width: 1024, height: 1366 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await goP(pg, 0.0); await pg.screenshot({ path: `${OUT}/tablet_00_hero.png` });
  await goP(pg, 0.33); await pg.screenshot({ path: `${OUT}/tablet_01.png` });
  const s = await state(pg);
  rec('tablet: renders and scrolls', s.p > 0.3, `p=${s.p.toFixed(3)} nav=${s.active}`);
  await ctx.close();
}
if (ONLY === 'all' || ONLY === 'reduced') {
  const { ctx, pg } = await open({ width: 1280, height: 800 }, { reducedMotion: 'reduce' });
  await goP(pg, 0.205); const a = await state(pg); await goP(pg, 0.215); const c = await state(pg);
  const holds = await pg.evaluate(() => { const m = window.__wu.manager; return m.path.keys.map((k, i) => k.hold > 0 ? m.path.positions[i].toArray() : null).filter(Boolean); });
  const onHold = [a, c].every(s => holds.some(h => Math.hypot(...h.map((v, i) => v - s.pos[i])) < 0.05));
  rec('prefers-reduced-motion: camera cuts between resting frames', onHold, JSON.stringify([a.pos, c.pos]));
  await ctx.close();
}
rec('no unhandled JavaScript errors', errors.length === 0, errors.slice(0, 5).join(' | '));
fs.writeFileSync(`reports/e2e-${ONLY}.json`, JSON.stringify({ when: new Date().toISOString(), url: URL, results, errors }, null, 1));
await b.close();
