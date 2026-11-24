/* spore golf */
(function () {
'use strict';
const { VW, VH, TS, COLS, ROWS, PHYS, SPR, HOLES, makeWorld, makeBall, stepBall, updateSwings, growPad, surfaceY, tileAt } = window.SB;

const ready = () => true;

/* canvas stuff. game draws at 640x400 then scales up so the pixels stay crisp */
const screen = document.getElementById('game');
const sctx = screen.getContext('2d');
const lo = document.createElement('canvas'); lo.width = VW; lo.height = VH;
let ctx = lo.getContext('2d');
ctx.imageSmoothingEnabled = false;
function resize() {
  const r = screen.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round(r.width * dpr / VW));
  if (screen.width !== VW * k) { screen.width = VW * k; screen.height = VH * k; }
}


/* tiny 5x7 pixel font */
const GLYPHS = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
  '.': '00000000000000000000000000110001100', ',': '00000000000000000000011000010001000', '!': '00100001000010000100001000000000100',
  '?': '01110100010000100010001000000000100', ':': '00000011000110000000011000110000000', '-': '00000000000000011111000000000000000',
  '+': '00000001000010011111001000010000000', '/': '00001000100001000100010000100010000', "'": '00100001000100000000000000000000000',
  '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000', '<': '00010001000100010000010000010000010',
  '>': '01000001000001000001000100010001000', '*': '00000101010111011111011101010100000', '=': '00000000001111100000111110000000000',
  '#': '01010010101111101010111110101001010', '&': '01100100101010001000101011001001101', '^': '00100010101000100000000000000000000',
};
function textWidth(s, sc = 1) { let w = 0; for (const ch of String(s).toUpperCase()) w += (ch === ' ' ? 4 : 6) * sc; return w - sc; }
function text(s, x, y, sc = 1, color = '#fff6e0', align = 'left', shadow = '#1a1424') { pixelText(String(s), x, y, sc, color, align, shadow); }
function pixelText(s, x, y, sc, color, align, shadow) {
  s = s.toUpperCase();
  const w = textWidth(s, sc);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  y = Math.round(y);
  for (const pass of shadow ? [0, 1] : [1]) {
    ctx.fillStyle = pass ? color : shadow;
    let px = cx + (pass ? 0 : sc);
    const py = y + (pass ? 0 : sc);
    for (const ch of s) {
      if (ch === ' ') { px += 4 * sc; continue; }
      const g = GLYPHS[ch === '·' ? '.' : ch];
      if (g) for (let i = 0; i < 35; i++) if (g[i] === '1') ctx.fillRect(px + (i % 5) * sc, py + ((i / 5) | 0) * sc, sc, sc);
      px += 6 * sc;
    }
  }
}

/* audio. every sound is made with web audio, no sound files */
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const AU = {
  ctx: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
        this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.4; this.sfx.connect(send); send.connect(this.verb);
    const len = ctx.sampleRate; this.noiseBuf = ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  },
  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  },
  setMute(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  },
  tone(f, t, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur * 0.9);
    const a = o.attack || 0.005, gain = o.gain == null ? 0.2 : o.gain;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
    osc.connect(g); g.connect(o.dest || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
  },
  pluck(f, t, gain, dest) {
    this.tone(f, t, 1.0, { gain, dest }); this.tone(f * 2, t, 0.3, { type: 'triangle', gain: gain * 0.3, dest });
    this.tone(f * 3.01, t, 0.1, { gain: gain * 0.12, dest });
  },
  noise(t, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 0.7;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain || 0.15, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfx); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  },
  now() { return this.ctx ? this.ctx.currentTime + 0.005 : 0; },
  shoot(p) { const t = this.now(); this.noise(t, 0.25, { gain: 0.08 + p * 0.1, freq: 500, sweep: 3000, type: 'bandpass', q: 1.2 }); this.tone(220 + p * 200, t, 0.15, { gain: 0.06, glide: 500 + p * 300 }); },
  hit(kind, v) {
    const t = this.now(), k = Math.min(1, v / 400);
    if (kind === 'post' || kind === 'log') { this.tone(320 + Math.random() * 60, t, 0.09, { type: 'triangle', gain: 0.1 * k + 0.03 }); this.noise(t, 0.05, { gain: 0.06 * k, freq: 1800, type: 'bandpass', q: 2 }); }
    else { this.noise(t, 0.09, { gain: 0.09 * k + 0.02, freq: 380 }); this.tone(120, t, 0.08, { gain: 0.08 * k, glide: 70 }); }
  },
  pad(combo) {
    const t = this.now(), sc = [74, 77, 79, 81, 84, 86, 89, 91, 93];
    this.pluck(mtof(sc[Math.min(combo - 1, sc.length - 1)]), t, 0.14, this.sfx);
    this.tone(240, t, 0.25, { gain: 0.14, glide: 95 });
  },
  cap() { const t = this.now(); this.pluck(mtof(69), t, 0.1, this.sfx); this.tone(160, t, 0.28, { gain: 0.15, glide: 65 }); },
  splash() {
    const t = this.now();
    this.noise(t, 0.45, { gain: 0.16, freq: 1400, sweep: 300, type: 'bandpass', q: 0.8 });
    for (let i = 0; i < 5; i++) this.tone(300 + Math.random() * 500, t + 0.12 + i * 0.07 + Math.random() * 0.04, 0.06, { gain: 0.04, glide: 900 + Math.random() * 600 });
  },
  grow() { const t = this.now(); [62, 65, 69, 74, 77].forEach((n, i) => this.pluck(mtof(n + 12), t + i * 0.06, 0.08, this.sfx)); },
  fly() { const t = this.now(); this.pluck(mtof(93), t, 0.08, this.sfx); this.pluck(mtof(98), t + 0.07, 0.06, this.sfx); },
  holed(good) {
    const t = this.now();
    const run = good ? [62, 65, 69, 74, 77, 81, 86] : [62, 65, 69, 74];
    run.forEach((n, i) => this.pluck(mtof(n + 12), t + i * 0.08, 0.1, this.sfx));
    [62, 65, 69].forEach(n => this.tone(mtof(n), t, 2.2, { type: 'triangle', gain: 0.05, attack: 0.3 }));
  },
  skip() { const t = this.now(); this.noise(t, 0.18, { gain: 0.1, freq: 1800, sweep: 600, type: 'bandpass', q: 1 }); this.tone(600, t, 0.1, { gain: 0.05, glide: 1200 }); },
  pop() { const t = this.now(); this.tone(500, t, 0.1, { gain: 0.05, glide: 900 }); },
  tick() { const t = this.now(); this.tone(1400, t, 0.02, { gain: 0.02, type: 'triangle' }); },
  ui() { const t = this.now(); this.pluck(mtof(81), t, 0.07, this.sfx); },
};

