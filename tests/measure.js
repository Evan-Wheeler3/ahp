/* Throughput measurement: bricks/min and $/min each weapon achieves against a given district's city,
   bot aiming at block bases, no threats, no upgrades unless asked. */
'use strict';
const H = require('./harness'), { botAim } = require('./bot');
function measure(wid, district, opts) {
  opts = opts || {};
  const g = H.load({ seed: opts.seed == null ? 1234 : opts.seed }), T = g.T;
  const s = T.save;
  s.owned[wid] = 1; s.load = [wid];
  if (opts.mk) s.mk[wid] = opts.mk;
  if (opts.ups) Object.assign(s.ups, opts.ups);
  T.startRun();
  T.dist = district * T.CFG.districtLen;
  T.buildings = []; T.edge = -20;
  while (T.edge < T.VW + 260) T.addBuilding();
  T.selectWeapon(wid);
  const secs = opts.secs || 60, n = secs * 60;
  const b0 = T.runBricks, c0 = T.runCash, k0 = T.runCollapses;
  for (let i = 0; i < n; i++) {
    T.enemyT = 1e9; T.invuln = 9;
    botAim(T, { ignoreThreats: true, rowMax: opts.rowMax || 4 });
    T.ptr.down = true;
    T.step(1 / 60);
    // keep the city at the target district instead of drifting deeper
    T.dist = district * T.CFG.districtLen;
  }
  return { bpm: (T.runBricks - b0) / secs * 60, cpm: (T.runCash - c0) / secs * 60, col: T.runCollapses - k0 };
}
module.exports = { measure };
if (require.main === module) {
  const ids = (process.argv[2] || '').split(',').filter(Boolean);
  const ds = (process.argv[3] || '0,2,4,6,8,10,12').split(',').map(Number);
  const mk = +(process.argv[4] || 0);
  const W = require('./harness').load().T.WEAPONS;
  const list = ids.length ? ids : W.map(w => w.id);
  console.log('weapon     ' + ds.map(d => ('D' + (d + 1)).padStart(12)).join(''));
  for (const id of list) {
    let row = id.padEnd(10);
    for (const d of ds) { const r = measure(id, d, { mk, secs: 45 }); row += (Math.round(r.bpm) + '/' + r.col).padStart(12); }
    console.log(row);
  }
}
