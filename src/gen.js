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

/* the 21 story levels */
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
  const openTh = 0.02 - prog * 0.06;          // later levels get bigger open caves
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
  const branches = new Set(), solids = new Set(), clear = new Set();
  const key = (x, y) => x + ',' + y;
  // ledges along the path so every climb has somewhere to stand
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len = Math.hypot(dx, dy);
    const steep = Math.abs(dy) > Math.abs(dx) * 0.7;
    const every = steep ? 4 : 6;
    for (let t = 2; t < len; t += every) {
      const x = Math.round(s.x0 + dx * t / len), y = Math.round(s.y0 + dy * t / len);
      const side = Math.floor(t / every) % 2 ? 1 : -1;
      if (steep) for (let k = 0; k < 3; k++) branches.add(key(x + side * (1 + k) - side, y + 2));
      else for (let k = -1; k <= 1; k++) branches.add(key(x + k, y + 3));
    }
  }
  // spawn ledge and the artifact nook
  for (let x = -3; x <= 3; x++) solids.add(key(x, 1));
  for (let x = ax - 2; x <= ax + 2; x++) solids.add(key(x, ay + 2));
  for (let y = -4; y <= 0; y++) for (let x = -3; x <= 3; x++) clear.add(key(x, y));
  for (let y = ay - 3; y <= ay + 1; y++) for (let x = ax - 3; x <= ax + 3; x++) clear.add(key(x, y));
  for (const k of [...branches]) if (solids.has(k)) branches.delete(k);

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
  const baseSolid = (x, y) => fbm(nT, x * 0.036, y * 0.062, 4) > openTh;
  function structural(x, y) {            // '#', '-', '.' before water gets added
    const k = key(x, y);
    if (solids.has(k)) return '#';
    if (branches.has(k)) return '-';
    if (clear.has(k) || carved(x, y)) return '.';
    return baseSolid(x, y) ? '#' : '.';
  }
  const pathish = (x, y) => carved(x, y) || clear.has(key(x, y)) || branches.has(key(x, y));
  const waterMemo = new Map();
  function water(x, y, depth) {
    const k = key(x, y);
    if (waterMemo.has(k)) return waterMemo.get(k);
    let res = false;
    if (depth < 3 && structural(x, y) === '.' && !pathish(x, y) && fbm(nP, x * 0.06, y * 0.06, 2) > poolTh) {
      const sup = (cx, cy) => { const b = structural(cx, cy + 1); return b === '#' || (b === '.' && water(cx, cy + 1, depth + 1)); };
      if (sup(x, y)) {
        let ok = true;
        for (const dir of [-1, 1]) {
          let cx = x + dir, steps = 0;
          while (true) {
            const c = structural(cx, y);
            if (c === '#') break;
            if (c !== '.' || pathish(cx, y) || !sup(cx, y) || ++steps > 14) { ok = false; break; }
            cx += dir;
          }
          if (!ok) break;
        }
        res = ok;
      }
    }
    if (depth === 0) waterMemo.set(k, res);
    return res;
  }

  const chunks = new Map();
  function chunk(cx, cy) {
    const k = cx + ',' + cy; let c = chunks.get(k);
    if (c) return c;
    const t = new Array(CH * CH);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const x = cx * CH + i, y = cy * CH + j, s = structural(x, y);
      t[j * CH + i] = s === '.' && water(x, y, 0) ? '~' : s;
    }
    c = { cx, cy, t, flies: [], caps: [], deco: [] };
    chunks.set(k, c);
    // stuff that lives in this chunk
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const x = cx * CH + i, y = cy * CH + j;
      if (t[j * CH + i] !== '#') continue;
      const above = structural(x, y - 1), above2 = structural(x, y - 2);
      if (above !== '.' || above2 !== '.' || water(x, y - 1, 0)) continue;
      const h = hash2(x, y, seed);
      if (h < 0.016 - prog * 0.008 && structural(x, y - 3) === '.') c.flies.push({ x: x * TS + 8, y: (y - 2) * TS + 4, got: false, id: k + ':' + i + ':' + j });
      else if (h > 0.985 && !pathish(x, y - 1) && [1, 2, 3].every(dx => structural(x + dx, y) === '#' && structural(x + dx, y - 1) === '.' && structural(x + dx, y - 4) === '.') && structural(x, y - 4) === '.') c.caps.push({ tx: x + 1, ty: y - 1 });
      else if (h > 0.9) c.deco.push([['rockS', 'rockM', 'rockMoss', 'stump', 'tree', 'pillarA'][Math.floor(hash2(x, y, seed + 9) * 6)], x, y]);
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

/* a world object the physics (SB.stepBall) knows how to use */
function makeGenWorld(n, mods, seedOverride) {
  const L = makeLevel(n, seedOverride);
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
  }
}
root.GEN = { makeGenWorld, loadAround, makeLevel, levelInfo, ARTIFACTS, STORY_LEVELS: 21, CH, hash2, mulberry32 };
if (typeof module !== 'undefined') module.exports = root.GEN;
})(typeof window !== 'undefined' ? window : globalThis);