/* tiles. just flat colours for now */
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
let terrainCache = null, waterCache = null;
function buildCaches(w) {
  terrainCache = document.createElement('canvas'); terrainCache.width = VW; terrainCache.height = VH;
  waterCache = document.createElement('canvas'); waterCache.width = VW; waterCache.height = VH;
  const c = terrainCache.getContext('2d'), wc = waterCache.getContext('2d');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = w.tiles[y][x], dx = x * TS, dy = y * TS;
    if (ch === '#') {
      c.fillStyle = (x + y) % 2 ? '#3f2c22' : '#45302a'; c.fillRect(dx, dy, TS, TS);
      if (y === 0 || w.tiles[y - 1][x] !== '#') { c.fillStyle = '#5f9a48'; c.fillRect(dx, dy, TS, 4); c.fillStyle = '#7fc35e'; c.fillRect(dx, dy, TS, 1); }
    } else if (ch === '-') {
      c.fillStyle = '#7a5032'; c.fillRect(dx, dy, TS, 4); c.fillStyle = '#9a6a44'; c.fillRect(dx, dy, TS, 1);
    } else if (ch === '~') {
      const surf = y === 0 || w.tiles[y - 1][x] !== '~';
      wc.fillStyle = 'rgba(70,130,190,0.6)'; wc.fillRect(dx, dy, TS, TS);
      if (surf) { wc.fillStyle = '#bfe6ff'; wc.fillRect(dx, dy, TS, 1); }
    }
  }
}

