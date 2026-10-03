/* Balance assertions:
   - early weapons cannot topple armored towers; nothing one-shots a tall block in the outskirts
   - each tier out-clears the previous tier in its own home districts, and peak income rises tier by tier
   - no single shot (fully upgraded, BIG power-up active) brings down the whole screen
   - railgun is a charged, short, slow weapon
   - the progression model lands in the 15-25 hour window with a slow start */
'use strict';
const H = require('./harness'), { botAim } = require('./bot'), E = require('./economy');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const DT = 1 / 60;

function city(T, district, seed) {
  T.startRun();
  T.dist = district * T.CFG.districtLen;
  T.buildings = []; T.edge = -20;
  while (T.edge < T.VW + 260) T.addBuilding();
  T.enemyT = 1e9;
}
/* one tall tower standing alone in the middle of the screen */
function lonelyTower(T, district) {
  city(T, district);
  let b;
  for (let tries = 0; tries < 400; tries++) {
    T.buildings = []; T.edge = 60;
    b = T.addBuilding();
    if (b.rows - 14 >= 60 && b.cols >= 16) break;
  }
  b.x = 70; T.edge = b.x + b.cols * 3;
  return b;
}

/* 1. early weapons vs tall towers */
console.log('early weapons vs tall towers');
for (const [wid, d, secs] of [['slug', 8, 45], ['carbine', 8, 45], ['scatter', 8, 45], ['auto', 9, 45], ['chain', 10, 45]]) {
  const T = H.load({ seed: 11 }).T;
  T.save.owned[wid] = 1; T.save.load = [wid];
  const b = lonelyTower(T, d); T.selectWeapon(wid);
  const n0 = b.cnt, c0 = T.runCollapses;
  for (let i = 0; i < secs * 60; i++) {
    T.enemyT = 1e9; T.invuln = 9; b.x = 70;                       // pin it on screen: give the gun every chance
    botAim(T, { ignoreThreats: true, mode: 'base' }); T.ptr.down = true; T.step(DT);
  }
  ok(T.runCollapses === c0 && b.cnt > n0 * 0.6, wid.padEnd(8) + ' ' + secs + 's on the base of a D' + (d + 1) + ' tower (' + n0 + ' bricks, armor ' + b.A + '): ' + (T.runCollapses - c0) + ' collapses, ' + Math.round(100 * b.cnt / n0) + '% left');
}
{
  const T = H.load({ seed: 12 }).T;
  T.save.load = ['slug'];
  const b = lonelyTower(T, 0); T.selectWeapon('slug');
  let shots = 0; const c0 = T.runCollapses;
  while (T.runCollapses === c0 && b.cnt > 0 && shots < 200) {
    b.x = 70; botAim(T, { ignoreThreats: true, mode: 'base' }); T.ptr.down = true;
    const before = T.cd.slug; T.step(DT); if (before <= 0 && T.cd.slug > 0) shots++;
    T.ptr.down = false; T.invuln = 9; T.enemyT = 1e9;
  }
  ok(shots >= 6, 'slug needs ' + shots + ' shots to drop a ' + b.cols + '-wide tall tower in the Outskirts (>= 6)');
}

/* 2. tier ordering from the throughput matrix */
console.log('tier ordering (bot bricks/min and $/min, from tests/throughput.json)');
const m = E.matrix(false);
const W = H.load().T.WEAPONS;
const HOME = { 1: [0, 1], 2: [2, 3], 3: [4, 5], 4: [6, 7], 5: [8, 9], 6: [10, 11], 7: [12, 13, 14] };
const bestOf = (tier, d, tab) => Math.max(...W.filter(w => w.tier === tier).map(w => tab[w.id][d]));
for (let t = 2; t <= 7; t++) {
  const ds = HOME[t];
  const cur = ds.reduce((a, d) => a + bestOf(t, d, m.bpm), 0) / ds.length, prev = ds.reduce((a, d) => a + bestOf(t - 1, d, m.bpm), 0) / ds.length;
  ok(cur > prev * 1.15, 'tier ' + t + ' out-clears tier ' + (t - 1) + ' in its home districts D' + ds.map(d => d + 1).join('/') + ': ' + Math.round(cur) + ' vs ' + Math.round(prev) + ' bricks/min');
}
let lastPeak = 0;
for (let t = 1; t <= 7; t++) {
  const peak = Math.max(...W.filter(w => w.tier === t).map(w => Math.max(...m.cpm[w.id])));
  ok(peak > lastPeak * 1.25, 'tier ' + t + ' peak income $' + Math.round(peak) + '/min (bot) beats tier ' + (t - 1) + ' by >25%');
  lastPeak = peak;
}
for (let t = 1; t <= 4; t++) {
  const deep = Math.max(...W.filter(w => w.tier === t).map(w => m.bpm[w.id][12]));
  const best7 = bestOf(7, 12, m.bpm);
  ok(deep < best7 * 0.5, 'tier ' + t + ' cannot keep up in D13 (' + deep + ' vs tier 7 ' + best7 + ' bricks/min)');
}

