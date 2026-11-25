/* sporebound */
(function () {
'use strict';
const { VW, VH, TS, COLS, ROWS, PHYS, SPR, HOLES, makeWorld, makeBall, stepBall, updateSwings, growPad, surfaceY, tileAt } = window.SB;

/* loading the images */
const IMG = {};
const FILES = { tp: 'Terrain_and_Props.png', bg1: 'BG_1.png', bg2: 'BG_2.png', bg3: 'BG_3.png', bg3alt: 'BG_3_alt.png' };
let loaded = 0, loadError = null;
for (const k in FILES) {
  const im = new Image();
  im.onload = () => { loaded++; };
  im.onerror = () => { loadError = FILES[k]; };
  im.src = 'assets/' + FILES[k];
  IMG[k] = im;
}
const ready = () => loaded === Object.keys(FILES).length;

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
/* two pixel fonts, both are meant for 11px */
const FONT_PX = 11, FONT_PAD = 4;
const FONTS = { body: { family: 'PixelSans', file: 'PixelSans.ttf', ready: false, dy: 4 }, head: { family: 'ScrollPixel', file: 'ScrollPixel.ttf', ready: false, dy: 4 } };
const textCache = new Map();
const mctx = document.createElement('canvas').getContext('2d');
if (window.FontFace) for (const k in FONTS) {
  const F = FONTS[k];
  new FontFace(F.family, `url(assets/fonts/${F.file})`).load().then(f => { document.fonts.add(f); F.ready = true; textCache.clear(); }).catch(() => { });
}
const fontFor = sc => { const F = sc >= 2 ? FONTS.head : FONTS.body; return F.ready ? F : (FONTS.body.ready ? FONTS.body : null); };
const prep = (s, F) => F.family === 'PixelSans' ? s.replace(/·/g, '-') : s;
const CREDIT_LINE = 'made by harry';
function runCanvas(s, color, F) {
  const key = F.family + '|' + s + '|' + color;
  let c = textCache.get(key);
  if (c) return c;
  mctx.font = `${FONT_PX}px ${F.family}`;
  const w = Math.ceil(mctx.measureText(s).width) + 2;
  c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = FONT_PX + FONT_PAD + 6;
  const x = c.getContext('2d');
  x.font = `${FONT_PX}px ${F.family}`; x.textBaseline = 'alphabetic'; x.fillStyle = color;
  x.fillText(s, 1, FONT_PX + 1);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  x.putImageData(im, 0, 0);
  if (textCache.size > 500) textCache.clear();
  textCache.set(key, c);
  return c;
}
function textWidth(s, sc = 1) {
  s = String(s);
  const F = fontFor(sc);
  if (!F) { let w = 0; for (const ch of s.toUpperCase()) w += (ch === ' ' ? 4 : 6) * sc; return w - sc; }
  mctx.font = `${FONT_PX}px ${F.family}`;
  return Math.ceil(mctx.measureText(prep(s, F)).width) * sc;
}
function text(s, x, y, sc = 1, color = '#fff6e0', align = 'left', shadow = '#1a1424') {
  s = String(s);
  const F = fontFor(sc);
  if (!F) return pixelText(s, x, y, sc, color, align, shadow);
  s = prep(s, F);
  const w = textWidth(s, sc);
  const cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const cy = Math.round(y) - F.dy * sc;
  if (shadow) { const sh = runCanvas(s, shadow, F); ctx.drawImage(sh, cx, cy + sc, sh.width * sc, sh.height * sc); }
  const c = runCanvas(s, color, F);
  ctx.drawImage(c, cx - sc, cy, c.width * sc, c.height * sc);
}
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

/* audio. every sound effect is made with web audio, plus the background track */
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
    this.startMusic();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { ctx.suspend(); if (this.track) this.track.pause(); }
      else { ctx.resume(); if (this.track && !this.muted) this.track.play().catch(() => { }); }
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
    if (this.track) { this.track.muted = m; if (!m) this.track.play().catch(() => { }); }
  },
  /* background track. ogg opus if the browser can play it, mp3 if not (old safari) */
  MUSIC_VOL: 0.55,
  startMusic() {
    const a = this.track = new Audio();
    const ogg = a.canPlayType('audio/ogg; codecs="opus"');
    a.src = 'assets/music/a-moment-of-solace.' + (ogg ? 'ogg' : 'mp3');
    a.loop = true; a.preload = 'auto'; a.volume = 0; a.muted = this.muted;
    a.play().catch(() => { });
    this.fadeTo(this.MUSIC_VOL, 2.5);
  },
  fadeTo(v, sec) {
    const a = this.track; if (!a) return;
    clearInterval(this.fadeTimer);
    const from = a.volume, t0 = performance.now();
    this.fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
      a.volume = Math.max(0, Math.min(1, from + (v - from) * k));
      if (k >= 1) clearInterval(this.fadeTimer);
    }, 30);
  },
  duck(sec) { this.fadeTo(this.MUSIC_VOL * 0.35, 0.15); clearTimeout(this.duckT); this.duckT = setTimeout(() => this.fadeTo(this.MUSIC_VOL, 1.2), sec * 1000); },
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
    this.duck(2.2);
    const t = this.now();
    const run = good ? [62, 65, 69, 74, 77, 81, 86] : [62, 65, 69, 74];
    run.forEach((n, i) => this.pluck(mtof(n + 12), t + i * 0.08, 0.1, this.sfx));
    [62, 65, 69].forEach(n => this.tone(mtof(n), t, 2.2, { type: 'triangle', gain: 0.05, attack: 0.3 }));
  },
  dnaLoss() { const t = this.now(); [76, 72, 69, 64].forEach((n, i) => this.tone(mtof(n), t + 0.05 + i * 0.06, 0.25, { type: 'triangle', gain: 0.05 })); },
  drain() { const t = this.now(); this.tone(440, t, 1.2, { type: 'triangle', gain: 0.07, glide: 110 }); this.noise(t, 1.0, { gain: 0.06, freq: 2000, sweep: 200, type: 'bandpass', q: 1.5 }); },
  reveal(r) { const t = this.now(), base = [74, 76, 79, 81, 86][r]; this.pluck(mtof(base), t, 0.08 + r * 0.02, this.sfx); if (r >= 3) this.pluck(mtof(base + 7), t + 0.06, 0.07, this.sfx); if (r === 4) for (let i = 0; i < 6; i++) this.tone(200 + Math.random() * 2000, t + i * 0.03, 0.04, { type: 'square', gain: 0.025 }); },
  mutate(r) { const t = this.now(); const run = [62, 66, 69, 74, 78, 81, 86, 90].slice(0, 4 + r); run.forEach((n, i) => this.pluck(mtof(n + 12), t + i * 0.06, 0.1, this.sfx)); this.duck(1.6); },
  reborn() { const t = this.now(); this.tone(220, t, 0.6, { gain: 0.08, glide: 880, attack: 0.05 }); this.pluck(mtof(86), t + 0.4, 0.1, this.sfx); },
  hop() { const t = this.now(); this.tone(380, t, 0.14, { gain: 0.09, glide: 900 }); this.noise(t, 0.12, { gain: 0.05, freq: 2400, type: 'bandpass', q: 2 }); },
  skip() { const t = this.now(); this.noise(t, 0.18, { gain: 0.1, freq: 1800, sweep: 600, type: 'bandpass', q: 1 }); this.tone(600, t, 0.1, { gain: 0.05, glide: 1200 }); },
  pop() { const t = this.now(); this.tone(500, t, 0.1, { gain: 0.05, glide: 900 }); },
  tick() { const t = this.now(); this.tone(1400, t, 0.02, { gain: 0.02, type: 'triangle' }); },
  ui() { const t = this.now(); this.pluck(mtof(81), t, 0.07, this.sfx); },
};

/* tiles. autotiles using the terrain block in the tileset */
const TSET = {
  tl: [4, 2], tr: [10, 2], t: [[6, 1], [7, 1], [8, 1]], l: [[4, 3], [4, 4], [4, 5]], r: [[10, 3], [10, 4], [10, 5]],
  bl: [4, 6], br: [10, 6], b: [[5, 6], [6, 6], [7, 6], [8, 6], [9, 6]], under: [[6, 2], [7, 2], [8, 2]],
  fill: [[5, 4], [5, 5], [9, 4], [9, 5], [9, 3]], tuft: [[6, 0], [7, 0], [8, 0]], drip: { 6: [6, 7], 9: [9, 7] },
};
const OFF = { orange: 0, green: 8 };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pick = (arr, i) => arr[Math.floor(hash(i) * arr.length) % arr.length];
function tile(c, [sx, sy], dx, dy, off = 0) { c.drawImage(IMG.tp, (sx + off) * TS, sy * TS, TS, TS, dx, dy, TS, TS); }
function spr(c, name, dx, dy, w, h) { const s = SPR[name]; c.drawImage(IMG.tp, s[0], s[1], s[2], s[3], Math.round(dx), Math.round(dy), w || s[2], h || s[3]); }

