/* SKY HUNTER SURVIVAL - DCR STUDIOS */
(() => {
'use strict';
const $ = id => document.getElementById(id), cv = $('c'), ctx = cv.getContext('2d');
const H = 640, PI2 = Math.PI * 2, GRAV = 1250, FLAP = -410, FLOOR = H - 22;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let best = +LS.get('shs_best', 0) || 0, snd = LS.get('shs_snd', true) !== false, fx = LS.get('shs_fx', true) !== false;
let W = 360, S = 1, state = 'menu', ret = 'ready', T = 0, gt = 0, hold = 0, overT = 0, shake = 0, trailT = 0, nextGate = 0, isNew = false;
let p, obs, mines, coins, parts, score, cn, lives, clouds = [];
const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() * .7, t: 1 + Math.random() * 3 }));

/* ---------- sound ---------- */
let ac;
function beep(f, d, type, v, slide) {
  if (!snd) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, n);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), n + d);
    g.gain.setValueAtTime(v || .06, n);
    g.gain.exponentialRampToValueAtTime(.001, n + d);
    o.connect(g); g.connect(ac.destination);
    o.start(n); o.stop(n + d);
  } catch (e) {}
}

/* ---------- ui helpers ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function msg(t) { const m = $('msg'); m.textContent = t || ''; m.classList.toggle('hidden', !t); }
function hud() {
  $('hs').textContent = score; $('hc').textContent = cn;
  $('hl').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
}
function setTxt() { $('bSnd').textContent = 'SOUND: ' + (snd ? 'ON' : 'OFF'); $('bFx').textContent = 'PARTICLES: ' + (fx ? 'ON' : 'OFF'); $('mBest').textContent = best; }

/* ---------- setup ---------- */
function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
  S = cv.height / H; W = cv.width / S;
}
function mkClouds() {
  clouds = Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * (H - 160), w: 50 + Math.random() * 60, sp: 15 + Math.random() * 35 }));
}
function reset() {
  p = { x: 90, y: H / 2, vy: 0, r: 15, inv: 0, rot: 0 };
  obs = []; mines = []; coins = []; parts = [];
  score = 0; cn = 0; lives = 3; gt = 0; hold = 0; overT = 0; shake = 0; nextGate = .6; isNew = false;
  hud();
}
const px = () => clamp(W * .28, 70, 200);
const speed = () => 190 + Math.min(gt / 20 * 28, 210);

/* ---------- flow ---------- */
function startGame() { reset(); state = 'ready'; show(null); $('hud').classList.remove('hidden'); msg('TAP / SPACE TO FLY'); }
function toMenu() { reset(); state = 'menu'; msg(''); $('hud').classList.add('hidden'); setTxt(); show('menu'); }
function pause() {
  if (state !== 'play' && state !== 'ready') return;
  ret = state; state = 'pause'; msg(''); show('pause');
}
function resume() {
  if (state !== 'pause') return;
  state = ret; show(null);
  if (ret === 'play') { hold = .9; msg('GET READY'); } else msg('TAP / SPACE TO FLY');
}
function flap() {
  if (hold > 0) return;
  if (state === 'ready') { state = 'play'; msg(''); }
  if (state !== 'play') return;
  p.vy = FLAP;
  beep(420, .1, 'triangle', .05, 220);
  burst(p.x - 12, p.y + 4, 6, '#7df9ff', 120);
}
function gameOver() {
  state = 'over'; overT = .9; msg('');
  burst(p.x, p.y, 50, '#ff5d7a', 380); burst(p.x, p.y, 30, '#7df9ff', 300);
  shake = 22; beep(220, .7, 'sawtooth', .1, -170);
  if (score > best) { best = score; isNew = true; LS.set('shs_best', best); }
}
function showOver() {
  $('oS').textContent = score; $('oB').textContent = best; $('oC').textContent = cn;
  $('newBest').classList.toggle('hidden', !isNew);
  $('hud').classList.add('hidden'); show('over');
}

/* ---------- world ---------- */
function burst(x, y, n, c, sp) {
  if (!fx) n = (n / 4) | 0;
  for (let i = 0; i < n && parts.length < 400; i++) {
    const a = Math.random() * PI2, v = Math.random() * sp, l = .4 + Math.random() * .5;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l, m: l, c, s: 2 + Math.random() * 3 });
  }
}
function spawnGate(lv, sp) {
  const gap = Math.max(140, 225 - lv * 9), amp = Math.min(lv * 11, 85) * Math.random();
  const by = gap / 2 + 70 + Math.random() * (H - gap - 140);
  obs.push({ x: W + 40, w: 62, gap, by, amp, ph: Math.random() * PI2, f: 1 + Math.random() * 1.2, y: by, passed: false });
  nextGate = Math.max(1.1, 1.75 - lv * .06);
  const mx = W + 71 + sp * nextGate * .5;
  if (gt > 10 && Math.random() < Math.min(.15 + lv * .05, .55)) {
    mines.push({ x: mx, by: 160 + Math.random() * (H - 320), y: H / 2, ph: Math.random() * PI2, r: 17 });
  } else {
    const y = 130 + Math.random() * (H - 260), n = 3 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) coins.push({ x: mx + (i - (n - 1) / 2) * 36, y: y - Math.sin(i / (n - 1) * Math.PI) * 28, r: 11, ph: i * .7 });
  }
}
function circRect(cx, cy, r, x, y, w, h) {
  const dx = cx - clamp(cx, x, x + w), dy = cy - clamp(cy, y, y + h);
  return dx * dx + dy * dy < r * r;
}
function hit(kind, o) {
  lives--; p.inv = 1.8; shake = 14;
  beep(150, .4, 'sawtooth', .1, -90);
  burst(p.x, p.y, 24, '#ff5d7a', 260); burst(p.x, p.y, 14, '#ffd23c', 200);
  hud();
  if (lives <= 0) { gameOver(); return; }
  if (kind === 'g') { p.y = o.y; p.vy = 0; }
  else if (kind === 'f') { p.y = H / 2; p.vy = -200; }
  else if (kind === 'm') o.dead = true;
}

