// pixel kit
(function () {
'use strict';
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function sprite(w, h, shape, mats, paint, opts = {}, reuse) {
  const c = reuse || document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'), M = new Array(w * h);
  const ext = {};
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const m = shape(i + 0.5, j + 0.5) || 0; M[j * w + i] = m;
    if (m) { const e = ext[m] || (ext[m] = { y0: j, y1: j }); e.y0 = Math.min(e.y0, j); e.y1 = Math.max(e.y1, j); }
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : M[j * w + i];
  const img = x.createImageData(w, h), d = img.data;
  const set = (i, j, col, a = 255) => { if (i < 0 || j < 0 || i >= w || j >= h) return; const k = (j * w + i) * 4, v = hex(col); d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = a; };
  const outline = opts.outline || '#1b1322';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const m = at(i, j);
    if (!m) { if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) set(i, j, outline); continue; }
    const mt = mats[m], e = ext[m];
    const low = (j - e.y0) / Math.max(1, e.y1 - e.y0) > (mt.band ?? 0.6);
    let col = low ? mt.lo : mt.base;
    if (at(i, j - 1) !== m || (at(i - 1, j) !== m && !low)) col = mt.hi;
    if (at(i, j + 1) !== m || at(i + 1, j) !== m) col = mt.dk || mt.lo;
    if (mt.edge && (at(i, j - 1) && at(i, j - 1) !== m)) col = outline;      // dark seam where it meets a different material
    set(i, j, col);
  }
  if (paint) paint((i, j, col, a) => set(Math.round(i), Math.round(j), col, a), at);
  x.putImageData(img, 0, 0);
  return c;
}
/* cache of the frames we already made: key -> canvas */
const cache = new Map();
function cached(key, make) { let c = cache.get(key); if (!c) { c = make(); if (cache.size > 800) cache.clear(); cache.set(key, c); } return c; }
/* draw a sprite with its anchor (ax, ay) at world (x, y), can be flipped and scaled */
function blit(ctx, spr, ax, ay, x, y, flip, scale = 1, alpha = 1) {
  const w = spr.width * scale, h = spr.height * scale, dx = Math.round(x - ax * scale), dy = Math.round(y - ay * scale);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(Math.round(x + ax * scale), dy); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, w, h); }
  else ctx.drawImage(spr, dx, dy, w, h);
  ctx.restore();
}
window.PK = { sprite, cached, blit, ell };
})();
