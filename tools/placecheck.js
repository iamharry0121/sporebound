// placement checker: walks every chunk around each levels route and checks that
globalThis.SB = require('../src/sim.js');
const GEN = require('../src/gen.js');
const TS = 16, FOOT = { rockS: [0, 27], rockM: [2, 52], rockMoss: [0, 63], rockBig: [0, 99], tree: [38, 68], pillarA: [0, 27], pillarB: [0, 25] };
const only = process.argv[2] ? [+process.argv[2] - 1] : [...Array(GEN.STORY_LEVELS).keys()];
let total = 0;
for (const n of only) {
  const w = GEN.makeGenWorld(n), L = w.L, T = (x, y) => SB.tileAt(w, x, y);
  const chunks = new Set();
  for (let i = 0; i < L.path.length - 1; i++) {
    const [x0, y0] = L.path[i], [x1, y1] = L.path[i + 1], steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) { const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) chunks.add(Math.floor(x / 16 + dx) + ',' + Math.floor(y / 16 + dy)); }
  }
  const issues = [], decos = [], caps = [];
  const bad = (what, info) => issues.push(what + ' ' + JSON.stringify(info));
  for (const k of chunks) {
    const [cx, cy] = k.split(',').map(Number), c = L.chunk(cx, cy);
    for (const [name, l, t] of c.deco) {
      const S = SB.SPR[name], r = l + S[2], b = t + S[3], gy = Math.round((b - 3) / TS), F = FOOT[name];
      decos.push({ name, l, t, r, b });
      for (let tx = Math.floor((l + F[0]) / TS); tx <= Math.floor((l + F[1]) / TS); tx++) if (T(tx, gy) !== '#' || T(tx, gy - 1) !== '.') bad('prop-unsupported', { name, tx, gy });
      for (let ty = Math.floor(t / TS); ty < gy; ty++) for (let tx = Math.floor(l / TS); tx <= Math.floor((r - 1) / TS); tx++) if (T(tx, ty) !== '.') bad('prop-overlaps-terrain', { name, tx, ty, c: T(tx, ty) });
    }
    for (const cp of c.caps) {
      const cap = SB.makeCap(cp.tx, cp.ty), l = cap.ox, t = cap.oy, gy = cp.ty + 1;
      caps.push({ l, t, r: l + 70, b: t + 56 });
      if (T(cp.tx - 1, gy) !== '#') bad('cap-unsupported', cp);
      for (let ty = Math.floor(t / TS); ty < gy; ty++) for (let tx = Math.floor(l / TS); tx <= Math.floor((l + 69) / TS); tx++) if (T(tx, ty) !== '.') bad('cap-overlaps-terrain', { ...cp, tx, ty });
    }
    for (const f of c.flies) if (T(Math.floor(f.x / TS), Math.floor(f.y / TS)) !== '.') bad('firefly-in-terrain', f);
    for (const e of c.enemies) {
      if (e.type === 'shroom') { for (const [ox, oy] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 7]]) if (T(Math.floor((e.x + ox) / TS), Math.floor((e.y + oy - 1) / TS)) === '#') bad('shroom-in-terrain', e); if (T(Math.floor(e.x / TS), Math.floor((e.y + 9) / TS)) !== '#') bad('shroom-not-on-ground', e); }
    }
    // water: every water tile has to sit on soil or more water, with walls or water on both sides
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const x = cx * 16 + i, y = cy * 16 + j;
      if (T(x, y) === '~') {
        if (!['#', '~'].includes(T(x, y + 1))) bad('water-floating', { x, y });
        if (!['#', '~'].includes(T(x - 1, y)) || !['#', '~'].includes(T(x + 1, y))) bad('water-leaking', { x, y });
      }
      // stray crumbs: a solid tile with no solid neighbour at all
      if (T(x, y) === '#' && !['#'].includes(T(x - 1, y)) && T(x + 1, y) !== '#' && T(x, y - 1) !== '#' && T(x, y + 1) !== '#') bad('lonely-tile', { x, y });
    }
  }
  const ov = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  for (let i = 0; i < decos.length; i++) { for (let j = i + 1; j < decos.length; j++) if (ov(decos[i], decos[j])) bad('props-overlap', [decos[i].name, decos[j].name, decos[i].l, decos[i].t]); for (const c of caps) if (ov(decos[i], c)) bad('prop-overlaps-cap', decos[i]); }
  const g = w.goal; if (T(Math.floor(g.x / TS), Math.floor(g.y / TS)) !== '.') bad('artifact-in-terrain', g);
  let floor = false; for (let k = 1; k <= 3; k++) if (T(Math.floor(g.x / TS), Math.floor(g.y / TS) + k) === '#') floor = true; if (!floor) bad('artifact-floating', g);
  if (T(Math.floor(w.start.x / TS), Math.floor(w.start.y / TS)) !== '.') bad('spawn-in-terrain', w.start);
  total += issues.length;
  const counts = {}; for (const s of issues) { const k = s.split(' ')[0]; counts[k] = (counts[k] || 0) + 1; }
  console.log(`level ${n + 1}: ${decos.length} props, ${caps.length} caps, ${issues.length} issues`, Object.keys(counts).length ? JSON.stringify(counts) : '', issues.slice(0, 3).join(' | '));
}
process.exit(total ? 1 : 0);
