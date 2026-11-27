// physics + level data
(function (root) {
'use strict';
const VW = 640, VH = 400, TS = 16, COLS = 40, ROWS = 25;

const PHYS = {
  G: 600, VMAX: 520, R: 5, DT: 1 / 120,
  E_GROUND: 0.3, E_POST: 0.4, E_CAP: 0.9, E_LOG: 0.35,
  PAD_MIN: 380, CAP_MIN: 240, ROLL: 170, REST_SPEED: 9, REST_TIME: 0.3, SHOT_MAX: 12,
  /* platformer controls */
  MOVE_MAX: 115, MOVE_ACC: 520, AIR_ACC: 240, HOP: 250, COYOTE: 0.1,
};

/* where each sprite is in Terrain_and_Props.png (sx, sy, w, h) */
const SPR = {
  bigMush: [116, 488, 70, 56], glow: [116, 448, 40, 32], goal: [168, 456, 35, 24], start: [192, 485, 16, 43],
  log: [81, 160, 78, 12], post: [304, 149, 16, 59], tree: [21, 466, 86, 78],
  pillarA: [33, 304, 28, 48], pillarB: [2, 305, 26, 48], rockS: [2, 369, 29, 15], rockM: [37, 365, 53, 19],
  rockMoss: [32, 389, 64, 27], rockBig: [4, 424, 101, 40], stump: [272, 176, 16, 32], trunk: [0, 4, 62, 252],
};
/* outline of the big mushroom cap, traced off the sprite */
const CAP_POLY = [[0, 30], [28, 0], [36, 0], [68, 14], [62, 22], [12, 36]];
const CAP_STEM = [[35, 34], [35, 56]];

// course
function build(fn) {
  const g = [...Array(ROWS)].map(() => Array(COLS).fill('.'));
  const api = {
    r(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; },
    p(x, y, c) { g[y][x] = c; },
    island(x0, x1, top) { api.r(x0, top, x1, ROWS - 1, '#'); },
    water(row) { for (let y = row; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === '.') g[y][x] = '~'; },
  };
  fn(api);
  return g.map(r => r.join(''));
}

const HOLES = [
  { name: 'First Fling', par: 2, set: 'orange', bg: 0,
    hint: 'Roll with A/D, hop with Space, drag back to fling.',
    map: build(({ island, water, p }) => {
      island(0, 9, 15); island(24, 39, 15); water(19);
      p(4, 14, 'S'); p(31, 14, 'G'); p(16, 7, '*');
    }),
    deco: [['tree', 1, 15], ['rockMoss', 27, 15], ['rockS', 35, 15]] },
  { name: 'The Hump', par: 3, set: 'green', bg: 1,
    hint: 'Missed into the bog? Look what grew there.',
    map: build(({ island, water, p }) => {
      island(0, 8, 16); island(16, 22, 9); island(31, 39, 14); water(19);
      p(4, 15, 'S'); p(35, 13, 'G'); p(19, 4, '*');
    }),
    deco: [['pillarA', 17, 9], ['rockM', 33, 14], ['rockS', 2, 16]] },
  { name: 'Glowcap Gully', par: 3, set: 'orange', bg: 2,
    hint: 'Glowcaps are bouncy. Every miss is a new path.',
    map: build(({ island, water, p, r }) => {
      island(0, 8, 15); island(31, 39, 7); r(18, 17, 20, 24, '#'); water(18);
      p(4, 14, 'S'); p(35, 6, 'G'); p(26, 4, '*');
    }),
    deco: [['rockMoss', 33, 7], ['tree', 3, 15]] },
  { name: 'Big Cap', par: 3, set: 'green', bg: 3,
    hint: 'The big mushroom bounces too.',
    map: build(({ island, water, p }) => {
      island(0, 13, 15); island(27, 39, 8); water(18);
      p(3, 14, 'S'); p(11, 14, 'M'); p(34, 7, 'G'); p(20, 3, '*');
    }),
    deco: [['rockBig', 28, 8], ['rockS', 6, 15]] },
  { name: 'Branches', par: 4, set: 'orange', bg: 0,
    hint: 'Branches catch you from above.',
    map: build(({ island, water, p, r }) => {
      island(0, 7, 16); island(34, 39, 13); water(18);
      r(12, 13, 15, 13, '-'); r(20, 9, 23, 9, '-'); r(28, 5, 31, 5, '-');
      p(3, 15, 'S'); p(30, 4, 'G'); p(36, 9, '*');
    }),
    deco: [['pillarB', 35, 13], ['rockS', 4, 16]] },
  { name: 'Pilings', par: 3, set: 'green', bg: 1,
    hint: 'Keep it low under the roots.',
    map: build(({ island, water, p, r }) => {
      island(0, 6, 15); island(31, 39, 15); water(18);
      r(9, 0, 30, 6, '#'); r(13, 7, 26, 8, '#');
      p(3, 14, 'S'); p(35, 14, 'G'); p(20, 12, '*');
    }),
    posts: [{ x: 12, top: 15 }, { x: 18, top: 13 }, { x: 24, top: 15 }],
    deco: [['rockMoss', 33, 15]] },
  { name: 'The Swing', par: 3, set: 'orange', bg: 2,
    hint: 'Time it with the swing.',
    map: build(({ island, water, p }) => {
      island(0, 8, 15); island(30, 39, 11); water(18);
      p(4, 14, 'S'); p(35, 10, 'G'); p(19, 13, '*');
    }),
    swings: [{ x: 312, y: -10, len: 150, amp: 0.75, speed: 1.6, phase: 0 }],
    deco: [['tree', 32, 11], ['rockS', 2, 15]] },
  { name: 'Hollow', par: 3, set: 'green', bg: 3,
    hint: 'The way out is hiding inside.',
    map: build(({ island, water, p, r }) => {
      island(0, 8, 16); island(25, 39, 8); r(25, 13, 36, 15, '.'); r(25, 16, 27, 24, '.');
      water(19);
      p(4, 15, 'S'); p(34, 15, 'G'); p(16, 8, '*');
    }),
    deco: [['rockM', 28, 8], ['pillarA', 2, 16]] },
  { name: 'Garden Gate', par: 4, set: 'orange', bg: 0,
    hint: 'The Garden of Rebirth lies past this gate.',
    map: build(({ island, water, p, r }) => {
      island(0, 7, 16); r(14, 15, 17, 24, '#'); island(33, 39, 5);
      r(23, 10, 26, 10, '-'); water(18);
      p(3, 15, 'S'); p(16, 14, 'M'); p(36, 4, 'G'); p(24, 4, '*');
    }),
    posts: [{ x: 29, top: 13 }],
    deco: [['rockBig', 33, 5], ['tree', 1, 16]] },
];

/* world */
/* modifiers for the whole run. mutations change these, defaults = nothing changed */
const DEFAULT_MODS = { grav: 1, power: 1, padPower: 1, padSize: 1, soilE: 0, grip: 1, skips: 0, homing: false };

function makeWorld(hi, mods, mirror) {
  const H = HOLES[hi];
  const tiles = H.map.map(r => mirror ? r.split('').reverse() : r.split(''));
  const w = { hi, tiles, pads: [], caps: [], posts: [], swings: [], flies: [], start: null, goal: null, time: 0, mirror: !!mirror, mods: Object.assign({}, DEFAULT_MODS, mods || {}) };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = tiles[y][x];
    if (c === 'S') { w.start = { x: x * TS + 8, y: (y + 1) * TS - PHYS.R }; tiles[y][x] = '.'; }
    else if (c === 'G') { w.goal = { x: x * TS + 8, y: y * TS + 8, tx: x, ty: y }; tiles[y][x] = '.'; }
    else if (c === '*') { w.flies.push({ x: x * TS + 8, y: y * TS + 8, got: false }); tiles[y][x] = '.'; }
    else if (c === 'M') {
      const ox = x * TS + 8 - 35, oy = (y + 1) * TS - 56;
      const segs = [];
      for (let i = 0; i < CAP_POLY.length; i++) {
        const a = CAP_POLY[i], b = CAP_POLY[(i + 1) % CAP_POLY.length];
        segs.push([ox + a[0], oy + a[1], ox + b[0], oy + b[1]]);
      }
      segs.push([ox + CAP_STEM[0][0], oy + CAP_STEM[0][1], ox + CAP_STEM[1][0], oy + CAP_STEM[1][1]]);
      w.caps.push({ ox, oy, segs, squish: 0 });
      tiles[y][x] = '.';
    }
  }
  for (const p of H.posts || []) {
    const px = (mirror ? COLS - 1 - p.x : p.x) * TS, py = p.top * TS;
    w.posts.push({ px, py, rect: [px + 5, py + 1, px + 11, VH + 40] });
  }
  for (const s of H.swings || []) w.swings.push({ ...s, x: mirror ? VW - s.x : s.x, phase: mirror ? s.phase + Math.PI : s.phase, lx: 0, ly: 0, vx: 0, vy: 0 });
  updateSwings(w, 0);
  return w;
}
const tileAt = (w, x, y) => w.tileFn ? w.tileFn(x, y) : (x < 0 || x >= COLS || y < 0 || y >= ROWS) ? '#' : w.tiles[y][x];
const isSolid = (w, x, y) => tileAt(w, x, y) === '#';
/* top of the water at column x. pass y to get the pool y is in (works in the endless worlds too) */
function surfaceY(w, x, y) {
  const tx = Math.floor(x / TS);
  if (y == null) { if (w.tileFn) return null; for (let yy = 0; yy < ROWS; yy++) if (w.tiles[yy][Math.max(0, Math.min(COLS - 1, tx))] === '~') return yy * TS; return null; }
  let ty = Math.floor(y / TS);
  if (tileAt(w, tx, ty) !== '~') { if (tileAt(w, tx, ty + 1) === '~') ty++; else return null; }
  while (tileAt(w, tx, ty - 1) === '~') ty--;
  return ty * TS;
}
/* a big bouncy mushroom standing on tile (tx, ty) */
function makeCap(tx, ty) {
  const ox = tx * TS + 8 - 35, oy = (ty + 1) * TS - 56, segs = [];
  for (let i = 0; i < CAP_POLY.length; i++) { const a = CAP_POLY[i], b = CAP_POLY[(i + 1) % CAP_POLY.length]; segs.push([ox + a[0], oy + a[1], ox + b[0], oy + b[1]]); }
  segs.push([ox + CAP_STEM[0][0], oy + CAP_STEM[0][1], ox + CAP_STEM[1][0], oy + CAP_STEM[1][1]]);
  return { ox, oy, segs, squish: 0 };
}
function updateSwings(w, t) {
  for (const s of w.swings) {
    const th = s.amp * Math.sin(t * s.speed + s.phase), dth = s.amp * s.speed * Math.cos(t * s.speed + s.phase);
    const cx = s.x + Math.sin(th) * s.len, cy = s.y + Math.cos(th) * s.len;
    s.vx = Math.cos(th) * s.len * dth; s.vy = -Math.sin(th) * s.len * dth;
    s.lx = cx; s.ly = cy; s.th = th;
  }
}

/* grow a glowcap where the spore sank. returns the pad, or null if it cant fit */
function growPad(w, x, y) {
  const sy = surfaceY(w, x, y);
  if (sy == null) return null;
  for (const p of w.pads) if (Math.abs(p.x - x) < 30) return null;
  let px = x;
  for (let tries = 0; tries < 3; tries++) {
    const l = Math.floor((px - 20) / TS), r = Math.floor((px + 20) / TS);
    if (isSolid(w, l, Math.floor(sy / TS) - 1) || isSolid(w, l, Math.floor(sy / TS))) px += 8;
    else if (isSolid(w, r, Math.floor(sy / TS) - 1) || isSolid(w, r, Math.floor(sy / TS))) px -= 8;
    else break;
  }
  const ps = w.mods.padSize;
  const pad = { x: px, sy, cx: px, cy: sy - 2 - 19 * (ps - 1), r: 21 * ps, scale: ps, grow: 0, squish: 0 };
  w.pads.push(pad);
  return pad;
}

/* ball physics */
function makeBall(x, y) { return { x, y, vx: 0, vy: 0, grounded: false, restT: 0, t: 0, padCombo: 0, skips: 0, jumps: 0, coyote: 0, move: 0 }; }

function resolve(b, nx, ny, pen, e, svx, svy, minOut, ev, kind, ref) {
  b.x += nx * pen; b.y += ny * pen;
  const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const tx = rvx - vn * nx, ty = rvy - vn * ny;
    let out = -vn * e;
    if (-vn < 55 && !minOut) out = 0;   // soft landings just stop, no tiny hops
    if (minOut && out < minOut) out = minOut;
    const fr = -vn > 60 ? 0.9 : 0.995;
    b.vx = tx * fr + nx * out + svx; b.vy = ty * fr + ny * out + svy;
    if (ev && -vn > 40) ev.push({ t: 'hit', kind, v: -vn, x: b.x - nx * PHYS.R, y: b.y - ny * PHYS.R, ref });
  }
  if (ny < -0.6) { b.grounded = true; b.groundVx = svx; b.groundMoving = !!(svx || svy); }
}

