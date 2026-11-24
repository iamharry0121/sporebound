/* spore golf */
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
  /* the cup, just a soft glow in the ground */
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
  spr(ctx, 'start', w.start.x - 22, w.start.y + PHYS.R - SPR.start[3] + 3);
  spr(ctx, 'goal', w.goal.x + 9, w.goal.y + 8 - SPR.goal[3] + 1);
}
function renderPlay(t, dt) {
  const w = G.w, H = HOLES[w.hi];
  drawBackground(H.bg, t, G.ball.x);
  ctx.drawImage(terrainCache, 0, 0);
  drawSigns(w);
  for (const p of w.posts) spr(ctx, 'post', p.px, p.py);
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
  ctx.fillStyle = 'rgba(10,24,26,0.25)'; ctx.fillRect(0, 0, VW, VH);
  const wy = 340;
  for (let x = 0; x < VW; x += TS) { ctx.drawImage(IMG.tp, 4 * TS, 8 * TS, TS, TS, x, wy, TS, TS); for (let y = wy + TS; y < VH; y += TS) ctx.drawImage(IMG.tp, 5 * TS, 8 * TS, TS, TS, x, y, TS, TS); }
  const per = 1.6, ph = (t % per) / per, left = 230, right = 410;
  const goingRight = Math.floor(t / per) % 2 === 0;
  const bx = goingRight ? left + (right - left) * ph : right - (right - left) * ph, by = wy - 26 - Math.sin(ph * Math.PI) * 110;
  const sq = ph < 0.1 ? 1 - ph / 0.1 : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;
  for (const [x, s] of [[left, goingRight ? sq * (ph < 0.5 ? 1 : 0) : sq * (ph > 0.5 ? 1 : 0)], [right, goingRight ? sq * (ph > 0.5 ? 1 : 0) : sq * (ph < 0.5 ? 1 : 0)]]) drawPad({ cx: x, sy: wy, x, grow: 1, squish: s * 0.8 });
  drawBall({ x: bx, y: by, vx: goingRight ? 120 : -120, vy: Math.cos(ph * Math.PI) * -200 }, t);
  const word = 'Spore Golf', sc = 5, tw = [...word].reduce((a, ch) => a + textWidth(ch, sc) + (fontFor(sc) ? sc : 0), 0);
  let x = VW / 2 - tw / 2;
  for (let i = 0; i < word.length; i++) {
    const b = Math.abs(Math.sin(t * 2.4 + i * 0.45)) * 8;
    text(word[i], x, 60 - b, sc, i > 5 ? '#9ff4dc' : '#f2fff8', 'left', '#0b1a1c');
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
  text('Up/Down + Space, or click  -  drag back to fling  -  F aim with keys  -  R retry  -  M mute', VW / 2, 372, 1, MEM.text, 'center');
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
  else { ctx.fillStyle = '#d6e6f0'; ctx.fillRect(0, 0, VW, VH); text(loadError ? `Missing assets/${loadError}` : 'Loading...', VW / 2, VH / 2, 2, loadError ? '#c0392b' : '#1a1424', 'center', null); }
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
