/* sporebound level gen (no drawing in here, the tools use it too) */
(function (root) {
'use strict';
const SB = root.SB;
const TS = SB.TS, CH = 16;   // chunk size in tiles

/* seeded random + 2d perlin noise */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function makePerlin(seed) {
  const rnd = mulberry32(seed), perm = new Uint8Array(512), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y), u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
  };
}
function fbm(n, x, y, oct) { let a = 1, f = 1, s = 0, norm = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.03; } return s / norm; }

/* the story: 7 levels, picked from the 21 generated ones so each one is a real step up */
const ARTIFACTS = [
  ['The First Seed', 'It remembers being a forest.', '#eaff8a'], ['Amber Tear', 'Sap from a tree that wept for a hundred years.', '#ffb35c'],
  ['Moss Lantern', 'It glows only in the dark.', '#8fe08a'], ['Root Bell', 'It rings underground. Something answers.', '#c9a27a'],
  ['Dew Prism', 'Morning, held still.', '#9ff4ff'], ['Hollow Shell', 'Listen. The tide is very far away.', '#f2e6d0'],
  ['Spore Compass', 'It points home. Whose home?', '#9ff4dc'], ['Fern Scroll', 'Unfurl it slowly.', '#7fd36f'],
  ['Mycel Thread', 'Every root in the bog is connected by it.', '#e8e0ff'], ['Sunken Bloom', 'It flowered underwater.', '#7cc4ff'],
  ['Pale Horn', 'Blown once, long ago.', '#e6e0cf'], ['Echo Stone', 'It repeats your thoughts, softly.', '#b0b8d8'],
  ['Ember Cap', 'A mushroom that is always warm.', '#ff8a6a'], ['Rain Chalice', 'Never empty. Never full.', '#8fc8ff'],
  ['Silt Mirror', 'It shows you as a seed.', '#c4b28a'], ['Moonseed', 'It only sprouts by night.', '#d8e0ff'],
  ['Bark Crown', 'Worn by the oldest tree.', '#a8805a'], ['Mist Feather', 'Lighter than the air it fell through.', '#e0f0ff'],
  ['Heartwood', 'The center of something enormous.', '#d47a5a'], ['Gloam Pearl', 'Grown in the last light of the day.', '#c9a2ff'],
  ['The Last Petal', 'The garden is waiting for it.', '#ff8fd8'],
];
const ADJ = ['Sunken', 'Whispering', 'Hollow', 'Mossy', 'Drowned', 'Gloaming', 'Tangled', 'Quiet', 'Rootbound', 'Misted', 'Amber', 'Pale', 'Deep', 'Dripping', 'Lantern', 'Silent', 'Fern', 'Mire', 'Glowing', 'Ancient', 'Last'];
const NOUN = ['Roots', 'Hollows', 'Burrows', 'Canopy', 'Mire', 'Grotto', 'Tangle', 'Warrens', 'Shelves', 'Depths', 'Spires', 'Chambers', 'Fen', 'Thicket', 'Veins', 'Steps', 'Galleries', 'Wells', 'Arches', 'Crowns', 'Garden'];
/* which way the artifact is in each level. uses every direction: right, up, down, left and diagonals */
const DIRS = [[1, 0], [1, -0.6], [1, 0.5], [0.3, -1], [-1, 0.2], [0.2, 1], [1, -1], [-1, -0.7], [0.6, 1], [-0.4, -1], [1, 0.3],
  [-1, 0.8], [0.1, -1], [1, 1], [-1, -0.2], [-0.3, 1], [1, -0.9], [-1, 0.6], [0.5, -1], [-0.8, -0.8], [1, -0.4]];
const STORY_SEED = 72931;

function levelInfo(n) {
  const r = mulberry32(STORY_SEED * 7 + n * 131);
  return { n, name: `${ADJ[n % ADJ.length]} ${NOUN[Math.floor(r() * NOUN.length)]}`, artifact: ARTIFACTS[n] };
}