let terrainCache = null, waterCache = null;
function buildCaches(w) {
  const H = HOLES[w.hi], off = OFF[H.set];
  terrainCache = document.createElement('canvas'); terrainCache.width = VW; terrainCache.height = VH;
  const c = terrainCache.getContext('2d'); c.imageSmoothingEnabled = false;
  const S = (x, y) => tileAt(w, x, y) === '#' && !(y < 0);
  for (const [name, tx, ty] of H.deco || []) { const s = SPR[name]; spr(c, name, w.mirror ? VW - tx * TS - s[2] : tx * TS, ty * TS - s[3] + 2); }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = w.tiles[y][x], dx = x * TS, dy = y * TS, i = x * 31 + y * 17;
    if (ch === '#') {
      const up = y === 0 ? true : S(x, y - 1), dn = y === ROWS - 1 ? true : S(x, y + 1);
      const lf = x === 0 ? true : S(x - 1, y), rt = x === COLS - 1 ? true : S(x + 1, y);
      let t;
      if (!up && !lf) t = TSET.tl; else if (!up && !rt) t = TSET.tr; else if (!up) t = pick(TSET.t, i);
      else if (!dn && !lf) t = TSET.bl; else if (!dn && !rt) t = TSET.br; else if (!dn) t = pick(TSET.b, i);
      else if (!lf) t = pick(TSET.l, i); else if (!rt) t = pick(TSET.r, i);
      else if (y > 0 && !S(x, y - 2) && y >= 2) t = pick(TSET.under, i); else t = pick(TSET.fill, i);
      tile(c, t, dx, dy, off);
      if (!up && lf && rt && hash(i + 5) > 0.35) tile(c, pick(TSET.tuft, i + 2), dx, dy - TS, off);
      if (!dn && TSET.drip[t[0]] && y + 1 < ROWS && w.tiles[y + 1][x] !== '~') tile(c, TSET.drip[t[0]], dx, dy + TS, off);
    } else if (ch === '-') {
      const l = w.tiles[y][x - 1] === '-', r = w.tiles[y][x + 1] === '-';
      tile(c, [!l ? 12 : !r ? 14 : 13, 10], dx, dy - 2);
      if (hash(i) > 0.4) tile(c, [12 + (i % 2), 9], dx, dy - TS - 2);
    }
  }
  waterCache = document.createElement('canvas'); waterCache.width = VW; waterCache.height = VH;
  const wc = waterCache.getContext('2d'); wc.imageSmoothingEnabled = false;
  for (let x = 0; x < COLS; x++) {
    let top = null;
    for (let y = 0; y < ROWS; y++) {
      if (w.tiles[y][x] !== '~') continue;
      const surf = y === 0 || w.tiles[y - 1][x] !== '~';
      if (surf) top = y * TS;
      tile(wc, surf ? [4, 8] : [5, 8], x * TS, y * TS);
    }
    if (top != null) {
      const g = wc.createLinearGradient(0, top, 0, VH);
      g.addColorStop(0, 'rgba(20,40,50,0)'); g.addColorStop(1, 'rgba(16,26,36,0.7)');
      wc.fillStyle = g; wc.fillRect(x * TS, top + 2, TS, VH - top);
    }
  }
}
const MUTATIONS = [
  { id: 'membrane', name: 'Thick Membrane', r: 0, max: 3, icon: 'shield', desc: 'Splashes cost 20% less DNA.', apply: R => { R.splashCost *= 0.8; } },
  { id: 'springcap', name: 'Springy Caps', r: 0, max: 3, icon: 'glow', desc: 'Glowcaps launch you 15% harder.', apply: R => { R.mods.padPower *= 1.15; } },
  { id: 'stem', name: 'Strong Stem', r: 0, max: 3, icon: 'arrow', desc: 'Fling 8% further.', apply: R => { R.mods.power *= 1.08; } },
  { id: 'sticky', name: 'Sticky Coat', r: 0, max: 2, icon: 'drop', desc: 'Grip the ground. You stop rolling sooner.', apply: R => { R.mods.grip *= 1.6; } },
  { id: 'strand', name: 'Extra Strand', r: 0, max: 3, icon: 'helix', desc: '+25 max DNA.', apply: R => { R.dnaMax += 25; } },
  { id: 'overgrowth', name: 'Overgrowth', r: 1, max: 2, icon: 'glow', desc: 'Glowcaps grow 30% bigger.', apply: R => { R.mods.padSize *= 1.3; } },
  { id: 'sight', name: 'Spore Sight', r: 1, max: 1, icon: 'eye', desc: 'Your aim guide reaches twice as far.', apply: R => { R.preview *= 2; } },
  { id: 'feather', name: 'Feather Seed', r: 1, max: 2, icon: 'feather', desc: 'Gravity pulls 12% less.', apply: R => { R.mods.grav *= 0.88; } },
  { id: 'kin', name: 'Firefly Kin', r: 1, max: 3, icon: 'fly', desc: 'Fireflies restore +20 more DNA.', apply: R => { R.flyHeal += 20; } },
  { id: 'rubber', name: 'Rubber Rind', r: 2, max: 1, icon: 'ball', desc: 'Soil is much bouncier.', apply: R => { R.mods.soilE += 0.22; } },
  { id: 'secondwind', name: 'Second Wind', r: 2, max: 1, icon: 'heart', desc: 'Your first splash in each room costs no DNA.', apply: R => { R.secondWind = true; } },
  { id: 'lure', name: 'Lure', r: 2, max: 1, icon: 'fly', desc: 'Fireflies drift toward you.', apply: R => { R.lure = true; } },
  { id: 'wing', name: 'Wing Spore', r: 3, max: 2, icon: 'wing', desc: 'Hop again in mid-air. Stacks.', apply: R => { R.airJumps++; } },
  { id: 'hydro', name: 'Hydrophobic', r: 3, max: 2, icon: 'wave', desc: 'Skip off the water once per leap.', apply: R => { R.mods.skips++; } },
  { id: 'truesight', name: 'True Sight', r: 3, max: 1, icon: 'eye', desc: 'Your aim guide shows every bounce.', apply: R => { R.trueSight = true; } },
  { id: 'homing', name: 'Homing Spore', r: 4, max: 1, icon: 'target', desc: 'The exit pulls you in when you get close.', apply: R => { R.mods.homing = true; } },
  { id: 'undertow', name: 'Undertow Bloom', r: 4, max: 1, icon: 'glow', desc: 'Splash, and a glowcap erupts and throws you back out.', apply: R => { R.undertow = true; } },
];

/* 12x12 pixel icons for the cards. a = outline, b = rarity colour, c = highlight */
const ICONS = {
  shield: ['..aaaaaaaa..', '.abbbbbbbba.', '.abccbbbbba.', '.abcbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....'],
  arrow: ['......aaaaa.', '.......abba.', '......abbba.', '.....abbaba.', '....abba.aa.', '...abba.....', '..abba......', '.abba.......', 'abba........', 'aba.........', '.a..........', '............'],
  drop: ['.....aa.....', '....abba....', '....abba....', '...abbbba...', '...abbbba...', '..abcbbbbba.', '.abccbbbbba.', '.abcbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '...aaaaaa...'],
  eye: ['............', '............', '....aaaa....', '..aabbbbaa..', '.abbbaabbba.', 'abbbaccabbba', 'abbbaccabbba', '.abbbaabbba.', '..aabbbbaa..', '....aaaa....', '............', '............'],
  feather: ['.........aa.', '........abba', '.......abbba', '......abcba.', '.....abcba..', '....abcba...', '...abcba....', '..abbba.....', '..abba......', '.abaa.......', '.a..........', 'a...........'],
  heart: ['............', '.aaa...aaa..', 'abbba.abbba.', 'abcbbabbbba.', 'abbbbbbbbba.', 'abbbbbbbbba.', '.abbbbbbba..', '..abbbbba...', '...abbba....', '....aba.....', '.....a......', '............'],
  wing: ['............', 'a...........', 'aa..........', 'aba.........', 'abba........', 'abbba....aa.', 'abbbbaaaabba', '.abbbbbbbbba', '..abbbbbbba.', '...aabbbba..', '.....aaaa...', '............'],
  wave: ['............', '...aaa......', '..abbba.....', '.abba.ba..a.', '.ba....abba.', '............', '...aaa......', '..abbba.....', '.abba.ba..a.', '.ba....abba.', '............', '............'],
  target: ['....aaaa....', '..aa....aa..', '.a..bbbb..a.', '.a.b....b.a.', 'a.b..cc..b.a', 'a.b.cccc.b.a', 'a.b.cccc.b.a', 'a.b..cc..b.a', '.a.b....b.a.', '.a..bbbb..a.', '..aa....aa..', '....aaaa....'],
  helix: ['.a......b...', '..a....b....', '...a..b.....', '....ab......', '....ba......', '...b..a.....', '..b....a....', '..b....a....', '...b..a.....', '....ba......', '....ab......', '...a..b.....'],
  ball: ['....aaaa....', '..aabbbbaa..', '.abccbbbbba.', '.abcbbbbbba.', 'abbbbbbbbbba', 'abbbbbbbbbba', 'abbbbbbbbbba', '.abbbbbbbba.', '.abbbbbbbba.', '..aabbbbaa..', '....aaaa....', '............'],
  fly: ['............', '..cc....cc..', '.cbbc..cbbc.', '.cbbcaacbbc.', '..ccabbacc..', '....abba....', '....abba....', '.....aa.....', '............', '............', '............', '............'],
};
function drawIcon(c, name, x, y, sc, color) {
  const rows = ICONS[name]; if (!rows) return;
  const pal = { a: '#1a1424', b: color, c: '#ffffff' };
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]; if (ch === '.') continue;
    c.fillStyle = pal[ch]; c.fillRect(x + i * sc, y + j * sc, sc, sc);
  }
}

/* ui. its all drawn in code to look like cells */
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
/* a cell membrane panel: dark outline, the membrane ring, cytoplasm fill, a highlight, organelles */
function membrane(x, y, w, h, r = 8, o = {}) {
  const c = o.c || ctx, edge = o.edge || MEM.edge;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (o.glow) { c.globalAlpha = o.glow; pxRound(c, x - 3, y - 3, w + 6, h + 6, r + 3, edge); c.globalAlpha = 1; }
  pxRound(c, x - 1, y - 1, w + 2, h + 2, r + 1, MEM.dark);
  pxRound(c, x, y, w, h, r, edge);
  pxRound(c, x + 1, y + 1, w - 2, h - 2, r - 1, o.edgeD || MEM.edgeD);
  pxRound(c, x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2), o.fill || MEM.cyto);
  c.fillStyle = o.hi || MEM.hi; c.globalAlpha = 0.55;
  c.fillRect(x + r, y + 1, Math.max(0, w - 2 * r), 1);
  c.globalAlpha = 1;
  if (o.dots) {
    c.fillStyle = edge;
    for (let i = 0; i < o.dots; i++) {
      const hx = hash(i * 7 + w + h * 3), hy = hash(i * 13 + x * 0 + h), s = 1 + ((hash(i * 3 + 1) * 2) | 0);
      c.globalAlpha = 0.18 + hash(i + 9) * 0.15;
      c.fillRect(Math.round(x + 4 + hx * (w - 10)), Math.round(y + 4 + hy * (h - 10)), s, s);
    }
    c.globalAlpha = 1;
  }
}
function pill(x, y, w, h = 14) { membrane(x, y, w, h, Math.floor(h / 2)); }

