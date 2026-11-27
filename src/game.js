// main game file
(function () {
'use strict';
const { VW, VH, TS, COLS, ROWS, PHYS, SPR, HOLES, makeWorld, makeBall, stepBall, updateSwings, surfaceY, tileAt } = window.SB;

/* loading the images */
const IMG = {};
const FILES = { tp: 'Terrain_and_Props.png', bg1: 'BG_1.png', bg2: 'BG_2.png', bg3: 'BG_3.png', bg3alt: 'BG_3_alt.png' };
for (const k in (window.FX_MANIFEST || {})) FILES['fx_' + k] = window.FX_MANIFEST[k].file;
for (const k in (window.ENEMY_MANIFEST || {})) FILES['en_' + k] = 'enemies/' + window.ENEMY_MANIFEST[k][0];
let loaded = 0, loadError = null;
for (const k in FILES) {
  const im = new Image();
  im.onload = () => { loaded++; };
  im.onerror = () => { loadError = FILES[k]; };
  im.src = 'assets/' + FILES[k];
  IMG[k] = im;
}
const ready = () => loaded === Object.keys(FILES).length;
// backdrop copies with a faded top
const faded = {};
function fadedLayer(k) {
  if (faded[k]) return faded[k];
  const im = IMG[k], c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'destination-out';            // only the top band
  const g = x.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, 220); x.globalCompositeOperation = 'source-over';
  return (faded[k] = c);
}

/* canvas stuff. game draws at 640x400 then scales up so the pixels stay crisp */
const screen = document.getElementById('game');
const sctx = screen.getContext('2d');
const lo = document.createElement('canvas'); lo.width = VW; lo.height = VH;
let ctx = lo.getContext('2d');
const VX = window.makeVFX({ G: null, VW, VH, get ctx() { return ctx; } });
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
// fonts
const FONT_PX = 11, FONT_PAD = 4;
const FONTS = { body: { family: 'PixelSans', file: 'PixelSans.ttf', ready: false, dy: 4 } };
const textCache = new Map();
const mctx = document.createElement('canvas').getContext('2d');
if (window.FontFace) for (const k in FONTS) {
  const F = FONTS[k];
  new FontFace(F.family, `url(assets/fonts/${F.file})`).load().then(f => { document.fonts.add(f); F.ready = true; textCache.clear(); }).catch(() => { });
}
const fontFor = sc => FONTS.body.ready ? FONTS.body : null;   // one clean face everywhere: the decorative one was hard to read big
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
  ctx: null, muted: (() => { try { return localStorage.getItem('sporebound_muted') === '1'; } catch (e) { return false; } })(),
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
    this.muted = m; try { localStorage.setItem('sporebound_muted', m ? '1' : '0'); } catch (e) { }
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
  oracle() { const t = this.now(); this.tone(98, t, 1.6, { type: 'triangle', gain: 0.07, attack: 0.4 }); this.tone(147, t + 0.1, 1.4, { gain: 0.04, attack: 0.5 }); this.noise(t, 1.2, { gain: 0.03, freq: 900, sweep: 300, type: 'bandpass', q: 2, attack: 0.3 }); },
  murmur() { const t = this.now(); this.tone(170 + Math.random() * 60, t, 0.05, { type: 'triangle', gain: 0.018 }); },
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
  { id: 'membrane', name: 'Thick Membrane', r: 0, max: 3, icon: 'shield', desc: 'Splashes and falls cost 20% less DNA.', apply: R => { R.splashCost *= 0.8; } },
  { id: 'springcap', name: 'Springy Caps', r: 0, max: 3, icon: 'glow', desc: 'Big mushrooms launch you 15% harder.', apply: R => { R.mods.padPower *= 1.15; } },
  { id: 'stem', name: 'Strong Stem', r: 0, max: 3, icon: 'arrow', desc: 'Fling 8% further.', apply: R => { R.mods.power *= 1.08; } },
  { id: 'sticky', name: 'Sticky Coat', r: 0, max: 2, icon: 'drop', desc: 'You grip and stop rolling sooner.', apply: R => { R.mods.grip *= 1.6; } },
  { id: 'strand', name: 'Extra Strand', r: 0, max: 3, icon: 'helix', desc: '+25 max DNA.', apply: R => { R.dnaMax += 25; } },
  { id: 'feather', name: 'Feather Seed', r: 1, max: 2, icon: 'feather', desc: 'Gravity pulls 12% less.', apply: R => { R.mods.grav *= 0.88; } },
  { id: 'kin', name: 'Firefly Kin', r: 1, max: 3, icon: 'fly', desc: 'Fireflies restore +20 more DNA.', apply: R => { R.flyHeal += 20; } },
  { id: 'rubber', name: 'Rubber Rind', r: 2, max: 1, icon: 'ball', desc: 'Soil is much bouncier.', apply: R => { R.mods.soilE += 0.22; } },
  { id: 'secondwind', name: 'Second Wind', r: 2, max: 1, icon: 'heart', desc: 'Your first fall each level costs no DNA.', apply: R => { R.secondWind = true; } },
  { id: 'lure', name: 'Lure', r: 2, max: 1, icon: 'fly', desc: 'Fireflies drift toward you.', apply: R => { R.lure = true; } },
  { id: 'wing', name: 'Wing Spore', r: 3, max: 2, icon: 'wing', desc: 'Hop again in mid-air. Stacks.', apply: R => { R.airJumps++; } },
  { id: 'hydro', name: 'Hydrophobic', r: 3, max: 2, icon: 'wave', desc: 'Skip off the water once per leap.', apply: R => { R.mods.skips++; } },
  { id: 'truesight', name: 'True Sight', r: 3, max: 1, icon: 'eye', desc: 'Your aim guide shows every bounce.', apply: R => { R.trueSight = true; } },
  { id: 'homing', name: 'Homing Spore', r: 4, max: 1, icon: 'target', desc: 'Artifacts pull you in when you get close.', apply: R => { R.mods.homing = true; } },
  { id: 'rapid', name: 'Rapid Spores', r: 0, max: 3, icon: 'arrow', desc: 'Toxin blasts recharge 25% faster.', apply: R => { R.toxCd *= 0.75; } },
  { id: 'potent', name: 'Potent Toxin', r: 1, max: 3, icon: 'drop', desc: 'Toxin blasts hit 50% harder.', apply: R => { R.toxDmg *= 1.5; } },
  { id: 'thorns', name: 'Barbed Coat', r: 2, max: 1, icon: 'shield', desc: 'Rivals that touch you get hurt too.', apply: R => { R.thorns = true; } },
  { id: 'devour', name: 'Devour', r: 3, max: 1, icon: 'heart', desc: 'Dissolving a rival restores 8 DNA.', apply: R => { R.devour = true; } },
  { id: 'undertow', name: 'Undertow Bloom', r: 4, max: 1, icon: 'glow', desc: 'Splash, and the water throws you back out.', apply: R => { R.undertow = true; } },
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

// ui
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
  membrane(DNA.x - 5, DNA.y + DNA.h + 2, DNA.w + 10, 25, 7);   // backing so the number is readable over bright sky
  text('DNA', DNA.x + DNA.w / 2, DNA.y + DNA.h + 4, 1, low ? '#ffb0b0' : MEM.text, 'center');
  text(String(Math.max(0, Math.round(R.dnaShown))), DNA.x + DNA.w / 2, DNA.y + DNA.h + 15, 1, low ? '#ffb0b0' : '#c8fff0', 'center');
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
    drawFXFrame('twinkle', Math.floor(t * 15), x + CW / 2, y + CH / 2, 0, 1.6, 0.8);
  }
}

/* effects */
const FXM = window.FX_MANIFEST || {};
function fx(k, x, y, o = {}) { if (FXM[k]) G.fx.push({ k, x, y, t: 0, rot: o.rot || 0, sc: o.sc || 1, a: o.a || 1, speed: o.speed || 15 }); }
function drawFXFrame(k, f, x, y, rot = 0, sc = 1, a = 1) {
  const M = FXM[k], img = IMG['fx_' + k]; if (!M || !img) return;
  const fr = M.frames[((f % M.frames.length) + M.frames.length) % M.frames.length], w = fr[2] * sc, h = fr[3] * sc;
  ctx.globalAlpha = a;
  if (rot) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.drawImage(img, fr[0], fr[1], fr[2], fr[3], -w / 2, -h / 2, w, h); ctx.restore(); }
  else ctx.drawImage(img, fr[0], fr[1], fr[2], fr[3], Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  ctx.globalAlpha = 1;
}
function drawFX(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const e = G.fx[i]; e.t += dt;
    const f = Math.floor(e.t * e.speed), n = FXM[e.k].frames.length;
    if (f >= n) { G.fx.splice(i, 1); continue; }
    drawFXFrame(e.k, f, e.x, e.y, e.rot, e.sc, e.a);
  }
}

