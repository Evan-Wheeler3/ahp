/* Survival: how long a bot with a typical loadout for each tier lasts in each district with threats on.
   It shoots threats with whichever equipped gun is best against them, and demolishes with its main gun. */
'use strict';
const H = require('./harness'), { botAim } = require('./bot');
/* [main gun, anti-air gun, spare] */
const LOADOUT = {
  1: ['carbine', 'carbine', 'scatter'],
  2: ['chain', 'flak', 'carbine'],
  3: ['bouncer', 'flak', 'chain'],
  4: ['napalm', 'flak', 'bouncer'],
  5: ['laser', 'tesla', 'rail'],
  6: ['quake', 'tesla', 'howitzer'],
  7: ['orbital', 'tesla', 'void']
};
function survive(tier, district, seed, secs) {
  const g = H.load({ seed }), T = g.T, s = T.save;
  const load = LOADOUT[tier];
  for (const id of load) s.owned[id] = 1;
  s.load = load.slice();
  /* upgrades a player at this tier typically owns (defense is cheap by mid-game) */
  const c = (v, m) => Math.max(0, Math.min(m, v));
  Object.assign(s.ups, { armor: c(tier, 6), assist: c(tier - 1, 4), pd: c(tier - 2, 5), dmg: c((tier - 1) * 2, 10), warn: c(tier - 2, 5),
    regen: c(tier - 3, 5), shieldgen: c(tier - 4, 3), reactive: c(tier - 4, 3), reload: c(tier, 8) });
  const aaW = T.WEAPONS.find(w => w.id === load[1]);
  s.mk[load[1]] = c((tier - aaW.tier) * 2, 5);
  T.renderBar();
  T.startRun();
  T.dist = district * T.CFG.districtLen;
  T.buildings = []; T.edge = -20;
  while (T.edge < T.VW + 260) T.addBuilding();
  const aa = load[1];
  const n = secs * 60;
  for (let i = 0; i < n; i++) {
    if (T.state !== 'play') return i / 60;
    const mode = botAim(T, { react: 0.35, jitter: 3 });     // human-ish: a beat to react, imperfect aim
    const want = mode === 'enemy' ? aa : load[0];
    if (T.weaponId !== want && !T.charging) T.selectWeapon(want);
    T.ptr.down = true;
    T.step(1 / 60);
    T.dist = Math.max(T.dist, district * T.CFG.districtLen);
    if (T.dist > (district + 0.98) * T.CFG.districtLen) T.dist = district * T.CFG.districtLen;    // stay in this district
  }
  return secs;
}
module.exports = { survive, LOADOUT };
if (require.main === module) {
  const secs = 150, tiers = (process.argv[2] || '1,2,3,4,5,6,7').split(',').map(Number);
  console.log('seconds survived (median of 3), ' + secs + 's max');
  for (const t of tiers) {
    let row = 'T' + t + ' ';
    for (let d = 0; d < 15; d++) {
      if (d > 2 * t + 5) { row += '    -'; continue; }
      const r = [1, 2, 3].map(sd => survive(t, d, sd * 97 + d, secs)).sort((a, b) => a - b)[1];
      row += String(Math.round(r)).padStart(5);
    }
    console.log(row);
  }
}