/* dna capsule */
const DNA = { x: 7, y: 28, w: 14, h: 150 };
const dnaInner = () => ({ x: DNA.x + 3, y: DNA.y + 3, w: DNA.w - 6, h: DNA.h - 6 });
function dnaFillTop() { const R = G.run, I = dnaInner(); return I.y + I.h * (1 - Math.max(0, R.dnaShown) / R.dnaMax); }
function drawDNABar(t) {
  const R = G.run; if (!R) return;
  membrane(DNA.x, DNA.y, DNA.w, DNA.h, 7);
  const I = dnaInner(), k = Math.max(0, R.dnaShown) / R.dnaMax, lag = Math.max(0, R.dnaLag) / R.dnaMax;
  const low = R.dna <= 25 * R.splashCost * 1.01;
  if (lag > k) pxRound(ctx, I.x, I.y, I.w, I.h, 4, 'rgba(255,230,200,0.75)', Math.round(I.h * (1 - lag)));
  const top = Math.round(I.h * (1 - k));
  if (k > 0) {
    const pulse = low && Math.sin(t * 6) > 0;
    pxRound(ctx, I.x, I.y, I.w, I.h, 4, pulse ? '#7a2a3a' : '#1f6f5e', top);
    pxRound(ctx, I.x + 2, I.y, I.w - 4, I.h, 2, pulse ? '#c4505e' : '#3fae84', top);
    for (let y = I.y + top; y < I.y + I.h - 1; y += 2) {
      const ph = (y - t * 26) * 0.2, cx = I.x + I.w / 2 - 0.5;
      const a = Math.round(cx + Math.sin(ph) * 3), b = Math.round(cx - Math.sin(ph) * 3);
      ctx.fillStyle = '#e4ffe8'; ctx.fillRect(a, y, 1, 1);
      ctx.fillStyle = '#9ff4ff'; ctx.fillRect(b, y, 1, 1);
      if ((y >> 1) % 3 === 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(a, b), y, Math.abs(a - b) + 1, 1); ctx.globalAlpha = 1; }
    }
    for (let i = 0; i < 4; i++) {
      const by = I.y + I.h - ((t * 14 + i * 37) % I.h);
      if (by > I.y + top + 1) { ctx.fillStyle = 'rgba(220,255,240,0.6)'; ctx.fillRect(I.x + 1 + ((i * 3) % (I.w - 2)), Math.round(by), 1, 1); }
    }
    ctx.fillStyle = 'rgba(230,255,245,0.8)'; ctx.fillRect(I.x + 1, I.y + top, I.w - 2, 1);
  }
  text('DNA', DNA.x + DNA.w / 2, DNA.y + DNA.h + 4, 1, low ? '#ffb0b0' : MEM.text, 'center');
  text(String(Math.max(0, Math.round(R.dnaShown))), DNA.x + DNA.w / 2, DNA.y + DNA.h + 15, 1, MEM.dim, 'center');
  // the mutations u have, little cells next to the capsule
  let y = DNA.y;
  for (const id of R.order) {
    const m = MUT[id], col = RARITY[m.r].color;
    pxCircle(ctx, DNA.x + 25, y + 7, 8, MEM.dark); pxCircle(ctx, DNA.x + 25, y + 7, 7, col); pxCircle(ctx, DNA.x + 25, y + 7, 6, RARITY[m.r].deep);
    if (m.icon === 'glow') ctx.drawImage(IMG.tp, SPR.glow[0], SPR.glow[1], SPR.glow[2], SPR.glow[3], DNA.x + 19, y + 3, 12, 9);
    else drawIcon(ctx, m.icon, DNA.x + 19, y + 1, 1, col);
    if (R.owned[id] > 1) text(String(R.owned[id]), DNA.x + 35, y + 2, 1, col);
    y += 18;
  }
}

/* mutation cards (theyre cells) */
const CW = 96, CH = 132;
const cardCache = new Map();
function wrapText(s, maxW) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const nx = cur ? cur + ' ' + w : w; if (textWidth(nx) > maxW && cur) { lines.push(cur); cur = w; } else cur = nx; }
  if (cur) lines.push(cur); return lines;
}
function cardFace(m, level) {
  const key = m.id + ':' + level; if (cardCache.has(key)) return cardCache.get(key);
  const c = document.createElement('canvas'); c.width = CW + 8; c.height = CH + 8;
  const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
  const rar = RARITY[m.r];
  withCtx(cx, () => {
    membrane(4, 4, CW, CH, 12, { edge: rar.color, edgeD: rar.mid, fill: rar.deep, dots: 14 });
    // nucleus
    const nx = 4 + CW / 2, ny = 4 + 36;
    pxCircle(cx, nx, ny, 20, rar.mid); pxCircle(cx, nx, ny, 19, rar.color); pxCircle(cx, nx, ny, 17, MEM.dark);
    cx.globalAlpha = 0.35; pxCircle(cx, nx, ny, 15, rar.mid); cx.globalAlpha = 1;
    if (m.icon === 'glow') cx.drawImage(IMG.tp, SPR.glow[0], SPR.glow[1], SPR.glow[2], SPR.glow[3], nx - 15, ny - 13, 30, 24);
    else drawIcon(cx, m.icon, nx - 12, ny - 12, 2, rar.color);
    text(m.name, nx, 4 + 60, 1, rar.color, 'center');
    cx.fillStyle = rar.color; cx.globalAlpha = 0.5;
    for (let x = 14; x < CW - 6; x += 3) cx.fillRect(x, 4 + 71, 1, 1);
    cx.globalAlpha = 1;
    wrapText(m.desc, CW - 16).slice(0, 4).forEach((ln, i) => text(ln, nx, 4 + 75 + i * 9, 1, MEM.text, 'center'));
    // rarity name + dots
    text(rar.name, nx, 4 + CH - 16, 1, rar.color, 'center');
    for (let i = 0; i <= m.r; i++) pxCircle(cx, nx - m.r * 4 + i * 8, 4 + CH - 5, 2, rar.color);
    if (level > 1) text('Lv ' + level, 4 + CW - 10, 4 + 8, 1, '#ffe9a8', 'right');
  });
  cardCache.set(key, c); return c;
}
let cardBackCanvas = null;
function cardBack() {
  if (cardBackCanvas) return cardBackCanvas;
  const c = document.createElement('canvas'); c.width = CW + 8; c.height = CH + 8;
  const cx = c.getContext('2d');
  withCtx(cx, () => {
    membrane(4, 4, CW, CH, 12, { edge: '#7fb8a8', edgeD: '#2d5a52', fill: '#10282a', dots: 22 });
    const nx = 4 + CW / 2, ny = 4 + CH / 2;
    for (let i = 0; i < 70; i++) {
      const a = i * 0.32, r = 2 + i * 0.5;
      cx.fillStyle = i % 4 ? '#3f8f7c' : '#9ff4dc'; cx.fillRect(Math.round(nx + Math.cos(a) * r), Math.round(ny + Math.sin(a) * r), 1 + (i % 7 === 0), 1 + (i % 7 === 0));
    }
    pxCircle(cx, nx, ny, 5, '#9ff4dc'); pxCircle(cx, nx, ny, 3, '#10282a');
  });
  return (cardBackCanvas = c);
}
function drawCilia(x, y, r, t, col) {
  if (r === 0) return;
  const n = [0, 8, 12, 16, 24][r], per = 2 * (CW + CH);
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per, px, py, nx, ny;
    if (d < CW) { px = x + d; py = y; nx = 0; ny = -1; } else if ((d -= CW) < CH) { px = x + CW; py = y + d; nx = 1; ny = 0; }
    else if ((d -= CH) < CW) { px = x + CW - d; py = y + CH; nx = 0; ny = 1; } else { d -= CW; px = x; py = y + CH - d; nx = -1; ny = 0; }
    const len = 2 + Math.round((Math.sin(t * 4 + i * 1.7) + 1) * 1.2), sway = Math.round(Math.sin(t * 3 + i) * 1);
    for (let k = 1; k <= len; k++) ctx.fillRect(Math.round(px + nx * (k + 1) + (ny ? sway * (k > 1) : 0)), Math.round(py + ny * (k + 1) + (nx ? sway * (k > 1) : 0)), 1, 1);
  }
}
function drawCard(m, x, y, flip, hover, t, picked) {
  const face = flip >= 0.5, sx = Math.max(0.02, Math.abs(Math.cos(flip * Math.PI)));
  const rar = RARITY[m.r];
  x = Math.round(x); y = Math.round(y - (hover ? 6 : 0));
  ctx.save();
  ctx.translate(x + CW / 2, 0); ctx.scale(sx, 1); ctx.translate(-CW / 2, 0);
  if (!face) { ctx.drawImage(cardBack(), -4, y - 4); ctx.restore(); return; }
  const anom = m.r === 4, edge = anom ? (Math.floor(t * 8) % 2 ? '#ff7fd8' : '#7ff6ff') : rar.color;
  if (hover || picked || m.r >= 3) { ctx.globalAlpha = picked ? 0.9 : 0.35 + 0.25 * Math.sin(t * 4); pxRound(ctx, -4, y - 4, CW + 8, CH + 8, 15, edge); ctx.globalAlpha = 1; }
  if (sx > 0.9) drawCilia(0, y, m.r, t, edge);
  const level = (G.run.owned[m.id] || 0) + (picked ? 0 : 1);
  ctx.drawImage(cardFace(m, level), -4, y - 4);
  if (anom) { ctx.globalAlpha = 0.6; ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(1.5, y + 1.5, CW - 3, CH - 3); ctx.globalAlpha = 1; }
  ctx.restore();
  if (anom && sx > 0.9) {
    if (Math.random() < 0.3) {
      const gy = y + 10 + Math.floor(Math.random() * (CH - 20)), gh = 2 + Math.floor(Math.random() * 3), off = Math.random() < 0.5 ? -2 : 2;
      ctx.drawImage(lo, x, gy, CW, gh, x + off, gy, CW, gh);
    }
  }
}

