(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Language: English by default, Portuguese on request ---------- */

  var PT = {
    skip: 'Pular para o conteúdo',
    clock: 'relógio',
    motion: 'Movimento',
    on: 'ligado',
    off: 'desligado',
    eyebrow: 'yDkay · Caio Consoli · Cascavel, Brasil',
    h1: 'Nada escapa.',
    lede: 'A luz não escapa de um buraco negro. Eu queria que os bugs tivessem o mesmo problema.',
    cue: 'Role para cair',
    l1: 'O trabalho',
    h2a: 'Eu procuro o lugar onde as coisas quebram.',
    p2a: 'Todo sistema tem uma borda que ele mesmo não conhece. Eu vou atrás dela, com paciência, antes que alguém chegue lá. Parte dessa busca é feita à mão. Cada vez mais, por agentes que eu ensino a procurar do jeito que eu procuro.',
    l2: 'Quem',
    h2b: 'Caio Consoli. Curioso por profissão.',
    p2b: 'Testador de ofício e construtor por temperamento, trabalhando de Cascavel, no sul do Brasil, com gente de qualquer lugar.',
    l3: 'Em órbita',
    h2c: 'Algumas coisas ainda estão fora de vista.',
    prod1: 'Primeiro produto',
    prod1w: 'Em observação.',
    l4: 'A pergunta',
    h2d: 'O que acontece depois do horizonte de eventos?',
    p2d: 'É a pergunta que eu mais gostaria de ver respondida. Nada que o atravessou voltou para contar. Até que algo volte, eu fico com mistérios menores: por que as coisas quebram, e onde.',
    l5: 'Horizonte de eventos',
    h2e: 'Daqui a luz não volta. E-mail volta.',
    owner: 'A yDkay é a empresa. Caio Consoli é o que há dentro.',
    'f-company': 'Empresa',
    'f-where': 'Sede',
    'f-place': 'Cascavel, Paraná, Brasil',
    'f-contact': 'Contato',
    newtab: '(abre em nova aba)'
  };
  var EN = {};
  var nodes = document.querySelectorAll('[data-i18n]');
  Array.prototype.forEach.call(nodes, function (el) { EN[el.dataset.i18n] = el.textContent; });
  EN.on = 'on';
  EN.off = 'off';

  var lang = 'en';
  var langBtn = $('lang');

  function t(key) { return (lang === 'pt' ? PT : EN)[key] || EN[key] || key; }

  function setLang(next) {
    lang = next;
    root.lang = next === 'pt' ? 'pt-BR' : 'en';
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    langBtn.textContent = next === 'pt' ? 'EN' : 'PT';
    langBtn.setAttribute('lang', next === 'pt' ? 'en' : 'pt');
    langBtn.setAttribute('aria-label', next === 'pt' ? 'EN, view in English' : 'PT, ver em português');
    document.title = next === 'pt' ? 'yDkay · Nada escapa' : 'yDkay · Nothing escapes';
    renderMotionLabel();
    try { localStorage.setItem('lang', next); } catch (e) {}
  }

  langBtn.addEventListener('click', function () { setLang(lang === 'pt' ? 'en' : 'pt'); });

  /* ---------- Motion: follows the system setting, the visitor can override ---------- */

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionBtn = $('motion');
  var stored = null;
  try { stored = localStorage.getItem('motion'); } catch (e) {}
  var motion = stored ? stored === 'on' : !reduceQuery.matches;

  function renderMotionLabel() {
    $('motion-state').textContent = motion ? t('on') : t('off');
    motionBtn.setAttribute('aria-pressed', motion ? 'true' : 'false');
  }

  function applyMotion() {
    root.classList.toggle('motion', motion);
    renderMotionLabel();
    if (motion) revealAll(false); else revealAll(true);
    restartSky();
  }

  motionBtn.addEventListener('click', function () {
    motion = !motion;
    try { localStorage.setItem('motion', motion ? 'on' : 'off'); } catch (e) {}
    applyMotion();
  });

  reduceQuery.addEventListener && reduceQuery.addEventListener('change', function (e) {
    var s = null;
    try { s = localStorage.getItem('motion'); } catch (err) {}
    if (!s) { motion = !e.matches; applyMotion(); }
  });

  /* ---------- Reveal on scroll ---------- */

  var reveals = document.querySelectorAll('.reveal');
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }) : null;

  function revealAll(show) {
    Array.prototype.forEach.call(reveals, function (el) {
      if (show || !io) { el.classList.add('in'); return; }
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) el.classList.add('in');
      else io.observe(el);
    });
  }

  /* ---------- The fall: scroll position becomes distance to the horizon ---------- */

  var contact = $('contact');
  var rVal = $('r-val');
  var tVal = $('t-val');
  var canvas = $('bh');
  var bh = null;
  try {
    bh = new window.BlackHole(canvas);
    root.classList.add('webgl');
  } catch (e) {
    bh = null; // the CSS fallback stays visible
  }

  var FAR = 34, NEAR = 1.2, STILL = 20;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var raf = 0, start = performance.now(), lastFrame = 0, staticTime = 18;

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(a, b, x) { var k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); }

  function progress() {
    var end = contact.offsetTop;
    return end > 0 ? clamp(window.scrollY / end, 0, 1) : 0;
  }

  // Slow approach through the sections, then the plunge at the horizon.
  var MID = 8, KNEE = 0.8;
  function distanceAt(p) {
    if (p <= KNEE) return FAR * Math.pow(MID / FAR, p / KNEE);
    var k = (p - KNEE) / (1 - KNEE);
    return MID * Math.pow(NEAR / MID, k * k);
  }

  function layout(p, moving) {
    var w = window.innerWidth, h = window.innerHeight;
    var aspect = w / h;
    var phone = w <= 760;
    var side = moving ? smooth(0, 0.14, p) * (1 - smooth(0.82, 0.98, p)) : 1;
    var s = { shiftX: 0, shiftY: 0, scrim: 0 };
    if (phone) {
      s.shiftY = 0.06 + 0.16 * side;
      s.scrim = moving ? smooth(0.03, 0.12, p) : 1;
    } else {
      s.shiftX = aspect * (0.1 + 0.12 * side);
      s.scrim = moving ? side : 1;
    }
    return s;
  }

  function updateReadout(dist) {
    rVal.textContent = dist.toFixed(dist < 10 ? 2 : 1);
    tVal.textContent = Math.sqrt(Math.max(0, 1 - 1 / dist)).toFixed(2);
  }

  function state(now) {
    var p = progress();
    var moving = motion;
    var dist = moving ? distanceAt(p) : STILL;
    var L = layout(p, moving);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    var time = moving ? (now - start) / 1000 : staticTime;
    return {
      time: time,
      dist: dist,
      tilt: (moving ? 0.16 + 0.1 * smooth(0.2, 0.8, p) : 0.18) + (moving ? mouse.y * 0.05 : 0),
      yaw: moving ? time * 0.012 + mouse.x * 0.12 : 0.35,
      shiftX: L.shiftX,
      shiftY: L.shiftY,
      zoom: 1.45,
      scrim: L.scrim,
      p: p
    };
  }

  var scrimEl = document.querySelector('.scrim');
  var lastP = -1, lastScrim = '';

  // drawSky: false when only the overlay and readout need updating.
  function paint(now, drawSky) {
    var s = state(now);
    var past = s.p >= 1;
    // Past the horizon the screen is black: nothing to update twice.
    if (past && lastP >= 1 && motion) return;
    lastP = s.p;
    var sc = s.scrim.toFixed(3);
    if (sc !== lastScrim) { scrimEl.style.setProperty('--scrim', sc); lastScrim = sc; }
    updateReadout(s.dist);
    if (bh && drawSky && !past) bh.draw(s);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    // About 30 frames a second is plenty for a slow-turning disk.
    if (now - lastFrame < 30) return;
    if (bh && lastFrame) bh.adapt(now - lastFrame);
    lastFrame = now;
    paint(now, true);
  }

  function restartSky() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    lastP = -1;
    if (motion && !document.hidden) raf = requestAnimationFrame(loop);
    else paint(performance.now(), true);
  }

  // In still mode the sky is one frame: scrolling only moves the overlay.
  var pending = false;
  function stillUpdate(drawSky) {
    if (motion || pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; paint(performance.now(), drawSky); });
  }

  window.addEventListener('scroll', function () { stillUpdate(false); }, { passive: true });
  window.addEventListener('resize', function () {
    if (bh) bh.dirty = true;
    if (motion) paint(performance.now(), true); else stillUpdate(true);
  });
  document.addEventListener('visibilitychange', restartSky);
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  if (canvas) {
    // If the GPU drops the context, fall back to the CSS black hole for good;
    // the loop keeps the overlay and readout working.
    canvas.addEventListener('webglcontextlost', function () {
      root.classList.remove('webgl');
      bh = null;
    });
  }

  $('year').textContent = String(new Date().getFullYear());

  var savedLang = null;
  try { savedLang = localStorage.getItem('lang'); } catch (e) {}
  if (savedLang === 'pt') setLang('pt');
  applyMotion();
})();