// story mode
const LEVELS = window.GEN.STORY_LEVELS;
const RARITY = [
  { name: 'Common', color: '#cfe3dc', mid: '#5f7f78', deep: '#18302f', w: 50 },
  { name: 'Uncommon', color: '#8fe08a', mid: '#3f7f46', deep: '#132c1a', w: 27 },
  { name: 'Rare', color: '#7cc4ff', mid: '#346a96', deep: '#10233a', w: 14 },
  { name: 'Epic', color: '#c9a2ff', mid: '#6a4c9c', deep: '#211736', w: 7 },
  { name: 'Anomaly', color: '#ff8fd8', mid: '#8c3f78', deep: '#2a1028', w: 2.5 },
];
const G = { ts: 1,
  state: 'load', mode: 'story', w: null, ball: null, phase: 'play', phaseT: 0, roomT: 0, particles: [], popups: [], fx: [], orbs: [],
  aim: null, kbAim: { a: 40, p: 0.6, on: false }, level: 0, run: null, draft: null, lastSafe: null, safeT: 0,
  time: 0, flies: 0, fade: 1, endT: 0, best: null, secondWindUsed: false, kbDraft: false, sinkX: 0, sinkY: 0,
  roomSpores: 0, touch: false, hopQueued: false, trail: [], oracle: null, oracleNext: 2.6, facing: 1, askCd: 0,
  cam: { x: 0, y: 0 }, artifacts: [], menu: 0, save: null, airT: 0,
};
try { G.best = JSON.parse(localStorage.getItem('sporebound_story_best') || 'null'); G.save = JSON.parse(localStorage.getItem('sporebound_story_save') || 'null'); } catch (e) { }
const MUT = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
VX.bind(G);
/* the Elder ate everything: same run, same progress, but no mutations and a fresh body */
function stripMutations() {
  const R = G.run, keep = { spores: R.spores, drafts: R.drafts, pity: R.pity, elderDone: R.elderDone };
  G.run = Object.assign(newRun(), keep);
  Object.assign(G.w.mods, G.run.mods);
  popup('You came back with nothing. Grow again.', G.lastSafe.x, G.lastSafe.y - 30, '#c2bba8');
}
function newRun() {
  return { dna: 100, dnaMax: 100, dnaShown: 100, dnaLag: 100, splashCost: 1, mods: Object.assign({}, window.SB.DEFAULT_MODS),
    preview: 1, flyHeal: 10, secondWind: false, lure: false, airJumps: 0, airSlings: 1, trueSight: false, undertow: false,
    toxDmg: 1, toxCd: 0.32, thorns: false, devour: false,
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
  G.phase = 'play'; G.phaseT = 0; G.roomT = 0; G.particles = []; G.popups = []; G.fx = []; G.orbs = []; G.trail = [];
  G.aim = null; G.kbAim.on = false; G.state = 'play'; G.fade = 1; G.paused = false; G.secondWindUsed = false; G.roomSpores = 0;
  G.oracle = null; G.oracleNext = 3.2; G.facing = Math.sign(G.w.goal.x - G.w.start.x) || 1; G.askCd = 0;
  G.cam.x = G.ball.x - VW / 2; G.cam.y = G.ball.y - VH * 0.55;
  G.prog = n / (LEVELS - 1); CB.reset(); G.deadHold = 0; G.lockCam = false;
  chunkCache.clear();
  window.GEN.loadAround(G.w, G.ball.x, G.ball.y, 2);
  resetAirCharges();
  fx('warp', G.ball.x, G.ball.y, { sc: 0.8 });
  VX.clear(); G.fade = 0; G.leaving = false; VX.iris(1, VW / 2, VH * 0.55, 0.8);
  saveProgress();
}
function newGame() { G.run = newRun(); G.time = 0; G.flies = 0; G.kills = 0; CB.S.kills = 0; G.artifacts = []; G.draft = null; startLevel(0); }
function continueGame() {
  const S = G.save; if (!S) return newGame();
  G.run = newRun();
  for (const id of S.order) for (let i = 0; i < (S.owned[id] || 0); i++) { MUT[id].apply(G.run); G.run.owned[id] = (G.run.owned[id] || 0) + 1; if (!G.run.order.includes(id)) G.run.order.push(id); }
  Object.assign(G.run, { dna: S.dna, dnaShown: S.dna, dnaLag: S.dna, spores: S.spores, drafts: S.drafts, pity: S.pity || 0 });
  G.kills = CB.S.kills = S.kills || 0;
  G.time = S.time; G.flies = S.flies; G.artifacts = S.artifacts.slice(); G.draft = null;
  startLevel(S.level);
}
function saveProgress() {
  const R = G.run;
  G.save = { level: G.level, owned: R.owned, order: R.order, dna: R.dna, spores: R.spores, drafts: R.drafts, pity: R.pity, time: G.time, flies: G.flies, kills: G.kills || 0, artifacts: G.artifacts };
  try { localStorage.setItem('sporebound_story_save', JSON.stringify(G.save)); } catch (e) { }
}
/* first-time fling lesson: shows on level 1 until two real flings land */
const TUT = { flings: (() => { try { return +localStorage.getItem('sporebound_tut') || 0; } catch (e) { return 0; } })(), t: 0, fade: 1 };
function tutCount() { if (TUT.flings >= 2) return; TUT.flings++; try { localStorage.setItem('sporebound_tut', String(TUT.flings)); } catch (e) { } }
function clearSave() { G.save = null; try { localStorage.removeItem('sporebound_story_save'); } catch (e) { } }
function resetAirCharges() { if (G.ball && G.run) { G.ball.jumps = G.run.airJumps; G.ball.slings = G.run.airSlings; G.ball.skips = G.run.mods.skips; G.ball.coyote = Math.max(G.ball.coyote, G.ball.grounded || G.ball.vy === 0 ? PHYS.COYOTE : 0); } }
const MENU = () => [...(G.save ? [{ id: 'continue', label: `Continue  -  level ${G.save.level + 1} of ${LEVELS}` }] : []), { id: 'story', label: 'Story  -  7 artifacts and a garden' }, { id: 'endless', label: 'Endless  -  coming soon', disabled: true }];
function menuSelect(i) {
  const it = MENU()[i]; if (!it || it.disabled) { AU.tick(); return; }
  AU.ui();
  if (it.id === 'continue') continueGame(); else newGame();
}

// input
function toGame(e) { const r = screen.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; }
const TBTN = { left: [36, 362, 22], right: [92, 362, 22], hop: [VW - 40, 362, 26], listen: [VW - 40, 312, 13] };
const touchHeld = { left: null, right: null, hop: null, listen: null };
let aimPointer = null;
function grounded() { return G.ball && G.ball.coyote > 0; }
function canSling() { return grounded() || (G.ball && G.ball.slings > 0); }   // one sling in the air per jump, refills when u land
screen.addEventListener('pointerdown', e => {
  e.preventDefault(); screen.focus(); AU.init();
  if (e.pointerType === 'touch') G.touch = true;
  try { screen.setPointerCapture(e.pointerId); } catch (_) { }
  const p = toGame(e);
  if (G.state === 'title') { if (ready()) { const i = menuHit(p); if (i >= 0) { G.menu = i; menuSelect(i); } } return; }
  if (G.state === 'end') { if (G.endT > 2.5) { AU.ui(); G.state = 'title'; } return; }
  if (G.state !== 'play') return;
  if (G.paused) {
    if (Math.abs(p.y - SENS_ROW.y) < 9 && Math.abs(p.x - SENS_ROW.l) < 14) { setSens(-1); return; }
    if (Math.abs(p.y - SENS_ROW.y) < 9 && Math.abs(p.x - SENS_ROW.r) < 14) { setSens(1); return; }
    G.paused = false; return;
  }
  if (G.phase === 'cleared') { if (G.phaseT > 1.2) nextLevel(); return; }
  if (p.x > VW - 40 && p.y < 22) { AU.setMute(!AU.muted); return; }
  if (G.phase === 'draft') { G.kbDraft = false; pickCard(draftHit(p)); return; }
  if (G.touch) for (const k in TBTN) {
    const [bx, by, br] = TBTN[k];
    if ((p.x - bx) ** 2 + (p.y - by) ** 2 < (br + 6) ** 2) {
      if (k === 'listen') { if (!G.oracle && G.askCd <= 0 && canListen()) { summonOracle(); G.askCd = 6; } return; }
      touchHeld[k] = e.pointerId; if (k === 'hop') G.hopQueued = true; return;
    }
  }
  if (G.phase === 'play') G.press = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() };
  if (G.phase === 'play' && canSling()) { aimPointer = e.pointerId; G.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y, lastBucket: -1 }; G.kbAim.on = false; }
});
screen.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (G.state === 'title' && ready()) { const i = menuHit(p); if (i >= 0 && i !== G.menu) { G.menu = i; AU.tick(); } }
  if (G.draft) { const h = draftHit(p); if (h !== G.draft.hover && h >= 0 && draftReady()) AU.tick(); G.draft.hover = h; if (h >= 0) G.kbDraft = false; }
  if (G.aim && e.pointerId === aimPointer) { G.aim.x = p.x; G.aim.y = p.y; }
  if (e.pointerType === 'mouse') G.mouse = p;
});
screen.addEventListener('pointerleave', () => { G.mouse = null; });
const release = e => {
  for (const k in touchHeld) if (touchHeld[k] === e.pointerId) touchHeld[k] = null;
  const pr = G.press; G.press = null;
  if (pr && pr.id === e.pointerId && G.state === 'play' && G.phase === 'play') {
    const p = toGame(e);
    if (Math.hypot(p.x - pr.x, p.y - pr.y) < 7 && performance.now() - pr.t < 350) {   // a click not a drag = toxin blast
      if (e.pointerId === aimPointer) { aimPointer = null; G.aim = null; }
      CB.blast(p.x + Math.round(G.cam.x), p.y + Math.round(G.cam.y)); return;
    }
  }
  if (e.pointerId !== aimPointer) return;
  aimPointer = null;
  if (G.aim && G.phase === 'play' && canSling()) { const v = aimVector(); if (v.p > 0.06) fling(v.vx, v.vy, v.p); }
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
  if ((e.code === 'Escape' && !G.kbAim.on) || e.code === 'KeyP') { G.paused = !G.paused; AU.tick(); return; }
  if (G.paused) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') setSens(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') setSens(1);
    else if (go) G.paused = false;
    return;
  }
  if (G.phase !== 'play') return;
  if (e.code === 'KeyQ' && !G.oracle && G.askCd <= 0 && canListen()) { summonOracle(); G.askCd = 6; return; }
  if (G.kbAim.on) {
    if (go) { if (canSling()) { const a = G.kbAim.a * Math.PI / 180, v = G.kbAim.p * vmax(); fling(Math.cos(a) * v, -Math.sin(a) * v, G.kbAim.p); } G.kbAim.on = false; }
    if (e.code === 'KeyF' || e.code === 'Escape' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.kbAim.on = false;
    return;
  }
  if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && canSling()) { G.kbAim.on = true; G.kbAim.a = G.ball.vx < -5 || (G.w.mirror && G.ball.vx <= 5) ? 135 : 45; AU.tick(); return; }
  if (HOP_KEYS.includes(e.code)) G.hopQueued = true;
  if (e.code === 'KeyE' || e.code === 'KeyJ') CB.autoBlast();
  if (e.code === 'KeyR') { G.ball.vx = G.ball.vy = 0; die(true); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.state === 'play' && (G.phase === 'play' || G.phase === 'dead')) G.paused = true; });

