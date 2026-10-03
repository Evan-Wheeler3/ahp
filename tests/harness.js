/* Loads the game script out of lights-out.html into a Node VM with a stubbed DOM.
   The canvas context counts draw calls so tests can sanity-check per-frame work. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const HTML = path.join(__dirname, '..', 'lights-out.html');
function extractScript() {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  return m[1];
}

function makeCtx(counter) {
  const noop = () => {};
  return {
    fillStyle: '#000', globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect() { counter.fillRect++; }, clearRect() { counter.clearRect++; }, drawImage() { counter.drawImage++; },
    save: noop, restore: noop, translate: noop, createPattern() { return { pattern: true }; }, beginPath: noop, stroke: noop, fill: noop, moveTo: noop, lineTo: noop
  };
}
function makeEl(tag, counter) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, children: [], _ev: {}, _html: '', textContent: '', scrollTop: 0, disabled: false,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on === undefined ? !this._s.has(c) : on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    set innerHTML(v) { this._html = String(v); this.children = []; }, get innerHTML() { return this._html; },
    addEventListener(t, f) { (this._ev[t] || (this._ev[t] = [])).push(f); },
    dispatch(t, ev) { for (const f of this._ev[t] || []) f(ev); },
    getBoundingClientRect() { return { width: 390, height: 74, left: 0, top: 0 }; },
    querySelector() { return makeEl('span', counter); },
    appendChild(c) { this.children.push(c); return c; },
    closest() { return null; },
    setPointerCapture() {}
  };
  if (tag === 'canvas') {
    el.width = 0; el.height = 0;
    const c = makeCtx(counter);
    el.getContext = () => c;
    el.toDataURL = () => 'data:image/png;base64,';
  }
  return el;
}

function load(opts) {
  opts = opts || {};
  const counter = { fillRect: 0, clearRect: 0, drawImage: 0 };
  const els = {};
  const docEv = {};
  const document = {
    body: makeEl('body', counter),
    getElementById(id) { return els[id] || (els[id] = makeEl(id === 'c' ? 'canvas' : 'div', counter)); },
    createElement(t) { return makeEl(t, counter); },
    addEventListener(t, f) { (docEv[t] || (docEv[t] = [])).push(f); },
    hidden: false
  };
  const store = new Map();
  const localStorage = opts.noStorage
    ? { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } }
    : { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  if (opts.saveData) store.set('lightsout2', JSON.stringify(opts.saveData));
  const window = {
    innerWidth: opts.w || 390, innerHeight: opts.h || 844,
    addEventListener() {}, AudioContext: undefined, webkitAudioContext: undefined
  };
  let now = 0;
  const sandbox = {
    window, document, localStorage, navigator: {}, console, getComputedStyle: () => ({ paddingTop: '47px', paddingLeft: '0px' }),
    performance: { now: () => now },
    requestAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {}
  };
  vm.createContext(sandbox);
  if (opts.seed != null) {   // deterministic Math.random (mulberry32) for repeatable balance numbers
    vm.runInContext('(function(){let a=' + (opts.seed >>> 0) + ';Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})()', sandbox);
  }
  vm.runInContext(extractScript(), sandbox, { filename: 'lights-out.js' });
  const T = window.__lo.t;
  return { T, lo: window.__lo, counter, els, store, document, docEv, setNow: v => { now = v; } };
}

/* invariants: per-building brick count matches the grid, hp is set exactly where bricks are */
function checkBuildings(T) {
  for (const b of T.buildings) {
    let n = 0;
    for (let i = 0; i < b.g.length; i++) {
      if (b.g[i]) { n++; if (!b.hp[i]) throw new Error('brick with 0 hp in building ' + b.id + ' at ' + i); }
      else if (b.hp[i]) throw new Error('hp without brick in building ' + b.id);
      if (b.fire && b.fire[i] && !b.g[i]) throw new Error('fire flag on empty cell in building ' + b.id);
    }
    if (n !== b.cnt) throw new Error('cnt mismatch in building ' + b.id + ': cnt=' + b.cnt + ' grid=' + n);
    if (b.cnt < 0) throw new Error('negative cnt');
  }
}
function totalBricks(T, onScreenOnly) {
  let n = 0;
  for (const b of T.buildings) {
    if (onScreenOnly && (b.x > T.VW || b.x + b.cols * 3 < 0)) continue;
    n += b.cnt;
  }
  return n;
}
/* unlock everything at max level */
function maxOut(T) {
  const s = T.save;
  for (const w of T.WEAPONS) { s.owned[w.id] = 1; s.mk[w.id] = 5; }
  for (const u of T.UPGRADES) s.ups[u.id] = u.max;
  s.load = T.WEAPONS.slice(0, 6).map(w => w.id);
}
module.exports = { load, extractScript, checkBuildings, totalBricks, maxOut };
