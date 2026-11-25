/* sporebound: the rivals and the toxin blast */
(function () {
'use strict';
window.makeCombat = function (A) {
  const { G, fx, burst, popup, AU, TS, MEM } = A;
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
    return { x: e.x, y: e.y, r: e.r };
  }

  /* state */
  const S = { corpses: [], stats: { leaps: 0, drowned: 0, fell: 0, volleys: 0, ducks: 0, dodges: 0, hits: 0, ambushes: 0, strikes: 0, spits: 0, drops: 0 },
    enemies: [], shots: [], toxins: [], clouds: [], splats: [], motes: [], killed: new Set(), seen: new Set(), cd: 0, kills: 0 };
  function reset() {
    S.corpses = []; S.enemies = []; S.shots = []; S.toxins = []; S.clouds = []; S.splats = []; S.motes = [];
    S.killed = new Set(); S.seen = new Set(); S.cd = 0; rings.length = 0;
    G.iframes = 0; G.shake = 0; G.flashA = 0; G.hitstop = 0;
  }
  function spawnFromQueue() {
    const q = W().spawnQ; if (!q || !q.length) return;
    for (const d of q.splice(0)) {
      if (S.killed.has(d.id) || S.seen.has(d.id)) continue;
      S.seen.add(d.id);
      if (d.type === 'shroom') S.enemies.push(makeShroom(d.x, d.y, d.id));
    }
  }
  function makeShroom(x, y, id) {
    return { type: 'shroom', spd: 1, dmg: 10, id, x, y: y + 7 - 7, vx: 0, vy: 0, r: 7, hp: 3, max: 3,
      state: 'wander', dir: rnd() < 0.5 ? -1 : 1, think: rnd() * 0.2, alert: 0, lx: x, ly: y, leapCd: 0.5, lungeCd: 0, spitCd: 1.5 + rnd(), charge: 0, crouch: 0, plan: null,
      dodgeCd: 0, recoil: 0, flash: 0, t: rnd() * 9, pause: 0, ground: false, wall: 0, sq: 0, slot: 0, face: 1 };
  }
  /* stuff that touches the player */
  function hurtPlayer(dmg, fx0, fy0) {
    if (G.phase !== 'play' || G.iframes > 0) return false;
    const R = G.run, b = G.ball;
    R.dnaLag = Math.max(R.dnaLag, R.dnaShown);
    R.dna = Math.max(0, R.dna - dmg);
    G.iframes = 1.0; shake(0.24); hitstop(0.06); flash(0.18, '#ffd0d0');
    const d = Math.sign(b.x - fx0) || 1;
    b.vx = d * 170; b.vy = Math.min(b.vy, -190); b.coyote = 0;
    AU.ouch(); AU.dnaLoss();
    popup(`-${Math.round(dmg)} DNA`, b.x, b.y - 16, '#ffb0b0');
    burst(b.x, b.y, 8, { color: ['#ffb0b0', '#fff2cc'], speed: 90, life: 0.4 });
    S.stats.hits++;
    if (R.dna <= 0) { R.spores++; G.roomSpores++; G.phase = 'dead'; G.phaseT = 0.45; G.padGrown = true; }
    return true;
  }
  function damage(e, dmg, kx, ky) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 0.15; e.sq = 1;
    const h = hitbox(e) || e;
    hitstop(0.035);
    if (e.type === 'shroom') { e.vx += kx; e.vy = Math.min(e.vy, ky); e.alert = 4; e.lx = G.ball.x; e.ly = G.ball.y; e.charge = 0; }
    AU.rivalHurt();
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true; S.kills++; G.kills = S.kills;
    S.killed.add(e.id);
    AU.rivalDie(); shake(0.14); hitstop(0.07);
    const h = hitbox(e) || { x: e.x, y: e.y };
    ring(h.x, h.y, 22, { speed: 140 });
    burst(h.x, h.y, 16, { color: [GLOW, GLOW2, CAP, EYE], speed: 120, life: 0.7, g: 120 });
    for (let i = 0; i < 6; i++) S.motes.push({ x: h.x + (rnd() - 0.5) * 12, y: h.y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 20, vy: -12 - rnd() * 18, t: 0, life: 1.4 + rnd() });
    S.corpses.push({ anim: 'sh_die', x: e.x, y: e.y + e.r, face: e.face || 1, t: 0, vy: 0, fly: false });
    const R = G.run;
    if (R.devour) { const hh = Math.min(R.dnaMax - R.dna, 8); if (hh > 0) { R.dna += hh; popup(`+${hh} DNA`, h.x, h.y - 20, '#d8ffd0'); } }
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
        if (sol) { spore(mx, my, sol.vx, sol.vy, { dmg: 8 }); AU.puff(); e.sq = 1; S.stats.spits++; e.spat = 0.35; }
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

  /* main update */
  function update(dt) {
    const b = G.ball, R = G.run;
    spawnFromQueue();
    if (S.cd > 0) S.cd -= dt;
    if (G.iframes > 0) G.iframes -= dt;
    if (G.shake > 0) G.shake -= dt;
    const P = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    let slot = 0;
    for (const e of S.enemies) if (e.type === 'shroom' && e.alert > 0 && !e.dead) e.slot = slot++;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - b.x) > 760 || Math.abs(e.y - b.y) > 520) continue;      // rivals that are far away just sleep
      updateShroom(e, dt, P);
      if (e.dead) continue;
      // touching: stomp from above, otherwise it hurts
      const h = hitbox(e); if (!h) continue;
      const dx = b.x - h.x, dy = b.y - h.y;
      if (dx * dx + dy * dy < (h.r + PHYS_R) ** 2 && G.phase === 'play') {
        if (b.vy > 60 && dy < -h.r * 0.3) {
          b.vy = -300; b.coyote = 0; b.slings = Math.max(b.slings || 0, 1);                 // bounce back, sling refilled
          AU.stomp(); fx('sparkB', b.x, b.y + 4, { sc: 0.8 }); damage(e, 1, 0, -60);
          e.sq = 1;
        } else {
          if (hurtPlayer(e.dmg || 10, h.x, h.y)) {
            if (R.thorns) damage(e, 1, -Math.sign(dx) * 120, -120);
            if (e.type === 'shroom') { e.recoil = 0.7; e.dir = Math.sign(dx) || 1; e.vx = -e.dir * 120; e.vy = -150; }
          }
        }
      }
    }
    for (const e of S.enemies) if (!e.dead && e.type === 'shroom' && e.y > (e.maxY = Math.min(e.maxY ?? e.y, e.y)) + 700) { e.dead = true; S.stats.fell++; }
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
          burst(t.x, t.y, 8, { color: ['#b6ff5a', '#f0ffb0', '#6fbf3a'], speed: 90, life: 0.45 });
        }
      }
      for (const s of S.shots) if (t.life > 0 && s.life > 0 && (t.x - s.x) ** 2 + (t.y - s.y) ** 2 < (s.r + 4) ** 2) {   // shoot spores out of the air
        t.life = 0; s.life = 0; AU.splat(); burst(s.x, s.y, 8, { color: [GLOW2, '#b6ff5a'], speed: 80, life: 0.4 });
      }
      if (t.life > 0 && solidAt(t.x, t.y)) {
        t.life = 0; AU.splat(); S.splats.push({ x: t.x, y: t.y - 2, t: 0 }); burst(t.x, t.y - 2, 7, { color: ['#b6ff5a', '#6fbf3a'], speed: 70, life: 0.4 });
        S.clouds.push({ x: t.x - Math.sign(t.vx) * 3, y: t.y - 6, t: 0, life: 1.3, dmg: t.dmg * 0.5, hit: new Set() });
      }
    }
    S.toxins = S.toxins.filter(t => t.life > 0);
    // toxin clouds that hang around
    for (const c of S.clouds) {
      c.t += dt;
      for (const e of S.enemies) {
        const h = !e.dead && !c.hit.has(e) && hitbox(e); if (!h) continue;
        if ((c.x - h.x) ** 2 + (c.y - h.y) ** 2 < 16 * 16) { c.hit.add(e); damage(e, c.dmg, 0, -40); }
      }
    }
    S.clouds = S.clouds.filter(c => c.t < c.life);
    // spores
    for (const s of S.shots) {
      s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.trail.push([s.x, s.y]); if (s.trail.length > 5) s.trail.shift();
      if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 < (PHYS_R + s.r) ** 2) { s.life = 0; hurtPlayer(s.dmg, s.x, s.y); }
      else if (solidAt(s.x, s.y) || waterAt(s.x, s.y)) { s.life = 0; burst(s.x, s.y - 2, 5, { color: [GLOW, GLOW2], speed: 50, life: 0.35 }); }
    }
    S.shots = S.shots.filter(s => s.life > 0);
    fxTick(dt);
  }
  /* effects stuff. also runs while ur down */
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
  function drawCorpses(c) {
    for (const k of S.corpses) {
      const M = MAN[k.anim]; if (!M) continue;
      const f = Math.min(M[3] - 1, k.t * 10), a = k.t < 0.7 ? 1 : 1 - (k.t - 0.7) / 0.4;
      anim(c, k.anim, f, k.x, k.y, k.face, { alpha: Math.max(0, a), flash: k.t < 0.06 });
    }
  }
  function draw(c, t) {
    const cam = G.cam;
    drawCorpses(c);
    for (const e of S.enemies) {
      if (e.dead || Math.abs(e.x - cam.x - 320) > 380 || Math.abs(e.y - cam.y - 200) > 260) continue;
      drawShroom(c, e, t);
    }
    for (const m of S.motes) { c.globalAlpha = Math.min(1, (m.life - m.t) * 2) * 0.8; px(c, m.x, m.y, m.t % 0.4 < 0.2 ? GLOW2 : GLOW); }
    c.globalAlpha = 1;
    for (const cl of S.clouds) {
      const k = cl.t / cl.life;
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + cl.t * 1.5, r = 4 + (i % 5) * 2.2 + k * 4;
        c.globalAlpha = 0.5 * (1 - k); px(c, cl.x + Math.cos(a) * r, cl.y + Math.sin(a) * r * 0.6, i % 3 ? '#b6ff5a' : '#e8ffb0');
      }
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

  return { anim, S, reset, update, fxTick, draw, drawReticle, blast, autoBlast, hurtPlayer, damage, makeShroom, simLeap };
};
})();