/* fling sensitivity: how far you have to pull for full power (set in the pause menu, remembered) */
const SENS = [0.6, 0.8, 1, 1.25, 1.6];
let sensI = (() => { try { const v = +localStorage.getItem('sporebound_sens'); return v >= 0 && v < SENS.length && localStorage.getItem('sporebound_sens') !== null ? v : 2; } catch (e) { return 2; } })();
function setSens(d) { sensI = Math.max(0, Math.min(SENS.length - 1, sensI + d)); try { localStorage.setItem('sporebound_sens', String(sensI)); } catch (e) { } AU.tick(); }
const SENS_ROW = { y: 214, l: VW / 2 - 70, r: VW / 2 + 70 };
function aimVector() {
  const a = G.aim, dx = a.sx - a.x, dy = a.sy - a.y, d = Math.hypot(dx, dy);
  const p = Math.min(1, d / (110 / SENS[sensI]));
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
  const air = !grounded();
  b.vx = vx; b.vy = vy; b.t = 0; b.restT = 0; b.padCombo = 0; b.coyote = 0;
  if (p >= 0.2) tutCount();
  AU.shoot(p);
  { const back = Math.atan2(-vy, -vx); VX.sparkBurst(b.x, b.y, 6 + Math.round(p * 6), { angle: back, spread: 1.1, speed: 120 + p * 140, col: '#ffe6a8', life: 0.28 }); VX.ring(b.x, b.y, 10 + p * 10, { flat: 1, speed: 90 }); VX.kick(0.04 + p * 0.08, -vx / 500, -vy / 500); }
  if (air) { b.slings = Math.max(0, (b.slings || 0) - 1); fx('sparkG', b.x, b.y, { sc: 0.9 }); burst(b.x, b.y, 6, { color: ['#9ff4dc', '#c8fff0'], speed: 70, life: 0.35 }); return; }
  resetAirCharges();
  fx('dust', b.x, b.y + 2, { sc: 0.8 });
}
function hop() {
  const b = G.ball;
  if (b.coyote > 0) {
    b.vy = Math.min(b.vy, -PHYS.HOP); b.coyote = 0; AU.hop();
    burst(b.x, b.y + 4, 5, { color: ['#c8b89a', '#8a7a62'], speed: 40, life: 0.35, g: 150 });
  } else if (b.jumps > 0) {
    b.jumps--; b.vy = Math.min(b.vy, -PHYS.HOP * 1.15); AU.hop();
    fx('sparkB', b.x, b.y + 4, { sc: 0.8 });
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
/* rivals + toxin blast are in src/combat.js */
const CB = window.makeCombat({ G, get ctx() { return ctx; }, tileAt, fx, burst, popup, AU, TS, MEM, PHYS, pxCircle, IMG, VX });

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
  G.time += dt; G.roomT += dt; if (G.askCd > 0) G.askCd -= dt;
  if (G.w && G.w.garden) gardenUpdate(dt);
  if (G.phase !== 'cleared' || (G.w && G.w.garden)) updateOracle(dt);
  window.GEN.loadAround(w, b.x, b.y, 2);
  updateCamera(dt);
  if (R.lure) for (const f of w.flies) if (!f.got) {
    const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
    if (d < 130 && d > 1) { f.x += dx / d * 70 * dt; f.y += dy / d * 70 * dt; }
  }
  if (G.kbAim.on) {
    const k = keys;
    if (k.ArrowLeft || k.KeyA) G.kbAim.a = Math.min(180, G.kbAim.a + 70 * dt / G.ts);
    if (k.ArrowRight || k.KeyD) G.kbAim.a = Math.max(0, G.kbAim.a - 70 * dt / G.ts);
    if (k.ArrowUp || k.KeyW) G.kbAim.p = Math.min(1, G.kbAim.p + 0.6 * dt / G.ts);
    if (k.ArrowDown || k.KeyS) G.kbAim.p = Math.max(0.08, G.kbAim.p - 0.6 * dt / G.ts);
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
    if (!canSling()) { G.kbAim.on = false; if (G.aim) G.aim = null; }
    if (b.grounded) { resetAirCharges(); if (!wasGround && preVy > 300) { fx('dust', b.x, b.y + 3, { sc: 0.7 }); } }
    if (!wasGround && b.grounded && preVy > 110) {
      b.land = Math.min(1, preVy / 420);
      if (preVy > 200) { VX.ring(b.x, b.y + 5, 8 + preVy / 28); VX.sparkBurst(b.x, b.y + 4, 2 + Math.round(preVy / 120), { angle: -Math.PI / 2, spread: 2.8, speed: 70 + preVy / 5, col: '#e3d3ac', life: 0.25, g: 400 }); }
      if (preVy > 420) VX.kick(0.12, 0, 2);
    }
    b.land = Math.max(0, (b.land || 0) - dt * 5); b.roll = (b.roll || 0) + b.vx * dt / PHYS.R * (b.grounded ? 1 : 0.5);
    for (const e of ev) {
      if (e.t === 'hit') {
        if (e.kind === 'cap') { AU.cap(); e.ref.squish = 1; fx('sparkB', e.x, e.y, { sc: 0.9 }); }
        else { if (e.v > 70) AU.hit(e.kind, e.v); if (e.v > 160) burst(e.x, e.y, 4, { color: ['#8a7a62', '#5a4e40'], speed: 60, life: 0.4 }); }
      } else if (e.t === 'pad') {
        AU.pad(e.combo); e.pad.squish = 1; fx('sparkB', b.x, b.y, { sc: 1 });
        VX.sparkBurst(b.x, b.y + 4, 10, { angle: -Math.PI / 2, spread: 2.4, speed: 190, col: '#9ff4ff', life: 0.35 }); VX.ring(b.x, b.y + 6, 26, { col: '#9ff4ff', speed: 160 }); VX.kick(0.08, 0, 2);
        if (e.combo > 1) popup('x' + e.combo, b.x, b.y - 10, '#9ff4ff');
      } else if (e.t === 'fly') {
        AU.fly(); G.flies++;
        const heal = Math.min(R.dnaMax - R.dna, R.flyHeal); R.dna += heal;
        fx('sparkG', e.f.x, e.f.y, { sc: 1 }); VX.sparkBurst(e.f.x, e.f.y, 10, { col: '#eaff8a', speed: 120, life: 0.4, curve: 5 });
        popup(heal > 0 ? `+${Math.round(heal)} DNA` : 'Firefly!', e.f.x, e.f.y - 10, '#eaff8a');
      } else if (e.t === 'skip') {
        AU.skip(); fx('sparkB', e.x, e.y - 2, { sc: 0.9 }); popup('Skip!', e.x, e.y - 12, '#a4fff5');
      }
    }
    if (G.phaseT % 0.05 < dt && !b.grounded) { G.trail.push({ x: b.x, y: b.y }); if (G.trail.length > 14) G.trail.shift(); }
    if (b.grounded) G.trail.length = Math.max(0, G.trail.length - 1);
    CB.update(dt);
    if (G.phase !== 'play') return;      // a rival mightve just taken ur last dna
    // remember the last safe spot so we can respawn there
    const tx0 = Math.floor((b.x - 9) / TS), tx1 = Math.floor((b.x + 9) / TS), ty = Math.floor((b.y + PHYS.R + 2) / TS);
    const footing = ['#', '-'].includes(tileAt(w, tx0, ty)) && ['#', '-'].includes(tileAt(w, tx1, ty));
    if (b.grounded && !b.groundMoving && footing && Math.abs(b.vx) < 160) { G.safeT += dt; if (G.safeT > 0.15) G.lastSafe = { x: b.x, y: b.y }; } else G.safeT = 0;
    // fell way down into the dark under ur last spot
    if (b.grounded) G.airT = 0; else G.airT += dt;
    if (!b.grounded && b.y > G.lastSafe.y + 560 && G.airT > 1.2) lostInDark();
    else if (r === 'goal' && G.w.garden) gardenFinale();
    else if (r === 'goal' && !(CB.elderActive() && !CB.S.elder.hunt) && !(G.level === 0 && !G.run.elderDone)) artifactFound();   // level 1: the elder comes first
    else if (r === 'sink') sink();
  } else if (G.phase === 'dead') {
    CB.updateElder(dt); CB.fxTick(dt);
    if (G.phaseT > 1.25 + (G.deadHold || 0)) { G.deadHold = 0; if (G.eaten) { G.eaten = false; stripMutations(); respawn(); } else if (R.dna <= 0) openDraft(); else respawn(); }
  } else if (G.phase === 'cleared') {
    const g = w.goal; b.x += (g.x - b.x) * Math.min(1, dt * 4); b.y += (g.y - b.y) * Math.min(1, dt * 4);
    if (G.phaseT > 3.9 && !G.iris && !G.leaving) { G.leaving = true; VX.iris(-1, G.ball.x - G.cam.x, G.ball.y - G.cam.y, G.w.garden ? 1.4 : 0.7, () => { G.leaving = false; if (G.w.garden) finish(); else nextLevel(); }); }
  }
}
/* lose DNA; the spore you lose waits for you in the garden */
function sink() {
  const b = G.ball, w = G.w, R = G.run;
  const sy = surfaceY(w, b.x, b.y) || b.y;
  AU.splash();
  fx('bubble', b.x, sy - 22, { rot: -Math.PI / 4, sc: 0.9 });
  VX.sparkBurst(b.x, sy, 14, { angle: -Math.PI / 2, spread: 1.3, speed: 220, col: '#9fd8ff', g: 520, life: 0.55 }); VX.ring(b.x, sy, 28, { col: '#cfefff', speed: 120 }); VX.kick(0.22, 0, 3);
  let cost = Math.round(25 * R.splashCost);
  if (R.secondWind && !G.secondWindUsed) { G.secondWindUsed = true; cost = 0; popup('Second wind!', b.x, sy - 26, '#ffb0c8'); }
  if (cost > 0) { const was = R.dna; R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = Math.max(0, R.dna - cost); CB.noteLoss(was - R.dna); AU.dnaLoss(); popup(`-${cost} DNA`, G.cam.x + DNA.x + 34, G.cam.y + dnaFillTop(), '#ffb0b0'); }
  R.spores++; G.roomSpores++;
  sendSpore(b.x - G.cam.x, sy - G.cam.y);
  if (R.undertow && R.dna > 0) {                           // the water throws you back out
    AU.pad(1);
    b.y = sy - PHYS.R - 2; b.vx *= 0.4; b.vy = -520;
    fx('sparkG', b.x, sy - 20, { sc: 1.5 }); popup('Undertow!', b.x, sy - 44, '#ff8fd8');
    return;
  }
  G.phase = 'dead'; G.phaseT = 0; G.sinkX = b.x; G.sinkY = b.y;
}
function die(manual) { if (manual) { G.phase = 'dead'; G.phaseT = 0.45; AU.pop(); } }
function respawn() {
  G.ball = makeBall(G.lastSafe.x, G.lastSafe.y); resetAirCharges(); G.iframes = 1.6;
  if (G.oracleNext > 1e8) G.oracleNext = G.roomT + 6;
  G.phase = 'play'; G.trail = [];
  AU.pop(); fx('warp', G.ball.x, G.ball.y, { sc: 0.7 });
  if (!G.oracle && Math.random() < 0.5) G.oracleNext = Math.min(G.oracleNext, G.roomT + 0.9);
}
function lostInDark() {
  const R = G.run; let cost = Math.round(15 * R.splashCost);
  if (R.secondWind && !G.secondWindUsed) { G.secondWindUsed = true; cost = 0; }
  const was = R.dna; R.dnaLag = Math.max(R.dnaLag, R.dnaShown); R.dna = Math.max(0, R.dna - cost); CB.noteLoss(was - R.dna); if (cost) AU.dnaLoss();
  popup(cost ? `The dark took ${cost} DNA` : 'Second wind!', G.ball.x, G.ball.y - 20, cost ? '#b0b8ff' : '#ffb0c8');
  R.spores++; G.roomSpores++;
  G.phase = 'dead'; G.phaseT = 0.45;
}
function artifactFound() {
  G.phase = 'cleared'; G.phaseT = 0;
  if (!G.artifacts.includes(G.level)) G.artifacts.push(G.level);
  AU.holed(true);
  const g = G.w.goal, col = G.w.L.info.artifact[2];
  fx('light', g.x, g.y, { sc: 1 }); fx('sparkG', g.x, g.y, { sc: 1.6 });
  burst(g.x, g.y, 34, { color: [col, '#ffffff', '#fff6c0'], speed: 140, life: 1.2, g: 30 });
  VX.sparkBurst(g.x, g.y, 42, { col, speed: 280, life: 0.8, curve: 6 }); VX.ring(g.x, g.y, 100, { flat: 1, speed: 240, col }); VX.ring(g.x, g.y, 60, { flat: 1, speed: 140, col: '#ffffff' }); VX.kick(0.35); G.hitstop = 0.14;
  G.ball.vx = G.ball.vy = 0; G.oracle = null;
}
function nextLevel() {
  if (G.level + 1 < LEVELS) startLevel(G.level + 1); else startGarden();
}
/* the garden of rebirth, the last map */
const PEDESTALS = [-42, -33, -24, -12, 14, 25, 38];
function startGarden() {
  const R = G.run;
  G.level = LEVELS;
  G.w = window.GEN.makeGardenWorld(R.mods);
  const w = G.w, ga = w.L.groundAt;
  G.ball = makeBall(w.start.x, w.start.y);
  G.lastSafe = { x: w.start.x, y: w.start.y }; G.safeT = 0; G.airT = 0;
  G.phase = 'play'; G.phaseT = 0; G.roomT = 0; G.particles = []; G.popups = []; G.fx = []; G.orbs = []; G.trail = [];
  G.aim = null; G.kbAim.on = false; G.state = 'play'; G.paused = false; G.roomSpores = 0;
  G.oracle = null; G.oracleNext = 1e9; G.facing = 1; G.askCd = 0;
  G.cam.x = G.ball.x - VW / 2; G.cam.y = G.ball.y - VH * 0.55;
  G.prog = 1; CB.reset(); G.deadHold = 0; G.lockCam = false;
  chunkCache.clear();
  // a glowcap for every spore u left behind, spread across the valley
  const n = Math.min(44, Math.max(3, R.spores)), slots = [];
  for (let x = -60; x <= 62; x++) if (Math.abs(x) > 8 && Math.abs(x * TS - w.start.x) > 4 * TS && !(x >= 47 && x <= 62) && !PEDESTALS.some(p => Math.abs(p - x) < 2)) slots.push(x);
  for (let i = 0; i < n; i++) {
    const tx = slots[Math.floor((i + 0.5) / n * slots.length)], sy = ga(tx) * TS, ps = 0.75 + hash(i * 7 + 3) * 0.55, x = tx * TS + 8;
    w.pads.push({ x, sy, cx: x, cy: sy - 2 - 19 * (ps - 1), r: 21 * ps, scale: ps, grow: 0, squish: 0, delay: 0.8 + Math.abs(tx + 58) * 0.035 });
  }
  G.garden = { peds: G.artifacts.map(i => ({ i, x: PEDESTALS[i] * TS + 8, y: ga(PEDESTALS[i]) * TS, near: 0 })), elder: { x: 55 * TS + 8, gy: ga(55) * TS }, done: false };
  window.GEN.loadAround(w, G.ball.x, G.ball.y, 3);
  resetAirCharges();
  VX.clear(); G.fade = 0; G.leaving = false; VX.iris(1, VW / 2, VH * 0.55, 1.2);
  popup('Every spore you left behind took root here.', G.ball.x + 30, G.ball.y - 24, '#d8ffd0');
}
function gardenUpdate(dt) {
  const w = G.w, b = G.ball, g = G.garden;
  for (const p of w.pads) if (p.grow < 1 && G.roomT > p.delay) {
    if (p.grow === 0) { AU.grow(); VX.sparkBurst(p.cx, p.sy - 4, 8, { angle: -Math.PI / 2, spread: 1.6, speed: 120, col: '#9ff4ff', life: 0.5 }); VX.ring(p.cx, p.sy - 1, 20, { col: '#9ff4ff' }); }
    p.grow = Math.min(1, p.grow + dt * 2.2);
  }
  for (const p of g.peds) {
    const near = Math.abs(b.x - p.x) < 26 && Math.abs(b.y - (p.y - 20)) < 50;
    if (near && !p.near) { const A = window.GEN.ARTIFACTS[window.GEN.STORY_MAP[p.i]]; AU.fly(); VX.sparkBurst(p.x, p.y - 26, 12, { col: A[2], speed: 140, life: 0.5, curve: 6 }); }
    p.near = near;
  }
  if (Math.random() < dt * 1.2) burst(g.elder.x + 6 + Math.random() * 10, g.elder.gy - 60, 1, { color: ['#9db2f5', '#cddcff'], speed: 8, life: 2.4, g: -6 });   // its dreaming in spores
}
const FINALE = 'You fell, and every time you fell, something grew. Look how much you grew. Bounce back, little spore. Always.';
function gardenFinale() {
  if (G.garden.done) return;
  G.garden.done = true; G.phase = 'cleared'; G.phaseT = -5.8;      // stay on the moment a bit before the wipe
  const b = G.ball, g = G.w.goal;
  b.vx = b.vy = 0; AU.holed(true); AU.oracle();
  VX.sparkBurst(g.x, g.y - 10, 60, { col: '#fff2cc', speed: 300, life: 1, curve: 6 }); VX.ring(g.x, g.y, 140, { flat: 1, speed: 220, col: '#d8ffd0' }); VX.kick(0.3);
  for (const p of G.w.pads) p.squish = 1;
  const hi = FINALE.indexOf('Bounce back');
  G.oracle = { line: FINALE, hl: [hi, hi + 'Bounce back'.length], t: -0.2, dur: 1.2 + FINALE.length * 0.045 + 3, chars: 0 };
}
/* the masked figure standing in the garden. tall hooded robe and the carved mask */
let figureCanvas = null;
function buildFigure() {
  const W = 40, H = 66, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x2 = c.getContext('2d'), cx = 20;
  const put = (x, y, col) => { x2.fillStyle = col; x2.fillRect(x, y, 1, 1); };
  const RO = ['#0c0a12', '#14121c', '#1f1c2a', '#2e2a3c', '#433d55'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / (H - 1);
    let hw;
    if (y < 26) { const u = (y - 13) / 13; hw = 11 * Math.sqrt(Math.max(0, 1 - u * u)) + (y > 14 ? 1.5 : 0); }    // hood
    else hw = 11 + (y - 26) * 0.21 + Math.sin(y * 0.4) * 0.5;                                                   // robe gets wider at the bottom
    const dx = (x + 0.5 - cx) / hw; if (Math.abs(dx) > 1) continue;
    let li = 0.55 - dx * 0.45 - v * 0.15;                                                                       // light from the left
    if (y >= 26 && Math.abs(((x - cx) + 40) % 7 - 3.5) < 0.6) li -= 0.25;                                       // folds
    if (y > H - 4) li += 0.2;
    put(x, y, RO[Math.max(0, Math.min(4, Math.floor(li * 5)))]);
    if (y > H - 3) put(x, y, (x + y) % 2 ? '#8f97a8' : '#c9a2ff');                                              // bottom edge glows a lil
  }
  for (let y = 2; y < 25; y++) for (let x = 0; x < W; x++) {                                                   // the dark inside the hood
    const u = (x + 0.5 - cx) / 8.5, w = (y - 14) / 11; if (u * u + w * w < 1) put(x, y, '#07060b');
  }
  if (!maskPortrait) maskPortrait = buildMaskPortrait();
  x2.drawImage(maskPortrait, 0, 0, 46, 50, cx - 11, 3, 23, 25);
  return c;
}
function drawFigure(x, y, t) {
  if (!figureCanvas) figureCanvas = buildFigure();
  const bob = Math.round(Math.sin(t * 1.6) * 1.2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [r, a] of [[34, 0.05], [24, 0.06], [14, 0.07]]) { ctx.globalAlpha = a; ctx.fillStyle = '#c9a2ff'; VX.disc(ctx, x, y - 36 + bob, r, 1); }
  ctx.restore();
  ctx.drawImage(figureCanvas, Math.round(x - 20), y - 66 + bob);
  for (let k = 0; k < 6; k++) { const a = t * 0.8 + k * 1.05, r = 24; ctx.fillStyle = k % 2 ? '#c9a2ff' : '#fff2cc'; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 34 + Math.sin(a) * r * 0.45 + bob), 1, 1); }
}
function drawPedestal(p, t) {
  const A = window.GEN.ARTIFACTS[window.GEN.STORY_MAP[p.i]], x = p.x, y = p.y;
  ctx.fillStyle = '#2b2233'; ctx.fillRect(x - 6, y - 12, 12, 12); ctx.fillStyle = '#443543'; ctx.fillRect(x - 7, y - 14, 14, 3); ctx.fillRect(x - 5, y - 12, 2, 12);
  ctx.fillStyle = '#5e4a5c'; ctx.fillRect(x - 7, y - 14, 14, 1);
  drawArtifact({ x, y: y - 28 + Math.sin(t * 2 + p.i) * 2 }, t + p.i, { artifact: A }, 0, 1);
  if (p.near) { text(A[0], x, y - 66, 1, A[2], 'center'); ctx.globalAlpha = 0.85; text(A[1], x, y - 55, 1, '#d8e0ff', 'center'); ctx.globalAlpha = 1; }
}
/* golden light coming down through the trees */
function drawGodRays(t, cx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 6; k++) {
    const bx = ((k * 157 - cx * 0.3) % (VW + 200) + VW + 200) % (VW + 200) - 100, w = 26 + (k % 3) * 14, a = 0.05 + 0.03 * Math.sin(t * 0.6 + k);
    ctx.globalAlpha = a; ctx.fillStyle = k % 2 ? '#ffe6a8' : '#d8ffd0';
    for (let y = 0; y < VH; y += 2) ctx.fillRect(Math.round(bx + y * 0.45), y, w, 2);
  }
  ctx.restore();
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
  G.phase = 'draft'; G.phaseT = 0; G.oracle = null;
  let first = false; try { first = !localStorage.getItem('sporebound_draftseen'); localStorage.setItem('sporebound_draftseen', '1'); } catch (e) { }
  G.draft = { cards: draftCards(G.run), t: 0, hover: -1, sel: 1, picked: -1, pickT: 0, revealed: [false, false, false], first };
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
  fx('absorb', p.x + CW / 2, p.y + CH / 2, { sc: 1.6 });
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
  drawFX(0);
  ctx.globalAlpha = out;
  if (draftReady()) text('Click a card  -  or arrows + Space  -  or 1 2 3', VW / 2, 284, 1, MEM.dim, 'center');
  const R = G.run;
  if (D.first) {                                   // the first time: say plainly what just happened and why
    ctx.globalAlpha = out * Math.min(1, Math.max(0, D.t - 0.8) * 2);
    membrane(VW / 2 - 225, 298, 450, 58, 12, { dots: 8 });
    text('Your DNA ran out, so you died. But you grow back changed.', VW / 2, 306, 1, '#ffe2a8', 'center');
    text('Every death lets you pick one mutation, and it stays for the whole run.', VW / 2, 320, 1, MEM.text, 'center');
    text('The water and rivals drain DNA. The Elder can eat your mutations.', VW / 2, 334, 1, MEM.dim, 'center');
    ctx.globalAlpha = out;
  } else if (R.order.length) {
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

// the hooded one
function buildMaskPortrait() {
  const W = 46, H = 50, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x2 = c.getContext('2d'), img = x2.createImageData(W, H), d = img.data;
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const put = (x, y, h) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = hex(h), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; };
  const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[(y * W + x) * 4 + 3];
  const disc = (cx, cy, r, h) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(x, y, h); };
  const cx = 23;
  // hood: tall cowl, folds on the shoulders, soft rim light on the left
  const hoodHW = y => y < 1 ? 0 : y < 13 ? 2 + (y - 1) * 1.05 : Math.min(22.5, 14.6 + (y - 13) * 0.42);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const hw = hoodHW(y), dx = x + 0.5 - cx; if (Math.abs(dx) > hw) continue;
    const e = hw - Math.abs(dx);
    let col = '#262a36';
    if (dx < 0 && e < 2.5) col = '#4a5064'; else if (dx < 0 && e < 5) col = '#363b4c';
    else if (dx > 0 && e < 3.5) col = '#1a1d27';
    if (y > 38 && Math.abs(Math.abs(dx) - 7) < 0.7) col = '#1a1d27';
    if (y > 41 && Math.abs(dx) < 1) col = '#1a1d27';
    put(x, y, col);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x + 0.5 - cx) / 13.2, ny = (y + 0.5 - 25.5) / 17.5;
    if (nx * nx + ny * ny < 1) put(x, y, nx * nx + ny * ny > 0.8 ? '#12141c' : '#0a0b10');
  }
  // the mask: big brow, high cheekbones, square jaw, strong chin
  const prof = [[9, 4.5], [10, 7], [11, 8.6], [13, 9.8], [16, 10.4], [19, 10.6], [22, 11.2], [24, 11.4], [27, 11.1], [30, 11], [33, 10.9], [34.5, 10.2], [36, 8.8], [38, 7.4], [40, 6.6], [41, 6.2], [41.6, 0]];
  const hwAt = y => { for (let i = 0; i < prof.length - 1; i++) { const [y0, w0] = prof[i], [y1, w1] = prof[i + 1]; if (y >= y0 && y <= y1) return w0 + (w1 - w0) * (y - y0) / (y1 - y0); } return 0; };
  const inMask = (x, y) => { const hw = hwAt(y + 0.5); return hw > 0 && Math.abs(x + 0.5 - cx) < hw; };
  const T = ['#f1ede2', '#ddd7c7', '#c2bba8', '#a29a86', '#7a7364'];
  for (let y = 8; y < 43; y++) for (let x = 0; x < W; x++) {
    if (!inMask(x, y)) continue;
    const hw = hwAt(y + 0.5), nx = (x + 0.5 - cx) / hw;
    let li = 0.62 - nx * 0.28 - Math.max(0, Math.abs(nx) - 0.7) * 1.1;          // round sides, light from the left
    if (y < 14) li += 0.12;                                                    // forehead catches the light
    if (y >= 19 && y <= 20) li += 0.16;                                        // brow ridge
    if (y >= 21 && y <= 23 && Math.abs(nx) < 0.8) li -= 0.3;                  // deep shadow under the brow
    if (y >= 24 && y <= 26 && Math.abs(Math.abs(nx) - (0.62 + (y - 24) * 0.04)) < 0.2) li += 0.22;  // cheekbones
    const ax = Math.abs(nx), diag = 0.86 - (y - 26) * 0.06;                      // the chiselled cheek part
    if (y >= 27 && y <= 34 && ax > diag && ax < 0.9) li -= 0.27 + (nx > 0 ? 0.06 : 0);
    if (y >= 27 && y <= 34 && ax > diag - 0.12 && ax <= diag) li += 0.06;     // soft highlight on the edge of that
    if (y >= 29 && y <= 34 && ax >= 0.9) li += 0.08;                         // jaw muscle
    if (y >= 35 && Math.abs(nx) > 0.55) li -= 0.26;                            // sharp jaw corner
    if (y >= 36 && y <= 39 && Math.abs(nx) < 0.45) li += 0.2;                  // chin
    if (y >= 33 && y <= 34 && Math.abs(nx) < 0.35) li -= 0.14;               // shadow above the chin
    if (y >= 24 && y <= 31 && nx > -0.08 && nx < 0.12) li -= 0.08;             // shadow side of the nose
    if (y >= 24 && y <= 30 && nx > -0.2 && nx <= -0.08) li += 0.1;             // nose ridge
    if (y === 32 && Math.abs(nx) < 0.12) li -= 0.1;                            // under the nose
    if (y >= 38 && y <= 39 && Math.abs(nx) < 0.05) li -= 0.18;                 // chin dent
    const grain = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997 / 997;     // stone grain so it looks old
    li += (grain - 0.5) * 0.07;
    const t = li > 0.72 ? 0 : li > 0.55 ? 1 : li > 0.38 ? 2 : li > 0.2 ? 3 : 4;
    put(x, y, T[t]);
    if (grain > 0.965 && t < 3) put(x, y, T[Math.min(4, t + 2)]);           // lil pits in the stone
  }
  // the two eye holes
  for (const ex of [cx - 4.8, cx + 4.8]) for (let y = 19; y < 25; y++) for (let x = Math.floor(ex - 4); x <= ex + 4; x++) {
    const dx = (x + 0.5 - ex) / 3.5, dy = (y + 0.5 - 22.2) / (y + 0.5 < 22.2 ? 1.1 : 1.6);
    if (dx * dx + dy * dy < 1) put(x, y, dy > 0.4 ? '#161424' : '#07060c');
  }
  // symbol on the brow, a small ring with a line through it
  for (const [x, y] of [[cx - 1, 13], [cx, 13], [cx - 2, 14], [cx + 1, 14], [cx - 2, 15], [cx + 1, 15], [cx - 1, 16], [cx, 16]]) put(x, y, '#8c8472');
  for (const [x, y] of [[cx - 1, 12], [cx, 12], [cx - 1, 17], [cx, 17]]) put(x, y, '#9e967f');
  for (const [x, y] of [[cx - 1, 14], [cx, 14], [cx - 1, 15], [cx, 15]]) put(x, y, '#f1ede2');
  // carved lines around the eyes like old engravings
  for (let k = 0; k < 3; k++) { put(cx - 10 + k, 25 + k, '#9e967f'); put(cx + 9 - k, 25 + k, '#857d6b'); }
  // tiny cracks
  for (const [x, y] of [[cx + 6, 11], [cx + 6, 12], [cx + 5, 13], [cx + 5, 14], [cx + 6, 15], [cx - 7, 30], [cx - 7, 31], [cx - 6, 32], [cx + 4, 37], [cx + 5, 38]]) if (inMask(x, y)) put(x, y, '#6e6758');
  // chipped corner and some moss
  for (const [x, y] of [[cx + 9, 33], [cx + 10, 33], [cx + 10, 32]]) put(x, y, '#0a0b10');
  for (const [x, y, c2] of [[cx - 9, 34, '#5f8a4a'], [cx - 10, 33, '#4b7040'], [cx - 9, 35, '#4b7040'], [cx - 8, 35, '#6f9a56'], [cx + 7, 10, '#5f8a4a'], [cx + 8, 11, '#4b7040'], [cx - 3, 40, '#5f8a4a']]) if (inMask(x, y)) put(x, y, c2);
  // outline everything
  const filled = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!alpha(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => alpha(x + a, y + b))) filled.push([x, y]);
  for (const [x, y] of filled) put(x, y, '#08070d');
  // edge of the mask (darker on the shadow side)
  for (let y = 8; y < 43; y++) for (let x = 0; x < W; x++) if (inMask(x, y) && [[1, 0], [-1, 0], [0, 1]].some(([a, b]) => !inMask(x + a, y + b))) put(x, y, x < cx ? '#a7a396' : '#6f6b62');
  x2.putImageData(img, 0, 0);
  return c;
}
let maskPortrait = null;
const WHISPERS = {   // always left/right/up/down from where you are, never "behind"
  right: ['Your path lies to the right.', 'Rightward, little one.', 'What you seek waits to the right.', 'Go right. Keep going.', 'The way bends right.'],
  left: ['Your path lies to the left.', 'Leftward, little one.', 'What you seek waits to the left.', 'Go left. Keep going.', 'The way bends left.'],
  up: ['Your path requires an ascent.', 'Look up. The way is above you.', 'Climb, little one. The light rests high.', 'What you seek waits above you.', 'Rise.'],
  down: ['Your path requires a descent.', 'The way lies below you.', 'Descend, little one. But mind the water.', 'What you seek is beneath you.', 'Lower. Lower still.'],
  near: ['You are close. So very close.', 'It is right before you.', 'Reach out. It is almost yours.'],
  'up+right': ['Up, and to the right.', 'Climb, then go right.'], 'up+left': ['Up, and to the left.', 'Climb, then go left.'],
  'down+right': ['Down, and to the right.', 'Descend, then go right.'], 'down+left': ['Down, and to the left.', 'Descend, then go left.'],
};
const FAR = [[1100, 'It is far, far away.'], [550, 'It is a long way still.'], [250, 'Not far now.'], [0, 'It is close.']];
function whisperDirection() {
  const b = G.ball, g = G.w.goal, dx = g.x - b.x, dy = g.y - b.y;
  if (Math.hypot(dx, dy) < 70) return 'near';
  const h = dx > 0 ? 'right' : 'left';
  const v = dy < -64 ? 'up' : dy > 48 ? 'down' : null;
  if (v && Math.abs(dx) > 120 && Math.abs(dy) > Math.abs(dx) * 0.35) return v + '+' + h;
  if (v && Math.abs(dy) > Math.abs(dx) * 0.5) return v;
  return h;
}
/* the hooded one won't help you dodge level 1's Elder, and goes quiet while anything hunts you */
function canListen() { return !CB.elderActive() && !(G.w && G.w.garden) && !(G.level === 0 && G.run && !G.run.elderDone); }
function summonOracle() {
  const dir = whisperDirection(), pool = WHISPERS[dir];
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (G.oracle && G.oracle.line === line && pool.length > 1) line = pool[(pool.indexOf(line) + 1) % pool.length];
  if (dir !== 'near') { const d = Math.hypot(G.w.goal.x - G.ball.x, G.w.goal.y - G.ball.y); line += ' ' + FAR.find(([m]) => d >= m)[1]; }
  G.oracle = { line, t: 0, dur: 1.2 + line.length * 0.045 + 3.2, chars: 0, guide: true };
  AU.oracle();
}
function updateOracle(dt) {
  if (G.oracle) {
    const o = G.oracle; o.t += dt;
    const n = Math.min(o.line.length, Math.floor(Math.max(0, o.t - 0.45) * 26));
    if (n > o.chars) { if (n % 2 === 0 && o.line[n - 1] !== ' ') AU.murmur(); o.chars = n; }
    if (o.t > o.dur) { G.oracle = null; G.oracleNext = G.roomT + 12 + Math.random() * 12; }
  } else if (G.phase === 'play' && G.roomT > G.oracleNext) summonOracle();
}
function drawHooded(x, y, t) {
  if (!maskPortrait) maskPortrait = buildMaskPortrait();
  ctx.drawImage(maskPortrait, x, y + Math.round(Math.sin(t * 1.3) * 1));
}
/* one bold letter in any colour. the glyph gets cached once in white then tinted every frame */
let tintCanvas = null;
function rainbowGlyph(ch, x, y, color) {
  const F = fontFor(1);
  if (!F) { text(ch, x, y, 1, color); text(ch, x + 1, y, 1, color, 'left', null); return; }
  const s = prep(ch, F), white = runCanvas(s, '#ffffff', F), sh = runCanvas(s, '#1a1424', F);
  if (!tintCanvas) tintCanvas = document.createElement('canvas');
  const tc = tintCanvas; if (tc.width < white.width || tc.height < white.height) { tc.width = white.width + 8; tc.height = white.height + 4; }
  const tx = tc.getContext('2d');
  tx.clearRect(0, 0, tc.width, tc.height); tx.globalCompositeOperation = 'source-over'; tx.drawImage(white, 0, 0);
  tx.globalCompositeOperation = 'source-in'; tx.fillStyle = color; tx.fillRect(0, 0, tc.width, tc.height); tx.globalCompositeOperation = 'source-over';
  const cx = Math.round(x), cy = Math.round(y) - F.dy;
  ctx.drawImage(sh, cx, cy + 1); ctx.drawImage(sh, cx + 1, cy + 1);                     // shadow under both strokes
  ctx.drawImage(tc, 0, 0, white.width, white.height, cx - 1, cy, white.width, white.height);
  ctx.drawImage(tc, 0, 0, white.width, white.height, cx, cy, white.width, white.height); // second stroke makes it bold
}
function drawOracle(t) {
  const o = G.oracle; if (!o) return;
  const fin = o.t > o.dur - 0.5 ? Math.max(0, (o.dur - o.t) / 0.5) : Math.min(1, o.t / 0.4);
  const bw = 290, bh = 66, x = 34 + (1 - fin) * -20, y = (G.touch ? 278 : VH - bh - 8) + (1 - fin) * 8;
  ctx.globalAlpha = fin;
  membrane(x, y, bw, bh, 12, { edge: '#8f97a8', edgeD: '#343a48', fill: 'rgba(10,11,16,0.92)', dots: 6 });
  pxRound(ctx, x + 6, y + 6, 54, 54, 8, '#0c0a14');
  ctx.save(); ctx.beginPath(); ctx.rect(x + 7, y + 7, 52, 52); ctx.clip();
  drawHooded(x + 10, y + 8, t);
  ctx.restore();
  ctx.globalAlpha = fin;
  text('???', x + 68, y + 7, 1, '#c2bba8');
  const shown = o.line.slice(0, o.chars);
  wrapText(o.line, bw - 78).reduce((acc, ln, i) => {
    const part = shown.slice(acc, acc + ln.length), ly = y + 21 + i * 11;
    if (!o.hl) text(part, x + 68, ly, 1, '#ece6f2');
    else {
      // normal text, then the highlighted words in bold with a rainbow going through the letters
      let cx = x + 68;
      const [h0, h1] = o.hl, a0 = Math.max(0, Math.min(part.length, h0 - acc)), a1 = Math.max(0, Math.min(part.length, h1 - acc));
      const pre = part.slice(0, a0), mid = part.slice(a0, a1), post = part.slice(a1);
      if (pre) { text(pre, cx, ly, 1, '#ece6f2'); cx += textWidth(pre); }
      for (let k = 0; k < mid.length; k++) {
        const ch = mid[k], gi = acc + a0 + k;
        if (ch !== ' ') {
          const hue = (t * 240 - gi * 32) % 360, light = 68 + 10 * Math.sin(t * 6 - gi * 0.7);
          rainbowGlyph(ch, cx, ly + Math.round(Math.sin(t * 7 - gi * 0.8) * 0.9), `hsl(${(hue + 360) % 360}, 100%, ${light}%)`);
        }
        cx += textWidth(ch) + 1;
      }
      if (post) text(post, cx, ly, 1, '#ece6f2');
    }
    return acc + ln.length + 1;
  }, 0);
  ctx.globalAlpha = 1;
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
  /* the exit. a soft rift of light, no sign cuz the hooded one tells u where it is */
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
// puff
const PUFF = ['#8c7452', '#bba47a', '#e3d3ac', '#f6ecd2'], PUFF_OUT = '#1c1420';
const PUFF_L = (() => { const v = [-0.55, -0.68, 0.48], n = Math.hypot(...v); return v.map(x => x / n); })();
const phash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function sporeSprite(rollQ, sqQ, lx, ly, eyes, mouth) {
  return PK.cached(`puff:${rollQ}:${sqQ}:${lx}:${ly}:${eyes}:${mouth}`, () => {
    const W = 16, H = 16, sq = sqQ / 20, R = 5.9, rx = R * (1 + sq), ry = R * (1 - sq), cx = 8, cy = 8 + sq * 3;
    const roll = rollQ / 12 * Math.PI * 2, ca = Math.cos(roll), sa = Math.sin(roll);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x2 = c.getContext('2d'), img = x2.createImageData(W, H), d = img.data, M = new Uint8Array(W * H);
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const set = (i, j, col) => { i = Math.round(i); j = Math.round(j); if (i < 0 || j < 0 || i >= W || j >= H) return; const k = (j * W + i) * 4, v = hex(col); d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = 255; };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = (i + 0.5 - cx) / rx, v = (j + 0.5 - cy) / ry, dd = u * u + v * v;
      if (dd > 1) continue;
      M[j * W + i] = 1;
      const nz = Math.sqrt(1 - dd), li = u * PUFF_L[0] + v * PUFF_L[1] + nz * PUFF_L[2];
      const lv = li < 0 ? 0 : li < 0.35 ? 1 : li < 0.72 ? 2 : 3;
      let col = PUFF[lv];
      const xr = u * ca + v * sa, yr = -u * sa + v * ca;                    // speckles sit on the rolling surface
      if (nz > 0.3 && phash(Math.round(xr * 7), Math.round(yr * 7)) > 0.86) col = lv > 1 ? '#a88d62' : '#6e5a3e';
      set(i, j, col);
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!M[j * W + i] && ((i > 0 && M[j * W + i - 1]) || (i < W - 1 && M[j * W + i + 1]) || (j > 0 && M[(j - 1) * W + i]) || (j < H - 1 && M[(j + 1) * W + i]))) set(i, j, PUFF_OUT);
    // pore on top
    const top = Math.round(cy - ry); set(cx - 1, top + 1, '#6e5a3e'); set(cx, top + 1, '#8c7452');
    // face
    const ex = Math.round(cx + lx * 1.2 - 0.5), ey = Math.round(cy - 0.5 + ly * 0.8 + sq * 2), INK = '#2a1e26';
    for (const x of [ex - 2, ex + 2]) {
      if (eyes === 'open') { set(x, ey, INK); set(x, ey + 1, INK); }
      else if (eyes === 'blink') set(x, ey + 1, INK);
      else if (eyes === 'hurt') { set(x - 1, ey, INK); set(x, ey + 1, INK); set(x + 1, ey, INK); }
      else { set(x, ey + 1, INK); set(x + (x < ex ? 1 : -1), ey, '#6e5a3e'); }     // aiming: squinty with a brow
    }
    set(ex - 3, ey + 2, '#f0a0a0'); set(ex + 3, ey + 2, '#f0a0a0');
    if (mouth === 'o') { set(ex, ey + 2, '#6e4a3a'); set(ex, ey + 3, '#6e4a3a'); } else set(ex, ey + 2, '#6e4a3a');
    x2.putImageData(img, 0, 0);
    return c;
  });
}
const PUFF_SPORES = ['#ffe6a8', '#f6ecd2', '#ffd27a'];
function drawBall(b, t, alpha = 1) {
  const sp = Math.hypot(b.vx || 0, b.vy || 0), air = !b.grounded && sp > 120;
  const stretch = air ? Math.min(0.16, sp / 2800) : 0, sq = Math.max(-0.2, Math.min(0.25, (b.land || 0) * 0.25 - stretch));
  const sqQ = Math.round(sq * 20), rollQ = (((Math.round(((b.roll || 0) / (Math.PI * 2)) * 12)) % 12) + 12) % 12;
  const lx = sp > 25 ? Math.round(Math.max(-1, Math.min(1, b.vx / 80))) : (G.facing || 0) * (G.state === 'play' ? 1 : 0), ly = sp > 60 ? Math.round(Math.max(-1, Math.min(1, b.vy / 200))) : 0;
  const hurt = G.state === 'play' && G.iframes > 0, aiming = G.state === 'play' && (G.aim || G.kbAim.on);
  const eyes = hurt ? 'hurt' : aiming ? 'aim' : (t % 3.3) < 0.12 ? 'blink' : 'open';
  const spr = sporeSprite(rollQ, sqQ, lx, ly, eyes, sp > 330 ? 'o' : '-');
  if (sp > 300 && alpha === 1 && G.state === 'play' && G.phase === 'play' && (G.time - (b.ghostT || 0)) > 0.025) { b.ghostT = G.time; VX.ghost(spr, 8, 8 + sqQ / 20 * 3, b.x, b.y, 0.4); }
  PK.blit(ctx, spr, 8, 8 + sqQ / 20 * 3, b.x, b.y, false, 1, alpha);
  // every landing puffs warm spores out the pore, otherwise a lazy lil wisp floats up
  const top = b.y - 5.9 * (1 - sq) - 1;
  if ((b.land || 0) > 0.35 && !b._puffed && G.state === 'play') { b._puffed = true; burst(b.x, top, 6, { color: PUFF_SPORES, speed: 45, life: 0.7, g: -30, angle: -Math.PI / 2, spread: 1.8 }); }
  if ((b.land || 0) < 0.1) b._puffed = false;
  ctx.globalAlpha = alpha * 0.85;
  for (let k = 0; k < 2; k++) {
    const ph = (t * 0.9 + k * 0.5) % 1;
    ctx.fillStyle = PUFF_SPORES[k]; ctx.fillRect(Math.round(b.x + Math.sin(t * 2 + k * 2) * 1.5), Math.round(top - 1 - ph * 6), 1, 1);
  }
  ctx.globalAlpha = 1;
}
/* how far the aim arc reaches: the whole flight on the first two levels, then shorter and shorter */
const ARC_BY_LEVEL = [7, 7, 2.4, 1.8, 1.4, 1.15, 1];
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
  const arc = ARC_BY_LEVEL[G.level] ?? 1, full = arc >= 7;
  const dt = 1 / 60, g = PHYS.G * (R ? R.mods.grav : 1), steps = Math.min(260, Math.round(34 * (R ? R.preview : 1) * arc));
  for (let i = 0; i < steps && !(R && R.trueSight); i++) {
    vy += g * dt; x += vx * dt; y += vy * dt;
    const tc = tileAt(w, Math.floor(x / TS), Math.floor(y / TS));
    if (tc === '#' || tc === '~' || (!w.infinite && (x < 0 || x > VW))) {
      if (full) {                                   // early levels: mark exactly where you'll land
        const lx = Math.round(x - vx * dt), ly = Math.round(y - vy * dt), r = 4 + Math.sin(t * 8) * 0.8;
        ctx.globalAlpha = 0.9; ctx.fillStyle = tc === '~' ? '#7fc8ff' : '#eaff8a';
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + t * 2; if (k % 2 === 0) ctx.fillRect(Math.round(lx + Math.cos(a) * r), Math.round(ly + Math.sin(a) * r), 1, 1); }
        ctx.fillRect(lx - 1, ly - 1, 2, 2);
      }
      break;
    }
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
  const L = Math.hypot(v.vx, v.vy) || 1, ux = v.vx / L, uy = v.vy / L;
  if (G.aim) {
    const bucket = Math.floor(v.p * 10);
    if (bucket !== G.aim.lastBucket) { G.aim.lastBucket = bucket; AU.tick(); }
    // the pull band: two strands from either side of the spore back to where you're pulling
    const pull = 10 + v.p * 40, hx = b.x - ux * pull, hy = b.y - uy * pull, nx = -uy * 5, ny = ux * 5;
    const band = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); };
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#1a1424';
    band(b.x + nx + 1, b.y + ny + 1, hx + 1, hy + 1); band(b.x - nx + 1, b.y - ny + 1, hx + 1, hy + 1);
    ctx.fillStyle = pc; band(b.x + nx, b.y + ny, hx, hy); band(b.x - nx, b.y - ny, hx, hy);
    ctx.fillStyle = '#1a1424'; ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 5, 5);
    ctx.fillStyle = '#fff6e0'; ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
    ctx.globalAlpha = 1;
  }
  // a bright arrow out the front: this is the way you'll fly
  const a0 = 9, a1 = 16 + v.p * 18, tx = b.x + ux * a1, ty = b.y + uy * a1, pulse = 0.75 + Math.sin(t * 10) * 0.25;
  for (const [col, o] of [['#1a1424', 1], [pc, 0]]) {
    ctx.fillStyle = col; ctx.globalAlpha = o ? 0.8 : pulse;
    for (let d = a0; d <= a1; d++) { ctx.fillRect(Math.round(b.x + ux * d) - 1 + o, Math.round(b.y + uy * d) - 1 + o, 2, 2); }
    for (let k = 1; k <= 5; k++) for (const sgn of [-1, 1]) {
      const qx = tx - ux * k + (-uy) * sgn * k * 0.9, qy = ty - uy * k + ux * sgn * k * 0.9;
      ctx.fillRect(Math.round(qx) - 1 + o, Math.round(qy) - 1 + o, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}
/* the fling lesson: a ghost hand grabs the spore, pulls back away from where you need to go, lets go */
const HAND = ['..##.....', '.#ww#....', '.#ww#....', '.#ww###..', '.#wwwww##', '##wwwwww#', '#wwwwwww#', '#wwwwwww#', '.#wwwww#.', '..#####..'];
/* while the hooded one gives directions, a pale arrow circles the spore and points at the artifact */
let guideA = 0;
function drawGuide(t, dt) {
  const on = G.oracle && G.oracle.guide && G.phase === 'play' && G.ball && G.w && G.w.goal;
  guideA = Math.max(0, Math.min(1, guideA + (on ? dt * 3 : -dt * 1.5)));
  if (guideA <= 0 || !G.ball || !G.w || !G.w.goal) return;
  const b = G.ball, g = G.w.goal, dx = g.x - b.x, dy = g.y - b.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  if (L < 40) return;
  const r = 30 + Math.sin(t * 5) * 3, tx = b.x + ux * r, ty = b.y + uy * r, px_ = -uy, py_ = ux;
  for (const [col, o] of [['#1a1424', 1], ['#e6dcff', 0]]) {           // a filled chevron with a dark outline
    ctx.globalAlpha = guideA * (o ? 0.75 : 1); ctx.fillStyle = col;
    for (let k = 0; k <= 16; k++) {                                     // head (k < 9) tapering to a point, then a short shaft
      const hw = k < 9 ? k * 0.5 : 1;
      for (let s2 = -hw; s2 <= hw; s2 += 0.5) ctx.fillRect(Math.round(tx - ux * k + px_ * s2) + o, Math.round(ty - uy * k + py_ * s2) + o, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
function drawTutorial(t, dt) {
  const show = G.level === 0 && TUT.flings < 2 && G.phase === 'play' && G.run && !CB.elderActive();
  TUT.fade = Math.max(0, Math.min(1, TUT.fade + (show && !G.aim && !G.kbAim.on ? dt * 2 : -dt * 4)));
  if (!show) TUT.t = 0; else TUT.t += dt;
  if (TUT.fade <= 0 || !G.ball) return;
  const b = G.ball, dir = Math.sign(G.w.goal.x - b.x) || 1, k = (TUT.t % 2.4) / 2.4;
  // 0-.15 reach in, .15-.6 pull back, .6-.7 hold, .7 let go, then fade
  const pullK = k < 0.15 ? 0 : k < 0.6 ? (k - 0.15) / 0.45 : k < 0.7 ? 1 : 0;
  const ease = 1 - (1 - pullK) ** 2, ox = -dir * 34 * ease, oy = 20 * ease;
  const ha = TUT.fade * (k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1) * 0.9;
  if (pullK > 0) {                                  // the band and the arc it promises
    ctx.globalAlpha = ha * 0.8; ctx.fillStyle = '#ffd86b';
    const n = Math.ceil(Math.hypot(ox, oy) / 2); for (let i = 0; i < n; i += 1) ctx.fillRect(Math.round(b.x + ox * i / n), Math.round(b.y + oy * i / n), 1, 1);
    ctx.globalAlpha = ha * 0.6 * ease; ctx.fillStyle = '#eaff8a';
    for (let i = 3; i < 16; i++) { const s = i * 0.05; ctx.fillRect(Math.round(b.x + dir * 150 * s * ease), Math.round(b.y - 230 * s * ease + 0.5 * 600 * s * s), 1, 1); }
  } else if (k >= 0.7) {                            // let go: a little burst where the spore would leap
    ctx.globalAlpha = ha * (1 - (k - 0.7) / 0.3); ctx.fillStyle = '#fff6e0';
    const r = 6 + (k - 0.7) * 40; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 1, 1); }
  }
  const hx = Math.round(b.x + ox - 5), hy = Math.round(b.y + oy - 1), grab = pullK > 0 && k < 0.7;
  ctx.globalAlpha = ha;                             // drawn at 2x so it reads as a pointer, not a speck
  HAND.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = ch === '#' ? '#1a1424' : grab ? '#fff6e0' : '#e8dcc0'; ctx.fillRect(hx + i * 2, hy + j * 2 + (grab ? 1 : 0), 2, 2); } });
  ctx.globalAlpha = TUT.fade;
  const label = TUT.flings === 0 ? 'pull back, let go' : 'nice. once more';
  const lw = textWidth(label) + 14, lx = Math.round(b.x - lw / 2), ly = Math.round(b.y - 36);
  pill(lx, ly, lw); text(label, b.x, ly + 3, 1, MEM.text, 'center');
  ctx.globalAlpha = 1;
}
function drawParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt; if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const pa = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.color;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pa * 0.18; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.size + 2, p.size + 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = pa;
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
    else if (k === 'listen') text('?', bx, by - 4, 1, G.askCd > 0 || G.oracle ? MEM.dim : MEM.hi, 'center', null);
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
  // plants: grass on every top, some flowers/ferns/reeds/bulbs, vines hanging under the islands
  const flora = [], vines = [];
  for (let j = 0; j < CHN; j++) for (let i = 0; i < CHN; i++) {
    const x = cx * CHN + i, y = cy * CHN + j;
    if (tileAt(w, x, y) !== '#') continue;
    const r = hash(x * 92821 + y * 68917);
    if (tileAt(w, x, y - 1) === '.') {
      const n = 3 + Math.floor(hash(x * 3 + y * 7) * 3);
      for (let k = 0; k < n; k++) flora.push({ t: 'g', x: x * TS + 1 + ((k * 5 + Math.floor(hash(x + k * 13) * 4)) % 15), y: y * TS + 1, h: 3 + Math.floor(hash(x * 11 + k * 7 + y) * 6) + (hash(x * 29 + k) < 0.15 ? 5 : 0), front: hash(x * 17 + k + y * 3) < 0.35, s: x * 1.7 + k });
      if (r < 0.16) flora.push({ t: 'f', x: x * TS + 4 + Math.floor(hash(r * 999) * 8), y: y * TS + 1, h: 8 + Math.floor(hash(x + y) * 7), c: Math.floor(hash(x * 5 + y) * 4), s: x });
      else if (r < 0.26) flora.push({ t: 'n', x: x * TS + 8, y: y * TS + 1, h: 9 + Math.floor(hash(x * 2 + y) * 5), s: x });
      else if (r < 0.31) flora.push({ t: 'r', x: x * TS + 6 + Math.floor(hash(y * 3 + x) * 5), y: y * TS + 1, h: 12 + Math.floor(hash(x * 9 + y) * 7), s: x });
      else if (r < 0.35) flora.push({ t: 'b', x: x * TS + 8, y: y * TS + 1, h: 8 + Math.floor(hash(x * 4 + y) * 5), s: x });
    }
    if (tileAt(w, x, y + 1) === '.' && r > 0.68) vines.push({ x: x * TS + 3 + Math.floor(hash(x * 7 + y) * 10), y: (y + 1) * TS - 1, len: 6 + Math.floor(hash(x * 13 + y * 5) * 22), s: x * 0.9 + y });
  }
  c = { terr, wat, deco: w.L.chunk(cx, cy).deco, flora, vines };
  chunkCache.set(k, c);
  if (chunkCache.size > 160) { for (const kk of chunkCache.keys()) { chunkCache.delete(kk); if (chunkCache.size < 120) break; } }
  return c;
}
/* plants (drawn in code) */
const FLORA_PAL = {
  orange: { g: ['#4a2326', '#75352f', '#9a4f33', '#c47048'], stem: '#5a2a28' },
  green: { g: ['#1d2a26', '#2f4a36', '#4a6a44', '#74a05a'], stem: '#2f4a36' },
};
const PETAL = ['#f2d6e8', '#d8e6ff', '#fff2c0', '#e6d0ff'];
function swayAt(px, py, t, h, s) {
  let sw = Math.sin(t * 1.6 + s * 0.37) * 1.2 + Math.sin(t * 0.7 + s * 0.11) * 0.8;           // the wind
  const b = G.ball, dx = px - b.x, dy = py - (b.y + 5);
  if (Math.abs(dx) < 16 && dy > -h - 8 && dy < 10) sw += Math.sign(dx || 1) * (16 - Math.abs(dx)) / 16 * 4.5;   // spore pushes it out the way
  return sw;
}
function stalk(x, y, h, sw, cols) {
  for (let i = 0; i < h; i++) {
    const k = i / h;
    ctx.fillStyle = cols[Math.min(cols.length - 1, Math.floor(k * cols.length))];
    ctx.fillRect(Math.round(x + sw * k * k), y - i, 1, 1);
  }
}
function drawFlora(t, front) {
  const pal = FLORA_PAL[G.level % 2 ? 'green' : 'orange'];
  visibleChunks((cx, cy, c) => {
    for (const f of c.flora) {
      if (f.t === 'g') { if (!!f.front !== front) continue; stalk(f.x, f.y, f.h, swayAt(f.x, f.y, t, f.h, f.s), pal.g); continue; }
      if (front) continue;
      const sw = swayAt(f.x, f.y, t, f.h, f.s);
      if (f.t === 'f') {
        stalk(f.x, f.y, f.h, sw, [pal.stem, pal.g[2]]);
        const ly = f.y - Math.floor(f.h * 0.4), lx = Math.round(f.x + sw * 0.16);
        ctx.fillStyle = pal.g[3]; ctx.fillRect(lx - 2, ly, 2, 1); ctx.fillRect(lx + 1, ly - 1, 2, 1);
        const hx = Math.round(f.x + sw), hy = f.y - f.h;
        ctx.fillStyle = PETAL[f.c]; ctx.fillRect(hx - 2, hy - 1, 5, 3); ctx.fillRect(hx - 1, hy - 2, 3, 5);
        ctx.fillStyle = '#ffe9a8'; ctx.fillRect(hx, hy, 1, 1);
      } else if (f.t === 'n') {
        for (const dir of [-1, 1, -0.5, 0.5]) for (let i = 0; i < f.h; i++) {
          const k = i / f.h;
          ctx.fillStyle = i > f.h * 0.6 ? pal.g[3] : pal.g[2];
          ctx.fillRect(Math.round(f.x + dir * i * 0.7 + sw * k * k), Math.round(f.y - i * (1 - Math.abs(dir) * 0.35) + i * i * 0.05 * Math.abs(dir)), 1, 2);
          if (i % 3 === 2) ctx.fillRect(Math.round(f.x + dir * i * 0.7 + sw * k * k) + (dir > 0 ? 1 : -1), Math.round(f.y - i * (1 - Math.abs(dir) * 0.35) + i * i * 0.05 * Math.abs(dir)) - 1, 1, 1);
        }
      } else if (f.t === 'r') {
        stalk(f.x, f.y, f.h, sw * 1.3, [pal.stem, pal.g[1], pal.g[2]]);
        ctx.fillStyle = '#6a4a32'; ctx.fillRect(Math.round(f.x + sw * 1.3) - 1, f.y - f.h - 3, 2, 4);
      } else if (f.t === 'b') {
        stalk(f.x, f.y, f.h, sw, [pal.stem, pal.g[2]]);
        const hx = Math.round(f.x + sw), hy = f.y - f.h, gl = 0.5 + 0.5 * Math.sin(t * 2 + f.s);
        ctx.globalAlpha = 0.25 + 0.25 * gl; pxCircle(ctx, hx + 0.5, hy, 6, '#9ff4dc'); ctx.globalAlpha = 1;
        ctx.fillStyle = '#c8fff0'; ctx.fillRect(hx - 1, hy - 2, 3, 4); ctx.fillRect(hx - 2, hy - 1, 5, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 1, hy - 1, 1, 1);
      }
    }
    if (front) return;
    for (const v of c.vines) {
      for (let i = 0; i < v.len; i++) {
        const k = i / v.len, sw = Math.sin(t * 1.1 + v.s + i * 0.15) * 2.2 * k;
        const b = G.ball, dx = v.x - b.x, push = Math.abs(dx) < 14 && Math.abs(v.y + i - b.y) < 8 ? Math.sign(dx || 1) * 3 * (1 - Math.abs(dx) / 14) : 0;
        const x = Math.round(v.x + sw + push * k);
        ctx.fillStyle = i % 7 === 3 ? pal.g[3] : pal.g[1]; ctx.fillRect(x, v.y + i, 1, 1);
        if (i % 7 === 3) ctx.fillRect(x + (i % 2 ? 1 : -1), v.y + i, 1, 1);
      }
    }
  });
}
function visibleChunks(fn) {
  const cx0 = Math.floor(G.cam.x / CHUNK_PX), cy0 = Math.floor((G.cam.y - TS) / CHUNK_PX);
  const cx1 = Math.floor((G.cam.x + VW) / CHUNK_PX), cy1 = Math.floor((G.cam.y + VH + TS) / CHUNK_PX);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(cx, cy, chunkCanvas(cx, cy));
}
function updateCamera(dt) {
  if (G.lockCam) return;                     // photo mode can set the camera by hand
  const b = G.ball, look = Math.max(-80, Math.min(80, b.vx * 0.35));
  const tx = b.x - VW / 2 + look, ty = b.y - VH * 0.55 + Math.max(-40, Math.min(60, b.vy * 0.12));
  const k = Math.min(1, dt * 5);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}