function collideRect(b, x0, y0, x1, y1, e, ev, kind, ref) {
  const R = PHYS.R;
  const cx = Math.max(x0, Math.min(b.x, x1)), cy = Math.max(y0, Math.min(b.y, y1));
  let dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return;
  if (d2 > 1e-6) { const d = Math.sqrt(d2); resolve(b, dx / d, dy / d, R - d, e, 0, 0, 0, ev, kind, ref); return; }
  const pl = b.x - x0, pr = x1 - b.x, pt = b.y - y0, pb = y1 - b.y, m = Math.min(pl, pr, pt, pb);
  if (m === pt) resolve(b, 0, -1, pt + R, e, 0, 0, 0, ev, kind, ref);
  else if (m === pb) resolve(b, 0, 1, pb + R, e, 0, 0, 0, ev, kind, ref);
  else if (m === pl) resolve(b, -1, 0, pl + R, e, 0, 0, 0, ev, kind, ref);
  else resolve(b, 1, 0, pr + R, e, 0, 0, 0, ev, kind, ref);
}
function collideSeg(b, ax, ay, bx, by, rad, e, svx, svy, minOut, ev, kind, ref) {
  const R = PHYS.R + rad;
  const abx = bx - ax, aby = by - ay, L2 = abx * abx + aby * aby;
  let t = L2 ? ((b.x - ax) * abx + (b.y - ay) * aby) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t, cy = ay + aby * t, dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= R * R || d2 < 1e-8) return false;
  const d = Math.sqrt(d2);
  resolve(b, dx / d, dy / d, R - d, e, svx, svy, minOut, ev, kind, ref);
  return true;
}

