const overlay = document.getElementById('overlay');

// Performance & platform helpers
const isMobileDevice = (()=>{
  try {
    return /Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent) || (('ontouchstart' in window) && window.innerWidth < 900);
  } catch(e) { return false; }
})();

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

// Throttle for less CPU on mobile: compute spokes dynamically
function computeSpokes(w, h) {
  const minSide = Math.min(w, h);
  let spokes = Math.floor(minSide / 20); // fewer for small screens
  spokes = Math.max(12, Math.min(64, spokes));
  // on mobile reduce further
  if (isMobileDevice) spokes = Math.max(10, Math.floor(spokes * 0.5));
  return spokes;
}
const topCard = document.getElementById('topCard');
const playerCard = document.getElementById('playerCard');
const muteBtn = document.getElementById('muteBtn');
const progressBar = document.querySelector('.progressBar');
const audio = document.getElementById('audio');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const viz = document.getElementById('viz');
const fx = document.getElementById('fx');
const ctx = viz.getContext('2d', { alpha: true });
const fxCtx = fx.getContext('2d', { alpha: true });
const scrollIndicator = document.getElementById('scrollIndicator');

function showCards() {
  topCard.classList.add('visible');
  playerCard.classList.add('visible');
}

let audioCtx, analyser, dataArray, bufferLength, sourceNode;
function ensureAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('AudioContext init failed', e);
    audioCtx = null;
  }
}

overlay.addEventListener('click', async () => {
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  showCards();
  ensureAudioContext();
  startFx();
  try { await audio.play(); } catch (e) {}
});
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); overlay.click(); }
});

if (scrollIndicator) {
  scrollIndicator.addEventListener('click', ()=> {
    const target = document.getElementById('content');
    if (target) target.scrollIntoView({behavior:'smooth', block:'start'});
    ensureAudioContext();
    if (audio.paused) { audio.play().catch(()=>{}); }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') { e.preventDefault(); audio.muted = !audio.muted; updateMuteIcon(); }
});

function updateMuteIcon(){
  const path = document.getElementById('muteIconPath');
  if (!path) return;
  if (audio.muted) {
    path.setAttribute('d','M5 9v6h3l5 5V4L8 9H5z M19 5l-1.5 1.5L15 9l-2 2 2 2 2.5 2.5L19 17l-2.5-2.5L14 12l2.5-2.5L19 7z');
    muteBtn.setAttribute('aria-label','Unmute');
  } else {
    path.setAttribute('d','M5 9v6h3l5 5V4L8 9H5z M16 12a4 4 0 0 0-1.2-2.8l-1.1 1.1a2.4 2.4 0 0 1 0 3.4l1.1 1.1A4 4 0 0 0 16 12z');
    muteBtn.setAttribute('aria-label','Mute');
  }
}
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    updateMuteIcon();
  });
}

function formatTime(sec){
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progressBar.style.width = pct + '%';
  currentTimeEl.textContent = formatTime(audio.currentTime);
  document.querySelector('.progressWrap').setAttribute('aria-valuenow', Math.floor(pct));
});
audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = formatTime(audio.duration);
  resizeCanvas();
});

document.getElementById('tgBtn').addEventListener('click', () => { window.open('https://t.me/x0xr0', '_blank'); });
const discordBtn = document.getElementById('discordBtn');
discordBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('rxckbs');
    const msg = document.getElementById('discordCopied');
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 1100);
  } catch (e) {
    console.warn('copy failed', e);
  }
});

const tiltContainer = document.getElementById('tiltContainer');
const cards = [topCard, playerCard];
function parallax(e){
  const rect = tiltContainer.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  cards.forEach((el,i)=>{
    const depth = i ? 8 : 12;
    el.style.transform = `rotateX(${(-y*depth)}deg) rotateY(${(x*depth)}deg) translateZ(0)`;
  });
}
tiltContainer.addEventListener('mousemove', parallax);
tiltContainer.addEventListener('mouseleave', ()=> cards.forEach(el=> el.style.transform=''));

let rafViz = null;
let rafFx = null;
function resizeCanvas(){
  const maxDpr = 1.75;
  const dpr = Math.min(maxDpr, Math.max(1, window.devicePixelRatio || 1));
  viz.width = viz.clientWidth * dpr;
  viz.height = viz.clientHeight * dpr;
  viz.style.width = viz.clientWidth + 'px';
  viz.style.height = viz.clientHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);

  fx.width = fx.clientWidth * dpr;
  fx.height = fx.clientHeight * dpr;
  fx.style.width = fx.clientWidth + 'px';
  fx.style.height = fx.clientHeight + 'px';
  fxCtx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', debounce(resizeCanvas, 120));
resizeCanvas();

function startViz(){
  if (!analyser) return;
  if (rafViz) cancelAnimationFrame(rafViz);
  draw();
}
function stopViz(){
  if (rafViz) cancelAnimationFrame(rafViz);
  rafViz = null;
}

audio.addEventListener('play', () => { startViz(); });
audio.addEventListener('pause', () => { stopViz(); });

