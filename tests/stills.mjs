import { chromium } from 'playwright';
const P = (process.env.P || '0.177,0.254,0.767,0.918,1').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.setDefaultTimeout(240000);
await pg.goto('http://localhost:4173/');
await pg.waitForFunction(() => window.__wu && document.querySelector('.loading.is-done'), null, { timeout: 240000 });
for (const p of P) {
  await pg.evaluate(p => window.scrollTo(0, window.__wu.scroll.yFor(p)), p);
  await pg.waitForFunction(p => Math.abs(window.__wu.manager.progress - p) < 0.0008, p, { timeout: 240000 });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: `/home/claude/work/still_${p}.png` });
}
await b.close();