/* one level: endless tiles, a carved path, pools, stuff */
function makeLevel(n, seedOverride) {
  const seed = seedOverride != null ? seedOverride : STORY_SEED + n * 1009;
  const rnd = mulberry32(seed);
  const nT = makePerlin(seed + 1), nP = makePerlin(seed + 2), nS = makePerlin(seed + 3);
  const prog = Math.min(1, n / 20);
  const dist = 26 + n * 6.5;
  const d = DIRS[n % DIRS.length], dl = Math.hypot(d[0], d[1]);
  const ax = Math.round(d[0] / dl * dist), ay = Math.round(d[1] / dl * dist * 0.8);
  const poolTh = 0.18 - prog * 0.14;          // later levels get more pools

  // the path: wobbly waypoints from the spawn to the artifact
  const pts = [[0, -1]];
  const steps = Math.max(2, Math.ceil(dist / 9));
  const px = -(ay), py = ax, pl = Math.hypot(px, py) || 1;
  for (let i = 1; i < steps; i++) {
    const k = i / steps, j = (rnd() - 0.5) * 12;
    pts.push([Math.round(ax * k + px / pl * j), Math.round(-1 + (ay + 1) * k + py / pl * j)]);
  }
  pts.push([ax, ay]);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    segs.push({ x0, y0, x1, y1, minx: Math.min(x0, x1) - 4, maxx: Math.max(x0, x1) + 4, miny: Math.min(y0, y1) - 4, maxy: Math.max(y0, y1) + 4 });
  }
  const R_PATH = 2.6;
  /* floating islands */
  const ICW = 27, ICH = 16;
  const density = 0.86 - prog * 0.1;
  const islandCache = new Map();
  function islandIn(gx, gy) {
    const k = gx + ',' + gy; if (islandCache.has(k)) return islandCache.get(k);
    const h = i => hash2(gx * 7 + i, gy * 13 - i, seed + 77);
    let isl = null;
    if (h(0) < density) {
      const big = h(5) < 0.22;
      isl = { cx: gx * ICW + 5 + h(1) * (ICW - 10), cy: gy * ICH + 4 + h(2) * (ICH - 8),
        a: big ? 15 + h(3) * 7 : 8 + h(3) * 7, b: big ? 8 + h(4) * 4 : 4.5 + h(4) * 3.5,
        p: 1.6 + h(7) * 1.2, amp: 1.4, basin: h(6) < 0.3, id: gx * 31 + gy * 17 };
      // keep open sky above the spawn and the artifact, both sit on their own island
      const hits = (x0, x1, y0, y1) => isl.cx + isl.a > x0 && isl.cx - isl.a < x1 && isl.cy + isl.b + 1.5 > y0 && isl.cy - 3 < y1;
      if (hits(-7, 7, -10, 0) || hits(ax - 6, ax + 6, ay - 8, ay + 1)) isl = null;
    }
    islandCache.set(k, isl); return isl;
  }
  const inIsland = (I, x, y) => {
    const dx = (x + 0.5 - I.cx) / I.a; if (Math.abs(dx) >= 1) return false;
    const ady = Math.abs(dx), edge = 1 - dx * dx;
    let top = I.cy - 1 + nT(x * 0.05 + I.id * 0.37, I.id * 0.51) * I.amp + (1 - Math.sqrt(edge)) * 2.6;
    if (I.basin && ady < 0.22) top += 1.7 * (1 - (dx / 0.22) ** 2);
    const bowl = Math.pow(1 - Math.pow(ady, I.p), 0.75);                       // round chunky bottom
    const bottom = I.cy + 0.8 + I.b * bowl * (0.85 + (nS(x * 0.045, I.id * 0.23) + 1) * 0.15);
    return y + 0.5 >= top && y + 0.5 <= bottom;
  };
  const natural = (x, y) => {
    const gx = Math.floor(x / ICW), gy = Math.floor(y / ICH);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const I = islandIn(gx + i, gy + j); if (I && inIsland(I, x, y)) return true;
    }
    return false;
  };
  /* extra islands the level adds itself */
  const extras = new Map();
  const addIsland = (cx, top, a, b) => {
    const I = { cx, cy: top + 1, a, b, p: 2.2, amp: 0.6, basin: false, id: 900 + extras.size * 7 };
    for (let gx = Math.floor((cx - a) / ICW); gx <= Math.floor((cx + a) / ICW); gx++)
      for (let gy = Math.floor((top - 2) / ICH); gy <= Math.floor((top + b + 2) / ICH); gy++) {
        const k = gx + ',' + gy; if (!extras.has(k)) extras.set(k, []); extras.get(k).push(I);
      }
  };
  const rawSolid = (x, y) => {
    if (natural(x, y)) return true;
    const L = extras.get(Math.floor(x / ICW) + ',' + Math.floor(y / ICH));
    if (L) for (const I of L) if (inIsland(I, x, y)) return true;
    return false;
  };
  const solidMemo = new Map();
  /* solid ground minus random specks. a tile needs at least 4 solid neighbours to exist */
  const baseSolid = (x, y) => {
    const k = x * 4194304 + y; let v = solidMemo.get(k);
    if (v !== undefined) return v;
    v = false;
    if (rawSolid(x, y)) { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && rawSolid(x + i, y + j)) n++; v = n >= 4; }
    if (solidMemo.size > 400000) solidMemo.clear();
    solidMemo.set(k, v); return v;
  };
  const branches = new Set(), solids = new Set(), clear = new Set(), isles = new Set();
  const key = (x, y) => x + ',' + y;
  const pathDist = (x, y) => {
    let best = 1e9;
    for (const s of segs) {
      const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - s.x0) * dx + (y - s.y0) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t)));
    }
    return best;
  };
  const landNear = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (natural(x + i, y + j)) return true; return false; };
  addIsland(0, 1, 10, 6);                       // spawn is on a real island
  addIsland(ax, ay + 2, 8, 5);                  // and so is the artifact
  const cores = [...extras.values()].flat().filter((I, i, a) => a.indexOf(I) === i).slice(0, 2);
  const inCore = (x, y) => cores.some(I => inIsland(I, x, y));   // the path never digs through these two
  /* footholds along the path, only where theres no land close by already */
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len = Math.hypot(dx, dy);
    const steep = Math.abs(dy) > Math.abs(dx) * 0.7;
    const every = steep ? 5 : 9;
    for (let t = 3; t < len; t += every) {
      const x = Math.round(s.x0 + dx * t / len), y = Math.round(s.y0 + dy * t / len);
      if (Math.hypot(x, y) < 8 || Math.hypot(x - ax, y - ay) < 8) continue;
      const side = Math.floor(t / every) % 2 ? 1 : -1, plank = hash2(x, y, seed + 5) < 0.1;
      if (steep) {
        if (landNear(x + side * 5, y + 2, 3)) continue;
        if (plank) for (let k = 0; k < 3; k++) branches.add(key(x + side * k, y + 2));
        else addIsland(x + side * 6.5, y + 2, 5.5 + hash2(x, y, seed + 6) * 2.5, 3.5 + hash2(x, y, seed + 7) * 1.5);
      } else {
        if (landNear(x, y + 3, 3)) continue;
        if (plank) for (let k = -1; k <= 1; k++) branches.add(key(x + k, y + 3));
        else addIsland(x, y + 3, 6 + hash2(x, y, seed + 6) * 3, 3.5 + hash2(x, y, seed + 7) * 2);
      }
    }
  }
  // spawn ledge and the artifact nook
  for (let x = -3; x <= 3; x++) solids.add(key(x, 1));
  for (let x = ax - 2; x <= ax + 2; x++) solids.add(key(x, ay + 2));   // make sure theres a floor even if the noise dips
  for (let y = -4; y <= 0; y++) for (let x = -3; x <= 3; x++) clear.add(key(x, y));
  for (let y = ay - 3; y <= ay + 1; y++) for (let x = ax - 3; x <= ax + 3; x++) clear.add(key(x, y));
  for (const k of [...branches]) if (solids.has(k)) branches.delete(k);

  const nearPath = (x, y) => { for (const s of segs) if (x >= s.minx - 2 && x <= s.maxx + 2 && y >= s.miny - 2 && y <= s.maxy + 2) return true; return false; };
  function carved(x, y) {
    for (const s of segs) {
      if (x < s.minx || x > s.maxx || y < s.miny || y > s.maxy) continue;
      const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - s.x0) * dx + (y - s.y0) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const ex = x - (s.x0 + dx * t), ey = y - (s.y0 + dy * t);
      if (ex * ex + ey * ey < R_PATH * R_PATH) return true;
    }
    return false;
  }
  /* the ground after the path gets carved */
  const s1Memo = new Map(), s2Memo = new Map();
  const memo = (M, k, f) => { let v = M.get(k); if (v === undefined) { v = f(); if (M.size > 300000) M.clear(); M.set(k, v); } return v; };
  const stage1 = (x, y) => memo(s1Memo, x * 4194304 + y, () => {
    const kk = key(x, y);
    if (solids.has(kk)) return true;
    if (clear.has(kk) || !baseSolid(x, y) || (carved(x, y) && !inCore(x, y))) return false;
    if (!nearPath(x, y)) return true;
    const cv = (i, j) => carved(i, j) && !inCore(i, j);
    return !((cv(x, y - 1) && (cv(x, y + 1) || !baseSolid(x, y + 1))) || (cv(x - 1, y) && cv(x + 1, y)));
  });
  const around = (f, x, y) => { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && f(x + i, y + j)) n++; return n; };
  const stage2 = (x, y) => memo(s2Memo, x * 4194304 + y, () => stage1(x, y) && (!nearPath(x, y) || around(stage1, x, y) >= 4));
  const solidAfterCarve = (x, y) => stage2(x, y) && (!nearPath(x, y) || around(stage2, x, y) >= 4);
  function structural(x, y) {            // '#', '-', '.' before water gets added
    const k = key(x, y);
    if (solids.has(k)) return '#';
    if (clear.has(k)) return '.';
    if (isles.has(k)) return '#';
    if (branches.has(k)) return '-';
    return solidAfterCarve(x, y) ? '#' : '.';
  }
  const pathish = (x, y) => carved(x, y) || clear.has(key(x, y)) || branches.has(key(x, y)) || isles.has(key(x, y));
  const waterMemo = new Map();
  function water(x, y, depth) {
    const k = key(x, y);
    if (waterMemo.has(k)) return waterMemo.get(k);
    let res = false;
    if (depth < 3 && structural(x, y) === '.' && !pathish(x, y)) {
      const sup = (cx, cy) => { const b = structural(cx, cy + 1); return b === '#' || (b === '.' && water(cx, cy + 1, depth + 1)); };
      if (sup(x, y)) {
        // a pool fills its whole dip or nothing. find the walls then one noise sample decides
        let ok = true, left = x, right = x;
        for (const dir of [-1, 1]) {
          let cx = x + dir, steps = 0;
          while (true) {
            const c = structural(cx, y);
            if (c === '#') break;
            if (c !== '.' || pathish(cx, y) || !sup(cx, y) || ++steps > 40) { ok = false; break; }
            cx += dir;
          }
          if (dir < 0) left = cx + 1; else right = cx - 1;
          if (!ok) break;
        }
        res = ok && right - left < 15 && right - left >= 2 && fbm(nP, left * 0.06, y * 0.06, 2) > poolTh;   // 3+ tiles wide, never a lonely puddle   // same answer for every tile in the dip
      }
    }
    if (depth === 0) waterMemo.set(k, res);
    return res;
  }

  const chunks = new Map();
  /* rivals that guard the way */
  const ambush = new Map();
  {
    const want = 1 + Math.round(prog * 6), pts2 = [];
    let total = 0; for (const s of segs) total += Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    const pointAt = d => { for (const s of segs) { const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0); if (d <= L) return [s.x0 + (s.x1 - s.x0) * d / L, s.y0 + (s.y1 - s.y0) * d / L]; d -= L; } return [ax, ay]; };
    const okSurf = (x, y) => structural(x, y) === '#' && [1, 2, 3].every(k => structural(x, y - k) === '.') && !water(x, y - 1, 0) &&
      [-1, 1].every(d => structural(x + d, y) === '#' && structural(x + d, y - 1) === '.');
    for (let i = 0; i < want; i++) {
      const [px, py] = pointAt(total * (0.3 + 0.6 * (i + 0.5) / want));
      let found = null;
      for (let r = 3; r <= 11 && !found; r++) for (const sx of [1, -1]) {
        const x = Math.round(px + sx * r);
        for (let y = Math.round(py) - 6; y <= Math.round(py) + 10 && !found; y++)
          if (okSurf(x, y) && Math.hypot(x, y) > 11 && Math.hypot(x - ax, y - ay) > 6 && pts2.every(([qx, qy]) => Math.hypot(qx - x, qy - y) > 7)) found = [x, y];
        if (found) break;
      }
      if (!found) continue;
      pts2.push(found);
      const hh = hash2(found[0], found[1], seed + 31);
      const type = n === 0 ? 'shroom' : n === 1 ? 'drift' : n === 2 ? 'worm' : hh < 0.42 ? 'shroom' : hh < 0.72 ? 'drift' : 'worm';
      ambush.set(found[0] + ',' + found[1], type);
    }
  }
  /* placing the scenery */
  const DECO_FOOT = { rockS: [0, 27], rockM: [2, 52], rockMoss: [0, 63], rockBig: [0, 99], tree: [38, 68], pillarA: [0, 27], pillarB: [0, 25] };
  const DECO_KINDS = ['rockS', 'rockM', 'rockMoss', 'tree', 'pillarA', 'pillarB', 'rockBig', 'rockS', 'rockMoss'];
  const DCELL = 8, SINK = 3;
  const isSurf = (x, y) => structural(x, y) === '#' && structural(x, y - 1) === '.' && !water(x, y - 1, 0);
  const rectClear = (l, t, r, b) => {           // pixel rect: every tile it touches is open air (no water)
    for (let ty = Math.floor(t / TS); ty <= Math.floor((b - 1) / TS); ty++) for (let tx = Math.floor(l / TS); tx <= Math.floor((r - 1) / TS); tx++)
      if (structural(tx, ty) !== '.' || water(tx, ty, 0)) return false;
    return true;
  };
  const overlaps = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  /* big bouncy caps. the stem goes on one ground tile, the whole 70x56 picture has to be in open air */
  const capMemo = new Map();
  function capAt(x, y) {
    const k = x * 4194304 + y; if (capMemo.has(k)) return capMemo.get(k);
    let c = null;
    if (hash2(x, y, seed) > 0.985 && isSurf(x, y) && !pathish(x, y - 1) && Math.hypot(x, y) > 6 && Math.hypot(x - ax, y - ay) > 6) {
      const l = x * TS - 11, t = y * TS - 56;
      if ([-1, 0, 1, 2].every(d => isSurf(x + d, y)) && rectClear(l, t - TS, l + 70, y * TS)) c = { tx: x + 1, ty: y - 1, l, t, r: l + 70, b: y * TS };
    }
    capMemo.set(k, c); return c;
  }
  const decoMemo = new Map();
  function rawDeco(cell, y) {
    const k = cell * 4194304 + y; if (decoMemo.has(k)) return decoMemo.get(k);
    let best = null;
    if (hash2(cell, y, seed + 77) < 0.62) for (let x = cell * DCELL; x < cell * DCELL + DCELL; x++) {
      if (!isSurf(x, y)) continue;
      const kind = DECO_KINDS[Math.floor(hash2(x, y, seed + 9) * DECO_KINDS.length)], S = SB.SPR[kind], F = DECO_FOOT[kind];
      const l = x * TS + 8 - Math.round((F[0] + F[1]) / 2), r = l + S[2], b = y * TS + SINK, t = b - S[3];
      if (l < cell * DCELL * TS || r > (cell + 1) * DCELL * TS) continue;            // stays inside its stretch
      let ok = Math.hypot(x, y) > 4 && Math.hypot(x - ax, y - ay) > 5;
      for (let tx = Math.floor((l + F[0]) / TS) - 1; tx <= Math.floor((l + F[1]) / TS) + 1 && ok; tx++) if (!isSurf(tx, y)) ok = false;   // flat base thats supported, never on a rounded edge tile
      if (ok) ok = rectClear(l, t - TS, r, y * TS);                                    // nothing sticking into the picture
      if (ok) for (let cy = y - 6; cy <= y + 6 && ok; cy++) for (let cx = x - 7; cx <= x + 7 && ok; cx++) { const c = capAt(cx, cy); if (c && overlaps({ l, t, r, b }, c)) ok = false; }
      const hh = hash2(x, y, seed + 9001);
      if (ok && (!best || hh > best.h)) best = { kind, x, y, l, t, r, b, h: hh };
    }
    decoMemo.set(k, best); return best;
  }
  function decoAt(cell, y) {                   // a prop stays unless a bigger one next to it overlaps
    const d = rawDeco(cell, y); if (!d) return null;
    for (let oc = -1; oc <= 1; oc++) for (let oy = -6; oy <= 6; oy++) {
      if (!oc && !oy) continue;
      const n = rawDeco(cell + oc, y + oy);
      if (n && (n.h > d.h || (n.h === d.h && (oc > 0 || (!oc && oy > 0)))) && overlaps(d, n)) return null;
    }
    return d;
  }
  function chunk(cx, cy) {
    const k = cx + ',' + cy; let c = chunks.get(k);
    if (c) return c;
    const t = new Array(CH * CH);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const x = cx * CH + i, y = cy * CH + j, s = structural(x, y);
      t[j * CH + i] = s === '.' && water(x, y, 0) ? '~' : s;
    }
    c = { cx, cy, t, flies: [], caps: [], deco: [], enemies: [] };
    chunks.set(k, c);
    // stuff that lives in this chunk
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const x = cx * CH + i, y = cy * CH + j;
      if (t[j * CH + i] !== '#') continue;
      const above = structural(x, y - 1), above2 = structural(x, y - 2);
      if (above !== '.' || above2 !== '.' || water(x, y - 1, 0)) continue;
      const h = hash2(x, y, seed);
      const cap = capAt(x, y);
      if (h < 0.016 - prog * 0.008 && structural(x, y - 3) === '.' && !cap) c.flies.push({ x: x * TS + 8, y: (y - 2) * TS + 4, got: false, id: k + ':' + i + ':' + j });
      if (cap) c.caps.push({ tx: cap.tx, ty: cap.ty });
      const d = decoAt(Math.floor(x / DCELL), y);
      if (d && d.x === x) c.deco.push([d.kind, d.l, d.t]);          // props keep their exact pixel position
      /* rivals: shroomlings walk on flat ground, driftcaps float over solid tops */
      let underCap = false; for (let qy = y - 1; qy <= y + 1 && !underCap; qy++) for (let qx = x - 4; qx <= x + 3; qx++) if (capAt(qx, qy)) { underCap = true; break; }
      const he = hash2(x, y, seed + 404), far = Math.hypot(x, y) > 22 && Math.hypot(x - ax, y - ay) > 7 && !underCap;
      const guard = underCap ? null : ambush.get(x + ',' + y);
      if (guard === 'shroom') c.enemies.push({ type: 'shroom', x: x * TS + 8, y: (y - 1) * TS + 8, id: k + ':a' + i + ':' + j });
      else if (guard === 'drift') c.enemies.push({ type: 'drift', x: x * TS + 8, y: y * TS, id: k + ':f' + i + ':' + j });
      else if (guard === 'worm') c.enemies.push({ type: 'worm', x: x * TS + 8, y: y * TS, id: k + ':w' + i + ':' + j });
      else if (far && structural(x, y - 3) === '.') {
        const flat = [-1, 1].every(d => structural(x + d, y) === '#' && structural(x + d, y - 1) === '.');
        if (flat && he < 0.013 + prog * 0.02) c.enemies.push({ type: 'shroom', x: x * TS + 8, y: (y - 1) * TS + 8, id: k + ':a' + i + ':' + j });
        else if (flat && he > 0.993 - prog * 0.013) c.enemies.push({ type: 'drift', x: x * TS + 8, y: y * TS, id: k + ':f' + i + ':' + j });
        else if (flat && n >= 2 && he > 0.5 && he < 0.506 + prog * 0.008 && [-2, 2].every(d => structural(x + d, y) === '#')) c.enemies.push({ type: 'worm', x: x * TS + 8, y: y * TS, id: k + ':w' + i + ':' + j });
      }
    }
    return c;
  }
  function tileAt(x, y) {
    const cx = Math.floor(x / CH), cy = Math.floor(y / CH);
    return chunk(cx, cy).t[(y - cy * CH) * CH + (x - cx * CH)];
  }
  return {
    n, seed, info: levelInfo(n), tileAt, chunk, chunks, CH,
    spawn: { x: 8, y: 1 * TS - SB.PHYS.R },
    artifact: { x: ax * TS + 8, y: (ay + 2) * TS - 14, tx: ax, ty: ay },
    path: pts,
  };
}