function draw(){
  rafViz = requestAnimationFrame(draw);
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  const w = viz.clientWidth, h = viz.clientHeight;
  ctx.clearRect(0,0,viz.width,viz.height);

  const low = dataArray[5] / 255;
  const pulse = 0.04 + low * 0.12;
  const grd = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2, Math.max(w,h)/2);
  grd.addColorStop(0, `rgba(30,30,30,${pulse})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,w,h);

  const bars = Math.min(80, Math.floor(w / 9));
  const gap = 3;
  const barW = (w / bars);
  for (let i=0;i<bars;i++){
    const idx = Math.floor(i * bufferLength / bars);
    let v = (dataArray[idx] || 0) / 255;
    v = Math.pow(v, 0.9);
    const bh = Math.max(3, v * (h * 0.5));
    const x = i * barW + gap/2;
    const y = h - bh - 12;
    const bw = barW - gap;
    const shade = 60 + Math.round(v * 110);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    roundRect(ctx, x, y, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.03 + v*0.08})`;
    roundRect(ctx, x+1, y+1, Math.max(0,bw-2), Math.max(0,bh-2), 5);
    ctx.fill();
    ctx.shadowColor = `rgba(255,255,255,${0.04 + v*0.06})`;
    ctx.shadowBlur = 12 * v;
    ctx.shadowOffsetY = -3 * v;
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  const cx = w/2, cy = h/2;
  const radius = Math.min(w,h) * 0.22;
  const ringBins = 128;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(performance.now()/4000);
  for (let i=0;i<ringBins;i++){
    const idx = Math.floor(i * bufferLength / ringBins);
    const v = (dataArray[idx] || 0) / 255;
    const len = radius + v * radius * 0.75;
    const a0 = (i / ringBins) * Math.PI * 2;
    const a1 = ((i+1) / ringBins) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(230,230,230,${0.08 + v*0.35})`;
    ctx.lineWidth = 1.4 + v * 2.4;
    ctx.arc(0,0,len, a0, a1);
    ctx.stroke();
  }
  ctx.restore();

  let bassAvg = 0; const bassCount = Math.max(8, Math.floor(bufferLength*0.06));
  for (let i=0;i<bassCount;i++){ bassAvg += dataArray[i]||0; }
  bassAvg = (bassAvg / bassCount) / 255;
  if (bassAvg > 0.4) beatGlitch = Math.min(1, beatGlitch + (bassAvg-0.35)*0.9);

  const logo = document.getElementById('logoText');
  const jitter = beatGlitch * 2.5;
  logo.style.textShadow = `0 ${jitter}px ${2+jitter}px rgba(255,255,255,0.12), 0 -${jitter}px ${1+jitter}px rgba(255,255,255,0.06)`;

  ctx.save();
  ctx.translate(cx, cy);
  const spokes = 32;
  for (let i=0;i<spokes;i++){
    const idx = Math.floor(i * bufferLength / spokes);
    const v = (dataArray[idx] || 0) / 255;
    if (v < 0.1) continue;
    const len = (Math.min(w,h) * 0.15) + v * (Math.min(w,h) * 0.35);
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + v*0.2})`;
    ctx.lineWidth = 0.6 + v * 1.4;
    ctx.beginPath();
    const a = (i/spokes) * Math.PI*2 + performance.now()/1800;
    ctx.moveTo(Math.cos(a)* (len*0.25), Math.sin(a)* (len*0.25));
    ctx.lineTo(Math.cos(a)* len, Math.sin(a)* len);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

const particles = [];
let beatGlitch = 0;
function initParticles(){
  particles.length = 0;
  const w = fx.clientWidth, h = fx.clientHeight;
  const count = Math.round(Math.min(160, Math.max(80, (w*h)/42000)));
  for(let i=0;i<count;i++){
    particles.push({
      x: Math.random()*w,
      y: Math.random()*h,
      vx: (Math.random()-0.5)*0.6,
      vy: (Math.random()-0.5)*0.6,
      life: Math.random()*200+60,
      size: Math.random()*1.6+0.4
    });
  }
}

function startFx(){
  if (rafFx) cancelAnimationFrame(rafFx);
  initParticles();
  drawFx();
}
function stopFx(){
  if (rafFx) cancelAnimationFrame(rafFx);
  rafFx = null;
}

function drawFx(){
  rafFx = requestAnimationFrame(drawFx);
  const w = fx.clientWidth, h = fx.clientHeight;
  fxCtx.clearRect(0,0,fx.width,fx.height);

  const t = performance.now()/1000;
  const cx = w/2, cy = h/2;
  fxCtx.save();
  fxCtx.translate(cx, cy);
  fxCtx.rotate(t * 0.08);
  for (let i=0;i<12;i++){
    const r = Math.min(w,h) * (0.08 + i*0.045);
    fxCtx.beginPath();
    fxCtx.arc(0,0,r,0,Math.PI*2);
    fxCtx.strokeStyle = `rgba(255,255,255,${0.02 + 0.015*Math.sin(t*1.6 + i)})`;
    fxCtx.lineWidth = 0.5 + 0.6*(1+Math.sin(t*2+i))/2 + beatGlitch*0.6;
    fxCtx.stroke();
  }
  fxCtx.restore();

  fxCtx.globalCompositeOperation = 'lighter';
  for (let p of particles){
    p.x += p.vx + (Math.sin((p.y+t*40)*0.003))*0.2;
    p.y += p.vy + (Math.cos((p.x-t*40)*0.003))*0.2;
    if (--p.life < 0){
      p.x = Math.random()*w; p.y = Math.random()*h; p.life = Math.random()*200+60;
    }
    if (p.x<0) p.x+=w; if (p.x>w) p.x-=w; if (p.y<0) p.y+=h; if (p.y>h) p.y-=h;
    fxCtx.fillStyle = `rgba(200,200,200,${0.02 + p.size*0.02 + beatGlitch*0.05})`;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size + beatGlitch*0.8, 0, Math.PI*2);
    fxCtx.fill();
  }
  fxCtx.globalCompositeOperation = 'source-over';

  beatGlitch *= 0.9;
}

function ensureInitOnGesture(){
  if (audioCtx) return;
  ensureAudioContext();
}
['click','touchstart','keydown'].forEach(evt => {
  window.addEventListener(evt, ensureInitOnGesture, {once:true, passive:true});
});

function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopViz();
    stopFx();
  } else {
    if (!audio.paused) startViz();
    startFx();
  }
});