/* ui. simple boxes for now */
const MEM = { edge: '#6fd6b8', edgeD: '#2f7f74', dark: '#0b1a1c', cyto: 'rgba(12,34,36,0.84)', hi: '#c8fff0', text: '#eafff6', dim: '#8fb8ae' };
let ctxStack = [];
function withCtx(c, fn) { ctxStack.push(ctx); ctx = c; try { fn(); } finally { ctx = ctxStack.pop(); } }
/* rounded rect with crisp pixels */
function pxRound(c, x, y, w, h, r, color, fromRow = 0) {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = color; r = Math.min(r, Math.floor(w / 2), Math.floor(h / 2));
  for (let j = Math.max(0, fromRow); j < h; j++) {
    let inset = 0;
    const dy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : -1;
    if (dy >= 0) inset = Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy)));
    c.fillRect(x + inset, y + j, w - inset * 2, 1);
  }
}
function pxCircle(c, cx, cy, r, color) { pxRound(c, Math.round(cx - r), Math.round(cy - r), r * 2, r * 2, r, color); }
/* plain box */
function membrane(x, y, w, h, r = 8, o = {}) {
  const c = o.c || ctx;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  c.fillStyle = 'rgba(12,20,24,0.85)'; c.fillRect(x, y, w, h);
  c.strokeStyle = o.edge || MEM.edge; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function pill(x, y, w, h = 14) { membrane(x, y, w, h, Math.floor(h / 2)); }

/* the round. 9 holes, get the spore in the cup in as few flings as u can */
const LEVELS = HOLES.length;
const G = {
  state: 'load', w: null, ball: null, phase: 'play', phaseT: 0, roomT: 0, particles: [], popups: [],
  aim: null, kbAim: { a: 40, p: 0.6, on: false }, level: 0, run: null, lastSafe: null, safeT: 0,
  time: 0, flies: 0, fade: 1, endT: 0, sinkX: 0, sinkY: 0, padGrown: false, roomSpores: 0,
  touch: false, trail: [], strokes: 0, card: [], menu: 0, cam: { x: 0, y: 0 },
};
function newRun() { return { mods: Object.assign({}, window.SB.DEFAULT_MODS), preview: 1, spores: 0 }; }
function vmax() { return PHYS.VMAX * (G.run ? G.run.mods.power : 1); }
function startLevel(n) {
  G.level = n;
  G.w = makeWorld(n, G.run.mods);
  buildCaches(G.w);
  G.ball = makeBall(G.w.start.x, G.w.start.y);
  G.lastSafe = { x: G.w.start.x, y: G.w.start.y }; G.safeT = 0;
  G.phase = 'play'; G.phaseT = 0; G.roomT = 0; G.particles = []; G.popups = []; G.trail = [];
  G.aim = null; G.kbAim.on = false; G.state = 'play'; G.fade = 1; G.strokes = 0; G.roomSpores = 0;
}
function newGame() { G.run = newRun(); G.time = 0; G.flies = 0; G.card = []; startLevel(0); }
const MENU = () => [{ id: 'play', label: 'Play  -  9 holes' }, { id: 'practice', label: 'Practice  -  coming soon', disabled: true }];
function menuSelect(i) {
  const it = MENU()[i]; if (!it || it.disabled) { AU.tick(); return; }
  AU.ui();
  newGame();
}

/* input. when the spore stops, drag back from it and let go to fling */
function toGame(e) { const r = screen.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; }
let aimPointer = null;
function grounded() { return G.ball && !G.ball.moving; }   // u can only shoot when its stopped
screen.addEventListener('pointerdown', e => {
  e.preventDefault(); screen.focus(); AU.init();
  if (e.pointerType === 'touch') G.touch = true;
  try { screen.setPointerCapture(e.pointerId); } catch (_) { }
  const p = toGame(e);
  if (G.state === 'title') { if (ready()) { const i = menuHit(p); if (i >= 0) { G.menu = i; menuSelect(i); } } return; }
  if (G.state === 'end') { if (G.endT > 2.5) { AU.ui(); G.state = 'title'; } return; }
  if (G.state !== 'play') return;
  if (G.phase === 'cleared') { if (G.phaseT > 1.2) nextLevel(); return; }
  if (p.x > VW - 40 && p.y < 22) { AU.setMute(!AU.muted); return; }
  if (G.phase === 'play' && grounded()) { aimPointer = e.pointerId; G.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y, lastBucket: -1 }; G.kbAim.on = false; }
});
screen.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (G.state === 'title' && ready()) { const i = menuHit(p); if (i >= 0 && i !== G.menu) { G.menu = i; AU.tick(); } }
  if (G.aim && e.pointerId === aimPointer) { G.aim.x = p.x; G.aim.y = p.y; }
});
const release = e => {
  if (e.pointerId !== aimPointer) return;
  aimPointer = null;
  if (G.aim && G.phase === 'play' && grounded()) { const v = aimVector(); if (v.p > 0.06) fling(v.vx, v.vy, v.p); }
  G.aim = null;
};
screen.addEventListener('pointerup', release);
screen.addEventListener('pointercancel', release);

const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true; AU.init();
  if (e.repeat) return;
  if (e.code === 'KeyM') { AU.setMute(!AU.muted); return; }
  const go = e.code === 'Space' || e.code === 'Enter';
  if (G.state === 'title') {
    if (!ready()) return;
    const n = MENU().length;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { G.menu = (G.menu + n - 1) % n; AU.tick(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { G.menu = (G.menu + 1) % n; AU.tick(); }
    if (go) menuSelect(G.menu);
    return;
  }
  if (G.state === 'end') { if (go && G.endT > 2.5) { AU.ui(); G.state = 'title'; } return; }
  if (G.state !== 'play') return;
  if (G.phase === 'cleared') { if (go && G.phaseT > 1.2) nextLevel(); return; }
  if (G.phase !== 'play') return;
  if (G.kbAim.on) {
    if (go) { if (grounded()) { const a = G.kbAim.a * Math.PI / 180, v = G.kbAim.p * vmax(); fling(Math.cos(a) * v, -Math.sin(a) * v, G.kbAim.p); } G.kbAim.on = false; }
    if (e.code === 'KeyF' || e.code === 'Escape' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.kbAim.on = false;
    return;
  }
  if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && grounded()) { G.kbAim.on = true; G.kbAim.a = G.w.goal.x < G.ball.x ? 135 : 45; AU.tick(); return; }
  if (e.code === 'KeyR') { G.ball.vx = G.ball.vy = 0; die(true); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function aimVector() {
  const a = G.aim, dx = a.sx - a.x, dy = a.sy - a.y, d = Math.hypot(dx, dy);
  const p = Math.min(1, d / 110);
  if (d < 1) return { vx: 0, vy: 0, p: 0 };
  return { vx: dx / d * p * vmax(), vy: dy / d * p * vmax(), p };
}
function currentAim() {
  if (G.aim) return aimVector();
  if (G.kbAim.on) { const a = G.kbAim.a * Math.PI / 180, v = G.kbAim.p * vmax(); return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v, p: G.kbAim.p }; }
  return null;
}
function fling(vx, vy, p) {
  const b = G.ball;
  b.vx = vx; b.vy = vy; b.t = 0; b.restT = 0; b.padCombo = 0; b.moving = true;
  G.strokes++;
  AU.shoot(p);
}
/* particles + the little popup text */
function burst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
    const sp = (o.speed || 80) * (0.4 + Math.random() * 0.8);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life || 0.7) * (0.6 + Math.random() * 0.6), max: o.life || 0.7,
      g: o.g == null ? 200 : o.g, color: o.color[(Math.random() * o.color.length) | 0], size: o.size || 1 });
  }
}
function popup(s, x, y, color) { G.popups.push({ s, x, y, t: 0, color: color || MEM.text }); }