function drawWorldBackground(t) {
  const cam = G.cam, bgi = G.level % 4;
  const b3 = bgi % 2 ? IMG.bg3alt : IMG.bg3;
  const wrapDraw = (img, f, extra, dy = 0) => {
    const span = img.width, sx = (((cam.x * f + extra) % span) + span) % span;
    ctx.drawImage(img, sx, 0, Math.min(VW, span - sx), VH, 0, dy, Math.min(VW, span - sx), VH);
    if (span - sx < VW) ctx.drawImage(img, 0, 0, VW - (span - sx), VH, span - sx, dy, VW - (span - sx), VH);
  };
  const alt = -(cam.y + VH / 2 - G.w.start.y) / TS;
  // backdrop parallax
  const haze = a => { ctx.fillStyle = `rgba(214,230,240,${a})`; ctx.fillRect(0, 0, VW, VH); };
  const d2 = Math.round(Math.max(36, Math.min(VH, 36 + alt * 3))), d1 = Math.round(Math.max(64, Math.min(VH, 64 + alt * 6)));   // its painted ground always stays under the screen
  wrapDraw(b3, 0.05, t * 2 + bgi * 300);
  if (d2 < VH) { wrapDraw(d2 > 0 ? fadedLayer('bg2') : IMG.bg2, 0.15, bgi * 400, d2); if (d2 < 0) { ctx.fillStyle = '#b7cae0'; ctx.fillRect(0, VH + d2, VW, -d2); } }
  haze(0.28);
  if (d1 < VH) { wrapDraw(d1 > 0 ? fadedLayer('bg1') : IMG.bg1, 0.3, bgi * 700, d1); if (d1 < 0) { ctx.fillStyle = '#312938'; ctx.fillRect(0, VH + d1, VW, -d1); } }
  haze(0.5);
  // height tint. deeper gets darker and bluer, higher gets brighter and warmer
  if (alt < 0) { ctx.fillStyle = `rgba(6,14,24,${Math.min(0.62, -alt / 120)})`; ctx.fillRect(0, 0, VW, VH); }
  else { ctx.fillStyle = `rgba(255,248,225,${Math.min(0.22, alt / 160)})`; ctx.fillRect(0, 0, VW, VH); }
}
function drawArtifact(g, t, info, k, fade = 1) {
  const col = info.artifact[2], y = g.y + Math.sin(t * 1.8) * 3 - k * 20, x = g.x;
  ctx.globalAlpha = ((0.12 + 0.06 * Math.sin(t * 2)) * (1 - k)) * fade;
  ctx.fillStyle = col; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 120, 6, 120);
  ctx.globalAlpha = (0.25 * (1 - k * 0.5)) * fade; pxCircle(ctx, x, y, 14 + k * 8, col);
  ctx.globalAlpha = (0.45) * fade; pxCircle(ctx, x, y, 8, '#ffffff');
  ctx.globalAlpha = (1) * fade;
  // lil relic
  const s = [[0, -7], [5, -2], [3, 6], [-3, 6], [-5, -2]];
  ctx.fillStyle = MEM.dark;
  for (let yy = -8; yy <= 7; yy++) { const hw = yy < -2 ? (yy + 8) : yy < 6 ? 6 - (yy + 2) * 0.25 : 3; ctx.fillRect(Math.round(x - hw - 1), Math.round(y + yy), Math.round(hw * 2 + 2), 1); }
  ctx.fillStyle = col;
  for (let yy = -7; yy <= 6; yy++) { const hw = yy < -2 ? (yy + 7) * 0.9 : yy < 6 ? 5 - (yy + 2) * 0.25 : 2; ctx.fillRect(Math.round(x - hw), Math.round(y + yy), Math.round(hw * 2), 1); }
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = (0.8) * fade; ctx.fillRect(Math.round(x - 2), Math.round(y - 4), 2, 3); ctx.globalAlpha = (1) * fade;
  for (let i = 0; i < 6; i++) {
    const a = t * 1.5 + i / 6 * 6.283, r = 13 + Math.sin(t * 2 + i) * 2 + k * 20;
    ctx.globalAlpha = (0.6 + 0.4 * Math.sin(t * 3 + i)) * fade; ctx.fillStyle = i % 2 ? col : '#ffffff';
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6), 1, 1);
  }
  ctx.globalAlpha = (1) * fade;
}

