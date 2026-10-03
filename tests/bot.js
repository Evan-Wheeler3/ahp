/* A simple autoplayer: shoots threats first, then crates, then the leftmost standing block,
   aimed the way each weapon is meant to be used (base, roof, or the block's left edge). */
'use strict';
const MODE = { thermite: 'top', rail: 'left', orbital: 'center', void: 'base2' };
function brickIn(b, c, r) { return c >= 0 && c < b.cols && r >= 0 && r < b.rows && b.g[c + r * b.cols]; }
function pickBrick(T, b, rowMax, mode) {
  const BR = 3, cols = b.cols, gy = T.groundY;
  if (mode === 'top' || mode === 'center') {
    let best = -1, bc = 0;
    const c0 = Math.floor(cols * (mode === 'center' ? 0.5 : 0.3));
    for (let d = 0; d < cols; d++) {
      const c = (c0 + d) % cols;
      for (let r = b.rows - 1; r >= 0; r--) if (b.g[c + r * cols]) { if (r > best + 2) { best = r; bc = c; } break; }
      if (best > 6) break;
    }
    if (best < 0) return null;
    return { x: b.x + (bc + 0.5) * BR, y: gy - (mode === 'center' ? 2 : best + 0.5) * BR };
  }
  if (mode === 'left') {
    for (let c = 0; c < cols; c++) for (let r = 0; r < 3; r++) if (brickIn(b, c, r)) return { x: b.x + c * BR + 2, y: gy - 1.5 * BR };
    return null;
  }
  const mid = Math.floor(cols * 0.35), r0 = mode === 'base2' ? 3 : 0;
  for (let r = r0; r < Math.min(b.rows, rowMax + r0); r++)
    for (let d = 0; d < cols; d++) {
      const c = (mid + d) % cols;
      if (b.g[c + r * cols]) return { x: b.x + (c + 0.5) * BR, y: gy - (r + 0.5) * BR };
    }
  return null;
}
function botAim(T, opts) {
  opts = opts || {};
  const aim = T.aim;
  if (!opts.ignoreThreats) {
    let best = null;
    const react = opts.react || 0, jit = opts.jitter || 0;
    for (const e of T.enemies) if (!e.dead && e.t >= react && (!best || e.z < best.z)) best = e;
    if (best && best.z < 0.9) { aim.x = best.x + (Math.random() * 2 - 1) * jit; aim.y = best.y + (Math.random() * 2 - 1) * jit; return 'enemy'; }
    for (const c of T.crates) if (!c.gone && c.x > 10 && c.x < T.VW - 10) { aim.x = c.x; aim.y = c.y; return 'crate'; }
  }
  const mode = opts.mode || MODE[T.weaponId] || 'base';
  const lo = opts.minX == null ? 24 : opts.minX, hi = T.VW - 12;
  let tb = null;
  for (const b of T.buildings) {
    if (b.cnt <= 0) continue;
    const cx = b.x + b.cols * 1.5;
    if (cx < lo || b.x > hi) continue;
    if (!tb || b.x < tb.x) tb = b;
  }
  if (!tb) { aim.x = T.VW * 0.7; aim.y = T.groundY - 6; return 'none'; }
  const p = pickBrick(T, tb, opts.rowMax || 4, mode) || pickBrick(T, tb, tb.rows, 'base');
  if (p) { aim.x = p.x; aim.y = p.y; }
  return 'building';
}
module.exports = { botAim, pickBrick };