function update(dt) {
  if (state === 'pause') return;
  T += dt;
  const sp = state === 'play' ? speed() : 50;
  for (const c of clouds) { c.x -= c.sp * (sp / 200) * dt; if (c.x < -c.w * 2) { c.x = W + c.w * 2; c.y = 40 + Math.random() * (H - 160); } }
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .98; q.vy *= .98; q.l -= dt; }
  parts = parts.filter(q => q.l > 0);
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (state === 'over') { if (overT > 0) { overT -= dt; if (overT <= 0) showOver(); } return; }
  if (state !== 'play') { p.x = px(); p.y = H / 2 + Math.sin(T * 3) * 8; p.vy = 0; p.rot = 0; return; }
  if (hold > 0) { hold -= dt; if (hold <= 0) msg(''); return; }

  gt += dt;
  const lv = gt / 20;
  p.x = px();
  p.vy = Math.min(p.vy + GRAV * dt, 720);
  p.y += p.vy * dt;
  p.rot += (clamp(p.vy / 600, -.5, .9) - p.rot) * Math.min(1, dt * 10);
  if (p.inv > 0) p.inv -= dt;
  if (p.y < p.r) { p.y = p.r; if (p.vy < 0) p.vy = 0; }
  trailT -= dt;
  if (trailT <= 0 && fx) { trailT = .03; parts.push({ x: p.x - 16, y: p.y, vx: -sp * .6, vy: (Math.random() - .5) * 30, l: .3, m: .3, c: '#7df9ff', s: 3 }); }

  if ((nextGate -= dt) <= 0) spawnGate(lv, sp);
  const R = p.r * .8;
  for (const g of obs) {
    g.x -= sp * dt;
    g.y = clamp(g.by + Math.sin(g.ph + T * g.f) * g.amp, g.gap / 2 + 30, H - 30 - g.gap / 2);
    if (!g.passed && g.x + g.w < p.x) { g.passed = true; score += 10; beep(660, .07, 'square', .04); hud(); }
    if (state === 'play' && p.inv <= 0 && (circRect(p.x, p.y, R, g.x, 0, g.w, g.y - g.gap / 2) || circRect(p.x, p.y, R, g.x, g.y + g.gap / 2, g.w, H))) hit('g', g);
  }
  for (const m of mines) {
    m.x -= sp * dt; m.y = m.by + Math.sin(T * 2 + m.ph) * 45;
    if (state === 'play' && p.inv <= 0 && Math.hypot(m.x - p.x, m.y - p.y) < m.r + R) hit('m', m);
  }
  for (const c of coins) {
    c.x -= sp * dt;
    if (!c.dead && Math.hypot(c.x - p.x, c.y - p.y) < c.r + p.r + 4) {
      c.dead = true; cn++; score += 5; hud();
      beep(900, .09, 'sine', .07, 500); burst(c.x, c.y, 10, '#ffd23c', 160);
    }
  }
  if (state === 'play' && p.inv <= 0 && p.y > FLOOR - p.r + 4) hit('f');
  obs = obs.filter(g => g.x > -g.w - 20);
  mines = mines.filter(m => !m.dead && m.x > -40);
  coins = coins.filter(c => !c.dead && c.x > -40);
}

