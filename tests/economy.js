/* Progression model ("balance spreadsheet" made executable).
   1. Measures every weapon's bot throughput ($/min and bricks/min) in districts 1..15 (seeded, cached).
   2. Simulates a player: each run they deploy where their best owned weapon earns most, among districts
      their gear can actually handle, earn HUMAN x bot rate for RUN_MIN minutes, then buy the cheapest
      thing they can afford (weapon, Mk level or upgrade). Repeats until everything is maxed.
   Assumptions are deliberately simple and printed with the result. */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./harness'), { measure } = require('./measure'), { survive } = require('./survival');
const CACHE = path.join(__dirname, 'throughput.json');
const DMAX = 15;

const HUMAN = 0.35;          // a person vs a perfect bot: aiming, threats, crates, reaction time
const RUN_MIN = 6;           // minutes per run once deploy checkpoints are in play
const FRONTIER_BPM = 2500;   // a district is "handleable" if the bot clears >= this many bricks/min there
const HUMAN_MARGIN = 2;      // players deploy 2 districts short of where the bot loadout survives 2.5 min
const KILL_BONUS = 1.1;      // shooting threats adds roughly 10% on top of brick income
const WEAPON_PULL = 0.4;     // players chase new guns: a weapon is ranked as if it cost 40% of its price

function matrix(force) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lights-out.html'), 'utf8');
  /* prices and pay rate don't change throughput, so they're left out of the cache key; $/min scales with payMult */
  const pay = +src.match(/payMult: ([\d.]+)/)[1];
  const key = src.replace(/(cost|base): \d+/g, '').replace(/payMult: [\d.]+/, '').replace(/BALANCE SHEET[\s\S]*?={20,} \*\//, '');
  const sig = require('crypto').createHash('md5').update(key).digest('hex');
  if (!force && fs.existsSync(CACHE)) {
    const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (c.sig === sig) { const k = pay / c.pay; for (const id in c.cpm) c.cpm[id] = c.cpm[id].map(v => v * k); return c; }
  }
  const T = H.load().T, m = { sig, pay, bpm: {}, cpm: {} };
  for (const w of T.WEAPONS) {
    m.bpm[w.id] = []; m.cpm[w.id] = [];
    for (let d = 0; d < DMAX; d++) { const r = measure(w.id, d, { secs: 40, seed: 77 + d }); m.bpm[w.id].push(Math.round(r.bpm)); m.cpm[w.id].push(Math.round(r.cpm * 100) / 100); }
    process.stderr.write('.');
  }
  /* survival ceiling per tier: deepest district a typical loadout of that tier survives 150 s (median of 3) */
  m.ceil = {};
  for (let t = 1; t <= 7; t++) {
    let c = 0;
    for (let d = 0; d < DMAX; d++) {
      const r = [1, 2, 3].map(sd => survive(t, d, sd * 97 + d, 150)).sort((a, b) => a - b)[1];
      if (r < 150) break;
      c = d;
    }
    m.ceil[t] = c;
    process.stderr.write('s');
  }
  process.stderr.write('\n');
  fs.writeFileSync(CACHE, JSON.stringify(m));
  return m;
}