/* story mode. 21 generated levels, one artifact in each */
const LEVELS = window.GEN.STORY_LEVELS;
const RARITY = [
  { name: 'Common', color: '#cfe3dc', mid: '#5f7f78', deep: '#18302f', w: 50 },
  { name: 'Uncommon', color: '#8fe08a', mid: '#3f7f46', deep: '#132c1a', w: 27 },
  { name: 'Rare', color: '#7cc4ff', mid: '#346a96', deep: '#10233a', w: 14 },
  { name: 'Epic', color: '#c9a2ff', mid: '#6a4c9c', deep: '#211736', w: 7 },
  { name: 'Anomaly', color: '#ff8fd8', mid: '#8c3f78', deep: '#2a1028', w: 2.5 },
];
const G = {
  state: 'load', mode: 'story', w: null, ball: null, phase: 'play', phaseT: 0, roomT: 0, particles: [], popups: [], orbs: [],
  aim: null, kbAim: { a: 40, p: 0.6, on: false }, level: 0, run: null, draft: null, lastSafe: null, safeT: 0,
  time: 0, flies: 0, fade: 1, endT: 0, best: null, secondWindUsed: false, kbDraft: false, sinkX: 0, sinkY: 0, padGrown: false,
  roomSpores: 0, touch: false, hopQueued: false, trail: [], facing: 1,
  cam: { x: 0, y: 0 }, artifacts: [], menu: 0, save: null, airT: 0,
};
try { G.best = JSON.parse(localStorage.getItem('sporebound_story_best') || 'null'); G.save = JSON.parse(localStorage.getItem('sporebound_story_save') || 'null'); } catch (e) { }
const MUT = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
function newRun() {
  return { dna: 100, dnaMax: 100, dnaShown: 100, dnaLag: 100, splashCost: 1, mods: Object.assign({}, window.SB.DEFAULT_MODS),
    preview: 1, flyHeal: 10, secondWind: false, lure: false, airJumps: 0, trueSight: false, undertow: false,
    owned: {}, order: [], drafts: 0, pity: 0, spores: 0 };
}
function draftCards(R) {
  const pool = MUTATIONS.filter(m => (R.owned[m.id] || 0) < m.max);
  const out = [];
  while (out.length < 3 && pool.length) {
    const ws = pool.map(m => RARITY[m.r].w + (m.r === 4 ? R.pity * 1.5 : 0));
    let x = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (x > ws[i]) { x -= ws[i]; i++; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  R.pity = out.some(m => m.r === 4) ? 0 : R.pity + 1;
  return out;
}
function vmax() { return PHYS.VMAX * (G.run ? G.run.mods.power : 1); }
function startLevel(n) {
  G.level = n;
  G.w = window.GEN.makeGenWorld(n, G.run.mods);
  G.ball = makeBall(G.w.start.x, G.w.start.y);
  G.lastSafe = { x: G.w.start.x, y: G.w.start.y }; G.safeT = 0; G.airT = 0;
  G.phase = 'play'; G.phaseT = 0; G.roomT = 0; G.particles = []; G.popups = []; G.orbs = []; G.trail = [];
  G.aim = null; G.kbAim.on = false; G.state = 'play'; G.fade = 1; G.secondWindUsed = false; G.roomSpores = 0;
  G.facing = Math.sign(G.w.goal.x - G.w.start.x) || 1;
  G.cam.x = G.ball.x - VW / 2; G.cam.y = G.ball.y - VH * 0.55;
  chunkCache.clear();
  window.GEN.loadAround(G.w, G.ball.x, G.ball.y, 2);
  resetAirCharges();
  saveProgress();
}
function newGame() { G.run = newRun(); G.time = 0; G.flies = 0; G.artifacts = []; G.draft = null; startLevel(0); }
function continueGame() {
  const S = G.save; if (!S) return newGame();
  G.run = newRun();
  for (const id of S.order) for (let i = 0; i < (S.owned[id] || 0); i++) { MUT[id].apply(G.run); G.run.owned[id] = (G.run.owned[id] || 0) + 1; if (!G.run.order.includes(id)) G.run.order.push(id); }
  Object.assign(G.run, { dna: S.dna, dnaShown: S.dna, dnaLag: S.dna, spores: S.spores, drafts: S.drafts, pity: S.pity || 0 });
  G.time = S.time; G.flies = S.flies; G.artifacts = S.artifacts.slice(); G.draft = null;
  startLevel(S.level);
}
function saveProgress() {
  const R = G.run;
  G.save = { level: G.level, owned: R.owned, order: R.order, dna: R.dna, spores: R.spores, drafts: R.drafts, pity: R.pity, time: G.time, flies: G.flies, artifacts: G.artifacts };
  try { localStorage.setItem('sporebound_story_save', JSON.stringify(G.save)); } catch (e) { }
}
function clearSave() { G.save = null; try { localStorage.removeItem('sporebound_story_save'); } catch (e) { } }
function resetAirCharges() { if (G.ball && G.run) { G.ball.jumps = G.run.airJumps; G.ball.skips = G.run.mods.skips; G.ball.coyote = Math.max(G.ball.coyote, G.ball.grounded || G.ball.vy === 0 ? PHYS.COYOTE : 0); } }
const MENU = () => [...(G.save ? [{ id: 'continue', label: `Continue  -  level ${G.save.level + 1} of ${LEVELS}` }] : []), { id: 'story', label: 'Story  -  21 artifacts' }, { id: 'endless', label: 'Endless  -  coming soon', disabled: true }];
function menuSelect(i) {
  const it = MENU()[i]; if (!it || it.disabled) { AU.tick(); return; }
  AU.ui();
  if (it.id === 'continue') continueGame(); else newGame();
}

/* input. A/D to roll, space to hop, drag back (from the ground) to fling */
function toGame(e) { const r = screen.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; }
const TBTN = { left: [36, 362, 22], right: [92, 362, 22], hop: [VW - 40, 362, 26] };
const touchHeld = { left: null, right: null, hop: null };
let aimPointer = null;
function grounded() { return G.ball && G.ball.coyote > 0; }
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
  if (G.phase === 'draft') { G.kbDraft = false; pickCard(draftHit(p)); return; }
  if (G.touch) for (const k in TBTN) {
    const [bx, by, br] = TBTN[k];
    if ((p.x - bx) ** 2 + (p.y - by) ** 2 < (br + 6) ** 2) { touchHeld[k] = e.pointerId; if (k === 'hop') G.hopQueued = true; return; }
  }
  if (G.phase === 'play' && grounded()) { aimPointer = e.pointerId; G.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y, lastBucket: -1 }; G.kbAim.on = false; }
});
screen.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (G.state === 'title' && ready()) { const i = menuHit(p); if (i >= 0 && i !== G.menu) { G.menu = i; AU.tick(); } }
  if (G.draft) { const h = draftHit(p); if (h !== G.draft.hover && h >= 0 && draftReady()) AU.tick(); G.draft.hover = h; if (h >= 0) G.kbDraft = false; }
  if (G.aim && e.pointerId === aimPointer) { G.aim.x = p.x; G.aim.y = p.y; }
});
const release = e => {
  for (const k in touchHeld) if (touchHeld[k] === e.pointerId) touchHeld[k] = null;
  if (e.pointerId !== aimPointer) return;
  aimPointer = null;
  if (G.aim && G.phase === 'play' && grounded()) { const v = aimVector(); if (v.p > 0.06) fling(v.vx, v.vy, v.p); }
  G.aim = null;
};
screen.addEventListener('pointerup', release);
screen.addEventListener('pointercancel', release);