function makeGenWorld(n, mods, seedOverride) {
  const L = makeLevel(n, seedOverride);
  L.story = n;
  return { L, hi: -1, infinite: true, tileFn: L.tileAt, tiles: null, pads: [], caps: [], posts: [], swings: [], flies: [],
    start: { x: L.spawn.x, y: L.spawn.y }, goal: { x: L.artifact.x, y: L.artifact.y, tx: L.artifact.tx, ty: L.artifact.ty }, goalR: 15,
    time: 0, mirror: false, mods: Object.assign({}, SB.DEFAULT_MODS, mods || {}), loaded: new Set() };
}
/* load the chunks around a point into the world (fireflies, big caps) */
function loadAround(w, x, y, radiusChunks) {
  const cx0 = Math.floor(x / TS / CH), cy0 = Math.floor(y / TS / CH);
  for (let cy = cy0 - radiusChunks; cy <= cy0 + radiusChunks; cy++) for (let cx = cx0 - radiusChunks; cx <= cx0 + radiusChunks; cx++) {
    const k = cx + ',' + cy; if (w.loaded.has(k)) continue;
    w.loaded.add(k);
    const c = w.L.chunk(cx, cy);
    for (const f of c.flies) w.flies.push(f);
    for (const cp of c.caps) w.caps.push(SB.makeCap(cp.tx, cp.ty));
    for (const e of c.enemies) (w.spawnQ = w.spawnQ || []).push(e);
  }
}
root.GEN = { makeGenWorld, loadAround, makeLevel, levelInfo, ARTIFACTS, STORY_LEVELS: ARTIFACTS.length, CH, hash2, mulberry32 };
if (typeof module !== 'undefined') module.exports = root.GEN;
})(typeof window !== 'undefined' ? window : globalThis);