/* 3. one shot never brings down the screen */
console.log('single-shot limits (Mk VI, every upgrade, BIG active)');
for (const w of W) {
  let worst = 0, worstC = 0, worstFlat = 0;
  for (const d of [0, 4, 9]) for (let k = 0; k < 4; k++) {
    const T = H.load({ seed: 100 + d * 10 + k }).T;
    H.maxOut(T); T.save.load = [w.id];
    city(T, d); T.selectWeapon(w.id); T.big = 6; T.hull = 99;
    for (let i = 0; i < 30; i++) T.step(DT);            // let the city settle
    /* judge only what was on screen when the trigger was pulled (not blocks that scroll in later) */
    const seen = T.buildings.filter(b => b.x < T.VW && b.x + b.cols * 3 > 0 && b.cnt > 40).map(b => ({ b, n: b.cnt }));
    const on = seen.reduce((a, x) => a + x.n, 0);
    const tb = seen.filter(x => x.b.x + x.b.cols * 1.5 > 20 && x.b.x < T.VW - 20);
    const b = tb.length ? tb[k % tb.length].b : null;
    if (!b || seen.length < 2) continue;
    T.aim.x = b.x + b.cols * (w.type === 'rail' ? 0.2 : 1.5); T.aim.y = T.groundY - (w.type === 'thermite' ? (b.rows - 16) * 3 : 4);
    const c0 = T.runCollapses;
    T.ptr.down = true; T.tryFire(); T.ptr.down = false;
    if (w.type === 'laser') { T.ptr.down = true; for (let i = 0; i < 18; i++) T.step(DT); T.ptr.down = false; }   // a 0.3 s burst
    for (let i = 0; i < 6 * 60; i++) { T.step(DT); T.invuln = 9; T.enemyT = 1e9; }
    const gone = seen.reduce((a, x) => a + (x.n - Math.max(0, x.b.cnt)), 0) / on;
    const flat = seen.filter(x => x.b.cnt < x.n * 0.3).length;
    worst = Math.max(worst, gone); worstC = Math.max(worstC, T.runCollapses - c0); worstFlat = Math.max(worstFlat, flat / seen.length);
    H.checkBuildings(T);
  }
  ok(worst < 0.5 && worstFlat < 0.75 && worstC <= (w.cap || 1), w.id.padEnd(9) + ' worst shot: ' + Math.round(worst * 100) + '% of on-screen bricks, ' + Math.round(worstFlat * 100) + '% of blocks flattened, ' + worstC + ' collapses (cap ' + (w.cap || 1) + ')');
}

/* 4. railgun shape */
{
  const T = H.load().T, r = T.WEAPONS.find(w => w.id === 'rail');
  ok(r.tier >= 5 && r.charge >= 0.5 && r.cd >= 3 && r.len * 1.4 < T.VW * 0.45, 'railgun: tier ' + r.tier + ', ' + r.charge + 's charge, ' + r.cd + 's cooldown, beam max ' + Math.round(r.len * 1.4) + 'px of a ' + T.VW + 'px screen');
}

/* 5. economy */
console.log('progression model');
{
  const r = E.simulate(m, false);
  ok(r.hours >= 15 && r.hours <= 25, 'everything maxed in ' + r.hours.toFixed(1) + ' h (' + r.runs + ' runs) at ' + E.HUMAN + 'x bot efficiency');
  ok(r.firstTier[2].h >= 0.4, 'tier 2 takes ' + r.firstTier[2].h.toFixed(1) + ' h to reach (early runs earn little)');
  let prev = 0, mono = true;
  for (let t = 2; t <= 7; t++) { const span = r.firstTier[t].h - prev; if (span < 0.5) mono = false; prev = r.firstTier[t].h; }
  ok(mono, 'every tier takes at least half an hour to reach from the previous one');
  ok(m.ceil[1] <= 5, 'a tier 1 loadout cannot survive past D' + (m.ceil[1] + 1) + ' (threats outgrow small arms)');
  let up = true; for (let t = 2; t <= 7; t++) if (m.ceil[t] < m.ceil[t - 1]) up = false;
  ok(up && m.ceil[2] > m.ceil[1], 'survival ceilings rise with tier: ' + [1, 2, 3, 4, 5, 6, 7].map(t => 'T' + t + ' D' + (m.ceil[t] + 1)).join(' '));
  const T = H.load().T;
  ok(T.WEAPONS.length >= 15 && T.WEAPONS.length <= 20 && T.UPGRADES.length >= 20, T.WEAPONS.length + ' weapons, ' + T.UPGRADES.length + ' upgrades + ' + T.WEAPONS.length + ' Mk tracks + ' + T.PERKS.length + ' prestige perks');
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL BALANCE TESTS PASSED');
process.exit(fails ? 1 : 0);