const keys = {};
const HOP_KEYS = ['Space', 'KeyW', 'ArrowUp', 'KeyK'];
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
  if (G.phase === 'draft') {
    const D = G.draft; if (!D) return;
    if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { pickCard(+e.code.slice(5) - 1); return; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { G.kbDraft = true; D.hover = -1; D.sel = Math.max(0, D.sel - 1); AU.tick(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { G.kbDraft = true; D.hover = -1; D.sel = Math.min(D.cards.length - 1, D.sel + 1); AU.tick(); }
    if (go) pickCard(D.hover >= 0 ? D.hover : D.sel);
    return;
  }
  if (G.phase === 'cleared') { if (go && G.phaseT > 1.2) nextLevel(); return; }
  if (G.phase !== 'play') return;
  if (G.kbAim.on) {
    if (go) { if (grounded()) { const a = G.kbAim.a * Math.PI / 180, v = G.kbAim.p * vmax(); fling(Math.cos(a) * v, -Math.sin(a) * v, G.kbAim.p); } G.kbAim.on = false; }
    if (e.code === 'KeyF' || e.code === 'Escape' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.kbAim.on = false;
    return;
  }
  if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && grounded()) { G.kbAim.on = true; G.kbAim.a = G.ball.vx < -5 || (G.w.mirror && G.ball.vx <= 5) ? 135 : 45; AU.tick(); return; }
  if (HOP_KEYS.includes(e.code)) G.hopQueued = true;
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
  b.vx = vx; b.vy = vy; b.t = 0; b.restT = 0; b.padCombo = 0; b.coyote = 0;
  resetAirCharges();
  AU.shoot(p);
}
function hop() {
  const b = G.ball;
  if (b.coyote > 0) {
    b.vy = Math.min(b.vy, -PHYS.HOP); b.coyote = 0; AU.hop();
    burst(b.x, b.y + 4, 5, { color: ['#c8b89a', '#8a7a62'], speed: 40, life: 0.35, g: 150 });
  } else if (b.jumps > 0) {
    b.jumps--; b.vy = Math.min(b.vy, -PHYS.HOP * 1.15); AU.hop();
  }
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
  R.dnaShown += (R.dna - R.dnaShown) * Math.min(1, dt * (R.dna > R.dnaShown ? 3 : 10));
  if (R.dnaLag > R.dnaShown) R.dnaLag = Math.max(R.dnaShown, R.dnaLag - 40 * dt); else R.dnaLag = R.dnaShown;
  if (G.phase === 'draft') { if (G.draft) updateDraft(dt); return; }
  G.time += dt; G.roomT += dt;
  window.GEN.loadAround(w, b.x, b.y, 2);
  updateCamera(dt);
  if (R.lure) for (const f of w.flies) if (!f.got) {
    const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
    if (d < 130 && d > 1) { f.x += dx / d * 70 * dt; f.y += dy / d * 70 * dt; }
  }
  if (G.kbAim.on) {
    const k = keys;
    if (k.ArrowLeft || k.KeyA) G.kbAim.a = Math.min(180, G.kbAim.a + 70 * dt);
    if (k.ArrowRight || k.KeyD) G.kbAim.a = Math.max(0, G.kbAim.a - 70 * dt);
    if (k.ArrowUp || k.KeyW) G.kbAim.p = Math.min(1, G.kbAim.p + 0.6 * dt);
    if (k.ArrowDown || k.KeyS) G.kbAim.p = Math.max(0.08, G.kbAim.p - 0.6 * dt);
  }
  if (G.phase === 'play') {
    const aiming = G.aim || G.kbAim.on;
    b.move = aiming ? 0 : ((keys.ArrowRight || keys.KeyD || touchHeld.right != null) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA || touchHeld.left != null) ? 1 : 0);
    if (G.hopQueued) { G.hopQueued = false; if (!aiming) hop(); }
    if (b.move) G.facing = b.move; else if (Math.abs(b.vx) > 40) G.facing = Math.sign(b.vx);
    const wasGround = b.grounded, preVy = b.vy;
    const ev = [];
    b.t = 0; b.ctl = true;
    const r = stepBall(w, b, dt, ev);
    if (!grounded()) { G.kbAim.on = false; if (G.aim) G.aim = null; }
    if (b.grounded) resetAirCharges();
    for (const e of ev) {
      if (e.t === 'hit') {
        if (e.kind === 'cap') { AU.cap(); e.ref.squish = 1; }
        else { if (e.v > 70) AU.hit(e.kind, e.v); if (e.v > 160) burst(e.x, e.y, 4, { color: ['#8a7a62', '#5a4e40'], speed: 60, life: 0.4 }); }
      } else if (e.t === 'pad') {
        AU.pad(e.combo); e.pad.squish = 1;
        if (e.combo > 1) popup('x' + e.combo, b.x, b.y - 10, '#9ff4ff');
      } else if (e.t === 'fly') {
        AU.fly(); G.flies++;
        const heal = Math.min(R.dnaMax - R.dna, R.flyHeal); R.dna += heal;
        popup(heal > 0 ? `+${Math.round(heal)} DNA` : 'Firefly!', e.f.x, e.f.y - 10, '#eaff8a');
      } else if (e.t === 'skip') {
        AU.skip(); popup('Skip!', e.x, e.y - 12, '#a4fff5');
      }
    }
    if (G.phaseT % 0.05 < dt && !b.grounded) { G.trail.push({ x: b.x, y: b.y }); if (G.trail.length > 14) G.trail.shift(); }
    if (b.grounded) G.trail.length = Math.max(0, G.trail.length - 1);
    // remember the last safe spot so we can respawn there
    const tx0 = Math.floor((b.x - 9) / TS), tx1 = Math.floor((b.x + 9) / TS), ty = Math.floor((b.y + PHYS.R + 2) / TS);
    const footing = ['#', '-'].includes(tileAt(w, tx0, ty)) && ['#', '-'].includes(tileAt(w, tx1, ty));
    if (b.grounded && !b.groundMoving && footing && Math.abs(b.vx) < 160) { G.safeT += dt; if (G.safeT > 0.15) G.lastSafe = { x: b.x, y: b.y }; } else G.safeT = 0;
    // fell way down into the dark under ur last spot
    if (b.grounded) G.airT = 0; else G.airT += dt;
    if (!b.grounded && b.y > G.lastSafe.y + 560 && G.airT > 1.2) lostInDark();
    else if (r === 'goal') artifactFound();
    else if (r === 'sink') sink();
  } else if (G.phase === 'dead') {
    if (!G.padGrown && G.phaseT > 0.45) {
      G.padGrown = true;
      const pad = growPad(w, G.sinkX, G.sinkY);
      if (pad) { AU.grow(); popup('A glowcap grew!', pad.cx, pad.sy - 40, '#9ff4ff'); }
    }
    if (G.phaseT > 1.25) { if (R.dna <= 0) openDraft(); else respawn(); }
  } else if (G.phase === 'cleared') {
    const g = w.goal; b.x += (g.x - b.x) * Math.min(1, dt * 4); b.y += (g.y - b.y) * Math.min(1, dt * 4);
    if (G.phaseT > 4.5) nextLevel();
  }
}
/* lose dna. it turns into the spore the glowcap grows from */
function sink() {
  const b = G.ball, w = G.w, R = G.run;
  const sy = surfaceY(w, b.x, b.y) || b.y;
  AU.splash();
  let cost = Math.round(25 * R.splashCost);
  if (R.secondWind && !G.secondWindUsed) { G.secondWindUsed = true; cost = 0; popup('Second wind!', b.x, sy - 26, '#ffb0c8'); }
  if (cost > 0) { R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = Math.max(0, R.dna - cost); AU.dnaLoss(); popup(`-${cost} DNA`, G.cam.x + DNA.x + 34, G.cam.y + dnaFillTop(), '#ffb0b0'); }
  R.spores++; G.roomSpores++;
  sendSpore(b.x - G.cam.x, sy - G.cam.y);
  if (R.undertow && R.dna > 0) {
    let pad = growPad(w, b.x, b.y);
    if (pad) pad.grow = 0.7;
    else pad = w.pads.reduce((a, p) => (!a || Math.abs(p.x - b.x) < Math.abs(a.x - b.x)) ? p : a, null);
    if (pad) {
      pad.squish = 1; AU.grow(); AU.pad(1);
      b.x = pad.cx; b.y = pad.cy - pad.r - PHYS.R - 1; b.vx *= 0.4; b.vy = -520;
      popup('Undertow!', pad.cx, pad.sy - 44, '#ff8fd8');
      return;
    }
  }
  G.phase = 'dead'; G.phaseT = 0; G.padGrown = false; G.sinkX = b.x; G.sinkY = b.y;
}
function die(manual) { if (manual) { G.phase = 'dead'; G.phaseT = 0.45; G.padGrown = true; AU.pop(); } }
function respawn() {
  G.ball = makeBall(G.lastSafe.x, G.lastSafe.y); resetAirCharges();
  G.phase = 'play'; G.trail = [];
  AU.pop();
}
function lostInDark() {
  const R = G.run, cost = Math.round(15 * R.splashCost);
  R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = Math.max(0, R.dna - cost); AU.dnaLoss();
  popup(`The dark took ${cost} DNA`, G.ball.x, G.ball.y - 20, '#b0b8ff');
  R.spores++; G.roomSpores++;
  G.phase = 'dead'; G.phaseT = 0.45; G.padGrown = true;
}
function artifactFound() {
  G.phase = 'cleared'; G.phaseT = 0;
  if (!G.artifacts.includes(G.level)) G.artifacts.push(G.level);
  AU.holed(true);
  const g = G.w.goal, col = G.w.L.info.artifact[2];
  burst(g.x, g.y, 34, { color: [col, '#ffffff', '#fff6c0'], speed: 140, life: 1.2, g: 30 });
  G.ball.vx = G.ball.vy = 0;
}
function nextLevel() {
  if (G.level + 1 < LEVELS) startLevel(G.level + 1); else finish();
}
function finish() {
  G.state = 'end'; G.endT = 0; clearSave();
  const score = { time: G.time, spores: G.run.spores };
  if (!G.best || score.time < G.best.time) { G.best = score; try { localStorage.setItem('sporebound_story_best', JSON.stringify(score)); } catch (e) { } }
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* the draft */
function cardPos(i) { return { x: VW / 2 - (3 * CW + 2 * 22) / 2 + i * (CW + 22), y: 110 }; }
const DEAL = i => 0.12 * i, FLIP = i => 0.6 + 0.24 * i;
function openDraft() {
  G.phase = 'draft'; G.phaseT = 0;
  G.draft = { cards: draftCards(G.run), t: 0, hover: -1, sel: 1, picked: -1, pickT: 0, revealed: [false, false, false] };
  AU.drain();
}
function draftReady() { return G.draft && G.draft.picked < 0 && G.draft.t > FLIP(2) + 0.3; }
function pickCard(i) {
  const D = G.draft; if (!draftReady() || i < 0 || i >= D.cards.length) return;
  const m = D.cards[i], R = G.run;
  D.picked = i; D.pickT = 0;
  m.apply(R); R.owned[m.id] = (R.owned[m.id] || 0) + 1; if (!R.order.includes(m.id)) R.order.push(m.id);
  R.drafts++;
  Object.assign(G.w.mods, R.mods);
  AU.mutate(m.r);
  const p = cardPos(i);
}
function updateDraft(dt) {
  const D = G.draft; D.t += dt;
  for (let i = 0; i < D.cards.length; i++) if (!D.revealed[i] && D.t > FLIP(i) + 0.12) { D.revealed[i] = true; AU.reveal(D.cards[i].r); }
  if (D.picked >= 0) {
    D.pickT += dt;
    if (D.pickT > 1.5) {
      const R = G.run; R.dna = R.dnaMax; R.dnaLag = R.dnaShown;
      G.draft = null; AU.reborn();
      respawn();
      popup('Reborn!', G.ball.x, G.ball.y - 20, '#d8ffd0');
    }
  }
}
function renderDraft(t) {
  const D = G.draft; if (!D) return;
  const fadeIn = Math.min(1, D.t * 3), out = D.picked >= 0 ? Math.max(0, 1 - Math.max(0, D.pickT - 1.0) * 2) : 1;
  ctx.globalAlpha = fadeIn * out; ctx.fillStyle = 'rgba(6,16,18,0.8)'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = out;
  membrane(VW / 2 - 140, 26, 280, 62, 14, { dots: 10 });
  text('Your DNA unravels...', VW / 2, 36, 2, '#9ff4dc', 'center');
  text(D.picked >= 0 ? `You mutated: ${D.cards[D.picked].name}` : 'Choose a mutation and be reborn', VW / 2, 70, 1, MEM.text, 'center');
  for (let i = 0; i < D.cards.length; i++) {
    const p = cardPos(i), dk = Math.min(1, Math.max(0, (D.t - DEAL(i)) / 0.35)), e = 1 - Math.pow(1 - dk, 3);
    const flip = Math.min(1, Math.max(0, (D.t - FLIP(i)) / 0.25));
    let y = VH + 20 + (p.y - VH - 20) * e;
    if (D.picked >= 0 && D.picked !== i) { ctx.globalAlpha = Math.max(0, 1 - D.pickT * 2) * out; y += D.pickT * 40; }
    if (D.picked === i) y -= Math.min(1, D.pickT * 4) * 10;
    drawCard(D.cards[i], p.x, y, flip, draftReady() && (D.hover === i || (D.hover < 0 && D.sel === i && G.kbDraft)), t, D.picked === i);
    ctx.globalAlpha = out;
    if (draftReady()) text(String(i + 1), p.x + CW / 2, p.y + CH + 10, 1, '#5f8f84', 'center', null);
  }
  ctx.globalAlpha = out;
  if (draftReady()) text('Click a card  -  or arrows + Space  -  or 1 2 3', VW / 2, 284, 1, MEM.dim, 'center');
  const R = G.run;
  if (R.order.length) {
    const s = 'Mutations: ' + R.order.map(id => MUT[id].name + (R.owned[id] > 1 ? ' x' + R.owned[id] : '')).join(', ');
    wrapText(s, 560).slice(0, 3).forEach((ln, i) => text(ln, VW / 2, 304 + i * 11, 1, '#6f9a90', 'center'));
  }
  ctx.globalAlpha = 1;
}
function draftHit(p) {
  for (let i = 0; i < 3; i++) { const c = cardPos(i); if (p.x >= c.x && p.x <= c.x + CW && p.y >= c.y - 6 && p.y <= c.y + CH) return i; }
  return -1;
}
function sendSpore(x1, y1) { G.orbs.push({ x0: DNA.x + DNA.w / 2, y0: dnaFillTop(), x1, y1, t: 0 }); }
function drawOrbs(dt) {
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i]; o.t += dt / 0.45;
    if (o.t >= 1) { G.orbs.splice(i, 1); continue; }
    const k = o.t, mx = (o.x0 + o.x1) / 2, my = Math.min(o.y0, o.y1) - 60;
    const x = (1 - k) * (1 - k) * o.x0 + 2 * (1 - k) * k * mx + k * k * o.x1, y = (1 - k) * (1 - k) * o.y0 + 2 * (1 - k) * k * my + k * k * o.y1;
    ctx.globalAlpha = 0.35; pxCircle(ctx, x, y, 4, '#9ff4ff'); ctx.globalAlpha = 1;
    ctx.fillStyle = '#e0fff8'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    if (Math.random() < 0.6) G.particles.push({ x: x + G.cam.x, y: y + G.cam.y, vx: 0, vy: 10, life: 0.4, max: 0.4, g: 0, color: Math.random() < 0.5 ? '#9ff4ff' : '#d8ffd0', size: 1 });
  }
}

