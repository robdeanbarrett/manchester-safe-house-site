// script.js
document.addEventListener('DOMContentLoaded', () => {
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) document.documentElement.classList.add('prm');

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  // Progress bar
  const progressWrap = document.querySelector('.progress-wrap');
  const progressBar = document.getElementById('progressBar');
  let progressHideTimer;
  const updateProgress = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? (y / docH) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressWrap) {
      progressWrap.style.opacity = 1;
      clearTimeout(progressHideTimer);
      progressHideTimer = setTimeout(() => (progressWrap.style.opacity = 0), 700);
    }
  };
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // Generalized modal manager
  const appMain = document.getElementById('main');
  const appHeader = document.querySelector('header');

  function setAppInert(state) {
    [appMain, appHeader].forEach(el => {
      if (!el) return;
      if (state) {
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
      } else {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('inert');
      }
    });
  }
  function trapFocus(modal) {
    const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(modal.querySelectorAll(selectors)).filter(el => !el.hasAttribute('disabled'));
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    function onKey(e) {
      if (e.key === 'Escape') { closeModal(modal); }
      if (e.key !== 'Tab') return;
      if (!nodes.length) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    modal.addEventListener('keydown', onKey);
    modal._untrap = () => modal.removeEventListener('keydown', onKey);
  }
  function openModal(modal) {
    const el = typeof modal === 'string' ? document.querySelector(modal) : modal;
    if (!el) return;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    setAppInert(true);
    trapFocus(el);
    (el.querySelector('[data-close-modal]') || el.querySelector('button') || el).focus();
    el.addEventListener('click', (e) => { if (e.target === el) closeModal(el); }, { once: true });
    el.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(el), { once: true }));
  }
  function closeModal(modal) {
    const el = typeof modal === 'string' ? document.querySelector(modal) : modal;
    if (!el) return;
    el.hidden = true;
    if (el._untrap) el._untrap();
    document.body.style.overflow = '';
    setAppInert(false);
  }
  // data-open-modal triggers
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-modal]');
    if (openBtn) {
      const sel = openBtn.getAttribute('data-open-modal');
      if (sel) {
        e.preventDefault();
        openModal(sel);
      }
    }
  });

  // Intercept anchor navigations and show Access modal (except bypass or same-page hash)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const inModal = !!a.closest('.modal-backdrop');
    const isHash = href.startsWith('#');
    const bypass = a.hasAttribute('data-bypass-lock') || href.startsWith('mailto:') || href.startsWith('tel:') || inModal || isHash;
    if (bypass) return;
    e.preventDefault();
    openModal('#accessModal');
  });

  // Lazy-load backgrounds
  const bgImgs = Array.from(document.querySelectorAll('.bg-img'));
  const sections = Array.from(document.querySelectorAll('section.section'));
  function preload(img) {
    if (!img) return;
    const dataSrc = img.getAttribute('data-src');
    const dataSrcset = img.getAttribute('data-srcset');
    if (!dataSrc) return;
    const probe = new Image();
    probe.onload = () => {
      img.src = dataSrc;
      if (dataSrcset) img.srcset = dataSrcset;
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    };
    probe.onerror = () => console.warn('BG failed:', dataSrc);
    try { probe.crossOrigin = 'anonymous'; } catch (e) {}
    probe.src = dataSrc;
  }
  if (bgImgs[0]) preload(bgImgs[0]);
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        const idx = Number(en.target.getAttribute('data-index')) || 0;
        [idx, idx + 1].forEach(k => { if (bgImgs[k]) preload(bgImgs[k]); });
      }
    });
  }, { threshold: 0.15 });
  sections.forEach((sec, i) => { sec.setAttribute('data-index', i); io.observe(sec); });

  // Background crossfade
  function activateBG(index) {
    if (!hasGSAP) return;
    bgImgs.forEach((img, i) =>
      gsap.to(img, {
        autoAlpha: i === index ? 1 : 0,
        duration: i === index ? 0.8 : 0.6,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    );
  }
  activateBG(0);
  if (hasGSAP) {
    sections.forEach((sec, i) =>
      ScrollTrigger.create({
        trigger: sec,
        start: 'top center',
        onEnter: () => activateBG(i),
        onEnterBack: () => activateBG(i)
      })
    );
  }

  // Utility for image readiness
  function whenImageReady(img) {
    return new Promise(resolve => {
      if (img.complete && img.naturalWidth) return resolve(img);
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => resolve(img), { once: true });
    });
  }

  // Big motion: pan while zooming out to show full image, reverse on scroll up
  const effectTweens = [];
  function clearEffectTweens() {
    while (effectTweens.length) {
      const t = effectTweens.pop();
      try { t.scrollTrigger && t.scrollTrigger.kill(); t.kill && t.kill(); } catch (e) {}
    }
  }

  async function registerBGEffects() {
    if (!hasGSAP || prefersReducedMotion) return;
    clearEffectTweens();

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < bgImgs.length; i++) {
      const img = bgImgs[i];
      const sec = sections[i] || sections[sections.length - 1];

      await whenImageReady(img);
      const iw = img.naturalWidth || vw;
      const ih = img.naturalHeight || vh;

      const coverScale   = Math.max(vw / iw, vh / ih);
      const containScale = Math.min(vw / iw, vh / ih);

      const startScale = coverScale * 1.65; // deeper zoom for drama
      const endScale   = containScale;      // full image visible

      const endWidth  = iw * endScale;
      const endHeight = ih * endScale;
      const safeSpanX = Math.max(0, (vw - endWidth) / 2);
      const safeSpanY = Math.max(0, (vh - endHeight) / 2);
      const minFallback = 80;
      const spanX = safeSpanX > 0 ? safeSpanX : minFallback;
      const spanY = safeSpanY > 0 ? safeSpanY : minFallback;

      const effect = (sec && sec.dataset && sec.dataset.bgEffect ? sec.dataset.bgEffect : (document.body.dataset && document.body.dataset.bgEffect) || 'panx').toLowerCase();
      const amtAttr = sec && sec.dataset ? Number(sec.dataset.bgAmt) : NaN;
      const amtMul = isNaN(amtAttr) ? 1 : Math.max(0.25, Math.min(2.0, amtAttr / 10));

      const baseFrom = { xPercent: -50, yPercent: -50, scale: startScale, transformOrigin: 'center center' };
      const baseTo   = { xPercent: -50, yPercent: -50, scale: endScale };

      let fromProps = { ...baseFrom };
      let toProps   = { ...baseTo };

      switch (effect) {
        case 'pany':
          fromProps.y = -spanY * amtMul; toProps.y = spanY * amtMul;
          fromProps.x = 0; toProps.x = 0;
          break;
        case 'diagonal':
          fromProps.x = -spanX * amtMul; toProps.x = spanX * amtMul;
          fromProps.y = -spanY * amtMul; toProps.y = spanY * amtMul;
          break;
        case 'rotate':
          fromProps.rotation = -8; toProps.rotation = 8;
          fromProps.x = -spanX * 0.4 * amtMul; toProps.x = spanX * 0.4 * amtMul;
          fromProps.y = -spanY * 0.25 * amtMul; toProps.y = spanY * 0.25 * amtMul;
          break;
        case 'parallaxy':
          fromProps.y = -spanY * 0.6 * amtMul; toProps.y = spanY * 0.6 * amtMul;
          fromProps.x = 0; toProps.x = 0;
          break;
        case 'zoomin':
        case 'zoomout':
          fromProps.x = -spanX * 0.15 * amtMul; toProps.x = spanX * 0.15 * amtMul;
          fromProps.y = 0; toProps.y = 0;
          break;
        case 'panx':
        default:
          fromProps.x = -spanX * amtMul; toProps.x = spanX * amtMul;
          fromProps.y = 0; toProps.y = 0;
          break;
      }

      const tween = gsap.fromTo(img, fromProps, {
        ...toProps,
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });
      effectTweens.push(tween);
    }
  }

  registerBGEffects();

  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      if (hasGSAP) {
        ScrollTrigger.getAll().forEach(st => {
          const trg = st.vars && st.vars.trigger;
          if (trg && trg.classList && trg.classList.contains('section')) st.kill();
        });
      }
      registerBGEffects().then(() => {
        if (hasGSAP) {
          sections.forEach((sec, i) =>
            ScrollTrigger.create({
              trigger: sec,
              start: 'top center',
              onEnter: () => activateBG(i),
              onEnterBack: () => activateBG(i)
            })
          );
          ScrollTrigger.refresh();
        }
      });
    }, 150);
  });

  // Entrance for hero and quotes
  if (hasGSAP) {
    gsap.to('.content.center', { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.2 });
  } else {
    document.querySelectorAll('.content.center').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  const SPEED_MULTIPLIER = 0.25;
  function estimateReadTime(text) {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    const seconds = words * 0.25 * SPEED_MULTIPLIER;
    return Math.min(1.0, Math.max(0.35, seconds));
  }
  function sequenceSection(section) {
    const content = section.querySelector('.content.quote');
    if (!content) return;
    const lines = Array.from(content.querySelectorAll('.text-line'));
    const cta = content.querySelector('.cta-line') || content.querySelector('.cta-row');

    function resetToStart() {
      if (!hasGSAP) return;
      gsap.set(content, { autoAlpha: 0, y: 24 });
      gsap.set(lines, { autoAlpha: 0, y: 64 });
      if (cta) gsap.set(cta, { autoAlpha: 0, y: 56 });
    }
    if (hasGSAP) resetToStart();

    if (!hasGSAP || prefersReducedMotion) {
      content.style.opacity = 1; content.style.transform = 'none';
      lines.forEach(l => { l.style.opacity = 1; l.style.transform = 'none'; });
      if (cta) { cta.style.opacity = 1; cta.style.transform = 'none'; }
      return;
    }

    const tl = gsap.timeline({ paused: true });
    tl.fromTo(content, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0);
    lines.forEach((el, idx) => {
      tl.fromTo(el, { autoAlpha: 0, y: 64 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out' }, idx === 0 ? '+=0.08' : '>');
      tl.to({}, { duration: estimateReadTime(el.textContent || '') });
    });
    if (cta) tl.fromTo(cta, { autoAlpha: 0, y: 56 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power3.out' }, '>');

    ScrollTrigger.create({
      trigger: section,
      start: 'top 68%',
      end: 'bottom top',
      onEnter: () => tl.restart(true),
      onEnterBack: () => tl.restart(true),
      onLeave: () => { tl.pause(0); resetToStart(); },
      onLeaveBack: () => { tl.pause(0); resetToStart(); }
    });
  }
  document.querySelectorAll('.section').forEach(sequenceSection);

  // Scrollspy for nav
  const navLinks = Array.from(document.querySelectorAll('.nav-right a'));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        navLinks.forEach(a => a.removeAttribute('aria-current'));
        const active = navLinks.find(a => a.getAttribute('href') === `#${en.target.id}`);
        if (active) active.setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });
  sections.forEach(s => spy.observe(s));

  // Mark JS ready (keep no-js fallback if any error prevented reaching here)
  try {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-js');
      document.documentElement.classList.add('js');
    });
  } catch (e) {}
});