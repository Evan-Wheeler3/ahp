/* Smoke test: syntax, boot without storage, every weapon, forced collapses, minutes of play, UI flows. */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const H = require('./harness'), { botAim } = require('./bot');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const DT = 1 / 60;

/* 1. syntax */
const tmp = path.join(os.tmpdir(), 'lights-out-check.js');
fs.writeFileSync(tmp, H.extractScript());
execFileSync(process.execPath, ['--check', tmp]);
ok(true, 'node --check passes');

/* 2. no localStorage at all */
{
  const g = H.load({ noStorage: true }), T = g.T;
  T.startRun();
  for (let i = 0; i < 300; i++) T.step(DT);
  T.draw();
  ok(T.state === 'play', 'playable with localStorage throwing');
}
/* 3. v2 save migrates without crashing */
{
  const g = H.load({ saveData: { money: 999999, owned: { slug: 1, rail: 1 }, ups: { power: 3 }, best: 4.2 } }), T = g.T;
  ok(T.save.v === 3 && T.save.best === 4.2 && !T.save.owned.rail && T.save.money === 500, 'v2 save migrated (best kept, economy reset)');
}

/* 4. every weapon fires, explodes, collapses; invariants hold */
{
  const g = H.load(), T = g.T;
  H.maxOut(T.save === undefined ? T : T);
  H.maxOut(T);
  T.startRun();
  T.hull = 99;
  let ex = null;
  try {
    for (const w of T.WEAPONS) {
      T.selectWeapon(w.id);
      for (let shot = 0; shot < 6; shot++) {
        botAim(T, { ignoreThreats: true });
        T.ptr.down = true;
        T.tryFire();
        for (let i = 0; i < 40; i++) { T.step(DT); T.invuln = 9; if (i % 4 === 0) T.draw(); }
        T.ptr.down = false;
        H.checkBuildings(T);
      }
      for (let i = 0; i < 240; i++) { T.step(DT); T.invuln = 9; }
      H.checkBuildings(T);
    }
  } catch (e) { ex = e; console.log(e.stack); }
  ok(!ex, 'all ' + T.WEAPONS.length + ' weapons fired with no exceptions; cnt matches grid after every volley');
  ok(T.runCollapses > 0, 'collapses happened (' + T.runCollapses + ')');
}

/* 5. forced collapse on every building: cut its base row clean */
{
  const g = H.load(), T = g.T;
  T.startRun();
  let ex = null, collapsed = 0;
  try {
    for (let round = 0; round < 12; round++) {
      for (const b of T.buildings) {
        if (b.cnt < 50 || b.x < 0 || b.x > T.VW) continue;
        for (let c = 0; c < b.cols; c++) for (let r = 0; r < 2; r++) if (b.g[c + r * b.cols]) { b.g[c + r * b.cols] = 0; b.hp[c + r * b.cols] = 0; b.cnt--; }
        b.shot = { cap: 1, used: 0 };
        const before = b.cnt; T.lastCollapse = -9; T.analyze(b, 1); if (b.cnt < before) collapsed++;
        H.checkBuildings(T);
      }
      for (let i = 0; i < 120; i++) T.step(DT);
      H.checkBuildings(T);
    }
  } catch (e) { ex = e; console.log(e.stack); }
  ok(!ex && collapsed > 5, 'forced collapses (' + collapsed + ') keep the grid consistent');
}

/* 6. several minutes of play with a bot cycling weapons, enemies on, slow frames mixed in */
{
  const g = H.load(), T = g.T;
  H.maxOut(T);
  T.save.load = ['rocket', 'chain', 'laser', 'rail', 'void', 'orbital'];
  T.renderBar();
  T.startRun();
  let ex = null, maxP = 0, maxF = 0, maxB = 0, frames = 0, drawCalls = 0;
  const ids = T.WEAPONS.map(w => w.id);
  const t0 = Date.now();
  try {
    for (let s = 0; s < 6 * 60 * 60; s++) {     // 6 simulated minutes at 60 Hz
      if (s % 600 === 0) T.selectWeapon(ids[(s / 600) % ids.length | 0]);
      botAim(T);
      T.ptr.down = true;
      T.invuln = 9;
      T.step(DT);
      if (s % 2 === 0) { const c0 = g.counter.fillRect; T.draw(); drawCalls = Math.max(drawCalls, g.counter.fillRect - c0); frames++; T.updateUI(DT); }
      if (s % 997 === 0) { T.frame(s * 1000 / 60 + 250); }       // a 250 ms hitch: clamped, split into fixed steps
      maxP = Math.max(maxP, T.pn); maxF = Math.max(maxF, T.fn); maxB = Math.max(maxB, T.nb);
      if (s % 60 === 0) H.checkBuildings(T);
      if (T.state !== 'play') break;
    }
  } catch (e) { ex = e; console.log(e.stack); }
  ok(!ex, '6 min simulated play: no exceptions (wall ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ' + frames + ' draws)');
  ok(T.state === 'play', 'still playing (district ' + Math.floor(T.dist / T.CFG.districtLen + 1) + ', $' + Math.round(T.runCash) + ', bricks ' + T.runBricks + ', collapses ' + T.runCollapses + ')');
  ok(maxP <= 3600 && maxF <= 900 && maxB <= 2500, 'pools bounded: particles ' + maxP + ', fx ' + maxF + ', burning ' + maxB);
  console.log('       peak fillRect calls in one frame: ' + drawCalls);
}

/* 7. real death, over screen, and UI flows */
{
  const g = H.load(), T = g.T;
  T.startRun();
  for (let s = 0; s < 60 * 400 && T.state !== 'over'; s++) { T.step(DT); }       // no shooting at all: you will be hit
  ok(T.state === 'over', 'an idle player dies and reaches the over screen');
  T.save.money = 1e9;
  for (const tab of ['wpn', 'off', 'eco', 'def', 'util', 'bo']) T.openArmory(tab);
  T.buy('w:carbine'); T.buy('w:auto');                    // auto needs a tier 1 weapon: carbine is one
  ok(T.save.owned.carbine && T.save.owned.auto, 'tier gating lets you buy tier 2 after a tier 1 weapon');
  T.buy('w:napalm');
  ok(!T.save.owned.napalm, 'cannot skip to tier 4 without tier 3');
  T.buyMk('auto'); T.buy('u:slots'); T.toggleEquip('auto'); T.toggleEquip('auto');
  ok(T.save.mk.auto === 1 && T.save.ups.slots === 1, 'Mk and upgrades purchase');
  T.save.cycleD = 9; T.save.earned = 5e6;
  const fz = T.fuseGain();
  T.doBlackout(); T.doBlackout();
  ok(T.save.fuses === fz && fz > 0 && !T.save.owned.auto && T.save.money === 0, 'blackout (two-tap confirm) grants ' + fz + ' fuses and resets the cycle');
  T.buyPerk('money');
  ok(T.save.perks.money === 1, 'fuse perk purchase');
  T.closeArmory();
  T.startRun();
  for (let i = 0; i < 120; i++) T.step(DT);
  ok(T.state === 'play', 'new cycle starts');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL SMOKE TESTS PASSED');
process.exit(fails ? 1 : 0);
