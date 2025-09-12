
	document.addEventListener('DOMContentLoaded', () => {
		const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
		if (!hasGSAP) return;
		gsap.registerPlugin(ScrollTrigger);

		// Utility: query params (support ?logo=...&crest=...&bg2=...)
		const params = new URLSearchParams(location.search);
		const paramLogo = params.get('logo');
		const paramCrest = params.get('crest');
		const paramBG2 = params.get('bg2');

		// Elements
		const brandLogoEl = document.getElementById('brandLogo');
		const crestEl = document.getElementById('crestImg');
		const bgImgs = Array.from(document.querySelectorAll('.bg-img'));
		const sections = Array.from(document.querySelectorAll('section.section'));

		// Safe apply image into <img>
		function setImg(el, url) {
			if (!url || !el) return;
			const temp = new Image();
			try { temp.crossOrigin = 'anonymous'; } catch (e) {}
			temp.onload = () => { el.src = url; if (el === brandLogoEl) el.style.display = 'block'; };
			temp.onerror = () => console.warn('Image failed to load:', url);
			temp.src = url;
		}

		// Safe apply image into bg stack item (by index)
		function setBG(index, url) {
			const img = bgImgs[index];
			if (!img || !url) return;
			// We use data-src so existing lazy/preload logic works
			img.setAttribute('data-src', url);
			img.removeAttribute('src'); // force fresh load via preload()
			// If the section is already near viewport, just load now
			preload(img);
		}

		// Initial assets from query params (if provided)
		if (paramLogo) setImg(brandLogoEl, paramLogo);
		if (paramCrest) setImg(crestEl, paramCrest);
		if (paramBG2) setBG(1, paramBG2);

		// Progress bar
		const progressWrap = document.querySelector('.progress-wrap');
		const progressBar = document.getElementById('progressBar');
		let progressHideTimer;
		const updateProgress = () => {
			const scrollTop = window.scrollY || document.documentElement.scrollTop;
			const docH = document.documentElement.scrollHeight - window.innerHeight;
			const pct = docH > 0 ? (scrollTop / docH) * 100 : 0;
			progressBar.style.width = pct + '%';
			progressWrap.style.opacity = 1;
			clearTimeout(progressHideTimer);
			progressHideTimer = setTimeout(() => progressWrap.style.opacity = 0, 700);
		};
		document.addEventListener('scroll', updateProgress, { passive: true });
		updateProgress();

		// Ripples
		const addRipple = (e) => {
			const btn = e.currentTarget;
			const rect = btn.getBoundingClientRect();
			const ripple = document.createElement('span');
			ripple.className = 'ripple';
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			const size = Math.max(rect.width, rect.height);
			ripple.style.width = ripple.style.height = size + 'px';
			ripple.style.left = (clientX - rect.left - size / 2) + 'px';
			ripple.style.top = (clientY - rect.top - size / 2) + 'px';
			btn.appendChild(ripple);
			ripple.addEventListener('animationend', () => ripple.remove());
		};
		document.querySelectorAll('.btn').forEach(b => {
			b.addEventListener('click', addRipple, { passive: true });
			b.addEventListener('touchstart', addRipple, { passive: true });
		});

		// Modal
		const modal = document.getElementById('filmModal');
		const openModalButtons = document.querySelectorAll('[data-open-modal], #watchTop');
		const closeModalButtons = modal.querySelectorAll('[data-close-modal]');
		let lastFocused = null;

		function trapFocus() {
			const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
			const first = focusables[0],
				last = focusables[focusables.length - 1];

			function onKey(e) {
				if (e.key === 'Escape') { closeModal(); }
				if (e.key !== 'Tab') return;
				if (e.shiftKey && document.activeElement === first) { e.preventDefault();
					last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault();
					first.focus(); }
			}
			modal.addEventListener('keydown', onKey);
			modal._untrap = () => modal.removeEventListener('keydown', onKey);
		}

		function openModal() {
			lastFocused = document.activeElement;
			modal.hidden = false;
			document.body.style.overflow = 'hidden';
			trapFocus();
			(modal.querySelector('[data-close-modal]') || modal.querySelector('button'))?.focus();
		}

		function closeModal() {
			modal.hidden = true;
			if (modal._untrap) modal._untrap();
			document.body.style.overflow = '';
			lastFocused && lastFocused.focus();
		}
		openModalButtons.forEach(btn => btn.addEventListener('click', openModal));
		closeModalButtons.forEach(btn => btn.addEventListener('click', closeModal));
		modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

		// Background lazy loading
		const preload = (img) => {
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
			probe.onerror = () => console.warn('Background failed to load:', dataSrc);
			try { probe.crossOrigin = 'anonymous'; } catch (e) {}
			probe.src = dataSrc;
		};

		// Preload first bg immediately
		if (bgImgs[0]) preload(bgImgs[0]);

		// Observe sections to load their bgs
		const io = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const idx = Number(entry.target.getAttribute('data-index')) || 0;
					if (bgImgs[idx]) preload(bgImgs[idx]);
				}
			});
		}, { threshold: 0.15 });
		sections.forEach((sec, i) => { sec.setAttribute('data-index', i);
			io.observe(sec); });

		// Cinematic crossfade + parallax
		function activateBG(index) {
			bgImgs.forEach((img, i) => {
				if (i === index) {
					gsap.to(img, { autoAlpha: 1, scale: 1.02, duration: 1.2, ease: "power2.out" });
				} else {
					gsap.to(img, { autoAlpha: 0, scale: 1.08, duration: 1, ease: "power2.out" });
				}
			});
		}
		activateBG(0);

		bgImgs.forEach((img, i) => {
			gsap.to(img, {
				yPercent: 12,
				ease: "none",
				scrollTrigger: {
					trigger: sections[i] || sections[sections.length - 1],
					start: "top bottom",
					end: "bottom top",
					scrub: true
				}
			});
		});

		sections.forEach((sec, i) => {
			const content = sec.querySelector('.content');
			const lines = gsap.utils.toArray(sec.querySelectorAll('.text-line'));
			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: sec,
					start: "top 65%",
					end: "top 30%",
					toggleActions: "play none none reverse"
				}
			});
			tl.to(content, { autoAlpha: 1, y: 0, duration: .9, ease: "power2.out" });
			if (lines.length) {
				tl.from(lines, { y: 28, autoAlpha: 0, stagger: .18, duration: .6, ease: "power2.out" }, "-=.35");
			}
			ScrollTrigger.create({
				trigger: sec,
				start: "top center",
				onEnter: () => activateBG(i),
				onEnterBack: () => activateBG(i)
			});
		});

		// Asset panel logic (lets you load local files; works on iPad too)
		const assetToggle = document.getElementById('assetToggle');
		const assetPanel = document.getElementById('assetPanel');
		const logoFile = document.getElementById('logoFile');
		const crestFile = document.getElementById('crestFile');
		const bg2File = document.getElementById('bg2File');
		const applyUrlsBtn = document.getElementById('applyUrls');
		const closeAssetsBtn = document.getElementById('closeAssets');
		const logoUrl = document.getElementById('logoUrl');
		const crestUrl = document.getElementById('crestUrl');
		const bg2Url = document.getElementById('bg2Url');

		assetToggle.addEventListener('click', () => assetPanel.classList.toggle('open'));
		closeAssetsBtn.addEventListener('click', () => assetPanel.classList.remove('open'));

		function fileToURL(file, cb) {
			if (!file) return;
			const url = URL.createObjectURL(file);
			cb(url);
		}

		logoFile.addEventListener('change', (e) => {
			const f = e.target.files?.[0];
			if (!f) return;
			fileToURL(f, (url) => { setImg(brandLogoEl, url); });
		});

		crestFile.addEventListener('change', (e) => {
			const f = e.target.files?.[0];
			if (!f) return;
			fileToURL(f, (url) => { setImg(crestEl, url); });
		});

		bg2File.addEventListener('change', (e) => {
			const f = e.target.files?.[0];
			if (!f) return;
			fileToURL(f, (url) => { setBG(1, url); });
		});

		applyUrlsBtn.addEventListener('click', () => {
			if (logoUrl.value) setImg(brandLogoEl, logoUrl.value.trim());
			if (crestUrl.value) setImg(crestEl, crestUrl.value.trim());
			if (bg2Url.value) setBG(1, bg2Url.value.trim());
		});

		// Keyboard quick-open for assets (press A)
		document.addEventListener('keydown', (e) => {
			if ((e.key === 'a' || e.key === 'A') && !e.metaKey && !e.ctrlKey && !e.altKey) {
				assetPanel.classList.toggle('open');
			}
		});
	}); 