const BG_OFF = [0, 420, 760, 1100];
function drawBackground(bgi, t, px) {
  const off = BG_OFF[bgi % BG_OFF.length], par = ((px || VW / 2) - VW / 2);
  const b3 = bgi % 2 ? IMG.bg3alt : IMG.bg3;
  ctx.drawImage(b3, Math.round(off * 0.5 + t * 2) % (b3.width - VW), 0, VW, VH, 0, 0, VW, VH);
  const o2 = Math.max(0, Math.min(IMG.bg2.width - VW, Math.round(off * 0.7 + par * 0.03)));
  ctx.drawImage(IMG.bg2, o2, 0, VW, VH, 0, 0, VW, VH);
  const o1 = Math.max(0, Math.min(IMG.bg1.width - VW, Math.round(off + par * 0.08)));
  ctx.drawImage(IMG.bg1, o1, 0, VW, VH, 0, 0, VW, VH);
}
function easeBack(g) { return g >= 1 ? 1 : 1 + 2.7 * Math.pow(g - 1, 3) + 1.7 * Math.pow(g - 1, 2); }
function drawPad(p) {
  const s = SPR.glow, g = easeBack(p.grow), sq = Math.sin(p.squish * Math.PI) * p.squish;
  const ps = p.scale || 1;
  const w = Math.round(s[2] * ps * g * (1 + sq * 0.15)), h = Math.round(s[3] * ps * g * (1 - sq * 0.25));
  if (w < 1 || h < 1) return;
  const glow = 0.25 + 0.1 * Math.sin(T * 3 + p.x);
  ctx.fillStyle = `rgba(120,240,255,${glow * g})`;
  ctx.beginPath(); ctx.ellipse(Math.round(p.cx), Math.round(p.sy - 14 * ps), 26 * g * ps, 18 * g * ps, 0, 0, 6.29); ctx.fill();
  ctx.drawImage(IMG.tp, s[0], s[1], s[2], s[3], Math.round(p.cx - 22 * w / s[2]), Math.round(p.sy + 8 - h), w, h);
}
function drawCap(c) {
  const s = SPR.bigMush, sq = Math.sin(c.squish * Math.PI) * c.squish;
  const w = Math.round(s[2] * (1 + sq * 0.12)), h = Math.round(s[3] * (1 - sq * 0.18));
  ctx.drawImage(IMG.tp, s[0], s[1], s[2], s[3], Math.round(c.ox + 35 - 35 * w / s[2]), Math.round(c.oy + s[3] - h), w, h);
}
function drawSwing(s) {
  ctx.strokeStyle = '#263030'; ctx.lineWidth = 1;
  const c = Math.cos(s.th), sn = Math.sin(s.th);
  for (const k of [-31, 31]) { ctx.beginPath(); ctx.moveTo(s.x + 0.5, s.y); ctx.lineTo(Math.round(s.lx + k * c) + 0.5, Math.round(s.ly - k * sn - 4)); ctx.stroke(); }
  const L = SPR.log;
  ctx.save(); ctx.translate(Math.round(s.lx), Math.round(s.ly)); ctx.rotate(-s.th);
  ctx.drawImage(IMG.tp, L[0], L[1], L[2], L[3], -39, -6, L[2], L[3]);
  ctx.restore();
}
function drawGoal(g, t) {
  /* the exit. just a soft rift of light, no sign */
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
  if (R && R.trueSight) {
    const sb = makeBall(b.x, b.y); sb.vx = v.vx; sb.vy = v.vy; sb.skips = R.mods.skips;
    const steps = Math.round(150 * R.preview);
    for (let i = 0; i < steps; i++) {
      const r = stepBall(w, sb, PHYS.DT, null);
      if (i % 6 === 0) {
        ctx.globalAlpha = 1 - i / (steps + 10);
        ctx.fillStyle = '#1a1424'; ctx.fillRect(Math.round(sb.x) - 2, Math.round(sb.y) - 2, 4, 4);
        ctx.fillStyle = i % 12 ? '#e9d8ff' : '#c58aff'; ctx.fillRect(Math.round(sb.x) - 1, Math.round(sb.y) - 1, 2, 2);
      }
      if (r) { if (r === 'goal') { ctx.globalAlpha = 1; ctx.fillStyle = '#eaff8a'; ctx.fillRect(Math.round(sb.x) - 2, Math.round(sb.y) - 2, 5, 5); } break; }
    }
  }
  let x = b.x, y = b.y, vx = v.vx, vy = v.vy;
  const dt = 1 / 60, g = PHYS.G * (R ? R.mods.grav : 1), steps = Math.round(34 * (R ? R.preview : 1));
  for (let i = 0; i < steps && !(R && R.trueSight); i++) {
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

function drawTouchButtons() {
  if (!G.touch) return;
  for (const k in TBTN) {
    const [bx, by, br] = TBTN[k], held = touchHeld[k] != null;
    ctx.globalAlpha = held ? 0.85 : 0.5;
    pxCircle(ctx, bx, by, br + 1, MEM.dark); pxCircle(ctx, bx, by, br, MEM.edge); pxCircle(ctx, bx, by, br - 2, held ? '#1f5048' : '#10282a');
    ctx.fillStyle = MEM.hi;
    if (k === 'left') for (let i = 0; i < 9; i++) ctx.fillRect(bx - 5 + i, by - i / 1.5, 1, Math.round(i * 1.33) + 1);
    else if (k === 'right') for (let i = 0; i < 9; i++) ctx.fillRect(bx + 5 - i, by - i / 1.5, 1, Math.round(i * 1.33) + 1);
    else text('hop', bx, by - 3, 1, MEM.hi, 'center', null);
    ctx.globalAlpha = 1;
  }
}

/* drawing the world. endless chunks, the camera scrolls, deeper = darker */
const CHUNK_PX = window.GEN.CH * TS;
const chunkCache = new Map();
function chunkCanvas(cx, cy) {
  const k = cx + ',' + cy; let c = chunkCache.get(k);
  if (c) return c;
  const w = G.w, off = OFF[G.level % 2 ? 'green' : 'orange'], CHN = window.GEN.CH, PAD = TS;
  const terr = document.createElement('canvas'); terr.width = CHUNK_PX; terr.height = CHUNK_PX + PAD * 2;
  const wat = document.createElement('canvas'); wat.width = CHUNK_PX; wat.height = CHUNK_PX;
  const tc = terr.getContext('2d'), wc = wat.getContext('2d'); tc.imageSmoothingEnabled = wc.imageSmoothingEnabled = false;
  const S = (x, y) => tileAt(w, x, y) === '#';
  for (let j = 0; j < CHN; j++) for (let i = 0; i < CHN; i++) {
    const x = cx * CHN + i, y = cy * CHN + j, ch = tileAt(w, x, y), dx = i * TS, dy = j * TS + PAD, hsh = x * 31 + y * 17;
    if (ch === '#') {
      const up = S(x, y - 1), dn = S(x, y + 1), lf = S(x - 1, y), rt = S(x + 1, y);
      let t;
      if (!up && !lf) t = TSET.tl; else if (!up && !rt) t = TSET.tr; else if (!up) t = pick(TSET.t, hsh);
      else if (!dn && !lf) t = TSET.bl; else if (!dn && !rt) t = TSET.br; else if (!dn) t = pick(TSET.b, hsh);
      else if (!lf) t = pick(TSET.l, hsh); else if (!rt) t = pick(TSET.r, hsh);
      else if (!S(x, y - 2)) t = pick(TSET.under, hsh); else t = pick(TSET.fill, hsh);
      tile(tc, t, dx, dy, off);
      if (!up && lf && rt && hash(hsh + 5) > 0.35 && tileAt(w, x, y - 1) === '.') tile(tc, pick(TSET.tuft, hsh + 2), dx, dy - TS, off);
      if (!dn && TSET.drip[t[0]] && tileAt(w, x, y + 1) === '.') tile(tc, TSET.drip[t[0]], dx, dy + TS, off);
    } else if (ch === '-') {
      const l = tileAt(w, x - 1, y) === '-', r = tileAt(w, x + 1, y) === '-';
      tile(tc, [!l ? 12 : !r ? 14 : 13, 10], dx, dy - 2);
      if (hash(hsh) > 0.4) tile(tc, [12 + (Math.abs(hsh) % 2), 9], dx, dy - TS - 2);
    } else if (ch === '~') {
      const surf = tileAt(w, x, y - 1) !== '~';
      tile(wc, surf ? [4, 8] : [5, 8], dx, j * TS);
      let depth = 0; while (depth < 4 && tileAt(w, x, y - depth - 1) === '~') depth++;
      wc.fillStyle = `rgba(14,24,34,${Math.min(0.6, depth * 0.18 + 0.05)})`; wc.fillRect(dx, j * TS + (surf ? 2 : 0), TS, surf ? TS - 2 : TS);
    }
  }
  c = { terr, wat, deco: w.L.chunk(cx, cy).deco };
  chunkCache.set(k, c);
  if (chunkCache.size > 160) { for (const kk of chunkCache.keys()) { chunkCache.delete(kk); if (chunkCache.size < 120) break; } }
  return c;
}
function visibleChunks(fn) {
  const cx0 = Math.floor(G.cam.x / CHUNK_PX), cy0 = Math.floor((G.cam.y - TS) / CHUNK_PX);
  const cx1 = Math.floor((G.cam.x + VW) / CHUNK_PX), cy1 = Math.floor((G.cam.y + VH + TS) / CHUNK_PX);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(cx, cy, chunkCanvas(cx, cy));
}
function updateCamera(dt) {
  const b = G.ball, look = Math.max(-80, Math.min(80, b.vx * 0.35));
  const tx = b.x - VW / 2 + look, ty = b.y - VH * 0.55 + Math.max(-40, Math.min(60, b.vy * 0.12));
  const k = Math.min(1, dt * 5);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}
function drawWorldBackground(t) {
  const cam = G.cam, bgi = G.level % 4;
  const b3 = bgi % 2 ? IMG.bg3alt : IMG.bg3;
  const wrapDraw = (img, f, extra) => {
    const span = img.width, sx = (((cam.x * f + extra) % span) + span) % span;
    ctx.drawImage(img, sx, 0, Math.min(VW, span - sx), VH, 0, 0, Math.min(VW, span - sx), VH);
    if (span - sx < VW) ctx.drawImage(img, 0, 0, VW - (span - sx), VH, span - sx, 0, VW - (span - sx), VH);
  };
  wrapDraw(b3, 0.05, t * 2 + bgi * 300);
  wrapDraw(IMG.bg2, 0.15, bgi * 400);
  wrapDraw(IMG.bg1, 0.3, bgi * 700);
  // height tint. deeper gets darker and bluer, higher gets brighter and warmer
  const alt = -(cam.y + VH / 2 - G.w.start.y) / TS;
  if (alt < 0) { ctx.fillStyle = `rgba(6,14,24,${Math.min(0.62, -alt / 120)})`; ctx.fillRect(0, 0, VW, VH); }
  else { ctx.fillStyle = `rgba(255,248,225,${Math.min(0.22, alt / 160)})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawArtifact(g, t, info, k) {
  const col = info.artifact[2], y = g.y + Math.sin(t * 1.8) * 3 - k * 20, x = g.x;
  ctx.globalAlpha = (0.12 + 0.06 * Math.sin(t * 2)) * (1 - k);
  ctx.fillStyle = col; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 120, 6, 120);
  ctx.globalAlpha = 0.25 * (1 - k * 0.5); pxCircle(ctx, x, y, 14 + k * 8, col);
  ctx.globalAlpha = 0.45; pxCircle(ctx, x, y, 8, '#ffffff');
  ctx.globalAlpha = 1;
  // lil relic
  const s = [[0, -7], [5, -2], [3, 6], [-3, 6], [-5, -2]];
  ctx.fillStyle = MEM.dark;
  for (let yy = -8; yy <= 7; yy++) { const hw = yy < -2 ? (yy + 8) : yy < 6 ? 6 - (yy + 2) * 0.25 : 3; ctx.fillRect(Math.round(x - hw - 1), Math.round(y + yy), Math.round(hw * 2 + 2), 1); }
  ctx.fillStyle = col;
  for (let yy = -7; yy <= 6; yy++) { const hw = yy < -2 ? (yy + 7) * 0.9 : yy < 6 ? 5 - (yy + 2) * 0.25 : 2; ctx.fillRect(Math.round(x - hw), Math.round(y + yy), Math.round(hw * 2), 1); }
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8; ctx.fillRect(Math.round(x - 2), Math.round(y - 4), 2, 3); ctx.globalAlpha = 1;
  for (let i = 0; i < 6; i++) {
    const a = t * 1.5 + i / 6 * 6.283, r = 13 + Math.sin(t * 2 + i) * 2 + k * 20;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i); ctx.fillStyle = i % 2 ? col : '#ffffff';
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function renderPlay(t, dt) {
  const w = G.w, L = w.L, cam = G.cam, cx = Math.round(cam.x), cy = Math.round(cam.y);
  drawWorldBackground(t);
  ctx.save(); ctx.translate(-cx, -cy);
  const decos = [], vis = [];
  visibleChunks((ccx, ccy, c) => { vis.push([ccx, ccy, c]); for (const d of c.deco) decos.push(d); });
  for (const [name, tx, ty] of decos) { const s = SPR[name]; spr(ctx, name, tx * TS + 8 - s[2] / 2, ty * TS - s[3] + 2); }
  for (const [ccx, ccy, c] of vis) ctx.drawImage(c.terr, ccx * CHUNK_PX, ccy * CHUNK_PX - TS);
  for (const c of w.caps) if (Math.abs(c.ox - cam.x - VW / 2) < VW) drawCap(c);
  w.flies.forEach((f, i) => { if (Math.abs(f.x - cam.x - VW / 2) < VW && Math.abs(f.y - cam.y - VH / 2) < VH) drawFly(f, t, i); });
  drawArtifact(w.goal, t, L.info, G.phase === 'cleared' ? Math.min(1, G.phaseT) : 0);
  for (const p of w.pads) drawPad(p);
  for (let i = 0; i < G.trail.length; i++) { ctx.globalAlpha = i / G.trail.length * 0.5; ctx.fillStyle = '#fff2cc'; ctx.fillRect(Math.round(G.trail[i].x), Math.round(G.trail[i].y), 1, 1); }
  ctx.globalAlpha = 1;
  if (G.phase === 'dead') { const b = G.ball; if (G.phaseT < 0.4) drawBall({ x: b.x, y: b.y + G.phaseT * 30, vx: 0, vy: 0 }, t, 1 - G.phaseT * 2.2); }
  else if (G.phase !== 'draft') drawBall(G.ball, t);
  for (const [ccx, ccy, c] of vis) ctx.drawImage(c.wat, ccx * CHUNK_PX, ccy * CHUNK_PX);
  if (G.phase === 'play' && (G.aim || G.kbAim.on)) drawAim(t);
  drawParticles(dt);
  ctx.restore();
  if (G.aim) {
    ctx.strokeStyle = 'rgba(234,255,246,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(G.aim.sx + 0.5, G.aim.sy + 0.5); ctx.lineTo(G.aim.x + 0.5, G.aim.y + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(234,255,246,0.6)'; ctx.fillRect(Math.round(G.aim.sx) - 1, Math.round(G.aim.sy) - 1, 3, 3);
  }
  drawOrbs(dt);
  // hud
  const lvl = `Level ${G.level + 1}/${LEVELS}  -  ${L.info.name}`;
  pill(30, 4, textWidth(lvl) + 16); text(lvl, 38, 7, 1, MEM.text);
  const alt = Math.round(-(G.ball.y - w.start.y) / TS);
  const altS = (alt > 0 ? '+' : '') + alt + 'm';
  const sw = 190; pill(VW - sw - 6, 4, sw);
  ctx.drawImage(IMG.tp, SPR.glow[0], SPR.glow[1], SPR.glow[2], SPR.glow[3], VW - sw + 2, 5, 14, 11);
  text(String(G.run.spores), VW - sw + 19, 7, 1, '#9ff4ff');
  ctx.fillStyle = '#eaff8a'; ctx.fillRect(VW - sw + 40, 10, 2, 2); ctx.globalAlpha = 0.4; ctx.fillRect(VW - sw + 39, 9, 4, 4); ctx.globalAlpha = 1;
  text(String(G.flies), VW - sw + 46, 7, 1, '#eaff8a');
  text(altS, VW - sw + 70, 7, 1, alt < 0 ? '#9fb8ff' : '#ffe9a8');
  text(fmtTime(G.time), VW - sw + 112, 7, 1, MEM.text);
  text(AU.muted ? 'M:off' : 'M:on', VW - 12, 7, 1, MEM.dim, 'right');
  const jumps = G.ball.jumps || 0;
  if (G.run.airJumps > 0) for (let i = 0; i < G.run.airJumps; i++) pxCircle(ctx, 40 + i * 8, 24, 2, i < jumps ? '#c9a2ff' : '#3a3050');
  drawDNABar(t);
  drawTouchButtons();
  if (G.roomT < 8 && G.phase === 'play' && G.level === 0 && !G.touch) {
    ctx.globalAlpha = Math.min(1, (8 - G.roomT) / 1.5);
    const hint = 'A/D roll  -  Space hop  -  drag back from the ground to fling (or F to aim)';
    const hw = textWidth(hint) + 16; pill(VW / 2 - hw / 2, 24, hw); text(hint, VW / 2, 27, 1, MEM.text, 'center'); ctx.globalAlpha = 1;
  }
  if (G.roomT < 2.6 && G.phase === 'play') {
    const k = G.roomT < 0.3 ? G.roomT / 0.3 : G.roomT > 2.1 ? (2.6 - G.roomT) / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, k);
    text(`Level ${G.level + 1}`, VW / 2, 104, 2, '#9ff4dc', 'center');
    text(L.info.name, VW / 2, 132, 4, MEM.text, 'center');
    text(`Somewhere here lies the ${L.info.artifact[0].replace(/^The /, '')}.`, VW / 2, 176, 1, L.info.artifact[2], 'center');
    ctx.globalAlpha = 1;
  }
  if (G.phase === 'cleared') {
    const k = Math.min(1, G.phaseT * 3), A = L.info.artifact;
    ctx.globalAlpha = k;
    membrane(VW / 2 - 160, 110, 320, 110, 16, { dots: 14, glow: 0.25, edge: A[2] });
    text(`Artifact ${G.level + 1} of ${LEVELS}`, VW / 2, 120, 1, MEM.dim, 'center');
    text(A[0], VW / 2, 136, 3, A[2], 'center');
    text(`"${A[1]}"`, VW / 2, 176, 1, MEM.text, 'center');
    text(G.roomSpores ? `${G.roomSpores} spore${G.roomSpores === 1 ? '' : 's'} left behind here  -  ${fmtTime(G.roomT)}` : `Not a single splash  -  ${fmtTime(G.roomT)}`, VW / 2, 194, 1, '#9ff4ff', 'center');
    if (G.phaseT > 1.2) { ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 4)); text('Space to continue', VW / 2, 208, 1, MEM.dim, 'center'); }
    ctx.globalAlpha = 1;
  }
  renderDraft(t);
}

function renderTitle(t) {
  drawBackground(0, t, VW / 2 + Math.sin(t * 0.2) * 200);
  ctx.fillStyle = 'rgba(10,24,26,0.25)'; ctx.fillRect(0, 0, VW, VH);
  const wy = 340;
  for (let x = 0; x < VW; x += TS) { ctx.drawImage(IMG.tp, 4 * TS, 8 * TS, TS, TS, x, wy, TS, TS); for (let y = wy + TS; y < VH; y += TS) ctx.drawImage(IMG.tp, 5 * TS, 8 * TS, TS, TS, x, y, TS, TS); }
  const per = 1.6, ph = (t % per) / per, left = 230, right = 410;
  const goingRight = Math.floor(t / per) % 2 === 0;
  const bx = goingRight ? left + (right - left) * ph : right - (right - left) * ph, by = wy - 26 - Math.sin(ph * Math.PI) * 110;
  const sq = ph < 0.1 ? 1 - ph / 0.1 : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;
  for (const [x, s] of [[left, goingRight ? sq * (ph < 0.5 ? 1 : 0) : sq * (ph > 0.5 ? 1 : 0)], [right, goingRight ? sq * (ph > 0.5 ? 1 : 0) : sq * (ph < 0.5 ? 1 : 0)]]) drawPad({ cx: x, sy: wy, x, grow: 1, squish: s * 0.8 });
  drawBall({ x: bx, y: by, vx: goingRight ? 120 : -120, vy: Math.cos(ph * Math.PI) * -200 }, t);
  const word = 'Sporebound', sc = 5, tw = [...word].reduce((a, ch) => a + textWidth(ch, sc) + (fontFor(sc) ? sc : 0), 0);
  let x = VW / 2 - tw / 2;
  for (let i = 0; i < word.length; i++) {
    const b = Math.abs(Math.sin(t * 2.4 + i * 0.45)) * 8;
    text(word[i], x, 60 - b, sc, i === 5 ? '#9ff4dc' : '#f2fff8', 'left', '#0b1a1c');
    x += textWidth(word[i], sc) + (fontFor(sc) ? sc : 0);
  }
  text('every miss grows something', VW / 2, 114, 2, '#c8ffb0', 'center');
  if (!ready()) { text(loadError ? `Missing assets/${loadError}` : 'Loading...', VW / 2, 180, 2, loadError ? '#ff8a6a' : MEM.text, 'center'); return; }
  const items = MENU();
  G.menu = Math.max(0, Math.min(items.length - 1, G.menu));
  items.forEach((it, i) => {
    const y = 148 + i * 26, sel = i === G.menu, wdt = 260;
    membrane(VW / 2 - wdt / 2, y, wdt, 20, 10, { edge: it.disabled ? '#5f7f78' : sel ? '#9ff4dc' : MEM.edgeD, glow: sel && !it.disabled ? 0.2 : 0 });
    text(it.label, VW / 2, y + 5, 1, it.disabled ? '#5f7f78' : sel ? '#f2fff8' : MEM.dim, 'center');
  });
  if (G.best) text(`Best story run: ${fmtTime(G.best.time)}  -  ${G.best.spores} spores`, VW / 2, 148 + items.length * 26 + 6, 1, '#ffe9a8', 'center');
  text('Up/Down + Space, or click  -  A/D roll  -  Space hop  -  drag to fling  -  M mute', VW / 2, 372, 1, MEM.text, 'center');
  text(CREDIT_LINE, VW / 2, 386, 1, MEM.dim, 'center');
}
function menuHit(p) { const n = MENU().length; for (let i = 0; i < n; i++) { const y = 148 + i * 26; if (p.x > VW / 2 - 130 && p.x < VW / 2 + 130 && p.y > y && p.y < y + 20) return i; } return -1; }

function renderEnd(t, dt) {
  drawBackground(2, t, VW / 2);
  ctx.fillStyle = 'rgba(10,24,26,0.35)'; ctx.fillRect(0, 0, VW, VH);
  const wy = 352;
  for (let x = 0; x < VW; x += TS) { ctx.drawImage(IMG.tp, 4 * TS, 8 * TS, TS, TS, x, wy, TS, TS); for (let y = wy + TS; y < VH; y += TS) ctx.drawImage(IMG.tp, 5 * TS, 8 * TS, TS, TS, x, y, TS, TS); }
  const R = G.run || newRun(), n = R.spores, shown = Math.min(n, Math.floor(G.endT * 8));
  for (let i = 0; i < Math.min(shown, 40); i++) { const x = 24 + ((i * 97) % 600) + hash(i) * 10; drawPad({ cx: x, sy: wy, x, grow: Math.min(1, (G.endT * 8 - i) / 5), squish: 0, scale: 0.8 + hash(i + 3) * 0.5 }); }
  text('The Garden of Rebirth', VW / 2, 12, 3, '#d8ffd0', 'center');
  text('Every spore you left behind took root here.', VW / 2, 44, 1, '#9ff4ff', 'center');
  // all 21 artifacts sitting in the garden
  for (let i = 0; i < LEVELS; i++) {
    const A = window.GEN.ARTIFACTS[i], got = G.artifacts.includes(i), x = VW / 2 - 10 * 26 + i * 26, y = 74;
    const k = Math.max(0, Math.min(1, (G.endT - 0.3 - i * 0.08) * 3));
    ctx.globalAlpha = k * (got ? 1 : 0.25);
    drawArtifact({ x, y }, t + i, { artifact: A }, 0);
  }
  ctx.globalAlpha = 1;
  membrane(VW / 2 - 200, 104, 400, 70, 16, { dots: 16 });
  const rows = [['Time', fmtTime(G.time) + (G.best && Math.abs(G.best.time - G.time) < 0.01 ? '  (best!)' : '')], ['Artifacts', `${G.artifacts.length} / ${LEVELS}`], ['Spores left behind', String(R.spores)], ['Times reborn  -  fireflies', `${R.drafts}  -  ${G.flies}`]];
  rows.forEach(([a, b], i) => { ctx.globalAlpha = Math.max(0, Math.min(1, (G.endT - 1.6 - i * 0.3) * 2)); text(a, VW / 2 - 180, 113 + i * 14, 1, MEM.dim); text(b, VW / 2 + 180, 113 + i * 14, 1, MEM.text, 'right'); });
  ctx.globalAlpha = Math.max(0, Math.min(1, (G.endT - 3) * 2));
  if (R.order.length) {
    const chips = R.order.map(id => ({ m: MUT[id], label: MUT[id].name + (R.owned[id] > 1 ? ' x' + R.owned[id] : '') }));
    const widths = chips.map(c => textWidth(c.label) + 26);
    let rowY = 190, x = 0, row = [];
    const flush = () => {
      const rw = row.reduce((a, c) => a + c.w + 6, -6); let cx = VW / 2 - rw / 2;
      for (const c of row) {
        const col = RARITY[c.m.r].color;
        membrane(cx, rowY - 3, c.w, 16, 8, { edge: col, edgeD: RARITY[c.m.r].mid, fill: RARITY[c.m.r].deep });
        if (c.m.icon === 'glow') ctx.drawImage(IMG.tp, SPR.glow[0], SPR.glow[1], SPR.glow[2], SPR.glow[3], cx + 4, rowY - 1, 15, 12);
        else drawIcon(ctx, c.m.icon, cx + 5, rowY - 1, 1, col);
        text(c.label, cx + 21, rowY + 1, 1, col);
        cx += c.w + 6;
      }
      row = []; x = 0; rowY += 21;
    };
    chips.forEach((c, i) => { if (x + widths[i] > 560 && row.length) flush(); row.push({ ...c, w: widths[i] }); x += widths[i] + 6; });
    flush();
  } else text('No mutations. A pure, unmutated spore.', VW / 2, 190, 1, MEM.dim, 'center');
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
  else { ctx.fillStyle = '#d6e6f0'; ctx.fillRect(0, 0, VW, VH); text(loadError ? `Missing assets/${loadError}` : 'Loading...', VW / 2, VH / 2, 2, loadError ? '#c0392b' : '#1a1424', 'center', null); }
  G.fade = Math.max(0, G.fade - dt * 2.5);
  if (G.fade > 0.01) { ctx.fillStyle = `rgba(8,20,22,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(lo, 0, 0, screen.width, screen.height);
  requestAnimationFrame(frame);
}
window.SPOREBOUND = { G, startLevel, newGame, continueGame, AU, MUT, MUTATIONS, openDraft, pickCard, fling, hop };
screen.focus();
requestAnimationFrame(frame);
})();
