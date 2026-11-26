// story mode checker: proves all 7 levels can actually be beaten
globalThis.SB = require('../src/sim.js');
const GEN = require('../src/gen.js');
const ANG = 6, POWERS = [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1.0];
const CAP = 24;

function check(n) {
  const w = GEN.makeGenWorld(n);
  const goal = w.goal, start = w.start;
  const dist = p => Math.hypot(p.x - goal.x, p.y - goal.y);
  const key = p => Math.round(p.x / 14) + ',' + Math.round(p.y / 14);
  // best-first: every resting spot it finds stays in the list, try the closest ones first
  const open = [{ x: start.x, y: start.y, flings: 0 }], seen = new Set([key(start)]);
  let best = dist(start), expanded = 0;
  while (open.length && expanded < 1600) {
    open.sort((a, b) => dist(a) - dist(b) + (a.flings - b.flings) * 4);
    const batch = open.splice(0, CAP);
    for (const p of batch) {
      expanded++;
      GEN.loadAround(w, p.x, p.y, 2);
      for (let a = 0; a < 360; a += ANG) for (const pw of POWERS) {
        const v = pw * SB.PHYS.VMAX, rad = a * Math.PI / 180;
        const r = SB.simulateShot(w, p.x, p.y, Math.cos(rad) * v, -Math.sin(rad) * v, 0, 900);
        if (r.r === 'goal') return { level: n + 1, name: w.L.info.name, ok: true, flings: p.flings + 1, expanded };
        if (r.r === 'rest') { const k = key(r); if (!seen.has(k)) { seen.add(k); open.push({ x: r.x, y: r.y, flings: p.flings + 1 }); best = Math.min(best, dist(r)); } }
      }
    }
  }
  return { level: n + 1, ok: false, reason: open.length ? 'budget' : 'stuck', best: Math.round(best / 16), expanded };
}
const only = process.argv[2] != null ? [+process.argv[2] - 1] : [...Array(GEN.STORY_LEVELS).keys()];
let fails = 0;
for (const n of only) {
  const t0 = Date.now(), r = check(n);
  if (!r.ok) fails++;
  console.log(JSON.stringify({ ...r, secs: ((Date.now() - t0) / 1000).toFixed(1) }));
}
process.exit(fails ? 1 : 0);