/* update */
function fixedUpdate(dt) {
  const w = G.w, b = G.ball, R = G.run;
  w.time += dt; updateSwings(w, w.time);
  G.phaseT += dt;
  for (const p of w.pads) { if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 1.8); if (p.squish > 0) p.squish = Math.max(0, p.squish - dt * 3.5); }
  for (const c of w.caps) if (c.squish > 0) c.squish = Math.max(0, c.squish - dt * 3.5);
  G.time += dt; G.roomT += dt;
  if (G.kbAim.on) {
    const k = keys;
    if (k.ArrowLeft || k.KeyA) G.kbAim.a = Math.min(180, G.kbAim.a + 70 * dt);
    if (k.ArrowRight || k.KeyD) G.kbAim.a = Math.max(0, G.kbAim.a - 70 * dt);
    if (k.ArrowUp || k.KeyW) G.kbAim.p = Math.min(1, G.kbAim.p + 0.6 * dt);
    if (k.ArrowDown || k.KeyS) G.kbAim.p = Math.max(0.08, G.kbAim.p - 0.6 * dt);
  }
  if (G.phase === 'play') {
    if (!b.moving) return;
    const ev = [];
    const r = stepBall(w, b, dt, ev);
    for (const e of ev) {
      if (e.t === 'hit') {
        if (e.kind === 'cap') { AU.cap(); e.ref.squish = 1; }
        else { if (e.v > 70) AU.hit(e.kind, e.v); if (e.v > 160) burst(e.x, e.y, 4, { color: ['#8a7a62', '#5a4e40'], speed: 60, life: 0.4 }); }
      } else if (e.t === 'pad') {
        AU.pad(e.combo); e.pad.squish = 1;
        if (e.combo > 1) popup('x' + e.combo, b.x, b.y - 10, '#9ff4ff');
      } else if (e.t === 'fly') {
        AU.fly(); G.flies++;
        popup('Firefly!', e.f.x, e.f.y - 10, '#eaff8a');
      } else if (e.t === 'skip') {
        AU.skip(); popup('Skip!', e.x, e.y - 12, '#a4fff5');
      }
    }
    if (G.phaseT % 0.05 < dt && !b.grounded) { G.trail.push({ x: b.x, y: b.y }); if (G.trail.length > 14) G.trail.shift(); }
    if (b.grounded) G.trail.length = Math.max(0, G.trail.length - 1);
    if (r === 'rest') { b.moving = false; G.lastSafe = { x: b.x, y: b.y }; G.trail = []; }   // wherever it stops is where u play from next
    else if (r === 'lost') { b.moving = false; b.x = G.lastSafe.x; b.y = G.lastSafe.y; b.vx = b.vy = 0; popup('Lost it!', b.x, b.y - 16); }
    else if (r === 'goal') holed();
    else if (r === 'sink') sink();
  } else if (G.phase === 'dead') {
    if (!G.padGrown && G.phaseT > 0.45) {
      G.padGrown = true;
      const pad = growPad(w, G.sinkX, G.sinkY);
      if (pad) { AU.grow(); popup('A glowcap grew!', pad.cx, pad.sy - 40, '#9ff4ff'); }
    }
    if (G.phaseT > 1.25) respawn();
  } else if (G.phase === 'cleared') {
    const g = w.goal; b.x += (g.x - b.x) * Math.min(1, dt * 4); b.y += (g.y - b.y) * Math.min(1, dt * 4);
  }
}
/* splash. the spore u leave behind turns into a glowcap */
function sink() {
  const b = G.ball, w = G.w, R = G.run;
  const sy = surfaceY(w, b.x, b.y) || b.y;
  AU.splash();
  R.spores++; G.roomSpores++;
  if (sy < VH) burst(b.x, sy, 10, { color: ['#9fd8ff', '#e0f6ff'], speed: 90, life: 0.5, angle: -Math.PI / 2, spread: 1.2, g: 300 });
  G.phase = 'dead'; G.phaseT = 0; G.padGrown = false; G.sinkX = b.x; G.sinkY = b.y;
}
function die(manual) { if (manual) { G.phase = 'dead'; G.phaseT = 0.45; G.padGrown = true; AU.pop(); } }
function respawn() {
  G.ball = makeBall(G.lastSafe.x, G.lastSafe.y);
  G.phase = 'play'; G.trail = [];
  AU.pop();
}
function scoreName(n, par) {
  if (n === 1) return 'Hole in one!';
  const d = n - par;
  return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `+${d}`;
}
function holed() {
  G.phase = 'cleared'; G.phaseT = 0;
  G.card[G.level] = G.strokes;
  AU.holed(G.strokes <= HOLES[G.level].par);
  const g = G.w.goal;
  burst(g.x, g.y, 34, { color: ['#eaff8a', '#ffffff', '#fff6c0'], speed: 140, life: 1.2, g: 30 });
  G.ball.vx = G.ball.vy = 0;
}
function nextLevel() {
  if (G.level + 1 < LEVELS) startLevel(G.level + 1); else finish();
}
function finish() {
  G.state = 'end'; G.endT = 0;
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const SKY = [['#9fd0e8', '#e6f2d8'], ['#a8c8e0', '#f0e2c8'], ['#b8b4d8', '#f2d8c0'], ['#8fb8d0', '#d8ecd8']];
function drawBackground(bgi, t, px) {
  const [top, bot] = SKY[bgi % SKY.length], g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const par = ((px || VW / 2) - VW / 2);
  for (const [k, col, h, f] of [[0.03, 'rgba(90,130,110,0.35)', 230, 0.011], [0.08, 'rgba(60,100,80,0.45)', 280, 0.017]]) {
    ctx.fillStyle = col;
    for (let x = 0; x < VW; x += 4) { const y = h + Math.sin((x + par * k + bgi * 90) * f) * 26 + Math.sin((x + bgi * 40) * f * 2.7) * 9; ctx.fillRect(x, Math.round(y), 4, VH - Math.round(y)); }
  }
}
function easeBack(g) { return g >= 1 ? 1 : 1 + 2.7 * Math.pow(g - 1, 3) + 1.7 * Math.pow(g - 1, 2); }
function drawPad(p) {
  const g = easeBack(p.grow), sq = Math.sin(p.squish * Math.PI) * p.squish, ps = p.scale || 1;
  const rx = 20 * ps * g * (1 + sq * 0.15), ry = 15 * ps * g * (1 - sq * 0.25);
  if (rx < 1) return;
  ctx.fillStyle = '#4fa0b0'; ctx.fillRect(Math.round(p.cx) - 1, Math.round(p.sy - ry), 3, Math.round(ry) + 4);
  ctx.fillStyle = '#7fe6f0'; ctx.beginPath(); ctx.ellipse(Math.round(p.cx), Math.round(p.sy - ry), rx, ry * 0.6, 0, Math.PI, 0); ctx.fill();
}
function drawCap(c) {
  const sq = Math.sin(c.squish * Math.PI) * c.squish;
  const st = c.segs[c.segs.length - 1];
  ctx.fillStyle = '#d8c8a8'; ctx.fillRect(Math.round(st[0]) - 3, Math.round(st[1]), 6, Math.round(st[3] - st[1]));
  ctx.fillStyle = '#b0503a'; ctx.beginPath();
  for (let i = 0; i < c.segs.length - 1; i++) { const sg = c.segs[i]; ctx.lineTo(sg[0], sg[1] + sq * 3); }
  ctx.closePath(); ctx.fill();
}
function drawSwing(s) {
  ctx.strokeStyle = '#263030'; ctx.lineWidth = 1;
  const c = Math.cos(s.th), sn = Math.sin(s.th);
  for (const k of [-31, 31]) { ctx.beginPath(); ctx.moveTo(s.x + 0.5, s.y); ctx.lineTo(Math.round(s.lx + k * c) + 0.5, Math.round(s.ly - k * sn - 4)); ctx.stroke(); }
  ctx.save(); ctx.translate(Math.round(s.lx), Math.round(s.ly)); ctx.rotate(-s.th);
  ctx.fillStyle = '#7a5032'; ctx.fillRect(-37, -5, 74, 10);
  ctx.restore();
}
function drawGoal(g, t) {
  /* the cup */
  const k = G.phase === 'cleared' ? Math.min(1, G.phaseT * 2) : 0, p = 0.5 + 0.5 * Math.sin(t * 2);
  ctx.globalAlpha = 0.18 + 0.1 * p; pxCircle(ctx, g.x, g.y, 16 + k * 10, '#eaff8a');
  ctx.globalAlpha = 0.3 + 0.1 * p; pxCircle(ctx, g.x, g.y, 10 + k * 6, '#f4ffd0');
  ctx.globalAlpha = 0.9; pxRound(ctx, Math.round(g.x - 3), Math.round(g.y - 7), 6, 14, 3, '#fffbe8');
  for (let i = 0; i < 16; i++) {
    const a = t * 1.8 + i / 16 * 6.283, r = 11 + Math.sin(t * 3 + i) * 2 + k * 14;
    ctx.fillStyle = i % 3 ? '#eaff8a' : '#9ff4dc';
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i);
    ctx.fillRect(Math.round(g.x + Math.cos(a) * r), Math.round(g.y + Math.sin(a) * r * 0.75), 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.4 + i * 0.2) % 1;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8; ctx.fillStyle = '#fffbe8';
    ctx.fillRect(Math.round(g.x - 8 + i * 4 + Math.sin(t * 2 + i) * 2), Math.round(g.y + 6 - ph * 30), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawFly(f, t, i) {
  if (f.got) return;
  const x = Math.round(f.x + Math.sin(t * 1.3 + i) * 4), y = Math.round(f.y + Math.sin(t * 2.1 + i * 2) * 3);
  ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 5 + i); ctx.fillStyle = '#eaff8a';
  ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fbffd0'; ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.fillStyle = '#c8e0ff'; if ((t * 12 | 0) % 2) { ctx.fillRect(x - 3, y - 2, 2, 1); ctx.fillRect(x + 1, y - 2, 2, 1); }
}
/* the spore. a little pixel seed with a sprout, eyes follow where its going */
function drawBall(b, t, alpha = 1) {
  const x = Math.round(b.x), y = Math.round(b.y);
  ctx.globalAlpha = alpha;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const d = dx * dx + dy * dy;
    if (d > 27) continue;
    ctx.fillStyle = d > 17 ? '#3a2418' : dy > 1 ? '#d9a062' : (dx < -1 && dy < -1) ? '#fff2cc' : '#f5d79c';
    ctx.fillRect(x + dx, y + dy, 1, 1);
  }
  const sp = Math.hypot(b.vx, b.vy), lx = sp > 20 ? Math.round(b.vx / sp * 1.5) : 0, ly = sp > 20 ? Math.round(b.vy / sp * 1) : 0;
  ctx.fillStyle = '#2b1a14';
  if ((t % 3.3) > 0.12) { ctx.fillRect(x - 2 + lx, y - 1 + ly, 1, 2); ctx.fillRect(x + 1 + lx, y - 1 + ly, 1, 2); }
  else { ctx.fillRect(x - 2 + lx, y + ly, 1, 1); ctx.fillRect(x + 1 + lx, y + ly, 1, 1); }
  const lean = Math.max(-2, Math.min(2, Math.round(-b.vx / 120)));
  ctx.fillStyle = '#4f9a5a'; ctx.fillRect(x, y - 6, 1, 2);
  ctx.fillStyle = '#7fd36f'; ctx.fillRect(x - 2 + lean, y - 8, 2, 1); ctx.fillRect(x + 1 + lean, y - 8, 2, 1);
  ctx.fillStyle = '#9fe08a'; ctx.fillRect(x - 1 + lean, y - 7, 1, 1); ctx.fillRect(x + 1 + lean, y - 7, 1, 1);
  ctx.globalAlpha = 1;
}
function drawAim(t) {
  const v = currentAim(); if (!v || v.p < 0.02) return;
  const b = G.ball, w = G.w;
  const R = G.run;
  let x = b.x, y = b.y, vx = v.vx, vy = v.vy;
  const dt = 1 / 60, g = PHYS.G * (R ? R.mods.grav : 1), steps = Math.round(34 * (R ? R.preview : 1));
  for (let i = 0; i < steps; i++) {
    vy += g * dt; x += vx * dt; y += vy * dt;
    const tc = tileAt(w, Math.floor(x / TS), Math.floor(y / TS));
    if (tc === '#' || tc === '~' || (!w.infinite && (x < 0 || x > VW))) break;
    if (i % 3 === 0) {
      ctx.globalAlpha = 1 - i / (steps + 6);
      ctx.fillStyle = '#1a1424'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = i % 6 ? '#fff6e0' : '#eaff8a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  const bw = 30, bx = Math.round(b.x - bw / 2), by = Math.round(b.y + 10);
  ctx.fillStyle = '#1a1424'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
  const pc = v.p > 0.85 ? '#ff8a6a' : v.p > 0.5 ? '#ffd86b' : '#9fe08a';
  ctx.fillStyle = pc; ctx.fillRect(bx, by, Math.round(bw * v.p), 3);
  if (G.aim) {
    const bucket = Math.floor(v.p * 10);
    if (bucket !== G.aim.lastBucket) { G.aim.lastBucket = bucket; AU.tick(); }
    ctx.strokeStyle = 'rgba(255,246,224,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(G.aim.sx + 0.5, G.aim.sy + 0.5); ctx.lineTo(G.aim.x + 0.5, G.aim.y + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,224,0.6)'; ctx.fillRect(Math.round(G.aim.sx) - 1, Math.round(G.aim.sy) - 1, 3, 3);
  }
}
function drawParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt; if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = G.popups.length - 1; i >= 0; i--) {
    const p = G.popups[i]; p.t += dt; if (p.t > 1.4) { G.popups.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, (1.4 - p.t) * 2);
    text(p.s, p.x, p.y - p.t * 14, 1, p.color, 'center');
    ctx.globalAlpha = 1;
  }
}

/* drawing. one screen per hole */
function drawSigns(w) {
  const g = w.goal, top = g.y - 30;     // flag
  ctx.fillStyle = '#eeeeee'; ctx.fillRect(Math.round(g.x) + 6, Math.round(top), 1, 38);
  ctx.fillStyle = '#e04848'; ctx.beginPath(); ctx.moveTo(g.x + 7, top); ctx.lineTo(g.x + 21, top + 5); ctx.lineTo(g.x + 7, top + 10); ctx.fill();
  ctx.fillStyle = '#f4f0e0'; ctx.fillRect(Math.round(w.start.x) - 1, Math.round(w.start.y + PHYS.R), 3, 3);   // tee
}
function renderPlay(t, dt) {
  const w = G.w, H = HOLES[w.hi];
  drawBackground(H.bg, t, G.ball.x);
  ctx.drawImage(terrainCache, 0, 0);
  drawSigns(w);
  for (const p of w.posts) { ctx.fillStyle = '#6a4a32'; ctx.fillRect(p.px + 4, p.py, 8, VH - p.py); }
  for (const c of w.caps) drawCap(c);
  for (const sw of w.swings) drawSwing(sw);
  w.flies.forEach((f, i) => drawFly(f, t, i));
  drawGoal(w.goal, t);
  for (const p of w.pads) drawPad(p);
  for (let i = 0; i < G.trail.length; i++) { ctx.globalAlpha = i / G.trail.length * 0.5; ctx.fillStyle = '#fff2cc'; ctx.fillRect(Math.round(G.trail[i].x), Math.round(G.trail[i].y), 1, 1); }
  ctx.globalAlpha = 1;
  if (G.phase === 'dead') { const b = G.ball; if (G.phaseT < 0.4) drawBall({ x: b.x, y: b.y + G.phaseT * 30, vx: 0, vy: 0 }, t, 1 - G.phaseT * 2.2); }
  else drawBall(G.ball, t);
  ctx.drawImage(waterCache, 0, 0);
  if (G.phase === 'play' && (G.aim || G.kbAim.on)) drawAim(t);
  drawParticles(dt);
  if (G.aim) {
    ctx.strokeStyle = 'rgba(234,255,246,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(G.aim.sx + 0.5, G.aim.sy + 0.5); ctx.lineTo(G.aim.x + 0.5, G.aim.y + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(234,255,246,0.6)'; ctx.fillRect(Math.round(G.aim.sx) - 1, Math.round(G.aim.sy) - 1, 3, 3);
  }
  // hud
  const lvl = `Hole ${G.level + 1}/${LEVELS}  -  ${H.name}`;
  pill(6, 4, textWidth(lvl) + 16); text(lvl, 14, 7, 1, MEM.text);
  const sw = 170; pill(VW - sw - 6, 4, sw);
  text(`Par ${H.par}`, VW - sw + 4, 7, 1, '#ffe9a8');
  text(`Strokes ${G.strokes}`, VW - sw + 46, 7, 1, G.strokes > H.par ? '#ffb0b0' : MEM.text);
  text(AU.muted ? 'M:off' : 'M:on', VW - 12, 7, 1, MEM.dim, 'right');
  if (G.roomT < 7 && G.phase === 'play' && H.hint) {
    ctx.globalAlpha = Math.min(1, (7 - G.roomT) / 1.5);
    const hw = textWidth(H.hint) + 16; pill(VW / 2 - hw / 2, 24, hw); text(H.hint, VW / 2, 27, 1, MEM.text, 'center'); ctx.globalAlpha = 1;
  }
  if (G.roomT < 2.2 && G.phase === 'play') {
    const k = G.roomT < 0.3 ? G.roomT / 0.3 : G.roomT > 1.7 ? (2.2 - G.roomT) / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, k);
    text(`Hole ${G.level + 1}`, VW / 2, 104, 2, '#9ff4dc', 'center');
    text(H.name, VW / 2, 132, 4, MEM.text, 'center');
    text(`Par ${H.par}`, VW / 2, 176, 1, '#ffe9a8', 'center');
    ctx.globalAlpha = 1;
  }
  if (G.phase === 'cleared') {
    const k = Math.min(1, G.phaseT * 3);
    ctx.globalAlpha = k;
    membrane(VW / 2 - 140, 116, 280, 90, 16, { dots: 12, glow: 0.25 });
    text(scoreName(G.strokes, H.par), VW / 2, 128, 3, G.strokes <= H.par ? '#eaff8a' : '#ffd0a8', 'center');
    text(`${G.strokes} stroke${G.strokes === 1 ? '' : 's'}  -  par ${H.par}`, VW / 2, 164, 1, MEM.text, 'center');
    if (G.roomSpores) text(`${G.roomSpores} glowcap${G.roomSpores === 1 ? '' : 's'} grew from your misses`, VW / 2, 178, 1, '#9ff4ff', 'center');
    if (G.phaseT > 1.2) { ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 4)); text('Space to continue', VW / 2, 192, 1, MEM.dim, 'center'); }
    ctx.globalAlpha = 1;
  }
}