function stepBall(w, b, dt, ev) {
  const P = PHYS, R = P.R, m = w.mods;
  b.t += dt;
  b.vy += P.G * m.grav * dt;
  if (m.homing) {
    const hx = w.goal.x - b.x, hy = w.goal.y - b.y, hd = Math.hypot(hx, hy);
    if (hd < 110 && hd > 1) { const k = 900 * (1 - hd / 110) * dt; b.vx += hx / hd * k; b.vy += hy / hd * k; }
  }
  b.vx *= 1 - 0.04 * dt;
  const prevY = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.grounded = false; b.groundMoving = false;
  // tiles. edges next to other solid tiles get stretched so the ball doesnt snag on seams
  const tx0 = Math.floor((b.x - R) / TS), tx1 = Math.floor((b.x + R) / TS);
  const ty0 = Math.floor((b.y - R) / TS), ty1 = Math.floor((b.y + R) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const c = tileAt(w, tx, ty);
    if (c === '#') {
      // edge strips
      const x0 = tx * TS, y0 = ty * TS, x1 = x0 + TS, y1 = y0 + TS, e = Math.min(0.88, P.E_GROUND + m.soilE);
      collideRect(b, isSolid(w, tx - 1, ty) ? x0 - TS : x0, y0, isSolid(w, tx + 1, ty) ? x1 + TS : x1, y1, e, ev, 'soil');
      collideRect(b, x0, isSolid(w, tx, ty - 1) ? y0 - TS : y0, x1, isSolid(w, tx, ty + 1) ? y1 + TS : y1, e, ev, 'soil');
    } else if (c === '-') {
      const top = ty * TS + 1;
      if (b.vy >= 0 && prevY + R <= top + 1.5 && b.y + R > top) {
        resolve(b, 0, -1, b.y + R - top, Math.min(0.88, P.E_GROUND + m.soilE), 0, 0, 0, ev, 'branch');
      }
    }
  }
  for (const p of w.posts) collideRect(b, p.rect[0], p.rect[1], p.rect[2], p.rect[3], P.E_POST, ev, 'post');
  for (const cap of w.caps) {
    let hit = false;
    for (const s of cap.segs) if (collideSeg(b, s[0], s[1], s[2], s[3], 0, P.E_CAP, 0, 0, P.CAP_MIN * m.padPower, ev, 'cap', cap)) hit = true;
    if (hit) b.grounded = false;
  }
  for (const pad of w.pads) {
    if (pad.grow < 0.6) continue;
    const dx = b.x - pad.cx, dy = b.y - pad.cy, d2 = dx * dx + dy * dy, rr = pad.r + R;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const before = ev ? ev.length : 0;
      resolve(b, dx / d, dy / d, rr - d, 1.0, 0, 0, P.PAD_MIN * m.padPower, null);
      b.grounded = false;
      if (ev) ev.push({ t: 'pad', pad, combo: ++b.padCombo });
    }
  }
  for (const s of w.swings) {
    const hw = 37, c = Math.cos(s.th), sn = Math.sin(s.th);
    collideSeg(b, s.lx - hw * c, s.ly + hw * sn, s.lx + hw * c, s.ly - hw * sn, 5, P.E_LOG, s.vx, s.vy, 0, ev, 'log');
  }
  if (!w.infinite && b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.5; if (ev) ev.push({ t: 'hit', kind: 'wall', v: 100, x: 0, y: b.y }); }
  if (!w.infinite && b.x > VW - R) { b.x = VW - R; b.vx = -Math.abs(b.vx) * 0.5; if (ev) ev.push({ t: 'hit', kind: 'wall', v: 100, x: VW, y: b.y }); }
  const mv = b.move || 0;
  if (b.grounded) {
    const rel = b.vx - b.groundVx;
    if (mv && rel * mv < P.MOVE_MAX) b.vx += mv * Math.min(P.MOVE_ACC * m.grip ** 0.3 * dt, P.MOVE_MAX - rel * mv);
    else if (!mv || rel * mv > P.MOVE_MAX) {
      /* slow rolls stop right away, fling speed rolls keep going */
      const roll = (Math.abs(rel) <= P.MOVE_MAX + 5 && b.move !== undefined && b.ctl ? 650 : P.ROLL) * m.grip * dt;
      b.vx = b.vx > b.groundVx ? Math.max(b.groundVx, b.vx - roll) : Math.min(b.groundVx, b.vx + roll);
    }
    b.padCombo = 0; b.coyote = P.COYOTE;
  } else {
    b.coyote = Math.max(0, b.coyote - dt);
    if (mv && b.vx * mv < P.MOVE_MAX) b.vx += mv * Math.min(P.AIR_ACC * dt, P.MOVE_MAX - b.vx * mv);
  }
  // water
  const cTile = tileAt(w, Math.floor(b.x / TS), Math.floor(b.y / TS));
  if (cTile === '~' || tileAt(w, Math.floor(b.x / TS), Math.floor((b.y + R) / TS)) === '~') {
    const sy = surfaceY(w, b.x, cTile === '~' ? b.y : b.y + R);
    if (sy != null && b.skips > 0 && b.vy > 0 && b.y + R > sy) {
      b.skips--; b.y = sy - R; b.vy = -Math.max(220, Math.abs(b.vy) * 0.8); b.vx *= 0.92;
      if (ev) ev.push({ t: 'skip', x: b.x, y: sy });
    } else if (sy != null && b.y > sy + 3) return 'sink';
  }
  if (!w.infinite && b.y > VH + 30) return 'sink';
  // goal
  const g = w.goal, gx = b.x - g.x, gy = b.y - g.y;
  const gr = w.goalR || 11;
  if (gx * gx + gy * gy < gr * gr) return 'goal';
  for (const f of w.flies) {
    if (ev && !f.got && (b.x - f.x) ** 2 + (b.y - f.y) ** 2 < 11 * 11) { f.got = true; ev.push({ t: 'fly', f }); }
  }
  // resting
  const sp = Math.hypot(b.vx - (b.grounded ? b.groundVx : 0), b.vy);
  if (b.grounded && !b.groundMoving && sp < P.REST_SPEED && !mv) { b.restT += dt; if (b.restT > P.REST_TIME) { b.vx = b.vy = 0; return 'rest'; } }
  else b.restT = 0;
  if (b.t > P.SHOT_MAX) return b.grounded && !b.groundMoving ? 'rest' : 'lost';
  return null;
}

/* runs a whole shot start to finish (the solver uses this) */
function simulateShot(w, x, y, vx, vy, t0, maxFall) {
  const b = makeBall(x, y); b.vx = vx; b.vy = vy;
  let t = t0 || 0;
  for (let i = 0; i < PHYS.SHOT_MAX / PHYS.DT + 2; i++) {
    t += PHYS.DT; if (w.swings.length) updateSwings(w, t);
    const r = stepBall(w, b, PHYS.DT, null);
    if (r) return { r, x: b.x, y: b.y, t };
    if (maxFall && b.y > y + maxFall) return { r: 'void', x: b.x, y: b.y, t };
  }
  return { r: 'lost', x: b.x, y: b.y, t };
}

root.SB = { DEFAULT_MODS, makeCap, VW, VH, TS, COLS, ROWS, PHYS, SPR, HOLES, makeWorld, makeBall, stepBall, simulateShot, updateSwings, growPad, surfaceY, tileAt, isSolid };
if (typeof module !== 'undefined') module.exports = root.SB;
})(typeof window !== 'undefined' ? window : globalThis);