/* ---------- drawing ---------- */
function pillar(x, w, y0, y1) {
  ctx.fillStyle = '#101a52'; ctx.fillRect(x, y0, w, y1 - y0);
  ctx.fillStyle = '#1b2a8a'; ctx.fillRect(x, y0, 9, y1 - y0);
  ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y0 + 1, w - 2, y1 - y0 - 2);
}
function drawGate(g) {
  const top = g.y - g.gap / 2, bot = g.y + g.gap / 2;
  pillar(g.x, g.w, -10, top); pillar(g.x, g.w, bot, H);
  ctx.fillStyle = '#2a3a9a'; ctx.fillRect(g.x - 6, top - 16, g.w + 12, 16); ctx.fillRect(g.x - 6, bot, g.w + 12, 16);
  ctx.fillStyle = '#ff5dd8'; ctx.fillRect(g.x - 6, top - 3, g.w + 12, 3); ctx.fillRect(g.x - 6, bot, g.w + 12, 3);
}
function drawMine(m) {
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(T * 1.5);
  ctx.strokeStyle = '#ff5d7a'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * PI2 / 8; ctx.moveTo(Math.cos(a) * m.r, Math.sin(a) * m.r); ctx.lineTo(Math.cos(a) * (m.r + 9), Math.sin(a) * (m.r + 9)); }
  ctx.stroke();
  ctx.fillStyle = '#3a1450'; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `rgba(255,61,110,${.6 + .4 * Math.sin(T * 8)})`; ctx.beginPath(); ctx.arc(0, 0, 6, 0, PI2); ctx.fill();
  ctx.restore();
}
function drawCoin(c) {
  const sq = Math.abs(Math.cos(T * 4 + c.ph)) * c.r + 2;
  ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.ellipse(c.x, c.y, sq, c.r, 0, 0, PI2); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(c.x, c.y, sq * .45, c.r * .5, 0, 0, PI2); ctx.fill();
}
function drawPlayer() {
  if (p.inv > 0 && ((p.inv * 14) | 0) % 2) return;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = 'rgba(125,249,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 25, 0, PI2); ctx.stroke();
  ctx.save(); ctx.rotate(T * 2); ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.moveTo(25, 0); ctx.lineTo(32, 0); }
  ctx.stroke(); ctx.restore();
  ctx.rotate(p.rot);
  const f = 8 + Math.random() * 8;
  ctx.fillStyle = '#ff9d3c'; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-20 - f, 0); ctx.lineTo(-14, 4); ctx.fill();
  ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-16 - f / 2, 0); ctx.lineTo(-14, 2); ctx.fill();
  ctx.fillStyle = '#2a3a9a'; ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-14, -17); ctx.lineTo(2, -17); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.scale(1, -1);
  }
  const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#7df9ff'); g.addColorStop(1, '#9b5cff');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(-16, 0); ctx.lineTo(-6, -9); ctx.lineTo(10, -8); ctx.lineTo(19, 0); ctx.lineTo(10, 8); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(10, 0, 3.5, 0, PI2); ctx.fill();
  ctx.restore();
}
function draw() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050a1f'); bg.addColorStop(.6, '#1b2a6b'); bg.addColorStop(1, '#5a2a8a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  ctx.fillStyle = '#fff';
  for (const s of stars) { ctx.globalAlpha = .25 + .75 * Math.abs(Math.sin(T * s.t + s.x * 9)); ctx.fillRect(s.x * W, s.y * H, 2, 2); }
  ctx.globalAlpha = .13; ctx.fillStyle = '#cfe8ff';
  for (const c of clouds) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(c.x + i * c.w * .5, c.y + (i % 2) * 6, c.w * .6, c.w * .22, 0, 0, PI2); ctx.fill(); }
  ctx.globalAlpha = 1;
  obs.forEach(drawGate); mines.forEach(drawMine); coins.forEach(drawCoin);
  ctx.fillStyle = '#2a0f4a'; ctx.fillRect(0, FLOOR, W, 22);
  ctx.fillStyle = '#ff3d6e'; ctx.fillRect(0, FLOOR, W, 3);
  for (const q of parts) { ctx.globalAlpha = clamp(q.l / q.m, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, q.s, q.s); }
  ctx.globalAlpha = 1;
  if (state !== 'over') drawPlayer();
}

/* ---------- loop ---------- */
let last = 0;
function loop(ts) {
  const dt = Math.min((ts - last) / 1000 || 0, .05); last = ts;
  update(dt); draw(); requestAnimationFrame(loop);
}

/* ---------- input ---------- */
const on = (id, f) => $(id).addEventListener('click', () => { beep(600, .05, 'sine', .05); f(); });
on('bPlay', startGame); on('bAgain', startGame); on('bRst', startGame);
on('bHelp', () => show('help')); on('bSet', () => show('settings'));
on('bHBack', () => show('menu')); on('bSBack', () => show('menu'));
on('bPause', pause); on('bRes', resume);
on('bPMenu', toMenu); on('bOMenu', toMenu);
on('bSnd', () => { snd = !snd; LS.set('shs_snd', snd); setTxt(); });
on('bFx', () => { fx = !fx; LS.set('shs_fx', fx); setTxt(); });
on('bReset', () => { best = 0; LS.set('shs_best', 0); setTxt(); $('bReset').textContent = 'BEST SCORE RESET'; setTimeout(() => $('bReset').textContent = 'RESET BEST SCORE', 1200); });

cv.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (state === 'play' || state === 'ready') { e.preventDefault(); if (!e.repeat) flap(); }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'pause') resume();
    else if (state === 'play' || state === 'ready') pause();
    else if (state === 'menu') show('menu');
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- init ---------- */
resize(); mkClouds(); setTxt(); toMenu();
requestAnimationFrame(loop);
})();
