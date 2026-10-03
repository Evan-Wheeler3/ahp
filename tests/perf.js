/* Hot-path timing under a worst-case load (fully upgraded, fast weapons, big collapses, fire, black holes).
   Node is not an iPhone; the useful numbers are the relative cost of step vs draw and the worst spikes. */
'use strict';
const H = require('./harness'), { botAim } = require('./bot');
const g = H.load({ seed: 3 }), T = g.T;
H.maxOut(T);
T.save.load = ['chain', 'napalm', 'laser', 'void', 'orbital', 'cluster'];
T.renderBar(); T.startRun();
T.dist = 6 * T.CFG.districtLen;
const ids = T.save.load;
const st = [], dr = [], fr = [];
const now = () => Number(process.hrtime.bigint()) / 1e6;
for (let s = 0; s < 3 * 60 * 60; s++) {
  if (s % 300 === 0) T.selectWeapon(ids[(s / 300) % ids.length | 0]);
  botAim(T); T.ptr.down = true; T.invuln = 9;
  let t0 = now(); T.step(1 / 60); const a = now() - t0;
  const c0 = g.counter.fillRect;
  t0 = now(); T.draw(); const b = now() - t0;
  st.push(a); dr.push(b); fr.push(g.counter.fillRect - c0);
}
const q = (arr, p) => { const x = arr.slice().sort((a, b) => a - b); return x[Math.floor(p * (x.length - 1))]; };
const f = v => v.toFixed(2).padStart(6);
console.log('                  p50    p99    max   (ms, node, 3 simulated minutes)');
console.log('step()        ' + f(q(st, .5)) + ' ' + f(q(st, .99)) + ' ' + f(Math.max(...st)));
console.log('draw()        ' + f(q(dr, .5)) + ' ' + f(q(dr, .99)) + ' ' + f(Math.max(...dr)));
console.log('fillRect/frame' + String(q(fr, .5)).padStart(7) + String(q(fr, .99)).padStart(7) + String(Math.max(...fr)).padStart(7));
console.log('bricks ' + T.runBricks + ', collapses ' + T.runCollapses + ', district ' + Math.floor(T.dist / T.CFG.districtLen + 1));
