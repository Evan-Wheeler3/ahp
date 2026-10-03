/* Real-browser check in headless Chromium at iPhone size: boots, no console errors, taps fire, Armory renders.
   Screenshots go to the directory given as argv[2] (optional). */
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'lights-out.html'));
  await page.waitForTimeout(600);
  if (out) await page.screenshot({ path: out + '/1-title.png' });
  /* give the save a mid-game state so the bar and Armory have content */
  await page.evaluate(() => {
    const T = window.__lo.t, s = T.save;
    s.money = 2.5e6; for (const id of ['slug', 'carbine', 'scatter', 'auto', 'flak', 'chain', 'rocket', 'bouncer', 'napalm', 'laser']) s.owned[id] = 1;
    s.mk.rocket = 3; s.ups.slots = 2; s.ups.cash = 4; s.cycleD = 6; s.load = ['rocket', 'chain', 'flak', 'napalm', 'laser'];
    T.renderBar();
  });
  await page.tap('#startBtn');
  await page.waitForTimeout(400);
  const vp = page.viewportSize();
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(vp.width * (0.45 + i * 0.07), vp.height * 0.72); await page.waitForTimeout(220); }
  await page.waitForTimeout(700);
  if (out) await page.screenshot({ path: out + '/2-play-rocket.png' });
  await page.evaluate(() => window.__lo.t.selectWeapon('laser'));
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(vp.width * 0.6, vp.height * 0.7); await page.mouse.down();
  for (let i = 0; i < 20; i++) { await page.mouse.move(vp.width * (0.6 + i * 0.005), vp.height * 0.7); await page.waitForTimeout(40); }
  if (out) await page.screenshot({ path: out + '/3-play-laser.png' });
  await page.mouse.up();
  const st = await page.evaluate(() => ({ state: window.__lo.state(), bricks: window.__lo.t.runBricks, cash: window.__lo.t.runCash }));
  await page.tap('#hudArm');
  await page.waitForTimeout(300);
  if (out) await page.screenshot({ path: out + '/4-armory-weapons.png' });
  await page.locator('[data-tab="eco"]').tap();
  await page.waitForTimeout(200);
  if (out) await page.screenshot({ path: out + '/5-armory-economy.png' });
  await page.locator('[data-tab="bo"]').tap();
  await page.waitForTimeout(200);
  if (out) await page.screenshot({ path: out + '/6-armory-blackout.png' });
  const tabsOk = await page.locator('.tab').count();
  const minTap = await page.evaluate(() => Math.min(...[...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)));
  await browser.close();
  console.log(JSON.stringify({ errors, ...st, tabs: tabsOk, minButtonHeight: minTap }));
  process.exit(errors.length || st.bricks <= 0 ? 1 : 0);
})();
