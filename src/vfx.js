/* sporebound: the visual effects */
(function () {
'use strict';
window.makeVFX = function (V) {
  let G = V.G; const { VW, VH } = V;
  const ctx = () => V.ctx;

  /* scanline pixel disc (crisp, no blurry edges) */
  function disc(c, cx, cy, r, flat = 1) {
    cx = Math.round(cx); cy = Math.round(cy);
    const ry = Math.floor(r * flat);
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - (y / flat) * (y / flat))));
      c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }

  /* sparks */
  const sparks = [];
  function spark(x, y, a, speed, o = {}) {
    sparks.push({ x, y, a, s: speed, life: o.life || 0.4, max: o.life || 0.4, col: o.col || '#ffffff', core: o.core || '#ffffff',
      g: o.g ?? 0, curve: o.curve || 0, len: o.len || 0.045, drag: o.drag ?? 3.2, glow: o.glow ?? true });
  }
  /* n sparks around `angle` (default is every direction) */
  function sparkBurst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (o.angle == null ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * (o.spread ?? 1));
      spark(x, y, a, (o.speed || 160) * (0.5 + Math.random() * 0.7), { ...o, life: (o.life || 0.35) * (0.6 + Math.random() * 0.6), curve: (Math.random() - 0.5) * (o.curve || 0) });
    }
  }
  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt; if (p.life <= 0 || p.s < 6) { sparks.splice(i, 1); continue; }
      let vx = Math.cos(p.a) * p.s, vy = Math.sin(p.a) * p.s;
      vy += p.g * dt; p.a = Math.atan2(vy, vx) + p.curve * dt; p.s = Math.hypot(vx, vy) * Math.exp(-p.drag * dt);
      p.x += Math.cos(p.a) * p.s * dt; p.y += Math.sin(p.a) * p.s * dt;
    }
  }
  function drawSparks(c) {
    for (const p of sparks) {
      const k = p.life / p.max, L = Math.max(1, Math.min(14, p.s * p.len * (0.5 + k))), dx = Math.cos(p.a), dy = Math.sin(p.a);
      if (p.glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 * k; c.fillStyle = p.col; disc(c, p.x, p.y, 2 + k * 2); c.restore(); }
      c.globalAlpha = Math.min(1, k * 1.6);
      for (let j = 0; j <= L; j++) {
        c.fillStyle = j < 1.5 ? p.core : p.col;
        c.fillRect(Math.round(p.x - dx * j), Math.round(p.y - dy * j), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /* afterimages */
  const ghosts = [];
  function ghost(spr, ax, ay, x, y, a = 0.5, tint = null) { ghosts.push({ spr, ax, ay, x, y, t: 0, a, tint }); }
  function drawGhosts(c, dt) {
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]; g.t += dt; const k = 1 - g.t / 0.28;
      if (k <= 0) { ghosts.splice(i, 1); continue; }
      c.globalAlpha = g.a * k; c.drawImage(g.spr, Math.round(g.x - g.ax), Math.round(g.y - g.ay));
    }
    c.globalAlpha = 1;
  }

  /* landing rings (flat ovals that shoot outward) */
  const rings = [];
  function ring(x, y, max, o = {}) { rings.push({ x, y, r: o.r0 || 2, max, sp: o.speed || 120, col: o.col || '#fff2cc', flat: o.flat ?? 0.32 }); }
  function drawRings(c, dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.r += r.sp * dt * (1 - r.r / r.max * 0.7);
      if (r.r >= r.max) { rings.splice(i, 1); continue; }
      c.globalAlpha = (1 - r.r / r.max) * 0.8; c.fillStyle = r.col;
      const n = Math.max(12, Math.floor(r.r * 1.8));
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; c.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y + Math.sin(a) * r.r * r.flat), 1, 1); }
    }
    c.globalAlpha = 1;
  }

  /* camera shake */
  function kick(amount, dx = 0, dy = 0) { G.trauma = Math.min(1, (G.trauma || 0) + amount); G.kickX = (G.kickX || 0) + dx; G.kickY = (G.kickY || 0) + dy; }
  function cameraOffset(t, dt) {
    G.trauma = Math.max(0, (G.trauma || 0) - dt * 1.6);
    const legacy = G.shake > 0 ? Math.min(1, G.shake / 0.6) : 0, tr = Math.max(G.trauma, legacy * 0.9), m = tr * tr * 10;
    const ox = m * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 97.1 + 2) * 0.4) + (G.kickX || 0);
    const oy = m * (Math.sin(t * 71.7 + 1) * 0.6 + Math.sin(t * 89.3 + 5) * 0.4) + (G.kickY || 0);
    G.kickX = (G.kickX || 0) * Math.exp(-dt * 14); G.kickY = (G.kickY || 0) * Math.exp(-dt * 14);
    return [Math.round(ox), Math.round(oy)];
  }

  /* light */
  const dark = document.createElement('canvas'); dark.width = VW; dark.height = VH;
  const dc = dark.getContext('2d');
  const STEPS = [[1, 0.16], [0.82, 0.16], [0.64, 0.18], [0.47, 0.2], [0.3, 0.24]];
  /* lights: {x, y, r, col, p} in world space. amb: 0..1 how dark. tint: the colour of the dark */
  function drawLight(cx, cy, lights, amb, tint = [8, 7, 15]) {
    const c = ctx(); if (amb < 0.02) return;
    dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, VW, VH);
    dc.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${Math.min(0.94, amb)})`; dc.fillRect(0, 0, VW, VH);
    dc.globalCompositeOperation = 'destination-out';
    const vis = [];
    for (const l of lights) {
      const x = l.x - cx, y = l.y - cy; if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue;
      vis.push([x, y, l]);
      const p = l.p ?? 1;
      for (const [f, a] of STEPS) { dc.fillStyle = `rgba(0,0,0,${a * p})`; disc(dc, x, y, l.r * f, 0.82); }
    }
    c.drawImage(dark, 0, 0);
    // bloom, each light tints the scene its own colour
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, l] of vis) {
      if (!l.col) continue;
      c.fillStyle = l.col;
      const k = (l.p ?? 1) * Math.min(1, amb * 2.2);
      c.globalAlpha = 0.06 * k; disc(c, x, y, l.r * 0.7, 0.82);
      c.globalAlpha = 0.08 * k; disc(c, x, y, l.r * 0.34, 0.82);
    }
    c.restore();
  }

  /* vignette */
  const vig = document.createElement('canvas'); vig.width = VW; vig.height = VH;
  {
    const v = vig.getContext('2d'), img = v.createImageData(VW, VH), d = img.data;
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const u = (x - VW / 2) / (VW / 2), w = (y - VH / 2) / (VH / 2), r = Math.sqrt(u * u * 0.8 + w * w);
      const a = Math.max(0, r - 0.8) / 0.55, B = [[0, 8], [12, 4]][y % 2][x % 2] / 16;      // smooth falloff with ordered dither so it stays pixel crisp
      const lv = Math.min(8, Math.floor(a * 8 + B));
      const k = (y * VW + x) * 4; d[k] = 6; d[k + 1] = 5; d[k + 2] = 12; d[k + 3] = lv * 17;
    }
    v.putImageData(img, 0, 0);
  }
  function drawVignette(a = 1) { const c = ctx(); c.globalAlpha = a; c.drawImage(vig, 0, 0); c.globalAlpha = 1; }

  /* iris wipe between levels */
  function iris(dir, x, y, dur = 0.55, done = null) { G.iris = { dir, x, y, t: 0, dur, done }; }
  function drawIris(dt) {
    const I = G.iris; if (!I) return;
    I.t += dt; let k = Math.min(1, I.t / I.dur); k = k * k * (3 - 2 * k);
    const R = Math.hypot(VW, VH), r = I.dir < 0 ? R * (1 - k) : R * k;           // -1 closes, +1 opens
    const c = ctx();
    dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, VW, VH); dc.fillStyle = '#07060d'; dc.fillRect(0, 0, VW, VH);
    dc.globalCompositeOperation = 'destination-out'; dc.fillStyle = '#000'; if (r > 0.5) disc(dc, I.x, I.y, r);
    c.drawImage(dark, 0, 0);
    // thin glowy edge on the iris
    if (r > 2 && r < R) { c.globalAlpha = 0.6; c.fillStyle = '#fff2cc'; const n = Math.floor(r * 2); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; c.fillRect(Math.round(I.x + Math.cos(a) * r), Math.round(I.y + Math.sin(a) * r), 1, 1); } c.globalAlpha = 1; }
    if (I.t >= I.dur) { G.iris = null; if (I.done) I.done(); }
  }

  function clear() { sparks.length = 0; ghosts.length = 0; rings.length = 0; G.trauma = 0; G.kickX = G.kickY = 0; }
  function draw(c, dt) { drawGhosts(c, dt); drawRings(c, dt); drawSparks(c); }
  return { bind(g) { G = g; }, spark, sparkBurst, updateSparks, draw, ghost, ring, kick, cameraOffset, drawLight, drawVignette, iris, drawIris, disc, clear };
};
})();