// lighting
const LEVEL_DARK = [0, 0.06, 0.12, 0.19, 0.26, 0.33, 0.4];
const LEVEL_DEPTH = [0.08, 0.26, 0.4, 0.52, 0.62, 0.7, 0.78];     // how far the background has sunk into the dark
function worldLights() {
  const L = [], w = G.w, b = G.ball;
  for (const l of CB.lights()) L.push(Object.assign({ col: l.warm ? '#ffd27a' : '#6f8be0' }, l));
  L.push({ x: b.x, y: b.y - 2, r: 60, col: '#ffd89a', p: 1 });
  for (const f of w.flies) if (!f.got) L.push({ x: f.x, y: f.y, r: 26, col: '#eaff8a', p: 0.75 });
  for (const p of w.pads) L.push({ x: p.cx, y: p.cy - 6, r: 46 * (p.scale || 1), col: '#9ff4ff', p: 0.8 });
  for (const c of w.caps) L.push({ x: c.ox + 35, y: c.oy + 22, r: 62, col: '#6f8be0', p: 0.75 });
  if (G.level < LEVELS) L.push({ x: w.goal.x, y: w.goal.y, r: 96, col: w.L.info.artifact[2], p: 1 });
  for (const o of G.oracle ? [G.oracle] : []) if (o.x != null) L.push({ x: o.x, y: o.y, r: 50, col: '#c9a2ff', p: 0.8 });
  return L;
}
function drawWorldLight(cx, cy) {
  const base = G.level >= LEVELS ? 0 : LEVEL_DARK[Math.min(LEVEL_DARK.length - 1, G.level)] || 0;
  const amb = Math.max(base, (G.dark || 0) * 0.92);
  VX.drawLight(cx, cy, worldLights(), amb, G.dark > 0.3 ? [8, 7, 15] : [12, 14, 26]);
}
/* glowy spores floating around in the air, like the ones the blue caps drop */
const SPORES = [];
function drawSporeDrift(t, dt) {
  const cam = G.cam, n = 38;
  while (SPORES.length < n) SPORES.push({ x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, vx: 4 + Math.random() * 6, vy: -3 - Math.random() * 5, ph: Math.random() * 9, big: Math.random() < 0.2 });
  for (const s of SPORES) {
    s.x += (s.vx + Math.sin(t * 0.7 + s.ph) * 4) * dt; s.y += (s.vy + Math.cos(t * 0.9 + s.ph) * 3) * dt;
    if (s.x < cam.x - 20 || s.x > cam.x + VW + 20 || s.y < cam.y - 20 || s.y > cam.y + VH + 20) { s.x = cam.x + Math.random() * VW; s.y = cam.y + VH + 10; if (Math.random() < 0.5) { s.x = cam.x - 10; s.y = cam.y + Math.random() * VH; } }
    const a = 0.35 + 0.35 * Math.sin(t * 2 + s.ph);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#6f8be0'; VX.disc(ctx, s.x, s.y, s.big ? 2 : 1);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.fillStyle = s.big ? '#cddcff' : '#9db2f5'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function renderPlay(t, dt) {
  const w = G.w, L = w.L, cam = G.cam, cx = Math.round(cam.x), cy = Math.round(cam.y);
  drawWorldBackground(t);
  if (G.w.garden) drawGodRays(t, cam.x);
  { const dpt = Math.max(G.level >= LEVELS ? 0 : LEVEL_DEPTH[Math.min(LEVEL_DEPTH.length - 1, G.level)], (G.dark || 0) * 0.85); if (dpt > 0) { ctx.fillStyle = `rgba(10,9,24,${dpt})`; ctx.fillRect(0, 0, VW, VH); } }
  const [sx, sy] = VX.cameraOffset(t, dt);
  ctx.save(); ctx.translate(-cx + sx, -cy + sy);
  const vis = [];
  visibleChunks((ccx, ccy, c) => { vis.push([ccx, ccy, c]); });
  // props are placed at exact pixels by the generator
  for (let gy = Math.floor(cam.y / CHUNK_PX); gy <= Math.floor((cam.y + VH + 100) / CHUNK_PX); gy++)
    for (let gx = Math.floor((cam.x - 140) / CHUNK_PX); gx <= Math.floor((cam.x + VW + 140) / CHUNK_PX); gx++)
      for (const [name, px, py] of L.chunk(gx, gy).deco) spr(ctx, name, px, py);
  for (const [ccx, ccy, c] of vis) ctx.drawImage(c.terr, ccx * CHUNK_PX, ccy * CHUNK_PX - TS);
  drawFlora(t, false);
  for (const c of w.caps) if (Math.abs(c.ox - cam.x - VW / 2) < VW) drawCap(c);
  w.flies.forEach((f, i) => { if (Math.abs(f.x - cam.x - VW / 2) < VW && Math.abs(f.y - cam.y - VH / 2) < VH) drawFly(f, t, i); });
  if (w.garden) { const g = G.garden; for (const p of g.peds) drawPedestal(p, t); CB.anim(ctx, 'el_sleep', t * 3, g.elder.x, g.elder.gy, -1); drawFigure(w.goal.x, w.goal.y + 26, t); }
  else drawArtifact(w.goal, t, L.info, G.phase === 'cleared' ? Math.min(1, G.phaseT) : 0);
  for (const p of w.pads) drawPad(p);
  for (let i = 0; i < G.trail.length; i++) { ctx.globalAlpha = i / G.trail.length * 0.5; ctx.fillStyle = '#fff2cc'; ctx.fillRect(Math.round(G.trail[i].x), Math.round(G.trail[i].y), 1, 1); }
  ctx.globalAlpha = 1;
  if (G.phase === 'dead') { const b = G.ball; if (G.phaseT < 0.4) drawBall({ x: b.x, y: b.y + G.phaseT * 30, vx: 0, vy: 0 }, t, 1 - G.phaseT * 2.2); }
  else if (G.phase !== 'draft') {
    CB.draw(ctx, t);
    drawBall(G.ball, t, G.iframes > 0 && Math.floor(t * 18) % 2 ? 0.35 : 1);
    if (G.phase === 'play' && !grounded() && G.ball.slings > 0) {
      const r = 8 + Math.sin(t * 6) * 0.6; ctx.fillStyle = '#9ff4dc'; ctx.globalAlpha = 0.55;
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + t * 1.5; if (i % 2) ctx.fillRect(Math.round(G.ball.x + Math.cos(a) * r), Math.round(G.ball.y + Math.sin(a) * r), 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
  drawFlora(t, true);
  drawSporeDrift(t, dt);
  for (const [ccx, ccy, c] of vis) ctx.drawImage(c.wat, ccx * CHUNK_PX, ccy * CHUNK_PX);
  if (G.phase === 'play' && (G.aim || G.kbAim.on)) drawAim(t);
  drawTutorial(t, dt);
  drawGuide(t, dt);
  if (G.phase === 'play' && G.mouse && !G.touch && !G.aim) CB.drawReticle(ctx, G.mouse.x + cx, G.mouse.y + cy, t);
  drawFX(dt);
  drawParticles(dt);
  if (!G.paused) VX.updateSparks(dt);
  VX.draw(ctx, dt);
  ctx.restore();
  drawWorldLight(cx - sx, cy - sy);
  VX.drawVignette(0.55 + (G.dark || 0) * 0.45);
  if (G.flashA > 0) { ctx.globalAlpha = Math.min(1, G.flashA); ctx.fillStyle = G.flashCol || '#ffffff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; G.flashA -= dt * 2.6; }
  if (G.aim) {
    ctx.strokeStyle = 'rgba(234,255,246,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(G.aim.sx + 0.5, G.aim.sy + 0.5); ctx.lineTo(G.aim.x + 0.5, G.aim.y + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(234,255,246,0.6)'; ctx.fillRect(Math.round(G.aim.sx) - 1, Math.round(G.aim.sy) - 1, 3, 3);
  }
  drawOrbs(dt);
  // photo mode (for store screenshots, set from code): no hud, logo is optional
  if (G.photo) { if (G.photo === 'cover') { const L = G.photoLogo || {}; drawLogo(t, L.y ?? G.photoY ?? 40, L.sc || 5, L.x ?? VW / 2, L.tag || 2); } if (G.photo === 'oracle') drawOracle(t); return; }
  // hud
  const lvl = G.w.garden ? L.info.name : `Level ${G.level + 1}/${LEVELS}  -  ${L.info.name}`;
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
  drawOracle(t);
  drawTouchButtons();
  if (!G.oracle && G.phase === 'play' && G.askCd <= 0 && !G.touch && canListen()) text('Q: listen', 34, VH - 14, 1, 'rgba(200,190,255,0.55)', 'left', null);
  if (G.roomT < 8 && G.phase === 'play' && G.level === 0 && !G.touch) {
    ctx.globalAlpha = Math.min(1, (8 - G.roomT) / 1.5);
    const hint = TUT.flings < 2 ? 'A/D roll  -  Space hop  -  click to blast toxin' : 'A/D roll  -  Space hop  -  drag to fling (again mid-air)  -  click to blast toxin';
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
  if (G.phase === 'cleared' && !G.w.garden) {
    const k = Math.min(1, G.phaseT * 3), A = L.info.artifact;
    ctx.globalAlpha = k;
    membrane(VW / 2 - 160, 110, 320, 124, 16, { dots: 14, glow: 0.25, edge: A[2] });
    text(`Artifact ${G.level + 1} of ${LEVELS}`, VW / 2, 120, 1, MEM.dim, 'center');
    text(A[0], VW / 2, 136, 3, A[2], 'center');
    text(`"${A[1]}"`, VW / 2, 176, 1, MEM.text, 'center');
    text(G.roomSpores ? `${G.roomSpores} spore${G.roomSpores === 1 ? '' : 's'} left behind here  -  ${fmtTime(G.roomT)}` : `Not a single fall  -  ${fmtTime(G.roomT)}`, VW / 2, 194, 1, '#9ff4ff', 'center');
    if (G.phaseT > 1.2) { ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 4)); text(G.touch ? 'Tap to continue' : 'Space or click to continue', VW / 2, 214, 1, MEM.dim, 'center'); }
    ctx.globalAlpha = 1;
  }
  renderDraft(t);
  if (G.paused) {
    ctx.fillStyle = 'rgba(6,16,18,0.6)'; ctx.fillRect(0, 0, VW, VH);
    membrane(VW / 2 - 120, 150, 240, 96, 14, { dots: 10 });
    text('Paused', VW / 2, 160, 2, '#9ff4dc', 'center');
    text(G.touch ? 'Tap to keep going' : 'Esc, P, Space or click to keep going', VW / 2, 188, 1, MEM.text, 'center');
    text(AU.muted ? 'M: sound is off' : 'M: sound is on', VW / 2, 200, 1, MEM.dim, 'center');
    // fling sensitivity:  <  ■ ■ ■ □ □  >
    const ry = SENS_ROW.y;
    text('<', SENS_ROW.l, ry - 4, 1, sensI > 0 ? '#9ff4dc' : MEM.dim, 'center'); text('>', SENS_ROW.r, ry - 4, 1, sensI < SENS.length - 1 ? '#9ff4dc' : MEM.dim, 'center');
    for (let i = 0; i < SENS.length; i++) { ctx.fillStyle = i <= sensI ? '#9ff4dc' : '#2c4a46'; ctx.fillRect(VW / 2 - 30 + i * 12, ry - 2, 8, 6); }
    text(G.touch ? 'Fling sensitivity' : 'Fling sensitivity  (A / D)', VW / 2, ry + 10, 1, MEM.dim, 'center');
  }
}

/* the bouncy title logo (title screen, and the cover in photo mode) */
function drawLogo(t, y0, sc = 5, cx = VW / 2, tag = 2) {
  const word = 'Sporebound', tw = [...word].reduce((a, ch) => a + textWidth(ch, sc) + (fontFor(sc) ? sc : 0), 0);
  let x = cx - tw / 2;
  for (let i = 0; i < word.length; i++) {
    const b = Math.abs(Math.sin(t * 2.4 + i * 0.45)) * 8 * sc / 5;
    text(word[i], x, y0 - b, sc, i === 5 ? '#9ff4dc' : '#f2fff8', 'left', '#0b1a1c');
    x += textWidth(word[i], sc) + (fontFor(sc) ? sc : 0);
  }
  text('every miss grows something', cx, y0 + 54 * sc / 5, tag, '#c8ffb0', 'center');
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
  drawBall({ x: bx, y: by, vx: goingRight ? 120 : -120, vy: Math.cos(ph * Math.PI) * -200, roll: bx / PHYS.R }, t);
  drawLogo(t, 60);
  if (!ready()) { text(loadError ? `Missing assets/${loadError}` : 'Loading...', VW / 2, 180, 2, loadError ? '#ff8a6a' : MEM.text, 'center'); return; }
  const items = MENU();
  G.menu = Math.max(0, Math.min(items.length - 1, G.menu));
  items.forEach((it, i) => {
    const y = 148 + i * 26, sel = i === G.menu, wdt = 260;
    membrane(VW / 2 - wdt / 2, y, wdt, 20, 10, { edge: it.disabled ? '#5f7f78' : sel ? '#9ff4dc' : MEM.edgeD, glow: sel && !it.disabled ? 0.2 : 0 });
    text(it.label, VW / 2, y + 5, 1, it.disabled ? '#5f7f78' : sel ? '#f2fff8' : MEM.dim, 'center');
  });
  if (G.best) text(`Best story run: ${fmtTime(G.best.time)}  -  ${G.best.spores} spore${G.best.spores === 1 ? '' : 's'}`, VW / 2, 148 + items.length * 26 + 6, 1, '#ffe9a8', 'center');
  text(G.touch ? 'Buttons roll and hop  -  drag anywhere to fling  -  tap to blast toxin' : 'A/D roll  -  Space hop  -  drag to fling  -  click or E: toxin  -  Q listen  -  M mute', VW / 2, 361, 1, MEM.text, 'center');
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
  text('You bounced back.', VW / 2, 12, 3, '#d8ffd0', 'center');
  text('Every spore you left behind took root in the garden.', VW / 2, 44, 1, '#9ff4ff', 'center');
  // the artifacts u got
  for (let i = 0; i < LEVELS; i++) {
    const A = window.GEN.ARTIFACTS[window.GEN.STORY_MAP[i]], got = G.artifacts.includes(i), x = VW / 2 - (LEVELS - 1) * 15 + i * 30, y = 74;
    const k = Math.max(0, Math.min(1, (G.endT - 0.3 - i * 0.08) * 3));
    drawArtifact({ x, y }, t + i, { artifact: got ? A : [A[0], A[1], '#5a6470'] }, 0, k * (got ? 1 : 0.35));   // the ones u missed stay grey
  }
  ctx.globalAlpha = 1;
  membrane(VW / 2 - 200, 104, 400, 70, 16, { dots: 16 });
  const rows = [['Time', fmtTime(G.time) + (G.best && Math.abs(G.best.time - G.time) < 0.01 ? '  (best!)' : '')], ['Artifacts', `${G.artifacts.length} / ${LEVELS}`], ['Spores left behind', String(R.spores)], ['Reborn  -  fireflies  -  rivals dissolved', `${R.drafts}  -  ${G.flies}  -  ${G.kills || 0}`]];
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
  { const m = G.touch ? 'Tap to return' : 'Click or press Space to return', w = textWidth(m) + 16; pill(VW / 2 - w / 2, 276, w); text(m, VW / 2, 279, 1, MEM.text, 'center'); }
  ctx.globalAlpha = 1;
  drawParticles(dt);
}

let last = performance.now(), acc = 0, T = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  resize();
  if (G.state === 'load' && ready()) G.state = 'title';
  const cur = G.state === 'play' && G.phase === 'play' && !G.touch ? 'none' : '';
  if (screen.style.cursor !== cur) screen.style.cursor = cur;   // the toxin reticle replaces the mouse in play
  const airAim = G.state === 'play' && G.phase === 'play' && (G.aim || G.kbAim.on) && G.ball && !grounded();
  G.ts += ((airAim ? 0.3 : 1) - G.ts) * Math.min(1, dt * 14);
  if (G.hitstop > 0 && !G.paused) G.hitstop -= dt;                    // freeze frames, a lil pause on big hits
  else if (G.state === 'play' && !G.paused && !G.photoFreeze) { acc += dt * G.ts; while (acc >= PHYS.DT) { fixedUpdate(PHYS.DT); acc -= PHYS.DT; if (G.state !== 'play') break; } }
  if (G.state === 'end') G.endT += dt;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.state === 'play') renderPlay(T, dt);
  else if (G.state === 'end') renderEnd(T, dt);
  else if (ready()) renderTitle(T);
  else { ctx.fillStyle = '#d6e6f0'; ctx.fillRect(0, 0, VW, VH); text(loadError ? `Missing assets/${loadError}` : 'Loading...', VW / 2, VH / 2, 2, loadError ? '#c0392b' : '#1a1424', 'center', null); }
  if (G.state === 'play') VX.drawIris(dt); else G.iris = null;
  G.fade = Math.max(0, G.fade - dt * 2.5);
  if (G.fade > 0.01) { ctx.fillStyle = `rgba(8,20,22,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.touch && window.innerHeight > window.innerWidth * 1.1) {          // phones, the game wants landscape
    const m = 'Turn your phone sideways for a bigger view', w = textWidth(m) + 16;
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(T * 3); pill(VW / 2 - w / 2, VH / 2 - 7, w); text(m, VW / 2, VH / 2 - 4, 1, MEM.text, 'center'); ctx.globalAlpha = 1;
  }
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(lo, 0, 0, screen.width, screen.height);
  requestAnimationFrame(frame);
}
window.SPOREBOUND = { G, CB, startLevel, newGame, continueGame, AU, MUT, MUTATIONS, openDraft, pickCard, fling, hop, summonOracle };
screen.focus();
requestAnimationFrame(frame);
})();