function renderTitle(t) {
  drawBackground(0, t, VW / 2 + Math.sin(t * 0.2) * 200);
  const wy = 340;
  ctx.fillStyle = 'rgba(70,130,190,0.7)'; ctx.fillRect(0, wy, VW, VH - wy);
  const per = 1.6, ph = (t % per) / per, left = 230, right = 410;
  const goingRight = Math.floor(t / per) % 2 === 0;
  const bx = goingRight ? left + (right - left) * ph : right - (right - left) * ph, by = wy - 26 - Math.sin(ph * Math.PI) * 110;
  const sq = ph < 0.1 ? 1 - ph / 0.1 : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;
  for (const [x, s] of [[left, goingRight ? sq * (ph < 0.5 ? 1 : 0) : sq * (ph > 0.5 ? 1 : 0)], [right, goingRight ? sq * (ph > 0.5 ? 1 : 0) : sq * (ph < 0.5 ? 1 : 0)]]) drawPad({ cx: x, sy: wy, x, grow: 1, squish: s * 0.8 });
  drawBall({ x: bx, y: by, vx: goingRight ? 120 : -120, vy: Math.cos(ph * Math.PI) * -200 }, t);
  text('Spore Golf', VW / 2, 40, 6, '#f2fff8', 'center', '#0b1a1c');
  text('every miss grows something', VW / 2, 100, 2, '#2f6f3a', 'center', null);
  const items = MENU();
  G.menu = Math.max(0, Math.min(items.length - 1, G.menu));
  items.forEach((it, i) => {
    const y = 148 + i * 26, sel = i === G.menu, wdt = 260;
    membrane(VW / 2 - wdt / 2, y, wdt, 20, 10, { edge: it.disabled ? '#5f7f78' : sel ? '#9ff4dc' : MEM.edgeD });
    text(it.label, VW / 2, y + 7, 1, it.disabled ? '#5f7f78' : sel ? '#f2fff8' : MEM.dim, 'center');
  });
  text('Drag back to fling  -  F aim with keys  -  R retry  -  M mute', VW / 2, 384, 1, '#ffffff', 'center');
}
function menuHit(p) { const n = MENU().length; for (let i = 0; i < n; i++) { const y = 148 + i * 26; if (p.x > VW / 2 - 130 && p.x < VW / 2 + 130 && p.y > y && p.y < y + 20) return i; } return -1; }

