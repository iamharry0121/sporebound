// rivals, the elder and toxin
(function () {
'use strict';
window.makeCombat = function (A) {
  const { G, fx, burst, popup, AU, TS, MEM } = A;
  const VX = A.VX || { sparkBurst() {}, kick() {}, ring() {} };
  const W = () => G.w;
  const tile = (tx, ty) => A.tileAt(W(), tx, ty);
  const solidAt = (x, y) => tile(Math.floor(x / TS), Math.floor(y / TS)) === '#';
  const waterAt = (x, y) => tile(Math.floor(x / TS), Math.floor(y / TS)) === '~';
  const rnd = () => Math.random();
  const GLOW = '#9db2f5', GLOW2 = '#cddcff', EYE = '#e8f4ff', CAP = '#4c5aa6', DEEP = '#272645';

  /* sounds (made in code like everything else) */
  Object.assign(AU, {
    blast() { const t = this.now(); this.noise(t, 0.12, { gain: 0.09, freq: 900, sweep: 2600, type: 'bandpass', q: 2 }); this.tone(520, t, 0.1, { type: 'triangle', gain: 0.05, glide: 260 }); },
    splat() { const t = this.now(); this.noise(t, 0.14, { gain: 0.08, freq: 700, sweep: 200 }); this.tone(190, t, 0.1, { gain: 0.06, glide: 90 }); },
    rivalHurt() { const t = this.now(); this.noise(t, 0.12, { gain: 0.1, freq: 600 }); this.tone(300, t, 0.14, { type: 'triangle', gain: 0.07, glide: 140 }); },
    rivalDie() { const t = this.now(); this.noise(t, 0.35, { gain: 0.12, freq: 900, sweep: 150 }); [69, 65, 62, 57].forEach((n, i) => this.tone(440 * Math.pow(2, (n - 69) / 12), t + i * 0.05, 0.18, { type: 'triangle', gain: 0.05 })); },
    charge() { const t = this.now(); this.tone(180, t, 0.42, { type: 'triangle', gain: 0.045, glide: 520, attack: 0.08 }); },
    puff() { const t = this.now(); this.noise(t, 0.18, { gain: 0.1, freq: 420, sweep: 1400, type: 'bandpass', q: 1 }); this.tone(150, t, 0.12, { gain: 0.07, glide: 240 }); },
    ouch() { const t = this.now(); this.tone(330, t, 0.22, { type: 'square', gain: 0.045, glide: 120 }); this.noise(t, 0.15, { gain: 0.09, freq: 500 }); },
    stomp() { const t = this.now(); this.tone(210, t, 0.18, { gain: 0.1, glide: 480 }); this.noise(t, 0.08, { gain: 0.07, freq: 800 }); },
    leap() { const t = this.now(); this.tone(140, t, 0.16, { type: 'triangle', gain: 0.04, glide: 300 }); },
    burrow() { const t = this.now(); this.noise(t, 0.3, { gain: 0.12, freq: 260, sweep: 900 }); this.tone(90, t, 0.25, { type: 'triangle', gain: 0.08, glide: 180 }); },
    snap() { const t = this.now(); this.noise(t, 0.06, { gain: 0.12, freq: 2200, type: 'bandpass', q: 3 }); this.tone(620, t, 0.08, { type: 'square', gain: 0.03, glide: 300 }); },
    rumble() { const t = this.now(); this.noise(t, 1.4, { gain: 0.14, freq: 160, sweep: 70 }); this.tone(55, t, 1.4, { type: 'triangle', gain: 0.12, glide: 38, attack: 0.3 }); },
    roar() { const t = this.now(); this.tone(70, t, 1.1, { type: 'sawtooth', gain: 0.08, glide: 44, attack: 0.05 }); this.tone(104, t, 1.0, { type: 'triangle', gain: 0.08, glide: 66 }); this.tone(157, t + 0.05, 0.9, { type: 'sawtooth', gain: 0.03, glide: 90 }); this.noise(t, 1.0, { gain: 0.14, freq: 300, sweep: 110 }); },
    volley() { const t = this.now(); this.noise(t, 0.2, { gain: 0.08, freq: 1500, sweep: 400, type: 'bandpass', q: 2 }); this.tone(240, t, 0.2, { type: 'triangle', gain: 0.06, glide: 600 }); },
    slam() { const t = this.now(); this.noise(t, 0.5, { gain: 0.2, freq: 220, sweep: 60 }); this.tone(48, t, 0.5, { type: 'triangle', gain: 0.16, glide: 30 }); },
    engulf() { const t = this.now(); this.noise(t, 0.6, { gain: 0.16, freq: 500, sweep: 80 }); this.tone(220, t, 0.7, { type: 'triangle', gain: 0.08, glide: 55 }); },
  });

  /* juice: shockwave rings, flashes, freeze frames */
  const rings = [];
  function ring(x, y, max, o = {}) { rings.push({ x, y, r: o.r0 || 2, max, speed: o.speed || 260, col: o.col || GLOW2, flat: o.flat || 1, w: o.w || 1 }); }
  const flash = (a, col = '#dfe8ff') => { G.flashA = Math.max(G.flashA || 0, a); G.flashCol = col; };
  const hitstop = s => { G.hitstop = Math.max(G.hitstop || 0, s); };
  const shake = s => { G.shake = Math.max(G.shake, s); };

  /* helpers */
  function los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) if (solidAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  /* small circle body vs the tiles (rivals dont need the spores fancy physics) */
  const PROBE = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]];
  function bodyHits(e) {
    for (const [px, py] of PROBE) if (solidAt(e.x + px * (e.r - 1), e.y + (py > 0 ? e.r : py * (e.r - 1)))) return true;
    return false;
  }
  function moveBody(e, dt) {
    e.vy = Math.min(560, e.vy + 900 * dt);
    e.ground = false; e.wall = 0;
    e.x += e.vx * dt;
    if (bodyHits(e)) { const d = Math.sign(e.vx) || 1; for (let i = 0; i < 24 && bodyHits(e); i++) e.x -= d * 0.5; e.wall = d; e.vx = 0; }
    e.y += e.vy * dt;
    if (bodyHits(e)) {
      const d = Math.sign(e.vy) || 1, y0 = e.y;
      if (d > 0) { e.y = Math.floor((e.y + e.r) / TS) * TS - e.r - 0.01; if (bodyHits(e)) e.y = y0; }   // sit right on top of the tile
      for (let i = 0; i < 40 && bodyHits(e); i++) e.y -= d * 0.5;
      e.vy = 0;
    }
    e.ground = e.vy >= 0 && (solidAt(e.x - e.r + 1, e.y + e.r + 1) || solidAt(e.x + e.r - 1, e.y + e.r + 1) || solidAt(e.x, e.y + e.r + 1));
    if (e.ground) e.vx *= Math.pow(0.0005, dt);
  }
  const footing = (x, y, r) => solidAt(x, y + r + 3) && !waterAt(x, y + r - 2);
  /* where would a jump land? rough sim against the tiles */
  function simLeap(e, vx, vy) {
    let x = e.x, y = e.y, t = 0;
    const p = { x, y, r: e.r };
    for (let i = 0; i < 70; i++) {
      t += 1 / 30; vy = Math.min(560, vy + 900 / 30);
      p.x = x + vx / 30; if (bodyHits(p)) { p.x = x; vx = 0; } x = p.x;
      p.y = y + vy / 30;
      if (bodyHits(p)) { if (vy > 0) return waterAt(x, y + e.r + 2) ? null : { x, y, t }; return null; }
      y = p.y;
      if (waterAt(x, y)) return null;
    }
    return null;   // falls into the dark
  }
  /* where u can hit each rival, and where it hurts u from */
  function hitbox(e) {
    if (e.type === 'shroom') return { x: e.x, y: e.y - 3, r: 9 };
    if (e.type === 'drift') return { x: e.x, y: e.y, r: 9 };
    if (e.type === 'worm') return e.state === 'lurk' ? null : { x: e.x + e.face * 2, y: e.gy - 13, r: 7 };
    if (e.type === 'bloater') return { x: e.x, y: e.y - 3, r: 12 };
    if (e.type === 'mite') return { x: e.x, y: e.y - 1, r: 5 };
    if (e.type === 'lancer') return { x: e.x, y: e.gy - 26, r: 9 };
    return { x: e.x, y: e.y, r: e.r };
  }

  /* state */
  const S = { corpses: [], stats: { leaps: 0, drowned: 0, fell: 0, volleys: 0, ducks: 0, dodges: 0, hits: 0, ambushes: 0, strikes: 0, spits: 0, drops: 0 },
    enemies: [], shots: [], toxins: [], clouds: [], splats: [], waves: [], motes: [], pops: [], killed: new Set(), seen: new Set(), cd: 0, kills: 0 };
  function reset() {
    S.elder = null; S.corpses = []; S.enemies = []; S.shots = []; S.toxins = []; S.clouds = []; S.splats = []; S.waves = []; S.motes = []; S.pops = [];
    const w0 = W(); S.stalk = { state: 'idle', at: G.level >= 3 && w0 && !w0.garden ? 18 + rnd() * 50 : null, t: 0, lost: 0, pulse: 0 };
    S.killed = new Set(); S.seen = new Set(); S.cd = 0; rings.length = 0;
    G.iframes = 0; G.shake = 0; G.dark = 0; G.darkT = 0; G.flashA = 0; G.hitstop = 0;
  }
  function spawnFromQueue() {
    const q = W().spawnQ; if (!q || !q.length) return;
    for (const d of q.splice(0)) {
      if (S.killed.has(d.id) || S.seen.has(d.id)) continue;
      S.seen.add(d.id);
      if (d.type === 'shroom') S.enemies.push(makeShroom(d.x, d.y, d.id));
      else if (d.type === 'drift') S.enemies.push(makeDrift(d.x, d.y, d.id));
      else if (d.type === 'worm') S.enemies.push(makeWorm(d.x, d.y, d.id));
      else if (d.type === 'bloater') S.enemies.push(makeBloater(d.x, d.y, d.id));
      else if (d.type === 'lancer') S.enemies.push(makeLancer(d.x, d.y, d.id));
      else if (d.type === 'mite') {                       // mites come in packs
        const n = 4 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) { const id = d.id + ':' + i; if (!S.killed.has(id)) S.enemies.push(makeMite(d.x + (i - n / 2) * 5, d.y, id)); }
      }
    }
  }
  function makeShroom(x, y, id) {
    return { type: 'shroom', spd: 1, dmg: 10, id, x, y: y + 7 - 7, vx: 0, vy: 0, r: 7, hp: 3, max: 3,
      state: 'wander', dir: rnd() < 0.5 ? -1 : 1, think: rnd() * 0.2, alert: 0, lx: x, ly: y, leapCd: 0.5, lungeCd: 0, spitCd: 1.5 + rnd(), charge: 0, crouch: 0, plan: null,
      dodgeCd: 0, recoil: 0, flash: 0, t: rnd() * 9, pause: 0, ground: false, wall: 0, sq: 0, slot: 0, face: 1 };
  }
  function makeDrift(x, y, id) {
    let hy = y - 46; for (let k = 0; k < 6 && solidAt(x, hy); k++) hy -= 16;
    return { type: 'drift', id, x, y: hy, hx: x, hy, vx: 0, vy: 0, r: 9, hp: 3, max: 3, state: 'dormant', charge: 0, cd: 1 + rnd(), dodgeCd: 0, flash: 0,
      t: rnd() * 9, sq: 0, face: 1, side: rnd() < 0.5 ? -1 : 1, fire: 0 };
  }
  function makeWorm(x, y, id) {
    return { type: 'worm', id, x, hx: x, gy: y, y: y - 12, r: 7, hp: 3, max: 3, state: 'lurk', st: 0, cd: 0.6, flash: 0, t: rnd() * 9, face: 1, strikes: 0, away: 0, hitDone: false };
  }

  function makeBloater(x, y, id) {
    return { type: 'bloater', id, x, y: y - 10.5, vx: 0, vy: 0, r: 10, hp: 3, max: 3, dmg: 8, state: 'wander', st: 0, dir: rnd() < 0.5 ? -1 : 1, turn: 1 + rnd() * 2,
      flash: 0, t: rnd() * 9, sq: 0, face: 1, ground: false, wall: 0 };
  }
  function makeMite(x, y, id) {
    return { type: 'mite', id, x, y: y - 3.5, vx: 0, vy: 0, r: 3, hp: 1, max: 1, dmg: 4, cd: 0.3 + rnd() * 0.8, flash: 0, t: rnd() * 9, sq: 0, face: 1, ground: false, wall: 0 };
  }
  function makeLancer(x, y, id) {
    return { type: 'lancer', id, x, gy: y, y: y - 26, r: 9, hp: 3, max: 3, dmg: 8, state: 'idle', st: 0, cd: 1 + rnd(), aim: null, flash: 0, t: rnd() * 9, sq: 0, face: 1 };
  }

  /* stuff that touches the player */
  function hurtPlayer(dmg, fx0, fy0) {
    if (G.phase !== 'play' || G.iframes > 0) return false;
    const R = G.run, b = G.ball, before = R.dna;
    R.dnaLag = Math.max(R.dnaLag, R.dnaShown);
    R.dna = elderActive() ? Math.max(Math.min(R.dna, 15), R.dna - dmg) : Math.max(0, R.dna - dmg);   // the elder wants u in one piece
    noteLoss(before - R.dna);
    G.iframes = 1.0; shake(0.24); hitstop(0.06); flash(0.18, '#ffd0d0');
    const d = Math.sign(b.x - fx0) || 1;
    b.vx = d * 170; b.vy = Math.min(b.vy, -190); b.coyote = 0;
    AU.ouch(); AU.dnaLoss();
    popup(`-${Math.round(dmg)} DNA`, b.x, b.y - 16, '#ffb0b0');
    burst(b.x, b.y, 8, { color: ['#ffb0b0', '#fff2cc'], speed: 90, life: 0.4 });
    VX.sparkBurst(b.x, b.y, 12, { col: '#ffb0b0', speed: 220, life: 0.32 }); VX.kick(0.3, d * 4, -1);
    S.stats.hits++;
    if (R.dna <= 0) { R.spores++; G.roomSpores++; G.phase = 'dead'; G.phaseT = 0.45; }
    return true;
  }
  function damage(e, dmg, kx, ky) {
    if (e.dead) return;
    if (e.type === 'worm' && (e.state === 'lurk' || e.state === 'burrow')) return;
    if (e.type === 'drift' && e.dash > 0) return;
    e.hp -= dmg; e.flash = 0.15; e.sq = 1;
    const h = hitbox(e) || e;
    fx('impB', h.x, h.y, { sc: 0.6, speed: 30 }); hitstop(0.035);
    VX.sparkBurst(h.x, h.y, 7, { col: GLOW2, speed: 170, life: 0.26, angle: Math.atan2(ky || -1, kx || 0.01), spread: 2 }); VX.kick(0.06);
    if (e.type === 'shroom') { e.vx += kx; e.vy = Math.min(e.vy, ky); e.alert = 4; e.lx = G.ball.x; e.ly = G.ball.y; e.charge = 0; }
    else if (e.type === 'drift') { e.vx += kx * 0.6; e.vy += ky * 0.3; e.state = 'awake'; e.charge = 0; }
    else if (e.type === 'worm' && e.state !== 'strike') { e.state = 'hit'; e.st = 0; }
    else if (e.type === 'bloater') { e.vx += kx * 0.4; e.vy = Math.min(e.vy, ky * 0.5); if (e.state === 'wander') e.state = 'chase'; }
    else if (e.type === 'mite') { e.vx += kx; e.vy = Math.min(e.vy, ky); }
    else if (e.type === 'lancer') { if (e.state === 'charge') { e.state = 'idle'; e.cd = 1.2; e.aim = null; } }   // a hit breaks its aim
    AU.rivalHurt();
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true; S.kills++; G.kills = S.kills;
    S.killed.add(e.id);
    AU.rivalDie(); shake(0.14); hitstop(0.07);
    const h = hitbox(e) || { x: e.x, y: e.y };
    fx('popB', h.x, h.y, { sc: 1, speed: 26 }); ring(h.x, h.y, 22, { speed: 140 });
    const tn = TINT[e.type] || TINT.blue;
    VX.sparkBurst(h.x, h.y, e.type === 'mite' ? 6 : 16, { col: tn[0], speed: 240, life: 0.5, curve: 5 }); VX.kick(e.type === 'mite' ? 0.05 : 0.16);
    burst(h.x, h.y, e.type === 'mite' ? 6 : 16, { color: [tn[0], tn[1], tn[2], EYE], speed: 120, life: 0.7, g: 120 });
    for (let i = 0; i < (e.type === 'mite' ? 1 : 6); i++) S.motes.push({ x: h.x + (rnd() - 0.5) * 12, y: h.y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 20, vy: -12 - rnd() * 18, t: 0, life: 1.4 + rnd(), col: tn });
    corpse(e);
    if (e.type === 'bloater') pop(e);
    const R = G.run;
    if (R.devour) { const hh = Math.min(R.dnaMax - R.dna, 8); if (hh > 0) { R.dna += hh; popup(`+${hh} DNA`, h.x, h.y - 20, '#d8ffd0'); } }
  }
  const TINT = { blue: [GLOW, GLOW2, CAP], bloater: ['#ffb35c', '#ffe2a8', '#a8562f'], mite: ['#c79cff', '#f0d4ff', '#7a4fb0'], lancer: ['#8ff0c0', '#d4ffe8', '#3f9a74'] };
  function corpse(e) {
    const anim = { shroom: 'sh_die', drift: 'dc_die', worm: 'wm_die', bloater: 'bl_die', mite: 'mt_die', lancer: 'ln_die' }[e.type];
    const y = e.type === 'worm' || e.type === 'lancer' ? e.gy : e.type === 'drift' ? e.y : e.y + e.r;
    S.corpses.push({ anim, x: e.x, y, face: e.face || 1, t: 0, vy: e.type === 'drift' ? -40 : 0, fly: e.type === 'drift' });
  }
  /* a bloater bursts: a ring of toxic puff that hurts you and anything else caught in it */
  function pop(e) {
    if (e.popped) return; e.popped = true;
    const x = e.x, y = e.y - 3;
    S.pops.push({ x, y, t: 0, life: 0.9, r: 34, hitP: false, hit: new Set([e]) });
    AU.slam(); shake(0.2); ring(x, y, 36, { speed: 170, col: '#ffb35c' }); ring(x, y, 24, { speed: 110, col: '#ffe2a8' });
    VX.sparkBurst(x, y, 22, { col: '#ffb35c', speed: 260, life: 0.45 });
    burst(x, y, 24, { color: ['#ffb35c', '#ffe2a8', '#a8562f', '#663832'], speed: 150, life: 0.8, g: 60 });
  }
  /* toxin blast, shoots from the spore toward a point in the world */
  function blast(tx, ty) {
    if (G.phase !== 'play' || S.cd > 0) return false;
    const b = G.ball, R = G.run;
    const sp = 330, TOX_G = 140;
    let dx = tx - b.x, dy = ty - b.y; const t0 = Math.hypot(dx, dy) / sp;
    dy -= 0.5 * TOX_G * t0 * t0;                         // aim a bit high so the arc goes right through where u clicked
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    S.toxins.push({ x: b.x + dx * 7, y: b.y + dy * 7, vx: dx * sp, vy: dy * sp, life: 1.1, dmg: R.toxDmg, trail: [] });
    S.cd = R.toxCd;
    if (!b.grounded) { b.vx -= dx * 28; b.vy -= dy * 28; }       // lil recoil in the air
    AU.blast(); S.splats.push({ x: b.x + dx * 8, y: b.y + dy * 8, t: 0.12 });
    VX.sparkBurst(b.x + dx * 8, b.y + dy * 8, 5, { angle: Math.atan2(dy, dx), spread: 0.8, speed: 190, col: '#b6ff5a', life: 0.2 }); VX.kick(0.03, -dx * 1.5, -dy * 1.5);
    return true;
  }
  /* keyboard blast. aims at the closest rival u can see, if theres none it shoots straight ahead */
  function autoBlast() {
    const b = G.ball; let best = null, bd = 280;
    for (const e of S.enemies) {
      const h = !e.dead && hitbox(e); if (!h) continue;
      const d = Math.hypot(h.x - b.x, h.y - b.y);
      if (d < bd && los(b.x, b.y, h.x, h.y)) { bd = d; best = { x: h.x + (e.vx || 0) * d / 330 * 0.8, y: h.y }; }
    }
    return blast(best ? best.x : b.x + (G.facing || 1) * 100, best ? best.y : b.y - 12);
  }

  /* aiming: lead the target along the gravity arc */
  const SPORE_SPEED = 250, SPORE_G = 260;     // goes about 240px on flat ground
  function aimAt(sx, sy, P, speed = SPORE_SPEED) {
    let tx = P.x, ty = P.y, sol = null;
    for (let it = 0; it < 3; it++) {
      const X = tx - sx, Y = sy - ty, S2 = speed * speed, disc = S2 * S2 - SPORE_G * (SPORE_G * X * X + 2 * Y * S2);
      if (disc < 0) return null;
      const arcs = [Math.atan2(S2 - Math.sqrt(disc), SPORE_G * Math.abs(X) || 1e-6), Math.atan2(S2 + Math.sqrt(disc), SPORE_G * Math.abs(X) || 1e-6)];
      sol = null;
      for (const th of arcs) {
        const vx = Math.sign(X || 1) * Math.cos(th) * speed, vy = -Math.sin(th) * speed;
        const T = Math.abs(X) / Math.max(1, Math.abs(vx));
        if (clearArc(sx, sy, vx, vy, tx, ty, T)) { sol = { vx, vy, T }; break; }
      }
      if (!sol) return null;
      tx = P.x + P.vx * sol.T * 0.75; ty = P.y + Math.min(0, P.vy) * sol.T * 0.3;
    }
    return sol;
  }
  function clearArc(x, y, vx, vy, tx, ty, T) {
    for (let t = 0; t < T + 0.1; t += 1 / 40) {
      const px = x + vx * t, py = y + vy * t + 0.5 * SPORE_G * t * t;
      if (Math.hypot(px - tx, py - ty) < 12) return true;
      if (t > 0.05 && solidAt(px, py)) return false;
    }
    return true;
  }
  const spore = (x, y, vx, vy, o = {}) => S.shots.push({ x, y, vx, vy, g: o.g ?? SPORE_G, life: o.life || 3, dmg: o.dmg || 8, r: o.r || 3, kind: o.kind || 'spore', trail: [] });

  /* shroomling brain (walks, jumps, lunges, spits) */
  function shroomThink(e, P) {
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
    const sees = (d < 230 && los(e.x, e.y - 6, P.x, P.y)) || d < 85;     // it sees u, or hears u rolling close by
    if (sees) { e.alert = 3.5; e.lx = P.x + P.vx * 0.35; e.ly = P.y; }
    if (e.alert <= 0) { e.state = 'wander'; return; }
    e.state = (e.hp <= e.max * 0.34 && d < 80) ? 'flee' : 'chase';
    const off = e.slot ? (e.slot % 2 ? -1 : 1) * 16 * Math.ceil(e.slot / 2) : 0;     // flanking, each one takes a side
    const tx = e.lx + (d > 40 ? off : 0), ty = e.ly;
    e.tx = tx; e.ty = ty;
    if (!e.ground || e.leapCd > 0 || e.crouch > 0 || e.charge > 0) return;
    const sameLevel = Math.abs(ty - e.y) < 18;
    const dir = Math.sign(tx - e.x) || e.dir;
    let walkable = sameLevel;
    if (walkable) for (let x = e.x; Math.abs(x - tx) > 8; x += dir * 8) if (!footing(x, e.y, e.r) || solidAt(x + dir * 8, e.y - 4)) { walkable = false; break; }
    if (e.state === 'chase' && walkable) return;
    // plan a jump: try a bunch of arcs, keep the one that lands closest to where it wants to go
    const goalX = e.state === 'flee' ? e.x - Math.sign(dx) * 120 : tx, goalY = e.state === 'flee' ? e.y : ty;
    const now = Math.hypot(goalX - e.x, goalY - e.y);
    let best = null, bs = now - 14;
    for (const vy of [-180, -260, -330, -400, -460]) for (let vx = -210; vx <= 210; vx += 30) {
      const L = simLeap(e, vx, vy); if (!L) continue;
      const s = Math.hypot(goalX - L.x, goalY - L.y) + L.t * 14;
      if (s < bs) { bs = s; best = { vx, vy }; }
    }
    if (best) { e.plan = best; e.crouch = 0.28; e.leapCd = 1.3 + rnd() * 0.5; }
    else e.leapCd = 0.4;
  }
  function updateShroom(e, dt, P) {
    e.t += dt; e.think -= dt; e.alert -= dt; e.leapCd -= dt; e.lungeCd -= dt; e.spitCd -= dt; e.dodgeCd -= dt; e.recoil -= dt; e.flash -= dt; e.pause -= dt; e.sq = Math.max(0, e.sq - dt * 4);
    if (e.think <= 0) { e.think = 0.14 + rnd() * 0.08; shroomThink(e, P); }
    const spd = (0.85 + G.prog * 0.35) * (e.spd || 1);
    if (e.alert > 0) e.face = Math.sign(P.x - e.x) || e.face; else if (Math.abs(e.vx) > 4) e.face = Math.sign(e.vx);
    // dodge a blast thats coming at it: hop to the side if its gonna hit
    if (e.ground && e.dodgeCd <= 0 && e.alert > 0) for (const t of S.toxins) {
      const rx = e.x - t.x, ry = e.y - 3 - t.y, vv = t.vx * t.vx + t.vy * t.vy, tt = (rx * t.vx + ry * t.vy) / vv;
      if (tt > 0 && tt < 0.28 && Math.hypot(rx - t.vx * tt, ry - t.vy * tt) < 13 && rnd() < 0.55 + G.prog * 0.3) {
        e.vy = -250; e.vx = (Math.sign(t.vx) || 1) * -40 + (rnd() < 0.5 ? -1 : 1) * 70; e.dodgeCd = 2.6; e.sq = 1; e.charge = 0; S.stats.dodges++; AU.leap(); break;
      }
    }
    if (e.charge > 0) {                                   // spitting: the cap puffs up then a spore glob flies out
      e.charge -= dt; e.vx *= 0.7;
      if (e.charge <= 0) {
        const mx = e.x + e.face * 9, my = e.y - 8, sol = aimAt(mx, my, P, 230);
        if (sol) { spore(mx, my, sol.vx, sol.vy, { dmg: 8 }); AU.puff(); e.sq = 1; S.stats.spits++; fx('puffW', mx + e.face * 4, my, { sc: 0.55, speed: 40, rot: e.face < 0 ? Math.PI : 0 }); e.spat = 0.35; }
        e.spitCd = Math.max(1.6, 3.2 - G.prog * 1.2) + rnd();
      }
    } else if (e.crouch > 0) {
      e.crouch -= dt; e.vx *= 0.8;
      if (e.crouch <= 0 && e.plan && e.ground) { e.vx = e.plan.vx; e.vy = e.plan.vy; e.lunging = !!e.plan.lunge; e.plan = null; e.sq = 1; S.stats.leaps++; AU.leap(); fx('dust', e.x, e.y + e.r, { sc: 0.45 }); }
    } else if (e.recoil > 0) {
      if (e.ground) e.vx = -e.dir * 60 * spd;
    } else if (e.state === 'wander') {
      if (e.ground) {
        if (e.pause > 0) e.vx = 0;
        else {
          if (!footing(e.x + e.dir * (e.r + 3), e.y, e.r) || e.wall) { e.dir *= -1; e.pause = 0.4 + rnd() * 0.8; }
          e.vx = e.dir * 20 * spd;
          if (rnd() < dt * 0.25) e.pause = 0.6 + rnd();
        }
      }
    } else if (e.ground) {
      const tx = e.state === 'flee' ? e.x - Math.sign(P.x - e.x) * 60 : e.tx;
      const dir = Math.sign(tx - e.x);
      if (Math.abs(tx - e.x) > 4 && dir) {
        e.dir = dir;
        const ahead = e.x + dir * (e.r + 3);
        if (!footing(ahead, e.y, e.r)) e.vx = 0;                                   // never walk off a ledge
        else if (e.wall === dir || solidAt(ahead + dir * 2, e.y)) {                // a step, hop it if its low
          if (!solidAt(ahead + dir * 2, e.y - TS)) { e.vy = -250; e.vx = dir * 50; } else e.vx = 0;
        } else e.vx = dir * 56 * spd;
      } else e.vx = 0;
      const ddx = P.x - e.x, dd = Math.hypot(ddx, P.y - e.y);
      // lunge when its close and on the same level, with a short windup first
      if (e.state === 'chase' && e.lungeCd <= 0 && Math.abs(P.y - e.y) < 14 && Math.abs(ddx) > 22 && Math.abs(ddx) < 72 && footing(e.x + Math.sign(ddx) * 30, e.y, e.r)) {
        e.lungeCd = 2 + rnd(); e.plan = { vx: Math.sign(ddx) * 230 * spd, vy: -140, lunge: true }; e.crouch = 0.22;
      } else if (e.state === 'chase' && e.spitCd <= 0 && dd > 70 && dd < 210 && los(e.x, e.y - 8, P.x, P.y) && aimAt(e.x + e.face * 9, e.y - 8, P, 230)) {
        e.charge = 0.42; AU.charge();                                               // spit from far away
      }
    } else if (e.tx != null) e.vx += Math.sign(e.tx - e.x) * 120 * dt;              // steer in the air toward the target
    moveBody(e, dt);
    if (e.spat > 0) e.spat -= dt;
    if (e.ground && e.vy >= 0) e.lunging = false;
    if (e.lunging && rnd() < dt * 30) burst(e.x - Math.sign(e.vx) * 4, e.y - 6, 1, { color: [GLOW, GLOW2], speed: 20, life: 0.35, g: -40 });   // leaves spores behind when it lunges
    if (rnd() < dt * 0.8) S.motes.push({ x: e.x + (rnd() - 0.5) * 16, y: e.y - 14, vx: (rnd() - 0.5) * 6, vy: -8 - rnd() * 8, t: 0, life: 1.2 + rnd() });
    if (waterAt(e.x, e.y + 1)) { AU.splat(); fx('bubble', e.x, e.y - 12, { rot: -Math.PI / 4, sc: 0.5 }); e.dead = true; S.stats.drowned++; S.killed.add(e.id); }
  }

  /* driftcap brain (floats, rains spores, darts away) */
  function updateDrift(e, dt, P) {
    e.t += dt; e.cd -= dt; e.dodgeCd -= dt; e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 3);
    if (e.dash > 0) e.dash -= dt;
    const d = Math.hypot(P.x - e.x, P.y - e.y), sees = d < 280 && los(e.x, e.y, P.x, P.y);
    if (e.state === 'dormant') { if (sees && d < 230) { e.state = 'awake'; e.cd = 0.8; AU.puff(); } }
    else if (!sees && d > 340) e.state = 'dormant';
    // where it wants to be: above and to the side of u, but on a leash around its home spot
    let tx = e.hx, ty = e.hy;
    if (e.state === 'awake') {
      if (Math.abs(P.x - e.x) < 30 && rnd() < dt * 0.4) e.side *= -1;
      tx = P.x + e.side * 70; ty = P.y - 62;
      const lx = tx - e.hx, ly = ty - e.hy, L = Math.hypot(lx, ly), leash = 230;
      if (L > leash) { tx = e.hx + lx / L * leash; ty = e.hy + ly / L * leash; }
      if (solidAt(tx, ty) || !los(tx, ty, P.x, P.y)) { tx = (tx + e.x) / 2; ty = Math.min(ty, e.y) - 10; }
    }
    const bob = Math.sin(e.t * 2.2) * 6;
    const ax = (tx - e.x) * 1.6 - e.vx * 1.4, ay = (ty + bob - e.y) * 1.6 - e.vy * 1.4;
    e.vx += ax * dt; e.vy += ay * dt;
    const sp = Math.hypot(e.vx, e.vy), max = e.dash > 0 ? 260 : 60;
    if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    if (!solidAt(nx, ny) && !solidAt(nx, ny + 8)) { e.x = nx; e.y = ny; } else { e.vx *= -0.4; e.vy *= -0.4; }
    if (e.state === 'awake') e.face = Math.sign(P.x - e.x) || e.face;
    // dart away if a blast is about to land
    if (e.dodgeCd <= 0) for (const t of S.toxins) {
      const rx = e.x - t.x, ry = e.y - t.y, vv = t.vx * t.vx + t.vy * t.vy, tt = (rx * t.vx + ry * t.vy) / vv;
      if (tt > 0 && tt < 0.3 && Math.hypot(rx - t.vx * tt, ry - t.vy * tt) < 13 && rnd() < 0.45 + G.prog * 0.35) {
        const pdx = -t.vy, pdy = t.vx, pl = Math.hypot(pdx, pdy) || 1, s = rnd() < 0.5 ? -1 : 1;
        e.vx = pdx / pl * 240 * s; e.vy = pdy / pl * 240 * s - 30; e.dash = 0.22; e.dodgeCd = 2.8; e.charge = 0; S.stats.ducks++; AU.puff();
        e.ghost = { x: e.x, y: e.y, t: 0.3 };
        break;
      }
    }
    if (e.ghost) { e.ghost.t -= dt; if (e.ghost.t <= 0) e.ghost = null; }
    if (e.state !== 'awake') { e.charge = 0; return; }
    if (e.charge > 0) {                                     // pulls in tight, then flares out and lets go
      e.charge -= dt;
      if (e.charge <= 0) {
        e.fire = 0.5; e.sq = 1; AU.volley(); S.stats.volleys++;
        const above = Math.abs(P.x - e.x) < 26 && P.y > e.y;
        if (above) {                                          // straight down, a curtain of spores
          for (let k = -2; k <= 2; k++) spore(e.x + k * 3, e.y + 8, k * 26 + P.vx * 0.2, 40, { dmg: 7 });
          S.stats.drops++;
        } else {
          const sol = aimAt(e.x, e.y + 6, P, 210);
          if (sol) {
            spore(e.x, e.y + 6, sol.vx, sol.vy, { dmg: 8 });
            if (G.prog > 0.3) for (const k of [-1, 1]) spore(e.x, e.y + 6, sol.vx * (1 + k * 0.14), sol.vy * (1 - k * 0.08), { dmg: 7 });
          }
        }
        fx('puffW', e.x, e.y + 8, { sc: 0.5, speed: 40, rot: Math.PI / 2 });
        e.cd = Math.max(1.2, 2.6 - G.prog * 1.0) + rnd() * 0.6;
      }
    } else if (e.cd <= 0 && sees && d < 240) { e.charge = 0.5; AU.charge(); }
    if (e.fire > 0) e.fire -= dt;
    if (rnd() < dt * 0.9) S.motes.push({ x: e.x + (rnd() - 0.5) * 12, y: e.y + 10 + rnd() * 6, vx: (rnd() - 0.5) * 4, vy: 6 + rnd() * 6, t: 0, life: 1 + rnd() });
  }

  /* burrowcap brain (hides, bursts out, strikes, dives back) */
  const WORM_T = { emerge: 0.5, strike: 0.62, burrow: 0.45, hit: 0.22 };
  function updateWorm(e, dt, P) {
    e.t += dt; e.st += dt; e.cd -= dt; e.flash -= dt;
    const dx = P.x - e.x, dy = P.y - e.gy;
    const sense = Math.abs(dx) < 130 && dy > -70 && dy < 14 && los(e.x, e.gy - 6, P.x, P.y), near = sense && Math.abs(dx) < 48;
    if (e.state === 'lurk') {
      if (rnd() < dt * 0.6) S.motes.push({ x: e.x + (rnd() - 0.5) * 10, y: e.gy - 2, vx: 0, vy: -10, t: 0, life: 0.7 });   // the only warning u get
      // it feels u through the soil and the mound creeps toward u
      if (sense && e.cd <= 0 && Math.abs(dx) > 26) {
        const nx = e.x + Math.sign(dx) * 26 * dt, ahead = nx + Math.sign(dx) * 8;
        if (Math.abs(nx - e.hx) < 150 && solidAt(ahead, e.gy + 2) && !solidAt(ahead, e.gy - 4) && !waterAt(ahead, e.gy - 4)) {
          e.x = nx; if (rnd() < dt * 10) burst(e.x, e.gy - 1, 1, { color: ['#75352f', '#914b2f'], speed: 40, life: 0.35, g: 300, angle: -Math.PI / 2, spread: 1.2 });
        }
      }
      if (near && Math.abs(dx) < 34 && e.cd <= 0) {
        e.state = 'emerge'; e.st = 0; e.face = Math.sign(dx) || 1; S.stats.ambushes++;
        AU.burrow(); shake(0.16); fx('dirtUp', e.x, e.gy - 12, { sc: 0.9, speed: 22 }); VX.sparkBurst(e.x, e.gy - 2, 10, { angle: -Math.PI / 2, spread: 1.6, speed: 200, g: 600, col: '#b8703f', life: 0.45 }); VX.kick(0.14, 0, 2);
        burst(e.x, e.gy - 2, 12, { color: ['#75352f', '#914b2f', '#46262b'], speed: 130, life: 0.6, g: 420, spread: 1.6 });
      }
      return;
    }
    if (e.state === 'emerge' && e.st > WORM_T.emerge) { e.state = 'up'; e.st = 0; e.strikes = 0; }
    if (e.state === 'hit' && e.st > WORM_T.hit) { e.state = 'up'; e.st = 0; }
    if (e.state === 'up') {
      e.face = Math.sign(dx) || e.face;
      if (Math.abs(dx) < 34 && Math.abs(dy) < 40 && e.st > 0.25) { e.state = 'strike'; e.st = 0; e.hitDone = false; AU.charge(); }
      else { e.away += dt; if (e.away > (near ? 1.8 : 1.1)) { e.state = 'burrow'; e.st = 0; AU.burrow(); } }
    }
    if (e.state === 'strike') {
      const f = e.st / WORM_T.strike * 8;
      if (f >= 3 && f < 6 && !e.hitDone) {                  // the snap, head whips down in front of it
        const [rx, ry] = f < 4 ? [21, 10] : f < 5 ? [25, 8] : [23, 9], hx = e.x + e.face * rx, hy = e.gy - ry;
        if (Math.hypot(P.x - hx, P.y - hy) < 12) { e.hitDone = true; hurtPlayer(12, e.x, e.gy - 14); }
        if (f >= 3 && !e.snapped) { e.snapped = true; AU.snap(); fx('hitDir', e.x + e.face * 26, e.gy - 9, { sc: 0.6, rot: e.face < 0 ? Math.PI : 0, speed: 30 }); S.stats.strikes++; }
      }
      if (e.st > WORM_T.strike) { e.snapped = false; e.strikes++; e.state = e.strikes >= 2 ? 'burrow' : 'up'; e.st = 0; e.away = 0; if (e.state === 'burrow') AU.burrow(); }
    }
    if (e.state === 'burrow' && e.st > WORM_T.burrow) { e.state = 'lurk'; e.st = 0; e.cd = 0.9 + rnd() * 0.6; e.away = 0; }
  }

  /* the elder. first meeting on level 1, u cant win it */
  const ELDER_LINE = "Just because you fell once doesn't mean you can't get back up again. Bounce back, little spore.";
  const EL_T = { rise: 1.5, roar: 1.3, volley: 0.95, slam: 1.15, engulf: 0.8, sink: 1.2 };
  function groundBelow(x, y) { for (let k = 0; k < 40; k++) { const yy = y + k * 4; if (solidAt(x, yy)) return Math.floor(yy / TS) * TS; } return null; }
  function spawnElder(offsets, under) {
    const b = G.ball, dir = Math.abs(b.vx) > 20 ? Math.sign(b.vx) : (Math.sign(W().goal.x - b.x) || 1);
    // it comes up in ur way
    for (const off of offsets || [130, 112, 148, 96, 160, 80, 64, -80, -100]) {
      const x = b.x + dir * off, gy = groundBelow(x, b.y - 40);
      if (gy != null && Math.abs(gy - (b.y + PHYS_R)) < 100 && !solidAt(x, gy - 60) && !solidAt(x - 20, gy - 30) && !solidAt(x + 20, gy - 30)) {
        const prev = S.elder;
        S.elder = { type: 'elder', x, gy, state: 'rise', t: 0, flash: 0, face: -dir || -1, cycle: prev ? prev.cycle : 0, step: prev ? prev.step : 0, shrug: prev ? prev.shrug : 0, under: !!under, far: 0 };
        AU.rumble(); shake(0.5); G.oracle = null; G.oracleNext = 1e9; G.darkT = 1;          // the hooded guy goes quiet and the dark closes in
        return true;
      }
    }
    return false;
  }
  const PATTERN = ['volley', 'slam', 'fan', 'engulf'];
  function elderGo(e, s) { e.state = s; e.t = 0; e.did = 0; }
  function updateElder(dt) {
    const e = S.elder; if (!e) return;
    const b = G.ball;
    e.t += dt; e.flash -= dt;
    e.face = Math.sign(b.x - e.x) || e.face;
    const mawX = e.x + e.face * 4, mawY = e.gy - 28;
    if (e.state === 'rise') {
      if (e.under) { e.x += (b.x - e.x) * Math.min(1, dt * 5); const g2 = groundBelow(e.x, b.y - 30); if (g2 != null) e.gy = g2; }   // it follows u under the soil
      if (rnd() < dt * 24) burst(e.x + (rnd() - 0.5) * 70, e.gy - 1, 1, { color: ['#75352f', '#46262b', GLOW], speed: 90, life: 0.6, g: 300 });
      if (rnd() < dt * 6) fx('smokeP', e.x + (rnd() - 0.5) * 60, e.gy - 8, { sc: 0.9, speed: 18 });
      shake(0.12);
      if (e.t > EL_T.rise) {
        if (e.under) { elderGo(e, 'engulf'); return; }
        elderGo(e, 'roar');
      }
      return;
    }
    if (e.state === 'roar') {
      if (e.t > 0.3 && !e.did) {
        e.did = 1; AU.roar(); shake(0.7); flash(0.45); hitstop(0.12);
        fx('ringBig', mawX, mawY, { sc: 1, speed: 16 }); fx('flareB', mawX, mawY, { sc: 1, speed: 18 });
        ring(mawX, mawY, 170, { speed: 300 }); ring(mawX, mawY, 120, { speed: 200, col: GLOW });
        VX.sparkBurst(mawX, mawY, 46, { col: GLOW2, speed: 340, life: 0.9, curve: 3 }); VX.kick(0.6);
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; burst(mawX + Math.cos(a) * 16, mawY + Math.sin(a) * 10, 1, { color: [GLOW2, EYE], speed: 160, life: 0.6, g: 0, angle: a, spread: 0.2 }); }
      }
      if (e.t > EL_T.roar) elderGo(e, PATTERN[e.step % PATTERN.length]);
      return;
    }
    if (e.state === 'sated') {                                 // it got what it wanted, back into the ground
      G.darkT = 0;
      if (e.t > EL_T.sink) S.elder = null;
      return;
    }
    // it creeps toward u between attacks. if u get too far it sinks and pops up right next to u again
    const dx = b.x - e.x, ad = Math.abs(dx);
    if (ad > 250 || Math.abs(b.y - e.gy) > 160) e.far += dt; else e.far = 0;
    if (e.far > (e.hunt ? 3.2 : 2.2) && G.phase === 'play') { const c = e.cycle, s = e.step, h = e.hunt; S.elder = null; if (spawnElder([110, 90, 130, 70, -90])) { S.elder.cycle = c; S.elder.step = s; S.elder.hunt = h; G.darkT = 1; } return; }
    if (e.state !== 'engulf') {
      const ahead = e.x + Math.sign(dx) * 26, gy2 = groundBelow(ahead, e.gy - 20);
      if (ad > 46 && gy2 != null && Math.abs(gy2 - e.gy) < 20 && !solidAt(ahead, e.gy - 30)) { e.x += Math.sign(dx) * (e.hunt ? 62 : 18) * dt; e.gy = gy2; }   // on the hunt it really chases
    }
    const next = () => { e.step++; if (e.step % PATTERN.length === 0) e.cycle++; elderGo(e, PATTERN[e.step % PATTERN.length]); };
    if (e.state === 'volley' || e.state === 'fan') {
      if (e.t > 0.32 && !e.did) {
        e.did = 1; AU.volley(); shake(0.18); fx('boltB', mawX, mawY + 2, { sc: 1, speed: 26 }); VX.sparkBurst(mawX, mawY, 14, { col: GLOW2, speed: 200, life: 0.35 }); VX.kick(0.12);
        if (e.state === 'volley') {                           // full ring of glowing spores with a gap to slip through
          const n = 14, gap = Math.atan2(b.y - mawY, b.x - mawX) + (rnd() < 0.5 ? 0.9 : -0.9);
          for (let k = 0; k < n; k++) { const a = gap + (k + 0.5) / n * Math.PI * 2; if (Math.abs(((a - gap + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.45) continue;
            spore(mawX, mawY, Math.cos(a) * 82, Math.sin(a) * 82, { g: 0, life: 4, dmg: 6, r: 3, kind: 'orb' }); }
        } else {                                              // tight fan aimed at u
          const base = Math.atan2(b.y - mawY, b.x + b.vx * 0.3 - mawX);
          for (let k = -2; k <= 2; k++) { const a = base + k * 0.16; spore(mawX, mawY, Math.cos(a) * 125, Math.sin(a) * 125, { g: 0, life: 3.5, dmg: 6, r: 3, kind: 'orb' }); }
        }
      }
      if (e.t > EL_T.volley) next();
      return;
    }
    if (e.state === 'slam') {
      if (e.t > 0.42 && !e.did) {                              // the ground answers, shockwaves go both ways
        e.did = 1; AU.slam(); shake(0.75); hitstop(0.09); flash(0.22);
        fx('slamUp', e.x, e.gy - 18, { sc: 1.4, speed: 18 }); ring(e.x, e.gy - 2, 140, { speed: 280, flat: 0.3 }); ring(e.x, e.gy - 2, 90, { speed: 180, flat: 0.3, col: GLOW });
        burst(e.x, e.gy - 3, 26, { color: [GLOW2, EYE, '#75352f'], speed: 220, life: 0.7, g: 520, angle: -Math.PI / 2, spread: 2.6 });
        VX.sparkBurst(e.x, e.gy - 2, 34, { angle: -Math.PI / 2, spread: 2.8, speed: 320, g: 650, col: GLOW2, life: 0.7 }); VX.kick(0.6, 0, 5);
        for (const d of [-1, 1]) S.waves.push({ x: e.x + d * 30, gy: e.gy, dir: d, life: 1.25, step: 0, hit: false });
      }
      if (e.t > EL_T.slam) next();
      return;
    }
    if (e.state === 'engulf') {
      const reach = ad < 64 || (!e.hunt && e.cycle >= 1) || e.under;
      if (!reach && e.t < 0.05) { next(); return; }            // still too far, keep shooting
      if (e.t < 0.45 && !e.under) e.x += Math.sign(dx) * Math.min(ad, 190 * dt);   // it lunges
      if (e.t > 0.45 && !e.did) {
        e.did = 1;
        if ((Math.abs(b.x - e.x) < 38 && b.y > e.gy - 90 && b.y < e.gy + 10) || e.under) { if (e.hunt) devourAll(e); else engulf(e); return; }
        AU.slam(); shake(0.35);
      }
      if (e.t > EL_T.engulf) {
        if (!e.hunt && e.cycle >= 1 && G.phase === 'play') { const c = e.cycle; S.elder = null; spawnElder([0, 6, -6, 12, -12], true); if (S.elder) S.elder.cycle = c; return; }   // no escape, it comes up right under u
        next();
      }
    }
  }
  /* caught on the hunt: it eats your DNA and everything you grew */
  function devourAll(e) {
    const R = G.run, b = G.ball, n = R.order.length;
    R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = 0; R.spores++; G.roomSpores++;
    AU.engulf(); AU.dnaLoss(); shake(0.7); hitstop(0.2); flash(0.7, '#0a0912');
    fx('popB', b.x, b.y, { sc: 1.4, speed: 22 }); ring(b.x, b.y, 70, { speed: 170 }); VX.sparkBurst(b.x, b.y, 44, { col: '#fff2cc', speed: 300, life: 0.8, curve: 6 }); VX.kick(0.8);
    burst(b.x, b.y, 26, { color: [DEEP, '#fff2cc', GLOW], speed: 130, life: 0.8 });
    popup(n ? `It ate every mutation (${n})` : 'It ate everything you were', b.x, b.y - 22, '#ff9aa8');
    G.phase = 'dead'; G.phaseT = 0.45; G.deadHold = 1.4; G.eaten = true;
    elderGo(e, 'sated');
    S.shots = S.shots.filter(s => s.kind !== 'orb'); S.waves = [];
    endStalk();
  }
  function engulf(e) {
    const R = G.run, b = G.ball;
    R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = 0; R.spores++; G.roomSpores++;
    AU.engulf(); AU.dnaLoss(); shake(0.6); hitstop(0.18); flash(0.6, '#0a0912');
    fx('popB', b.x, b.y, { sc: 1.4, speed: 22 }); ring(b.x, b.y, 60, { speed: 160 }); VX.sparkBurst(b.x, b.y, 40, { col: '#fff2cc', speed: 300, life: 0.8, curve: 6 }); VX.kick(0.8);
    burst(b.x, b.y, 26, { color: [DEEP, '#fff2cc', GLOW], speed: 130, life: 0.8 });
    popup(`-${Math.round(R.dnaLag)} DNA`, b.x, b.y - 18, '#ffb0b0');
    G.phase = 'dead'; G.phaseT = 0.45; R.elderDone = true;
    G.deadHold = 1.2 + ELDER_LINE.length * 0.045 + 1.6;      // hold on the moment while the hooded guy talks
    const hi = ELDER_LINE.indexOf('Bounce back');
    G.oracle = { line: ELDER_LINE, hl: [hi, hi + 'Bounce back'.length], t: -0.6, dur: 1.2 + ELDER_LINE.length * 0.045 + 3.4, chars: 0 };
    elderGo(e, 'sated');
    S.shots = S.shots.filter(s => s.kind !== 'orb'); S.waves = [];
    setTimeout(() => AU.oracle(), 600);
  }

  // elder stalk (levels 4-7)
  const STALK_T = 25, HUNT_T = 20, STALK_LOSS = 50;
  const STALK_LINE = 'Something old is following you. Stay whole.';
  const fleeing = () => S.stalk && (S.stalk.state === 'stalk' || S.stalk.state === 'hunt');
  function noteLoss(n) { if (n > 0 && S.stalk && S.stalk.state === 'stalk') S.stalk.lost += n; }
  function whisper(line) { G.oracle = { line, t: -0.2, dur: 1.2 + line.length * 0.045 + 2.4, chars: 0 }; AU.oracle(); }
  function endStalk(msg) {
    const st = S.stalk; st.state = 'done'; G.darkT = 0;
    G.oracleNext = G.roomT + 8;
    if (msg) popup(msg, G.ball.x, G.ball.y - 30, '#c2bba8');
  }
  function updateStalk(dt) {
    const st = S.stalk; if (!st || st.at == null || st.state === 'done') return;
    st.t += dt;
    if (st.state === 'idle') {
      if (G.roomT > st.at && G.phase === 'play' && !S.elder) {
        st.state = 'stalk'; st.t = 0; st.lost = 0;
        AU.rumble(); shake(0.3); G.darkT = 0.35; whisper(STALK_LINE);
      }
      return;
    }
    if (st.state === 'stalk') {
      st.pulse -= dt; if (st.pulse <= 0) { st.pulse = 4 + rnd() * 2; AU.rumble(); shake(0.15); }   // it's under you somewhere
      if (st.lost >= STALK_LOSS && G.phase === 'play' && spawnElder()) {
        st.state = 'hunt'; st.t = 0; S.elder.hunt = true; G.darkT = 1;
        popup('RUN', G.ball.x, G.ball.y - 34, '#ff9aa8');
      } else if (st.t > STALK_T) endStalk('It lost your trail.');
      return;
    }
    if (st.state === 'hunt') {
      if (!S.elder) { endStalk(); return; }
      if (st.t > HUNT_T && S.elder.state !== 'engulf' && S.elder.state !== 'sated') {
        elderGo(S.elder, 'sated'); S.shots = S.shots.filter(s => s.kind !== 'orb'); S.waves = [];
        AU.rumble(); endStalk('It sank back into the dark.');
      }
    }
  }
  /* rivals that sense it: no attacks, just run from you */
  /* bloater: waddles at you, swells up, bursts */
  const SWELL_T = 0.75;
  function updateBloater(e, dt, P, scared) {
    e.t += dt; e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 3); e.st += dt;
    const dx = P.x - e.x, d = Math.hypot(dx, P.y - e.y), sees = d < 190 && los(e.x, e.y - 4, P.x, P.y);
    if (e.state === 'swell') {
      e.vx *= Math.pow(0.02, dt);
      if (e.st > SWELL_T) { e.dead = true; S.killed.add(e.id); corpse(e); pop(e); return; }
    } else if (scared) {
      e.state = 'wander'; e.dir = -Math.sign(dx) || 1; e.vx = e.dir * 34;
    } else {
      if (e.state === 'wander' && sees) e.state = 'chase';
      if (e.state === 'chase' && d > 260) e.state = 'wander';
      if (e.state === 'chase' && d < 30) { e.state = 'swell'; e.st = 0; AU.charge(); e.face = Math.sign(dx) || e.face; }
      if (e.state === 'chase') e.dir = Math.sign(dx) || e.dir;
      else if ((e.turn -= dt) < 0) { e.dir *= -1; e.turn = 1.5 + rnd() * 2.5; }
      if (e.state !== 'swell' && e.ground) {
        const ahead = e.x + e.dir * (e.r + 3);
        if (!footing(ahead, e.y, e.r) || e.wall) { e.dir *= -1; if (e.state === 'chase') e.vx = 0; }   // won't walk off ledges
        else e.vx = e.dir * (e.state === 'chase' ? 30 : 14);
      }
    }
    if (e.state !== 'swell') e.face = e.dir;
    moveBody(e, dt);
  }
  /* mites: tiny, quick, hop at you in packs */
  function updateMite(e, dt, P, scared) {
    e.t += dt; e.flash -= dt; e.cd -= dt; e.sq = Math.max(0, e.sq - dt * 4);
    const dx = P.x - e.x, d = Math.hypot(dx, P.y - e.y), sees = d < 200 && los(e.x, e.y - 2, P.x, P.y);
    if (e.ground && e.cd <= 0) {
      let dir = scared ? -Math.sign(dx) || 1 : sees ? Math.sign(dx) || 1 : rnd() < 0.5 ? -1 : 1;
      if (!footing(e.x + dir * 12, e.y, e.r) && !(sees && !scared && P.y > e.y + 10)) dir = -dir;   // don't hop off the edge for nothing
      const hot = sees && !scared;
      e.vx = dir * (hot ? 70 + rnd() * 50 : 30 + rnd() * 20);
      e.vy = hot ? -170 - rnd() * 90 - Math.max(0, e.y - P.y) * 0.8 : -110 - rnd() * 40;
      e.face = dir; e.sq = 1; e.cd = hot ? 0.35 + rnd() * 0.4 : 0.8 + rnd() * 1.2;
    }
    moveBody(e, dt);
    if (e.ground) e.vx *= Math.pow(0.0001, dt);
  }
  /* stalk lancer: rooted, aims a line, then fires a fast lance */
  const LANCE_T = 1.05, LANCE_LOCK = 0.28, LANCE_SPEED = 330;
  function updateLancer(e, dt, P, scared) {
    e.t += dt; e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 3); e.st += dt; e.cd -= dt;
    const mx = e.x, my = e.gy - 40, d = Math.hypot(P.x - mx, P.y - my), sees = d < 320 && los(mx, my, P.x, P.y);
    e.face = Math.sign(P.x - e.x) || e.face;
    if (scared) { e.state = 'idle'; e.aim = null; e.cd = 1; return; }
    if (e.state === 'idle') {
      if (sees && e.cd <= 0) { e.state = 'charge'; e.st = 0; AU.charge(); }
    } else if (e.state === 'charge') {
      if (e.st < LANCE_T - LANCE_LOCK) e.aim = { x: P.x + P.vx * 0.12, y: P.y + P.vy * 0.06 };   // the line follows you, then freezes: move!
      if (!sees && e.st < LANCE_T - LANCE_LOCK) { e.state = 'idle'; e.cd = 0.6; e.aim = null; }
      else if (e.st > LANCE_T) {
        const ax = e.aim.x - mx, ay = e.aim.y - my, L = Math.hypot(ax, ay) || 1;
        spore(mx + ax / L * 6, my + ay / L * 6, ax / L * LANCE_SPEED, ay / L * LANCE_SPEED, { g: 0, life: 1.6, dmg: 9, r: 3, kind: 'lance' });
        AU.snap(); AU.volley(); VX.sparkBurst(mx, my, 6, { angle: Math.atan2(ay, ax), spread: 0.6, speed: 200, col: '#8ff0c0', life: 0.2 });
        e.state = 'fire'; e.st = 0; e.aim = null; e.sq = 1;
      }
    } else if (e.state === 'fire') { if (e.st > 0.4) { e.state = 'idle'; e.cd = 1.6 + rnd() * 0.8; } }
  }
  function flee(e, dt, P) {
    const away = Math.sign(e.x - P.x) || 1;
    if (e.type === 'shroom') {
      e.charge = 0; e.crouch = 0; e.plan = null; e.lunging = false; e.think = 0.5;
      e.state = 'flee'; e.alert = 1; e.spd = Math.max(e.spd || 1, 1.6);
      updateShroom(e, dt, P);
    } else if (e.type === 'drift') {
      e.t += dt; e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 3); e.dash = 0;
      const tx = e.x + away * 120, ty = Math.min(e.y, P.y - 40) - 30 + Math.sin(e.t * 3) * 6;
      e.vx += ((tx - e.x) * 1.6 - e.vx * 1.4) * dt; e.vy += ((ty - e.y) * 1.6 - e.vy * 1.4) * dt;
      const sp = Math.hypot(e.vx, e.vy); if (sp > 110) { e.vx *= 110 / sp; e.vy *= 110 / sp; }
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      if (!solidAt(nx, ny) && !solidAt(nx, ny + 8)) { e.x = nx; e.y = ny; } else { e.vx *= -0.4; e.vy *= -0.4; }
      e.face = away;
    } else if (e.type === 'bloater') updateBloater(e, dt, P, true);
    else if (e.type === 'mite') updateMite(e, dt, P, true);
    else if (e.type === 'lancer') updateLancer(e, dt, P, true);
    else updateWorm(e, dt, { x: e.x + 1e5, y: e.gy, vx: 0, vy: 0 });   // it stays down in the soil
  }

  /* main update */
  function update(dt) {
    const b = G.ball, R = G.run;
    spawnFromQueue();
    updateStalk(dt);
    // level 1: a few steps in and the elder comes up. ur not meant to win this one
    if (G.level === 0 && !R.elderDone && !S.elder && G.roomT > 2.5 && b.grounded && Math.hypot(b.x - W().start.x, b.y - W().start.y) > 80) spawnElder();
    if (S.elder) {
      updateElder(dt);
      const e = S.elder;
      if (e && e.state !== 'rise' && e.state !== 'sated') {
        for (const t of S.toxins) if ((t.x - e.x) ** 2 + ((t.y - (e.gy - 34)) * 1.3) ** 2 < 32 ** 2) {
          t.life = 0; e.flash = 0.08; AU.splat(); S.splats.push({ x: t.x, y: t.y, t: 0 }); fx('impB', t.x, t.y, { sc: 0.5, speed: 30 });
          if (e.shrug++ === 0) popup("It doesn't even notice.", e.x, e.gy - 86, '#c2bba8');
        }
      }
    }
    if (S.cd > 0) S.cd -= dt;
    if (G.iframes > 0) G.iframes -= dt;
    if (G.shake > 0) G.shake -= dt;
    const P = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    let slot = 0;
    for (const e of S.enemies) if (e.type === 'shroom' && e.alert > 0 && !e.dead) e.slot = slot++;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - b.x) > 760 || Math.abs(e.y - b.y) > 520) continue;      // rivals that are far away just sleep
      if (elderActive() && !S.elder.hunt) { if (e.type === 'shroom') { e.vx = 0; e.alert = 0; } continue; }   // everything freezes while the elder is out
      if (fleeing()) flee(e, dt, P);
      else if (e.type === 'shroom') updateShroom(e, dt, P); else if (e.type === 'drift') updateDrift(e, dt, P);
      else if (e.type === 'bloater') updateBloater(e, dt, P); else if (e.type === 'mite') updateMite(e, dt, P);
      else if (e.type === 'lancer') updateLancer(e, dt, P); else updateWorm(e, dt, P);
      if (e.dead) continue;
      // touching: stomp from above, otherwise it hurts (u cant touch a worm thats hiding)
      const h = hitbox(e); if (!h) continue;
      const dx = b.x - h.x, dy = b.y - h.y;
      if (dx * dx + dy * dy < (h.r + PHYS_R) ** 2 && G.phase === 'play') {
        if (b.vy > 60 && dy < -h.r * 0.3) {
          b.vy = -300; b.coyote = 0; b.slings = Math.max(b.slings || 0, 1);                 // bounce back, sling refilled
          AU.stomp(); fx('sparkB', b.x, b.y + 4, { sc: 0.8 }); fx('hitDir', b.x, b.y + 6, { sc: 0.6, rot: Math.PI / 2, speed: 30 }); damage(e, 1, 0, -60);
          e.sq = 1;
        } else if ((e.type !== 'worm' || e.state === 'strike') && !fleeing()) {
          if (hurtPlayer(e.type === 'drift' ? 6 : (e.dmg || 10), h.x, h.y)) {
            if (e.type === 'mite') { e.vx = -Math.sign(dx) * 90; e.vy = -120; e.cd = 0.6; }
            if (e.type === 'bloater' && e.state !== 'swell') { e.state = 'swell'; e.st = SWELL_T * 0.5; }
            if (R.thorns) damage(e, 1, -Math.sign(dx) * 120, -120);
            if (e.type === 'shroom') { e.recoil = 0.7; e.dir = Math.sign(dx) || 1; e.vx = -e.dir * 120; e.vy = -150; }
          }
        }
      }
    }
    for (const e of S.enemies) if (!e.dead && (e.type === 'shroom' || e.type === 'bloater' || e.type === 'mite') && e.y > (e.maxY = Math.min(e.maxY ?? e.y, e.y)) + 700) { e.dead = true; S.stats.fell++; }
    S.enemies = S.enemies.filter(e => !e.dead);
    // toxin blasts
    for (const t of S.toxins) {
      t.life -= dt; t.vy += 140 * dt; t.x += t.vx * dt; t.y += t.vy * dt;
      t.trail.push([t.x, t.y]); if (t.trail.length > 6) t.trail.shift();
      for (const e of S.enemies) {
        const h = !e.dead && t.life > 0 && hitbox(e); if (!h) continue;
        if ((t.x - h.x) ** 2 + (t.y - h.y) ** 2 < (h.r + 2) ** 2) {
          t.life = 0; const d = Math.sign(t.vx) || 1;
          damage(e, t.dmg, d * 150, -110); AU.splat(); S.splats.push({ x: t.x, y: t.y, t: 0 });
          fx('splatG', t.x, t.y, { sc: 0.55, speed: 30 }); VX.sparkBurst(t.x, t.y, 6, { col: '#b6ff5a', speed: 150, life: 0.25 });
          burst(t.x, t.y, 8, { color: ['#b6ff5a', '#f0ffb0', '#6fbf3a'], speed: 90, life: 0.45 });
        }
      }
      for (const s of S.shots) if (t.life > 0 && s.life > 0 && (t.x - s.x) ** 2 + (t.y - s.y) ** 2 < (s.r + 4) ** 2) {   // shoot spores out of the air
        t.life = 0; s.life = 0; AU.splat(); fx('orbPop', s.x, s.y, { sc: 0.4, speed: 34 }); burst(s.x, s.y, 8, { color: [GLOW2, '#b6ff5a'], speed: 80, life: 0.4 });
      }
      if (t.life > 0 && solidAt(t.x, t.y)) {
        t.life = 0; AU.splat(); S.splats.push({ x: t.x, y: t.y - 2, t: 0 }); burst(t.x, t.y - 2, 7, { color: ['#b6ff5a', '#6fbf3a'], speed: 70, life: 0.4 });
        S.clouds.push({ x: t.x - Math.sign(t.vx) * 3, y: t.y - 6, t: 0, life: 1.3, dmg: t.dmg * 0.5, hit: new Set() });
        fx('poisonG', t.x - Math.sign(t.vx) * 3, t.y - 14, { sc: 0.45, speed: 14 });
      }
    }
    S.toxins = S.toxins.filter(t => t.life > 0);
    // toxin clouds that hang around (good vs driftcaps that keep dodging)
    for (const c of S.clouds) {
      c.t += dt;
      for (const e of S.enemies) {
        const h = !e.dead && !c.hit.has(e) && hitbox(e); if (!h) continue;
        if ((c.x - h.x) ** 2 + (c.y - h.y) ** 2 < 16 * 16) { c.hit.add(e); damage(e, c.dmg, 0, -40); }
      }
    }
    S.clouds = S.clouds.filter(c => c.t < c.life);
    // bloater bursts: the puff spreads fast, hurts you once, and can set off other rivals (and bloaters)
    for (const p of S.pops) {
      p.t += dt; const R0 = p.r * Math.min(1, p.t / 0.25);
      if (p.t < 0.45) {
        if (!p.hitP && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (R0 + PHYS_R) ** 2) { p.hitP = true; hurtPlayer(12, p.x, p.y); }
        for (const e of S.enemies) {
          const h = !e.dead && !p.hit.has(e) && hitbox(e); if (!h) continue;
          if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (R0 + h.r) ** 2) { p.hit.add(e); damage(e, 2, Math.sign(h.x - p.x) * 160, -140); }
        }
      }
    }
    S.pops = S.pops.filter(p => p.t < p.life);
    // spores and the elders glowing orbs
    for (const s of S.shots) {
      s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.trail.push([s.x, s.y]); if (s.trail.length > 5) s.trail.shift();
      if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 < (PHYS_R + s.r) ** 2) { s.life = 0; if (hurtPlayer(s.dmg, s.x, s.y)) fx('orbPop', s.x, s.y, { sc: 0.4, speed: 34 }); }
      else if (solidAt(s.x, s.y) || waterAt(s.x, s.y)) { s.life = 0; fx('orbPop', s.x, s.y - 2, { sc: 0.35, speed: 34 }); VX.sparkBurst(s.x, s.y - 2, 4, { col: GLOW2, speed: 110, life: 0.22 }); burst(s.x, s.y - 2, 5, { color: [GLOW, GLOW2], speed: 50, life: 0.35 }); }
    }
    S.shots = S.shots.filter(s => s.life > 0);
    // the elders shockwaves, jump over them
    for (const w of S.waves) {
      w.life -= dt; const nx = w.x + w.dir * 150 * dt;
      const gy = groundBelow(nx, w.gy - 24);
      if (gy == null || Math.abs(gy - w.gy) > 18) { w.life = 0; continue; }
      w.x = nx; w.gy = gy; w.step += 150 * dt;
      if (w.step > 11) { w.step = 0; fx('slamUp', w.x, w.gy - 10, { sc: 0.55, speed: 28 }); VX.sparkBurst(w.x, w.gy - 2, 3, { angle: -Math.PI / 2, spread: 1, speed: 160, g: 600, col: GLOW2, life: 0.3 }); burst(w.x, w.gy - 1, 2, { color: [GLOW2, '#75352f'], speed: 70, life: 0.4, g: 400, angle: -Math.PI / 2, spread: 1 }); }
      if (!w.hit && Math.abs(b.x - w.x) < 9 && b.y > w.gy - 16 && b.y < w.gy + 4) { w.hit = true; hurtPlayer(8, w.x, w.gy); }
    }
    S.waves = S.waves.filter(w => w.life > 0);
    fxTick(dt);
  }
  /* effects stuff. also runs while ur down so the elder moment can play out */
  function fxTick(dt) {
    for (const sp of S.splats) sp.t += dt;
    for (const k of S.corpses) {
      k.t += dt;
      if (k.fly) { k.vy += 300 * dt; k.y += k.vy * dt; if (solidAt(k.x, k.y + 6)) { k.y = Math.floor((k.y + 6) / TS) * TS - 6; k.vy = 0; k.fly = false; } }
    }
    S.corpses = S.corpses.filter(k => k.t < 1.1);
    S.splats = S.splats.filter(sp => sp.t < 0.3);
    for (const m of S.motes) { m.t += dt; m.x += m.vx * dt + Math.sin(m.t * 3 + m.y) * 0.1; m.y += m.vy * dt; }
    S.motes = S.motes.filter(m => m.t < m.life);
    for (const r of rings) r.r += r.speed * dt * (1 - r.r / r.max * 0.6);
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].r >= rings[i].max) rings.splice(i, 1);
    G.dark = (G.dark || 0) + ((G.darkT || 0) - (G.dark || 0)) * Math.min(1, dt * (G.darkT ? 1.6 : 0.7));
  }
  const PHYS_R = A.PHYS.R;

  /* drawing */
  function px(c, x, y, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
  /* pixel disc made of scanlines (crisp, no blurry edges) */
  function disc(c, cx, cy, r, flat = 1) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -Math.floor(r * flat); y <= Math.floor(r * flat); y++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - (y / flat) * (y / flat))));
      c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }
  /* soft glow in steps, added on top of the scene */
  function glow(c, x, y, r, col, a) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col;
    for (let k = 3; k >= 1; k--) { c.globalAlpha = a * (0.35 + (3 - k) * 0.25) / 3; disc(c, x, y, r * k / 3); }
    c.restore();
  }
  const MAN = window.ENEMY_MANIFEST || {};
  function frame(name, f) {
    const M = MAN[name], img = A.IMG['en_' + name];
    if (!M || !img || !img.width) return null;
    const i = ((Math.floor(f) % M[3]) + M[3]) % M[3];
    return PK.cached('en:' + name + ':' + i, () => {
      const c = document.createElement('canvas'); c.width = M[1]; c.height = M[2];
      c.getContext('2d').drawImage(img, i * M[1], 0, M[1], M[2], 0, 0, M[1], M[2]); return c;
    });
  }
  const white = spr => PK.cached(spr, () => {            // white version of a frame for the hit flash
    const c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height;
    const x = c.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); return c;
  });
  /* draws frame f of an animation with its anchor at (x, y) */
  function anim(c, name, f, x, y, face, o = {}) {
    const M = MAN[name]; if (!M) return;
    const spr = frame(name, o.hold ? Math.min(M[3] - 1, f) : f); if (!spr) return;
    const flip = M[6] ? face > 0 : face < 0;
    PK.blit(c, o.flash ? white(spr) : spr, M[4], M[5], x, y, flip, o.sc || 1, o.alpha ?? 1);
  }
  function hpPips(c, e, x, y) {
    if (e.hp >= e.max) return;
    const w = Math.round(e.max * 3); x = Math.round(x - w / 2);
    c.fillStyle = '#0b1a1c'; c.fillRect(x - 1, Math.round(y) - 1, w + 2, 3);
    c.fillStyle = '#ff6a5a'; c.fillRect(x, Math.round(y), Math.max(0, Math.round(w * e.hp / e.max)), 1);
  }
  function drawShroom(c, e, t) {
    const foot = e.y + e.r, fl = e.flash > 0;
    glow(c, e.x, e.y - 12, 16 + (e.charge > 0 ? 8 * (1 - e.charge / 0.42) : 0), CAP, 0.38);
    if (fl) anim(c, 'sh_hurt', 0, e.x, foot, e.face, { flash: true });
    else if (e.charge > 0) anim(c, 'sh_despawn', (1 - e.charge / 0.42) * 3.9, e.x, foot, e.face, { hold: true });       // puffing up to spit
    else if (e.spat > 0) anim(c, 'sh_spawn', 5 + (0.35 - e.spat) * 8, e.x, foot, e.face, { hold: true });
    else if (e.crouch > 0) anim(c, 'sh_despawn', 2, e.x, foot, e.face);
    else if (!e.ground) anim(c, 'sh_spawn', e.vy < 0 ? 5 : 6, e.x, foot, e.face);
    else if (Math.abs(e.vx) > 6) anim(c, 'sh_walk', e.t * 10, e.x, foot, e.face);
    else anim(c, 'sh_walk', Math.floor(e.t * 3) % 2 ? 0 : 3, e.x, foot, e.face);
    hpPips(c, e, e.x, e.y - 22);
  }
  function drawDrift(c, e, t) {
    glow(c, e.x, e.y - 2, 20 + (e.charge > 0 ? 10 * (1 - e.charge / 0.5) : 0), CAP, 0.4);
    if (e.ghost) anim(c, 'dc_idle', 0, e.ghost.x, e.ghost.y, e.face, { alpha: e.ghost.t / 0.3 * 0.4 });
    if (e.flash > 0) anim(c, 'dc_hit', 0, e.x, e.y, e.face, { flash: true });
    else if (e.charge > 0) anim(c, 'dc_attack', (1 - e.charge / 0.5) * 3.9, e.x, e.y, e.face, { hold: true });
    else if (e.fire > 0) anim(c, 'dc_attack', 4 + (0.5 - e.fire) * 8, e.x, e.y, e.face, { hold: true });
    else anim(c, 'dc_idle', e.t * (e.state === 'dormant' ? 6 : 9), e.x, e.y, e.face);
    hpPips(c, e, e.x, e.y - 16);
  }
  function drawWorm(c, e, t) {
    const T = WORM_T, fl = e.flash > 0, o = { flash: fl };
    if (e.state !== 'lurk') glow(c, e.x, e.gy - 16, 14, CAP, 0.3);
    if (e.state === 'lurk') anim(c, 'wm_lurk', e.t * 4, e.x, e.gy, e.face);
    else if (e.state === 'emerge') anim(c, 'wm_emerge', e.st / T.emerge * 6, e.x, e.gy, e.face, { hold: true, flash: fl });
    else if (e.state === 'strike') anim(c, 'wm_strike', e.st / T.strike * 8, e.x, e.gy, e.face, { hold: true, flash: fl });
    else if (e.state === 'burrow') anim(c, 'wm_burrow', e.st / T.burrow * 6, e.x, e.gy, e.face, { hold: true });
    else if (e.state === 'hit') anim(c, 'wm_hit', 0, e.x, e.gy, e.face, o);
    else anim(c, 'wm_idle', e.t * 8, e.x, e.gy, e.face, o);
    if (e.state !== 'lurk') hpPips(c, e, e.x, e.gy - 32);
  }
  function drawElder(c, t) {
    const e = S.elder; if (!e) return;
    const T = EL_T, o = { flash: e.flash > 0, hold: true };
    glow(c, e.x, e.gy - 40, 46, CAP, 0.8);
    let name = 'el_idle', f = e.t * 9; o.hold = false;
    if (e.state === 'rise') { name = 'el_rise'; f = e.t / T.rise * 8; o.hold = true; }
    else if (e.state === 'roar') { name = 'el_roar'; f = e.t / T.roar * 8; o.hold = true; }
    else if (e.state === 'volley' || e.state === 'fan') { name = 'el_volley'; f = e.t / T.volley * 6; o.hold = true; }
    else if (e.state === 'slam') { name = 'el_slam'; f = e.t / T.slam * 8; o.hold = true; }
    else if (e.state === 'engulf') { name = 'el_engulf'; f = e.t / T.engulf * 6; o.hold = true; }
    else if (e.state === 'sated') { name = 'el_sink'; f = e.t / T.sink * 6; o.hold = true; }
    anim(c, name, f, e.x, e.gy, e.face, o);
  }
  function drawBloater(c, e, t) {
    const foot = e.y + e.r, fl = e.flash > 0, sw = e.state === 'swell' ? e.st / SWELL_T : 0;
    glow(c, e.x, e.y - 6, 18 + sw * 14, '#a8562f', 0.4 + sw * 0.3);
    if (fl) anim(c, 'bl_hit', 0, e.x, foot, e.face, { flash: true });
    else if (sw) anim(c, 'bl_swell', sw * 5.9, e.x, foot, e.face, { hold: true, flash: sw > 0.7 && Math.floor(e.t * 20) % 2 === 0 });
    else if (Math.abs(e.vx) > 4) anim(c, 'bl_walk', e.t * 8, e.x, foot, e.face);
    else anim(c, 'bl_walk', Math.floor(e.t * 2) % 2 ? 0 : 3, e.x, foot, e.face);
    hpPips(c, e, e.x, e.y - 24);
  }
  function drawMite(c, e, t) {
    const foot = e.y + e.r;
    glow(c, e.x, e.y - 1, 7, '#7a4fb0', 0.35);
    if (e.flash > 0) anim(c, 'mt_idle', 0, e.x, foot, e.face, { flash: true });
    else if (!e.ground) anim(c, 'mt_hop', e.vy < -60 ? 1 : e.vy < 60 ? 2 : 3, e.x, foot, e.face);
    else anim(c, 'mt_idle', e.t * 8, e.x, foot, e.face);
  }
  function drawLancer(c, e, t) {
    const fl = e.flash > 0, mx = e.x, my = e.gy - 40;
    const k = e.state === 'charge' ? Math.min(1, e.st / LANCE_T) : 0;
    glow(c, e.x, e.gy - 30, 16 + k * 10, '#3f9a74', 0.38 + k * 0.3);
    if (e.aim) {                                    // the aim line: faint while it tracks you, bright and blinking once it locks
      const locked = e.st > LANCE_T - LANCE_LOCK, ax = e.aim.x - mx, ay = e.aim.y - my, L = Math.hypot(ax, ay) || 1;
      const len = Math.min(340, L + 120), n = Math.floor(len / 3);
      c.fillStyle = locked ? (Math.floor(t * 24) % 2 ? '#d4ffe8' : '#8ff0c0') : '#8ff0c0';
      for (let i = 2; i < n; i++) {
        const x = mx + ax / L * i * 3, y = my + ay / L * i * 3;
        if (solidAt(x, y)) break;
        if (!locked && i % 2) continue;
        c.globalAlpha = (locked ? 0.85 : 0.25 + k * 0.3) * (1 - i / n * 0.6); c.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      c.globalAlpha = 1;
    }
    if (fl) anim(c, 'ln_hit', 0, e.x, e.gy, e.face, { flash: true });
    else if (e.state === 'charge') anim(c, 'ln_charge', k * 5.9, e.x, e.gy, e.face, { hold: true });
    else if (e.state === 'fire') anim(c, 'ln_fire', e.st / 0.4 * 3.9, e.x, e.gy, e.face, { hold: true });
    else anim(c, 'ln_idle', e.t * 6, e.x, e.gy, e.face);
    hpPips(c, e, e.x, e.gy - 50);
  }
  function drawCorpses(c) {
    for (const k of S.corpses) {
      const M = MAN[k.anim]; if (!M) continue;
      const f = Math.min(M[3] - 1, k.t * 10), a = k.t < 0.7 ? 1 : 1 - (k.t - 0.7) / 0.4;
      anim(c, k.anim, f, k.x, k.y, k.face, { alpha: Math.max(0, a), flash: k.t < 0.06 });
    }
  }
  /* every light in the scene (for the elders darkness) */
  function lights() {
    const L = [];
    if (S.elder) L.push({ x: S.elder.x, y: S.elder.gy - 40, r: 112 + Math.sin(G.time * 3) * 3 });
    for (const s of S.shots) L.push({ x: s.x, y: s.y, r: s.kind === 'orb' ? 13 : 9, p: 0.55 });
    for (const t of S.toxins) L.push({ x: t.x, y: t.y, r: 12, p: 0.55, warm: 1 });
    for (const e of S.enemies) L.push({ x: e.x, y: e.type === 'worm' ? e.gy - 14 : e.type === 'lancer' ? e.gy - 32 : e.type === 'mite' ? e.y : e.y - 8, r: e.type === 'mite' ? 12 : 30, p: 0.7 });
    for (const p of S.pops) L.push({ x: p.x, y: p.y, r: 40 * (1 - p.t / p.life), p: 0.8, warm: 1 });
    for (const w of S.waves) L.push({ x: w.x, y: w.gy - 8, r: 22, p: 0.7 });
    return L;
  }
  function draw(c, t) {
    const cam = G.cam;
    drawCorpses(c);
    drawElder(c, t);
    for (const e of S.enemies) {
      if (e.dead || Math.abs(e.x - cam.x - 320) > 380 || Math.abs(e.y - cam.y - 200) > 260) continue;
      if (e.type === 'shroom') drawShroom(c, e, t); else if (e.type === 'drift') drawDrift(c, e, t);
      else if (e.type === 'bloater') drawBloater(c, e, t); else if (e.type === 'mite') drawMite(c, e, t);
      else if (e.type === 'lancer') drawLancer(c, e, t); else drawWorm(c, e, t);
    }
    for (const m of S.motes) { c.globalAlpha = Math.min(1, (m.life - m.t) * 2) * 0.8; px(c, m.x, m.y, m.t % 0.4 < 0.2 ? (m.col ? m.col[1] : GLOW2) : (m.col ? m.col[0] : GLOW)); }
    c.globalAlpha = 1;
    for (const cl of S.clouds) {
      const k = cl.t / cl.life;
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + cl.t * 1.5, r = 4 + (i % 5) * 2.2 + k * 4;
        c.globalAlpha = 0.5 * (1 - k); px(c, cl.x + Math.cos(a) * r, cl.y + Math.sin(a) * r * 0.6, i % 3 ? '#b6ff5a' : '#e8ffb0');
      }
      c.globalAlpha = 1;
    }
    for (const p of S.pops) {                       // a bloater's burst: an amber puff ring that thins out
      const k = p.t / p.life, R0 = p.r * Math.min(1, p.t / 0.25);
      for (let i = 0; i < 30; i++) {
        const a = i / 30 * Math.PI * 2 + i * 0.7, r = R0 * (0.55 + (i % 4) * 0.15);
        c.globalAlpha = 0.75 * (1 - k); px(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, i % 3 ? '#ffb35c' : '#ffe2a8');
      }
      if (p.t < 0.12) { c.globalAlpha = 1 - p.t / 0.12; glow(c, p.x, p.y, 20, '#ffb35c', 0.9); }
      c.globalAlpha = 1;
    }
    for (const sp of S.splats) {
      const k = sp.t / 0.3, r = 2 + k * 7;
      c.globalAlpha = 1 - k;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; px(c, sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r * 0.8, i % 2 ? '#b6ff5a' : '#f0ffb0'); }
      if (k < 0.4) { c.fillStyle = '#e8ffb0'; c.fillRect(Math.round(sp.x) - 1, Math.round(sp.y) - 1, 3, 3); }
      c.globalAlpha = 1;
    }
    for (const s of S.shots) {                      // glowy spores: bright core, blue halo, short trail
      if (s.kind === 'lance') {                     // the lancer's shot: a hard jade streak
        const L = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / L, uy = s.vy / L;
        glow(c, s.x, s.y, 6, '#3f9a74', 0.9);
        for (let i = 0; i < 9; i++) { c.globalAlpha = 1 - i / 9; px(c, s.x - ux * i, s.y - uy * i, i < 2 ? '#f0fff6' : i < 5 ? '#d4ffe8' : '#8ff0c0'); }
        c.globalAlpha = 1; continue;
      }
      s.trail.forEach(([x, y], i) => { c.globalAlpha = (i + 1) / s.trail.length * 0.45; px(c, x, y, GLOW); });
      c.globalAlpha = 1;
      glow(c, s.x, s.y, s.kind === 'orb' ? 7 : 5, '#6f8be0', 0.9);
      const x = Math.round(s.x), y = Math.round(s.y);
      c.fillStyle = s.kind === 'orb' ? GLOW : CAP; c.fillRect(x - 1, y - 2, 3, 5); c.fillRect(x - 2, y - 1, 5, 3);
      c.fillStyle = GLOW2; c.fillRect(x - 1, y - 1, 3, 3); px(c, x, y - 1, EYE); px(c, x - 1, y - 1, EYE);
    }
    for (const r of rings) {                        // shockwave rings: thin bright pixel circle that fades as it grows
      const k = r.r / r.max; c.globalAlpha = (1 - k) * 0.9; c.fillStyle = r.col;
      const n = Math.max(16, Math.floor(r.r * 1.6));
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y + Math.sin(a) * r.r * r.flat), 1, 1); }
    }
    c.globalAlpha = 1;
    for (const tx of S.toxins) {
      tx.trail.forEach(([x, y], i) => { c.globalAlpha = (i + 1) / tx.trail.length * 0.6; px(c, x, y, '#8fdc4a'); });
      c.globalAlpha = 1; c.fillStyle = '#3f7a22'; c.fillRect(Math.round(tx.x) - 2, Math.round(tx.y) - 2, 4, 4);
      c.fillStyle = '#b6ff5a'; c.fillRect(Math.round(tx.x) - 1, Math.round(tx.y) - 1, 3, 3); px(c, tx.x - 1, tx.y - 1, '#f0ffb0');
    }
  }
  /* the aim reticle at the mouse (world coords), the ring shows the blast cooldown */
  function drawReticle(c, x, y, t) {
    const ready = S.cd <= 0, col = ready ? '#d8ff9a' : '#7f9a6a';
    c.globalAlpha = 0.85;
    for (const [dx, dy] of [[-4, 0], [-3, 0], [3, 0], [4, 0], [0, -4], [0, -3], [0, 3], [0, 4]]) px(c, x + dx, y + dy, col);
    px(c, x, y, col);
    if (!ready) { const k = 1 - S.cd / G.run.toxCd; for (let i = 0; i < 12 * k; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI * 2; px(c, x + Math.cos(a) * 6, y + Math.sin(a) * 6, '#b6ff5a'); } }
    c.globalAlpha = 1;
  }

  const elderActive = () => !!S.elder && S.elder.state !== 'sated';
  const stalking = () => !!S.stalk && S.stalk.state === 'stalk';
  return { anim, S, reset, update, fxTick, updateElder, drawElder, elderActive, stalking, noteLoss, draw, drawReticle, blast, autoBlast, hurtPlayer, damage, makeShroom, makeDrift, makeWorm, makeBloater, makeMite, makeLancer, simLeap, lights, disc };
};
})();