(function typewriter(){
  const text = "@avi"; let index = 0;
  function step(){
    if(index <= text.length){ document.title = text.substring(0,index); index++; setTimeout(step, 200); }
    else { index = 0; setTimeout(step, 1600); }
  } step();
})();

document.addEventListener('DOMContentLoaded', ()=> {
  setTimeout(()=> topCard.classList.add('visible'), 320);
  setTimeout(()=> playerCard.classList.add('visible'), 680);
  if (!audioCtx && !audio.paused) ensureAudioContext();
  startFx();
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, {threshold:0.18, rootMargin:'0px 0px -10% 0px'});
  document.querySelectorAll('.content-block').forEach(el=> io.observe(el));

  const tryStartOnce = ()=>{
    ensureAudioContext();
    if (audio.paused) { audio.play().catch(()=>{}); }
    window.removeEventListener('click', tryStartOnce);
    window.removeEventListener('touchstart', tryStartOnce);
  };
  window.addEventListener('click', tryStartOnce, {once:true});
  window.addEventListener('touchstart', tryStartOnce, {once:true, passive:true});
});



// Safer animation loop using DPR-aware canvas resizing and dynamic spokes
let rafId = null;
function visualizerLoop() {
  // Resize canvases for crispness
  resizeCanvasToDisplaySize(viz);
  resizeCanvasToDisplaySize(fx);
  const w = viz.width;
  const h = viz.height;
  // clear
  ctx.clearRect(0,0,w,h);
  fxCtx.clearRect(0,0,fx.width,fx.height);

  // compute data
  if (analyser && typeof analyser.getByteFrequencyData === 'function') {
    analyser.getByteFrequencyData(dataArray);
  }

  // draw background rings (cheap)
  const cx = w/2, cy = h/2;
  ctx.save();
  ctx.translate(cx, cy);
  const spokes = computeSpokes(w, h);
  const bufferLength = dataArray.length || 0;
  for (let i=0;i<spokes;i++){
    const idx = Math.floor(i * bufferLength / spokes);
    const v = (dataArray[idx] || 0) / 255;
    if (v < 0.06) continue;
    const len = (Math.min(w,h) * 0.12) + v * (Math.min(w,h) * 0.38);
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + v*0.18})`;
    ctx.lineWidth = Math.max(0.5, 0.6 + v * 1.2);
    ctx.beginPath();
    const a = (i/spokes) * Math.PI*2 + performance.now()/2200;
    ctx.moveTo(Math.cos(a)* (len*0.28), Math.sin(a)* (len*0.28));
    ctx.lineTo(Math.cos(a)* len, Math.sin(a)* len);
    ctx.stroke();
  }
  ctx.restore();

  // light FX (cheap blur)
  fxCtx.save();
  fxCtx.globalAlpha = 0.06;
  fxCtx.fillRect(0,0,fx.width,fx.height);
  fxCtx.restore();

  rafId = requestAnimationFrame(visualizerLoop);
}

// Start visualizer safely
function startVisualizer() {
  if (rafId) return;
  // Only run visualizer in visible tab to save battery
  if (document.hidden) { document.addEventListener('visibilitychange', ()=> { if (!document.hidden) visualizerLoop(); }, {once:true}); return; }
  visualizerLoop();
}

// Stop visualizer when appropriate
function stopVisualizer() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// Kick off when analyser is ready
function ensureVisualizerActive() {
  if (!analyser) return;
  startVisualizer();
}