function simulate(m, verbose) {
  const T = H.load().T, W = T.WEAPONS, U = T.UPGRADES;
  const own = { slug: 1 }, mk = {}, ups = {};
  let money = 0, minutes = 0, runs = 0;
  const firstTier = {}, log = [];
  const lv = id => ups[id] | 0;
  const power = w => (1 + 0.1 * (mk[w] | 0)) * (1 + 0.03 * (lv('dmg') + lv('power') + lv('reload')));
  const cashMult = () => (1 + 0.12 * lv('cash')) * (1 + 0.04 * (lv('demo') + lv('bounty') + lv('combo')));
  const tierOpen = t => t <= 1 || W.some(w => w.tier === t - 1 && own[w.id]);
  function bestRun() {
    let best = { cpm: 0, w: 'slug', d: 0 };
    const topTier = Math.max(...W.filter(w => own[w.id]).map(w => w.tier));
    const dCap = Math.max(0, m.ceil[topTier] - HUMAN_MARGIN);
    for (const w of W) {
      if (!own[w.id]) continue;
      for (let d = 0; d <= dCap; d++) {
        const p = power(w.id);
        if (m.bpm[w.id][d] * p < FRONTIER_BPM && d > 0) continue;
        const c = m.cpm[w.id][d] * p * cashMult() * KILL_BONUS;
        if (c > best.cpm) best = { cpm: c, w: w.id, d };
      }
    }
    return best;
  }
  function items() {
    const out = [];
    for (const w of W) {
      if (!own[w.id]) { if (tierOpen(w.tier)) out.push({ k: 'w', id: w.id, cost: w.cost, rank: w.cost * WEAPON_PULL, tier: w.tier }); }
      else if ((mk[w.id] | 0) < 5) out.push({ k: 'mk', id: w.id, cost: T.mkCost(w, mk[w.id] | 0) });
    }
    for (const u of U) if (lv(u.id) < u.max) out.push({ k: 'u', id: u.id, cost: T.upCost(u, lv(u.id)) });
    for (const x of out) if (x.rank == null) x.rank = x.cost;
    return out.sort((a, b) => a.rank - b.rank);
  }
  let total = 0;
  for (const w of W) { total += w.cost; for (let l = 0; l < 5; l++) total += T.mkCost(w, l); }
  for (const u of U) for (let l = 0; l < u.max; l++) total += T.upCost(u, l);
  while (runs < 20000) {
    const it = items();
    if (!it.length) break;
    const br = bestRun();
    const earn = br.cpm * HUMAN * RUN_MIN;
    money += earn; minutes += RUN_MIN; runs++;
    if (verbose && runs % 25 === 1) log.push('run ' + String(runs).padStart(4) + '  ' + (minutes / 60).toFixed(1).padStart(5) + 'h  ' + br.w.padEnd(9) + ' D' + String(br.d + 1).padEnd(3) + ' $' + Math.round(earn).toLocaleString('en-US').padStart(10) + '/run');
    for (let again = true; again;) {
      again = false;
      for (const x of items()) {
        if (x.cost > money) break;      // save up for the most wanted thing rather than spending around it
        money -= x.cost; again = true;
        if (x.k === 'w') { own[x.id] = 1; if (!firstTier[x.tier]) firstTier[x.tier] = { h: minutes / 60, runs, inc: earn }; }
        else if (x.k === 'mk') mk[x.id] = (mk[x.id] | 0) + 1;
        else ups[x.id] = lv(x.id) + 1;
        break;
      }
    }
  }
  return { hours: minutes / 60, runs, firstTier, log, total };
}
module.exports = { matrix, simulate, HUMAN, RUN_MIN, HUMAN_MARGIN };

if (require.main === module) {
  const m = matrix(process.argv.includes('--force'));
  const r = simulate(m, true);
  console.log('bricks/min (bot) by district');
  for (const id in m.bpm) console.log(id.padEnd(9) + m.bpm[id].map(v => String(v).padStart(6)).join(''));
  console.log('\n$/min (bot, no upgrades) by district');
  for (const id in m.cpm) console.log(id.padEnd(9) + m.cpm[id].map(v => String(Math.round(v)).padStart(7)).join(''));
  console.log('\nsurvival ceiling by tier (bot, district index): ' + JSON.stringify(m.ceil) + ', players deploy ' + HUMAN_MARGIN + ' shallower');
  console.log('\n' + r.log.join('\n'));
  console.log('\ntier first owned:');
  for (const t in r.firstTier) console.log('  T' + t + ' at ' + r.firstTier[t].h.toFixed(1) + 'h (run ' + r.firstTier[t].runs + ', $' + Math.round(r.firstTier[t].inc) + '/run)');
  console.log('\nEverything maxed after ' + r.hours.toFixed(1) + ' h, ' + r.runs + ' runs. Total price of everything $' + Math.round(r.total).toLocaleString('en-US'));
  console.log('(assumes ' + HUMAN + 'x bot efficiency, ' + RUN_MIN + ' min runs)');
}