function renderEnd(t, dt) {
  drawBackground(2, t, VW / 2);
  ctx.fillStyle = 'rgba(10,24,26,0.35)'; ctx.fillRect(0, 0, VW, VH);
  const wy = 352;
  ctx.fillStyle = 'rgba(70,130,190,0.7)'; ctx.fillRect(0, wy, VW, VH - wy);
  const R = G.run || newRun(), n = R.spores, shown = Math.min(n, Math.floor(G.endT * 8));
  for (let i = 0; i < Math.min(shown, 40); i++) { const x = 24 + ((i * 97) % 600) + hash(i) * 10; drawPad({ cx: x, sy: wy, x, grow: Math.min(1, (G.endT * 8 - i) / 5), squish: 0, scale: 0.8 + hash(i + 3) * 0.5 }); }
  text('Round complete', VW / 2, 16, 3, '#d8ffd0', 'center');
  // scorecard
  const x0 = VW / 2 - 250, cw = 49, total = G.card.reduce((a, b) => a + (b || 0), 0), par = HOLES.reduce((a, h) => a + h.par, 0);
  membrane(x0 - 10, 64, 520, 72, 14, { dots: 14 });
  text('Hole', x0, 74, 1, MEM.dim); text('Par', x0, 94, 1, MEM.dim); text('You', x0, 114, 1, MEM.dim);
  for (let i = 0; i < LEVELS; i++) {
    const x = x0 + 60 + i * cw, sc = G.card[i], k = Math.max(0, Math.min(1, (G.endT - 0.3 - i * 0.1) * 3));
    ctx.globalAlpha = k;
    text(String(i + 1), x, 74, 1, MEM.text, 'center'); text(String(HOLES[i].par), x, 94, 1, '#ffe9a8', 'center');
    text(sc == null ? '-' : String(sc), x, 114, 1, sc == null ? MEM.dim : sc <= HOLES[i].par ? '#eaff8a' : '#ffd0a8', 'center');
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, (G.endT - 1.4) * 2));
  const d = total - par;
  text(`${total} strokes  -  ${d === 0 ? 'even par' : (d > 0 ? '+' : '') + d + ' to par'}  -  ${fmtTime(G.time)}`, VW / 2, 156, 2, MEM.text, 'center');
  text(`${n} glowcap${n === 1 ? '' : 's'} grew from your misses  -  ${G.flies} firefl${G.flies === 1 ? 'y' : 'ies'}`, VW / 2, 190, 1, '#9ff4ff', 'center');
  ctx.globalAlpha = G.endT > 3 ? 0.55 + 0.45 * Math.sin(t * 3) : 0;
  text('Click or press Space to return', VW / 2, 300, 1, MEM.text, 'center');
  ctx.globalAlpha = 1;
  drawParticles(dt);
}

let last = performance.now(), acc = 0, T = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  resize();
  if (G.state === 'load' && ready()) G.state = 'title';
  if (G.state === 'play') { acc += dt; while (acc >= PHYS.DT) { fixedUpdate(PHYS.DT); acc -= PHYS.DT; if (G.state !== 'play') break; } }
  if (G.state === 'end') G.endT += dt;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.state === 'play') renderPlay(T, dt);
  else if (G.state === 'end') renderEnd(T, dt);
  else if (ready()) renderTitle(T);
  G.fade = Math.max(0, G.fade - dt * 2.5);
  if (G.fade > 0.01) { ctx.fillStyle = `rgba(8,20,22,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(lo, 0, 0, screen.width, screen.height);
  requestAnimationFrame(frame);
}
window.SPOREBOUND = { G, startLevel, newGame, AU, fling };
screen.focus();
requestAnimationFrame(frame);
})();
