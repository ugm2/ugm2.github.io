// riso — interactions; three.js only in road.js.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
root.classList.add("js");
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = (k, v) => {
	try {
		return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v);
	} catch {
		return null;
	}
};
const seen = (els, cb, opts = { threshold: 0.3 }) => {
	const io = new IntersectionObserver((es) => {
		for (const e of es)
			if (e.isIntersecting) {
				cb(e.target);
				io.unobserve(e.target);
			}
	}, opts);
	els.forEach((el) => io.observe(el));
};
// Safari 26's floating toolbar: pinned UI stays inside the visible height
const vis = () => root.style.setProperty("--ih", `${innerHeight}px`);
vis();
addEventListener("resize", vis, { passive: true });

let glideRaf = 0,
	passing = false;
// pass: a jump crossing the road (it snaps along silently)
const glide = (y, ms, done, pass) => {
	cancelAnimationFrame(glideRaf);
	passing = !!pass;
	const y0 = scrollY;
	const d = y - y0;
	const t0 = performance.now();
	const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2);
	const step = (now) => {
		const t = RM ? 1 : Math.min(1, (now - t0) / ms);
		scrollTo({ top: y0 + d * ease(t), behavior: "instant" });
		glideRaf = t < 1 ? requestAnimationFrame(step) : 0;
		if (t >= 1) (done?.(), (passing = false));
	};
	step(t0);
};
let moved = false;
// one hash owner: the road's stop inside it, else the section in view
const hashes = {
	section: "",
	road: "",
	ready: false,
	sync() {
		if (!this.ready) return;
		const h = this.road || this.section;
		if (h !== location.hash) history.replaceState(null, "", h || location.pathname + location.search);
	},
};
for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"])
	addEventListener(ev, () => (cancelAnimationFrame(glideRaf), (passing = false), (moved = true)), {
		capture: true,
		passive: true,
	});

const snd = (() => {
	const btn = $("#sound");
	const note = $(".note-snd");
	let ac, out, buf, eng;
	let on = store("riso-sound") === "1";
	const set = (v) => {
		on = v;
		btn.setAttribute("aria-pressed", String(v));
		root.classList.toggle("snd", v);
		store("riso-sound", v ? "1" : "0");
		if (!v) (engine(0), ac?.suspend().catch(() => {}));
	};
	const wakeAudio = () => (ac.state === "running" ? Promise.resolve() : ac.resume()).catch(() => {});
	const init = () => {
		if (!ac) {
			try {
				ac = new (window.AudioContext || window.webkitAudioContext)();
			} catch {
				set(false);
				return null;
			}
			const lim = ac.createWaveShaper();
			lim.curve = Float32Array.from({ length: 1025 }, (_, i) => {
				const x = i / 512 - 1;
				return (0.55 * Math.tanh(1.8 * x)) / Math.tanh(1.8);
			});
			out = ac.createGain();
			out.connect(lim).connect(ac.destination);
			buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
			const d = buf.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		}
		return wakeAudio();
	};
	const noise = (t, dur, type, f, vol, f2, q = 0.8) => {
		const s = ac.createBufferSource(),
			fl = ac.createBiquadFilter(),
			g = ac.createGain();
		s.buffer = buf;
		fl.type = type;
		fl.Q.value = q;
		fl.frequency.setValueAtTime(f, t);
		if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		s.connect(fl).connect(g).connect(out);
		s.start(t, Math.random() * 0.8, dur + 0.05);
	};
	const tone = (t, dur, f, f2, vol, type = "sine") => {
		const o = ac.createOscillator(),
			g = ac.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f, t);
		o.frequency.exponentialRampToValueAtTime(f2, t + dur);
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(g).connect(out);
		o.start(t);
		o.stop(t + dur + 0.02);
	};
	const S = {
		tick: (t) => (noise(t, 0.05, "bandpass", 2400, 0.4, 1500, 1.6), tone(t, 0.035, 1100, 600, 0.06, "triangle")),
		stamp: (t, v = 1) => (tone(t, 0.16, 150, 50, 0.38 * v), noise(t, 0.08, "lowpass", 1100, 0.62 * v)),
		peel: (t) => noise(t, 0.22, "bandpass", 700, 1.25, 5000, 1.2),
		slap: (t, v = 1) => (noise(t, 0.07, "lowpass", 1800, 1.1 * v), tone(t, 0.06, 240, 90, 0.26 * v)),
		paper: (t) => (noise(t, 0.36, "bandpass", 2200, 0.5, 800, 0.9), noise(t + 0.1, 0.24, "bandpass", 3200, 0.32, 1400)),
		drum: (t) => (
			noise(t, 0.12, "lowpass", 560, 0.75),
			tone(t, 0.14, 95, 42, 0.31),
			noise(t + 0.045, 0.05, "highpass", 3000, 0.2)
		),
	};
	const play = (name, v, delay = 0) => {
		if (!on || !ac) return;
		if (ac.state !== "running") return void wakeAudio();
		S[name](ac.currentTime + 0.005 + delay, v);
	};
	// the engine is torn down after ~1.5 s at zero
	let idle = 0;
	const drop = () => {
		eng?.forEach((n) => (n.stop?.(), n.disconnect()));
		eng = null;
		idle = 0;
	};
	function engine(v) {
		const want = on && v > 0.05;
		if (!want) {
			if (eng && !idle) idle = setTimeout(drop, 1500);
			if (!eng || !ac || ac.state !== "running") return;
		} else {
			clearTimeout(idle);
			idle = 0;
		}
		if (!ac || ac.state !== "running" || (!eng && !want)) return;
		if (!eng) {
			eng = [ac.createOscillator(), ac.createOscillator(), ac.createBiquadFilter(), ac.createGain()];
			const [o1, o2, f, g] = eng;
			o1.type = "sawtooth";
			o2.type = "triangle";
			f.type = "lowpass";
			f.Q.value = 1.2;
			g.gain.value = 0;
			o1.connect(f);
			o2.connect(f);
			f.connect(g).connect(out);
			o1.start();
			o2.start();
		}
		const [o1, o2, f, g] = eng;
		const k = clamp(v / 16, 0, 1);
		const t = ac.currentTime;
		o1.frequency.setTargetAtTime(44 + k * 70, t, 0.12);
		o2.frequency.setTargetAtTime(22 + k * 35, t, 0.12);
		f.frequency.setTargetAtTime(200 + k * 520, t, 0.12);
		g.gain.setTargetAtTime(want ? 0.03 + k * 0.035 : 0, t, want ? 0.1 : 0.25);
	}
	set(on);
	btn.addEventListener("click", () => {
		set(!on);
		btn.classList.remove("invite");
		note?.classList.remove("invite");
		if (on)
			init()?.then(() => {
				[0, 0.26, 0.56].forEach((d) => play("drum", 1, d));
				play("paper", 1, 0.66);
				dispatchEvent(new Event("riso:reprint"));
			});
	});
	const prime = () => on && init();
	addEventListener("click", prime, { once: true, capture: true });
	addEventListener("keydown", prime, { once: true, capture: true });
	if (FINE) {
		let last = 0;
		document.addEventListener("pointerover", (e) => {
			const el = e.target.closest("a, button");
			if (!el || el.contains(e.relatedTarget)) return;
			const n = performance.now();
			if (n - last > 70) play("tick");
			last = n;
		});
	}
	document.addEventListener("pointerdown", (e) => {
		if (e.target.closest("a, button:not(#sound)")) play("stamp");
	});
	let invited = false;
	const invite = () => {
		if (on || RM || invited) return;
		invited = true;
		for (const el of [btn, note]) {
			el?.classList.add("invite");
			el?.addEventListener("animationend", () => el.classList.remove("invite"), { once: true });
		}
	};
	document.addEventListener("visibilitychange", () => {
		if (!ac) return;
		if (document.hidden) (engine(0), ac.suspend().catch(() => {}));
		else if (on) wakeAudio();
	});
	const audio = () => (on ? init()?.then(() => ({ ac, out, buf })) : null);
	return { play, engine, invite, audio };
})();

{
	const copy = async (t) => {
		try {
			await navigator.clipboard.writeText(t);
			return true;
		} catch {}
		const ta = Object.assign(document.createElement("textarea"), { value: t });
		ta.setAttribute("readonly", "");
		ta.style.cssText = "position:fixed;top:0;opacity:0";
		document.body.append(ta);
		ta.select();
		let ok = false;
		try {
			ok = document.execCommand("copy");
		} catch {}
		ta.remove();
		return ok;
	};
	for (const a of $$("[data-copy]")) {
		const addr = a.dataset.copy;
		const b = document.createElement("button");
		b.type = "button";
		b.className = a.className;
		b.innerHTML = a.innerHTML;
		if (a.hasAttribute("data-mag")) b.setAttribute("data-mag", "");
		b.setAttribute("aria-label", `Copy ${addr}`);
		a.replaceWith(b);
		const st = $(".copied", b.parentElement);
		let t, t2;
		b.addEventListener("click", async (e) => {
			const ok = await copy(addr);
			if (!ok) getSelection().selectAllChildren(b);
			st.innerHTML = ok
				? 'copied <svg class="ic" aria-hidden="true"><use href="#i-ok" /></svg><span class="sr"> — the address is on your clipboard</span>'
				: `press ${/Mac|iP/.test(navigator.userAgent) ? "⌘" : "Ctrl+"}C`;
			// the stamp stays on screen, even when the address fills a phone's width
			st.style.left = `${Math.min(b.offsetLeft + b.offsetWidth - 34, st.offsetParent.clientWidth - st.offsetWidth - 6)}px`;
			st.style.top = `${b.offsetTop - 22}px`;
			st.classList.remove("on");
			void st.offsetWidth;
			st.classList.add("on");
			if (!e.detail) snd.play("stamp");
			snd.play("paper", 1, 0.14);
			clearTimeout(t);
			clearTimeout(t2);
			t = setTimeout(() => {
				st.classList.remove("on");
				t2 = setTimeout(() => (st.textContent = ""), 400);
			}, 2600);
		});
	}
}

{
	// once the header scrolls away it becomes a printed tab (a mini bar on phones)
	const top = $(".top");
	const here = $(".here", top);
	const pin = Object.assign(document.createElement("i"), { ariaHidden: "true" });
	pin.style.cssText = "position:absolute;top:0;height:130px;width:1px;pointer-events:none";
	document.body.append(pin);
	new IntersectionObserver((es) => top.classList.toggle("stuck", !es.at(-1).isIntersecting)).observe(pin);
	const links = $$(".nav > a");
	const spy = new IntersectionObserver(
		(es) => {
			const e = es.filter((x) => x.isIntersecting).at(-1);
			if (!e) return;
			const a = links.find((l) => l.hash === "#" + e.target.id);
			links.forEach((l) => (l === a ? l.setAttribute("aria-current", "location") : l.removeAttribute("aria-current")));
			here.textContent = a ? a.getAttribute("aria-label") : "";
			hashes.section = a ? a.hash : "";
			hashes.sync();
		},
		{ rootMargin: "-45% 0px -54% 0px" },
	);
	[$(".hero"), ...links.map((a) => $(a.hash))].forEach((el) => spy.observe(el));
	addEventListener("load", () => document.fonts.ready.then(() => ((hashes.ready = true), hashes.sync())), {
		once: true,
	});
	document.addEventListener("click", (e) => {
		const a = e.target.closest('a[href^="#"]');
		const el = a && !a.closest(".stops") && (a.hash === "#main" ? $("#main") : $(a.hash + ".sheet"));
		if (!el || e.metaKey || e.ctrlKey || e.shiftKey) return;
		e.preventDefault();
		const top = el === $("#main");
		const h = top ? el : $("h2", el);
		const y = top
			? 0
			: el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
		glide(
			y,
			clamp(500 + Math.abs(y - scrollY) * 0.1, 700, 1600),
			() => {
				h.tabIndex = -1;
				h.focus({ preventScroll: true });
				if (!top) {
					h.classList.remove("arrive");
					void h.offsetWidth;
					h.classList.add("arrive");
				}
				snd.play("stamp");
			},
			true,
		);
	});
}

const hero = $(".hero");
const art = $("#art");
const cv = $(".print-live", art);
const h1 = $(".h1");
const fallback = () => {
	root.classList.remove("gl");
	setTimeout(snd.invite, 1200);
};
if (root.classList.contains("gl")) {
	const guard = setTimeout(fallback, 6000);
	import("./print.js")
		.then((m) =>
			m.mountPrint(cv, {
				src: "images/unai-900.webp",
				// depth: "images/unai-depth.webp" — off until it is rebuilt from a real depth map
				fig: $("#p-fig").getAttribute("d"),
				skin: $("#p-skin").getAttribute("d"),
				dpr: Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.5),
				onLost: fallback,
			}),
		)
		.then((P) => {
			clearTimeout(guard);
			if (root.classList.contains("gl")) portrait(P);
		})
		.catch(fallback);
}

function portrait(P) {
	let heroH = hero.offsetHeight;
	addEventListener("resize", () => (heroH = hero.offsetHeight), { passive: true });
	const look = P.state.look;
	const tgt = [0, 0];
	const lit = () => root.classList.contains("gl");
	let inView = true,
		active = true,
		raf = 0,
		last = performance.now(),
		input = -1e9,
		intro = RM ? null : { t: performance.now(), first: true },
		kick = null;
	const face = () => {
		const r = art.getBoundingClientRect();
		return [r.left + r.width * 0.72, r.top + r.height * 0.52];
	};
	const aim = (x, y) => {
		const [fx, fy] = face();
		tgt[0] = clamp((x - fx) / (innerWidth * 0.42), -1, 1);
		tgt[1] = clamp((y - fy) / (innerHeight * 0.42), -1, 1);
		input = performance.now();
		wake();
	};
	const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
	const settle = (t) => {
		t = clamp(t, 0, 1);
		return 1 - Math.exp(-6 * t) * Math.cos(9 * t);
	};
	const frame = (now) => {
		raf = 0;
		if (!lit()) return;
		const dt = Math.min(64, now - last);
		last = now;
		let busy = false;
		if (intro) {
			const t = now - intro.t;
			P.state.print = [ease(t / 520), ease((t - 260) / 560), ease((t - 560) / 620), settle((t - 120) / 1500)];
			if (t > 1700) {
				if (intro.first) snd.invite();
				intro = null;
			}
			busy = true;
		}
		if (kick) {
			const t = (now - kick) / 900;
			P.state.print[3] = t >= 1 ? 1 : 1 - Math.exp(-4.5 * t) * Math.cos(11 * t);
			if (t >= 1) kick = null;
			busy = true;
		}
		const idle = now - input > (FINE ? 5000 : 2600);
		const sy = clamp(scrollY / (heroH * 0.8), 0, 1);
		const gx = idle ? Math.sin(now * 0.00042) * 0.55 : tgt[0];
		const gy = (idle ? Math.sin(now * 0.00029 + 1) * 0.3 : tgt[1]) * (1 - sy) + sy * 0.75;
		const k = 1 - Math.exp(-dt / (idle ? 420 : 140));
		const dx = gx - look[0],
			dy = gy - look[1];
		look[0] += dx * k;
		look[1] += dy * k;
		if (Math.abs(dx) + Math.abs(dy) > 0.002 || idle) busy = true;
		P.draw();
		h1.style.setProperty("--rx", (look[0] * 4).toFixed(2) + "px");
		h1.style.setProperty("--ry", (look[1] * 3).toFixed(2) + "px");
		if (busy && active) raf = requestAnimationFrame(frame);
	};
	const wake = () => {
		if (!raf && active && !RM && lit()) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	};
	if (RM) P.state.print = [1, 1, 1, 1];
	P.draw();
	requestAnimationFrame(() => art.classList.add("printed"));
	wake();
	if (RM) {
		addEventListener("resize", () => P.draw());
		return;
	}
	addEventListener("pointermove", (e) => aim(e.clientX, e.clientY), {
		passive: true,
	});
	addEventListener("pointerdown", (e) => e.pointerType !== "mouse" && aim(e.clientX, e.clientY), { passive: true });
	addEventListener("scroll", wake, { passive: true });
	addEventListener("resize", () => (P.draw(), wake()));
	cv.addEventListener("click", () => {
		kick = performance.now();
		snd.play("drum");
		wake();
	});
	addEventListener("riso:reprint", () => {
		intro = { t: performance.now() };
		wake();
	});
	new IntersectionObserver((es) => {
		inView = es.at(-1).isIntersecting;
		active = inView && !document.hidden;
		wake();
	}).observe(art);
	document.addEventListener("visibilitychange", () => {
		active = inView && !document.hidden;
		wake();
	});
}

if (FINE && !RM) {
	for (const el of $$("[data-mag]")) {
		let r;
		const k = el.classList.contains("say-mail") ? 0.16 : 0.34;
		el.addEventListener("pointerenter", () => {
			r = el.getBoundingClientRect();
			el.classList.add("mag-on");
		});
		el.addEventListener("pointermove", (e) => {
			if (!r) r = el.getBoundingClientRect();
			el.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * k).toFixed(1) + "px");
			el.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * k).toFixed(1) + "px");
		});
		el.addEventListener("pointerleave", () => {
			r = null;
			el.classList.remove("mag-on");
			el.style.setProperty("--mx", "0px");
			el.style.setProperty("--my", "0px");
		});
	}
}

for (const a of $$("[data-roll]")) {
	const t = a.textContent.trim();
	a.setAttribute("aria-label", t);
	const ch = [...t].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`);
	a.innerHTML = `<span class="rl" aria-hidden="true">${ch.join("")}</span>`;
}

{
	const mb = $("#menu-btn"),
		nav = $("#nav"),
		lab = $(".mb-l", mb);
	const isOpen = () => mb.getAttribute("aria-expanded") === "true";
	const setMenu = (open, focus = true) => {
		mb.setAttribute("aria-expanded", String(open));
		nav.classList.toggle("open", open);
		root.classList.toggle("menu-open", open);
		lab.textContent = open ? "Close" : "Menu";
		if (open) {
			snd.play("paper");
			setTimeout(() => $("a", nav).focus(), 60);
		} else if (focus) mb.focus();
	};
	mb.addEventListener("click", () => setMenu(!isOpen()));
	nav.addEventListener("click", (e) => e.target.closest("a") && isOpen() && setMenu(false, false));
	addEventListener("keydown", (e) => {
		if (!isOpen()) return;
		if (e.key === "Escape") setMenu(false);
		if (e.key === "Tab") {
			const f = [...$$("a, button", nav), $("#sound"), mb];
			const i = f.indexOf(document.activeElement);
			const j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 || i < 0 ? 0 : i + 1;
			e.preventDefault();
			f[j].focus();
		}
	});
	matchMedia("(min-width: 901px)").addEventListener("change", (m) => m.matches && isOpen() && setMenu(false, false));
}

{
	const els = RM ? [] : $$("[data-lines]");
	const words = (n) => {
		for (const c of [...n.childNodes]) {
			if (c.nodeType === 1) words(c);
			else if (c.nodeType === 3 && c.textContent.trim()) {
				const f = document.createDocumentFragment();
				for (const p of c.textContent.split(/(\s+)/)) {
					if (!p) continue;
					if (/^\s+$/.test(p)) f.append(p);
					else {
						const w = document.createElement("span"),
							i = document.createElement("span");
						w.className = "w";
						i.textContent = p;
						w.append(i);
						f.append(w);
					}
				}
				c.replaceWith(f);
			}
		}
	};
	const lines = (el) => {
		let top = null,
			l = -1;
		for (const w of $$(".w", el)) {
			const t = w.offsetTop;
			if (top === null || t > top + 6) {
				l++;
				top = t;
			}
			w.style.setProperty("--l", l);
		}
	};
	els.forEach((el) => {
		words(el);
		el.classList.add("split");
	});
	document.fonts.ready.then(() => els.forEach(lines));
	let rt;
	addEventListener("resize", () => {
		clearTimeout(rt);
		rt = setTimeout(() => els.forEach(lines), 200);
	});
	seen(els, (el) => el.classList.add("in"), { threshold: 0.25 });
	seen($$(".note"), (el) => el.classList.add("in"), { threshold: 0.6 });
}

{
	const bands = $$("[data-band]").map((b) => ({
		el: b,
		t: $(".band-t", b),
		dir: +b.dataset.band,
		x: 0,
		w: 0,
	}));
	const fill = () =>
		bands.forEach((b) => {
			const one = b.t.firstElementChild;
			const w = one.offsetWidth;
			if (b.w) b.x *= w / b.w;
			b.w = w;
			const need = Math.ceil((b.el.offsetWidth * 2) / b.w) + 1;
			while (b.t.children.length < need) b.t.append(one.cloneNode(true));
		});
	fill();
	Promise.race([document.fonts.load("italic 600 1em Fraunces"), new Promise((r) => setTimeout(r, 3000))])
		.catch(() => {})
		.then(() => {
			fill();
			$(".bands").classList.add("inked");
		});
	if (!RM) {
		let vis = false,
			raf = 0,
			lastY = scrollY,
			vel = 0,
			sign = 1,
			lastT = performance.now();
		const step = (now) => {
			raf = 0;
			const dt = Math.min(50, now - lastT);
			lastT = now;
			const dy = scrollY - lastY;
			lastY = scrollY;
			if (dy) sign = Math.sign(dy);
			vel += (Math.abs(dy) - vel) * 0.12;
			const speed = (0.075 + Math.min(vel, 90) * 0.014) * dt * sign;
			for (const b of bands) {
				b.x = (((b.x + speed * b.dir) % b.w) + b.w) % b.w;
				b.t.style.transform = `translate3d(${-b.x}px,0,0)`;
			}
			if (vis) raf = requestAnimationFrame(step);
		};
		new IntersectionObserver((es) => {
			vis = es.at(-1).isIntersecting;
			if (vis && !raf) {
				lastT = performance.now();
				raf = requestAnimationFrame(step);
			}
		}).observe($(".bands"));
		addEventListener("resize", fill);
	}
}

{
	const box = $("#stickers");
	const items = $$(".stk", box);
	box.classList.add("phys");
	let W = 0,
		H = 0,
		z = 1,
		raf = 0,
		last = 0;
	let touched = false;
	const S = items.map((el) => ({
		el,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		a: 0,
		va: 0,
		w: 0,
		h: 0,
		drag: null,
	}));
	const rnd = (
		(s) => () =>
			((s = (s * 16807) % 2147483647) - 1) / 2147483646
	)(11);
	const put = (s) =>
		(s.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) rotate(${s.a.toFixed(1)}deg)`);
	const measure = () => {
		W = box.clientWidth;
		H = box.clientHeight;
		for (const s of S) {
			s.w = s.el.offsetWidth;
			s.h = s.el.offsetHeight;
			s.x = clamp(s.x, 0, W - s.w);
			s.y = clamp(s.y, 0, H - s.h);
			put(s);
		}
	};
	const layout = () => {
		const pad = 14,
			placed = [];
		for (const s of [...S].sort((a, b) => b.w * b.h - a.w * a.h)) {
			let best,
				bestScore = Infinity;
			for (let i = 0; i < 160; i++) {
				const x = pad + rnd() * (W - s.w - 2 * pad),
					y = pad + rnd() * (H - s.h - 2 * pad);
				let sc = 0;
				for (const p of placed) {
					const ox = Math.max(0, Math.min(x + s.w, p.x + p.w) - Math.max(x, p.x) + 10),
						oy = Math.max(0, Math.min(y + s.h, p.y + p.h) - Math.max(y, p.y) + 10);
					sc += ox * oy;
				}
				if (sc < bestScore) {
					bestScore = sc;
					best = [x, y];
				}
				if (!sc) break;
			}
			[s.x, s.y] = best;
			s.a = (rnd() - 0.5) * 24;
			placed.push(s);
			put(s);
		}
	};
	const collide = () => {
		let bump = 0;
		for (let i = 0; i < S.length; i++)
			for (let j = i + 1; j < S.length; j++) {
				const a = S[i],
					b = S[j];
				const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - 6,
					oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - 6;
				if (ox <= 0 || oy <= 0) continue;
				const ax = ox < oy ? "x" : "y",
					vk = "v" + ax,
					sz = ax === "x" ? "w" : "h";
				const d = Math.sign(a[ax] + a[sz] / 2 - (b[ax] + b[sz] / 2)) || 1;
				const o = Math.min(ox, oy) * (a.drag || b.drag ? 1 : 0.5);
				if (!a.drag) a[ax] += d * o;
				if (!b.drag) b[ax] -= d * o;
				const rel = (a[vk] - b[vk]) * d;
				if (rel < 0) {
					bump = Math.max(bump, -rel);
					const e = 0.45;
					if (a.drag) b[vk] = a[vk] * (1 + e);
					else if (b.drag) a[vk] = b[vk] * (1 + e);
					else {
						const t = a[vk];
						a[vk] = b[vk] * e;
						b[vk] = t * e;
					}
					a.va += rel * 0.04 * d;
					b.va -= rel * 0.04 * d;
				}
			}
		return bump;
	};
	const loop = (now) => {
		raf = 0;
		const dt = Math.min(0.033, (now - last) / 1000);
		last = now;
		let moving = false;
		const f = Math.pow(0.06, dt),
			fa = Math.pow(0.08, dt);
		for (const s of S) {
			if (s.drag) {
				moving = true;
				continue;
			}
			s.vx *= f;
			s.vy *= f;
			s.va = clamp(s.va * fa, -420, 420);
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.a = clamp(s.a + s.va * dt, -38, 38);
			let hit = 0;
			if (s.x < 0 || s.x > W - s.w) {
				s.x = clamp(s.x, 0, W - s.w);
				hit = Math.abs(s.vx);
				s.vx *= -0.55;
				s.va *= -0.6;
			}
			if (s.y < 0 || s.y > H - s.h) {
				s.y = clamp(s.y, 0, H - s.h);
				hit = Math.max(hit, Math.abs(s.vy));
				s.vy *= -0.55;
			}
			if (hit > 220) snd.play("slap", Math.min(1, hit / 1600));
			if (Math.abs(s.vx) + Math.abs(s.vy) > 6 || Math.abs(s.va) > 4) moving = true;
		}
		const bump = collide();
		if (bump > 260) snd.play("slap", Math.min(0.6, bump / 2400));
		for (const s of S) {
			s.x = clamp(s.x, 0, W - s.w);
			s.y = clamp(s.y, 0, H - s.h);
			if (!s.drag) put(s);
		}
		if (moving) raf = requestAnimationFrame(loop);
	};
	const run = () => {
		if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(loop);
		}
	};
	const local = (e) => {
		const r = box.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	};
	for (const s of S) {
		const el = s.el;
		// a finger must press and hold, so swipes still scroll
		let hold = 0,
			at = null;
		const pick = (e) => {
			touched = true;
			try {
				el.setPointerCapture(e.pointerId);
			} catch {}
			const [px, py] = local(e);
			s.drag = {
				ox: px - s.x,
				oy: py - s.y,
				a0: s.a,
				hist: [[performance.now(), s.x, s.y]],
			};
			s.vx = s.vy = s.va = 0;
			el.style.zIndex = ++z;
			el.classList.add("drag");
			snd.play("peel");
			run();
		};
		el.addEventListener("pointerdown", (e) => {
			if (e.button) return;
			if (e.pointerType !== "touch") return void (e.preventDefault(), pick(e));
			at = e;
			clearTimeout(hold);
			hold = setTimeout(() => ((hold = 0), pick(at)), 200);
		});
		el.addEventListener("touchmove", (e) => s.drag && e.preventDefault(), { passive: false });
		el.addEventListener("pointermove", (e) => {
			if (hold) {
				if (Math.hypot(e.clientX - at.clientX, e.clientY - at.clientY) > 8) (clearTimeout(hold), (hold = 0));
				else at = e;
			}
			if (!s.drag) return;
			const [px, py] = local(e);
			const d = s.drag,
				t = performance.now();
			s.x = clamp(px - d.ox, 0, W - s.w);
			s.y = clamp(py - d.oy, 0, H - s.h);
			d.hist.push([t, s.x, s.y]);
			while (d.hist.length > 2 && t - d.hist[0][0] > 90) d.hist.shift();
			const [t0, x0, y0] = d.hist[0];
			s.vx = t > t0 ? ((s.x - x0) / (t - t0)) * 1000 : 0;
			s.vy = t > t0 ? ((s.y - y0) / (t - t0)) * 1000 : 0;
			s.a = d.a0 + clamp(s.vx * 0.012, -16, 16);
			put(s);
		});
		const drop = () => {
			clearTimeout(hold);
			hold = 0;
			const d = s.drag;
			if (!d) return;
			s.drag = null;
			el.classList.remove("drag");
			const t = performance.now(),
				[t0, x0, y0] = d.hist[0];
			if (!RM && t - t0 > 8 && t - t0 < 200) {
				s.vx = clamp(((s.x - x0) / (t - t0)) * 1000, -2600, 2600);
				s.vy = clamp(((s.y - y0) / (t - t0)) * 1000, -2600, 2600);
				s.va = s.vx * 0.09;
			}
			snd.play("slap", 0.55);
			run();
		};
		el.addEventListener("pointerup", drop);
		el.addEventListener("pointercancel", drop);
	}
	measure();
	layout();
	document.fonts.ready.then(() => {
		measure();
		if (!touched) layout();
	});
	addEventListener("resize", measure);
	$("#scatter").addEventListener("click", () => {
		touched = true;
		if (RM) {
			layout();
			return;
		}
		for (const s of S) {
			s.vx = (rnd() - 0.5) * 2600;
			s.vy = (rnd() - 0.5) * 2000;
			s.va = (rnd() - 0.5) * 300;
		}
		snd.play("paper");
		run();
	});
	if (!RM)
		seen([box], () =>
			S.forEach((s, i) => {
				s.el.animate(
					{ scale: [0.3, 1], opacity: [0, 1] },
					{
						duration: 520,
						delay: 80 + i * 55,
						easing: "cubic-bezier(.34,1.56,.64,1)",
						fill: "backwards",
					},
				);
				snd.play("slap", 0.25, 0.08 + i * 0.055);
			}),
		);
}

if (root.classList.contains("tour")) {
	const track = $("#road");
	const pin = $(".road-pin", track);
	const view = $(".road-view", track);
	const rcv = $(".road-gl", view);
	const deck = $(".deck", track);
	const bar = $(".stops", track);
	const links = $$("a", bar);
	const cards = [$(".road-start", track), ...$$(".job", track).reverse()];
	const N = cards.length - 1;
	const DWELL = 0.1;
	const VMAX = 2.2;
	const narrow = matchMedia("(max-width: 900px) and (min-height: 501px), (max-width: 600px)");
	const tag = $(".road-tag", view);
	const ptr = [0, 0];
	const want = links.findIndex((a) => a.hash === location.hash);
	let landed = want <= 0;
	let top = 0,
		span = 1,
		prog = 0,
		vw = 0,
		sT = 0,
		sD = 0,
		cur = -1,
		shown = -1,
		vD = 0,
		drawAt = 0,
		arrived = -2,
		raf = 0,
		last = 0,
		seen = false,
		dirty = true,
		again = false,
		hot = -1,
		trip = null,
		R = null;
	const live = () => root.classList.contains("tour");
	const measure = () => {
		top = track.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(pin).top) || 0);
		span = Math.max(1, track.offsetHeight - pin.offsetHeight);
		vw = innerWidth;
	};
	const at = (k) => Math.round(top + (k / N) * span);
	const inside = () => scrollY >= top - 1 && scrollY <= top + span + 1;
	// until a #stop-… deep link has landed, leave the URL alone
	const roadHash = () => {
		if (!landed) return;
		hashes.road = inside() && cur >= 0 ? links[cur].hash : "";
		hashes.sync();
	};
	const ease = (e) => e * 0.5 + (0.5 - 0.5 * Math.cos(Math.PI * e)) * 0.5;
	const yOf = (x) => {
		const i = Math.min(N - 1, Math.floor(x));
		const q = x - i;
		if (q <= 0) return at(i);
		let lo = 0,
			hi = 1;
		for (let n = 0; n < 18; n++) ease((lo + hi) / 2) < q ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2);
		return top + ((i + DWELL + lo * (1 - 2 * DWELL)) / N) * span;
	};
	const read = () => {
		prog = clamp((scrollY - top) / span, 0, 1);
		const u = prog * N;
		const i = Math.min(N - 1, Math.floor(u));
		const e = clamp((u - i - DWELL) / (1 - 2 * DWELL), 0, 1);
		sT = i + ease(e);
	};
	const framing = () => {
		const v = view.getBoundingClientRect();
		if (narrow.matches) return { w: v.width, h: v.height };
		const d = deck.getBoundingClientRect();
		const b = bar.getBoundingClientRect();
		const nh = parseFloat(getComputedStyle(root).getPropertyValue("--navh")) || 0;
		return {
			w: v.width,
			h: v.height,
			x: ((d.right + v.right) / 2 - (v.left + v.right) / 2) / v.width,
			// centre between nav and stop bar; fy = share of height left free
			y: (nh + b.top - v.bottom) / 2 / v.height,
			fy: (b.top - v.top - nh) / v.height,
			veil: (d.right - v.left) / v.width,
		};
	};
	const edges = () => {
		const more = bar.scrollWidth - bar.clientWidth - bar.scrollLeft;
		bar.style.setProperty("--fl", bar.scrollLeft > 2 ? "36px" : "0px");
		bar.style.setProperty("--fr", more > 2 ? "36px" : "0px");
	};
	bar.addEventListener("scroll", edges, { passive: true });
	const centre = (k, how = "smooth") => {
		if (!narrow.matches || bar.scrollWidth <= bar.clientWidth + 2) return;
		const a = links[k].getBoundingClientRect();
		const b = bar.getBoundingClientRect();
		bar.scrollTo({
			left: bar.scrollLeft + a.left - b.left - (b.width - a.width) / 2,
			behavior: how,
		});
	};
	const ui = () => {
		const k = Math.round(sD);
		if (k !== cur) {
			links.forEach((a, i) => {
				a.tabIndex = i === k ? 0 : -1;
				if (i === k) a.setAttribute("aria-current", "step");
				else a.removeAttribute("aria-current");
			});
			cur = k;
			centre(k);
			roadHash();
		}
		const c = Math.abs(sD - k) < 0.4 ? k : -1;
		if (c !== shown) {
			cards.forEach((el, i) => el.classList.toggle("on", i === c));
			shown = c;
		}
		bar.style.setProperty("--p", (sD / N).toFixed(4));
	};
	const tick = (now) => {
		raf = 0;
		if (!live()) return;
		const dt = clamp((now - last) / 1000, 0, 0.05);
		last = now;
		if (trip) {
			const p = clamp((now - trip.t0) / trip.ms, 0, 1);
			sD = sT = trip.a + (trip.b - trip.a) * (0.5 - 0.5 * Math.cos(Math.PI * p));
			vD = (((trip.b - trip.a) * Math.PI) / 2) * Math.sin(Math.PI * p) * (1000 / trip.ms);
			scrollTo({ top: p < 1 ? yOf(sD) : at(trip.b), behavior: "instant" });
			if (p >= 1) ((trip = null), (vD = 0));
		} else {
			vD = clamp(vD + (49 * (sT - sD) - 14 * vD) * dt, -VMAX, VMAX);
			sD += vD * dt;
		}
		if (passing || !seen) ((sD = sT), (vD = 0), (arrived = Math.round(sT)));
		if (Math.abs(sT - sD) < 5e-4 && Math.abs(vD) < 2e-3) ((sD = sT), (vD = 0));
		ui();
		const k = Math.round(sD);
		if (Math.abs(sD - k) < 0.012 && Math.abs(vD) < 0.15 && k !== arrived) {
			if (arrived !== -2) snd.play("stamp", 0.85);
			arrived = k;
		} else if (Math.abs(sD - k) > 0.3) arrived = -1;
		const moving = sD !== sT;
		const drawn = R && seen && !document.hidden && !passing;
		if (passing) dirty = true;
		const idle = !moving && !dirty && again;
		if (drawn && (moving || dirty || (again && (!idle || now - drawAt > 31)))) {
			again = R.draw(sD, vD, ptr, clamp((now - drawAt) / 1000, 0, 0.05), now, shown >= 0, dt, trip);
			drawAt = now;
			dirty = false;
		} else if (!drawn) again = false;
		snd.engine(drawn && !passing ? R.speed : 0);
		if (moving || again || trip) raf = requestAnimationFrame(tick);
		else snd.engine(0);
	};
	const wake = () => {
		if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}
	};
	const relayout = () => {
		if (!live()) return;
		const was = top + "," + span;
		measure();
		if (was !== top + "," + span && prog > 0 && prog < 1) scrollTo({ top: top + prog * span, behavior: "instant" });
		read();
		R?.layout(framing());
		edges();
		dirty = true;
		wake();
	};
	// stop-bar trips: one ease, ~1.3 s for one stop to ~2.8 s for four; any input cancels
	const go = (k, focus) => {
		k = clamp(k, 0, N);
		const n = Math.abs(k - sD);
		trip =
			RM || n < 0.01
				? null
				: { a: sD, b: k, t0: performance.now(), ms: n < 1 ? 500 + 800 * n : Math.min(3000, 1300 + (n - 1) * 500) };
		if (!trip) scrollTo({ top: at(k), behavior: "instant" });
		if (focus) links[k].focus({ preventScroll: true });
		wake();
	};
	for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"])
		addEventListener(
			ev,
			() => {
				if (!trip) return;
				trip = null;
				read();
			},
			{ capture: true, passive: true },
		);
	bar.addEventListener("click", (e) => {
		const a = e.target.closest("a");
		if (!a) return;
		e.preventDefault();
		go(links.indexOf(a));
	});
	bar.addEventListener("keydown", (e) => {
		const i = links.indexOf(document.activeElement);
		const j = {
			ArrowRight: i + 1,
			ArrowDown: i + 1,
			ArrowLeft: i - 1,
			ArrowUp: i - 1,
			Home: 0,
			End: N,
		}[e.key];
		if (i < 0 || j === undefined) return;
		e.preventDefault();
		go(j, true);
	});
	const cool = () => {
		hot = -1;
		rcv.classList.remove("hot");
		tag.classList.remove("on");
	};
	if (FINE)
		pin.addEventListener("pointermove", (e) => {
			const v = view.getBoundingClientRect();
			ptr[0] = clamp(((e.clientX - v.left) / v.width) * 2 - 1, -1, 1);
			ptr[1] = clamp(1 - ((e.clientY - v.top) / v.height) * 2, -1, 1);
			const k = R && e.target === rcv ? R.hover(e.clientX, e.clientY) : -1;
			if (k !== hot) {
				hot = k;
				rcv.classList.toggle("hot", k !== -1);
				tag.classList.toggle("on", k !== -1);
				if (k !== -1) {
					R.poke(k, 0.6);
					snd.play("paper");
					tag.textContent =
						k < 0
							? "vroom vroom"
							: k === cur
								? "you’re here"
								: k
									? `drive to ${$("b", links[k]).textContent} `
									: "back to the start";
					if (k > 0 && k !== cur)
						tag.insertAdjacentHTML("beforeend", '<svg class="ic" aria-hidden="true"><use href="#i-r" /></svg>');
				}
			}
			tag.style.translate = `${(e.clientX - v.left).toFixed(0)}px ${(e.clientY - v.top).toFixed(0)}px`;
			wake();
		});
	pin.addEventListener("pointerleave", () => {
		ptr[0] = ptr[1] = 0;
		cool();
		wake();
	});
	rcv.addEventListener("click", (e) => {
		const k = R ? R.hover(e.clientX, e.clientY) : -1;
		if (k === -1) return;
		R.poke(k);
		snd.play(k < 0 ? "slap" : "stamp");
		if (k >= 0 && k !== cur) go(k);
		wake();
	});
	const onScroll = () => {
		if (innerWidth !== vw) return relayout();
		if (trip) return roadHash();
		read();
		roadHash();
		wake();
	};
	addEventListener("scroll", onScroll, { passive: true });
	const ro = new ResizeObserver(relayout);
	ro.observe(track);
	ro.observe(view);
	const vis = new IntersectionObserver((es) => {
		seen = es.at(-1).isIntersecting;
		dirty = true;
		wake();
	});
	vis.observe(track);
	document.addEventListener("visibilitychange", () => {
		dirty = true;
		wake();
	});
	measure();
	read();
	sD = sT;
	ui();
	arrived = Math.round(sD);
	edges();
	document.fonts.ready.then(() => {
		relayout();
		if (want > 0 && !landed && live() && !moved) {
			scrollTo({ top: at(want), behavior: "instant" });
			read();
			sD = sT;
			arrived = Math.round(sD);
			centre(want, "instant");
		}
		landed = true;
		roadHash();
	});
	const flat = () => {
		R = null;
		cool();
		view.classList.remove("ready");
		view.classList.add("flat");
	};
	const fail = () => {
		if (!live()) return;
		const h = landed ? -1 : want;
		const k = h > 0 ? h : cur;
		const was = inside() || h > 0;
		landed = true;
		const after = track.nextElementSibling;
		const y0 = after.getBoundingClientRect().top;
		const gone = y0 < innerHeight && !was;
		ro.disconnect();
		vis.disconnect();
		removeEventListener("scroll", onScroll);
		cards.forEach((el) => {
			el.style.transition = "none";
			el.classList.remove("on");
		});
		root.classList.remove("tour");
		links.forEach((a) => a.removeAttribute("tabindex"));
		requestAnimationFrame(() => cards.forEach((el) => (el.style.transition = "")));
		if (gone)
			scrollBy({
				top: after.getBoundingClientRect().top - y0,
				behavior: "instant",
			});
		else if (was) {
			const el = k > 0 ? cards[k] : $("#work");
			const put = () => el.scrollIntoView({ block: "start", behavior: "instant" });
			put();
			const y = scrollY;
			document.fonts.ready.then(() => scrollY === y && put());
		}
	};
	const load = new IntersectionObserver(
		(es) => {
			if (!es.at(-1).isIntersecting) return;
			load.disconnect();
			const light = !FINE || innerWidth < 760;
			// never start the (long) world build mid-glide
			const idle = () => new Promise((r) => (passing ? setTimeout(() => idle().then(r), 150) : r()));
			import("./road.js")
				.then((m) => idle().then(() => m))
				.then((m) =>
					m.mountRoad(rcv, {
						light,
						dpr: Math.min(devicePixelRatio || 1, light ? 1.25 : 1.5),
						onLost: flat,
					}),
				)
				.then((api) => {
					if (!live() || view.classList.contains("flat")) return;
					R = api;
					relayout();
					view.classList.add("ready");
				})
				.catch(fail);
		},
		{ rootMargin: "100% 0px" },
	);
	load.observe(track);
}

{
	const list = $(".projs");
	const rows = $$(".proj", list);
	if (FINE && !RM) {
		const pv = $(".pv");
		const trk = $(".pv-track", pv);
		for (const r of rows) {
			const t = $(".tile", r).cloneNode(true);
			$$("img", t).forEach((i) => ((i.alt = ""), (i.loading = "eager")));
			trk.append(t);
		}
		root.classList.add("pv-on");
		let x = 0,
			y = 0,
			tx = 0,
			ty = 0,
			rot = 0,
			sc = 0,
			sv = 0,
			raf = 0,
			last = 0,
			idx = -1,
			on = false,
			pinned = null,
			held = 0,
			px = 0,
			ph = 0,
			side = 1;
		const edge = () => $(".p-links", rows[0]).getBoundingClientRect().left;
		const aim = (cx = px) => {
			px = cx;
			const r = rows[idx];
			if (!r) return;
			const w = pv.offsetWidth,
				h = pv.offsetHeight,
				b = r.getBoundingClientRect(),
				gap = 34;
			const up = b.top - gap - h / 2,
				dn = b.bottom + gap + h / 2;
			tx = clamp(cx, w / 2 + 16, edge() - w / 2 - 28);
			ty = up - h / 2 >= 16 ? up : dn + h / 2 <= innerHeight - 16 || b.top < innerHeight - b.bottom ? dn : up;
			side = ty === up ? 1 : -1;
			ph = h;
		};
		const loop = (now) => {
			raf = 0;
			const dt = clamp((now - last) / 1000, 0, 0.05);
			last = now;
			const k = 1 - Math.exp(-dt * 8.5);
			const vx = ((tx - x) * k) / Math.max(dt, 1e-3);
			x += (tx - x) * k;
			y = ty;
			rot += (clamp(vx * 0.008, -5, 5) - rot) * (1 - Math.exp(-dt * 7));
			sv += ((+on - sc) * 320 - sv * 21) * dt;
			sc = Math.max(0, sc + sv * dt);
			const yo = ((1 - sc) * ph * side) / 2;
			pv.style.transform = `translate3d(${x.toFixed(1)}px,${(y + yo).toFixed(1)}px,0) translate(-50%,-50%) rotate(${(rot - 2).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
			if (Math.abs(tx - x) > 0.4 || Math.abs(rot) > 0.05 || Math.abs(sc - on) + Math.abs(sv) > 0.003)
				raf = requestAnimationFrame(loop);
		};
		const run = () => {
			if (!raf) {
				last = performance.now();
				raf = requestAnimationFrame(loop);
			}
		};
		const light = (i) => {
			list.classList.toggle("hov", i >= 0);
			rows.forEach((r, j) => r.classList.toggle("on", j === i));
		};
		const show = (i, cx) => {
			const fresh = !on || i !== idx;
			idx = i;
			aim(cx);
			if (!on) {
				x = tx;
				y = ty;
			}
			if (fresh) {
				if (on) sc = Math.min(sc, 0.8);
				trk.classList.toggle("jump", !on);
				trk.style.transform = `translateY(${-i * 25}%)`;
				pv.classList.remove("held");
				clearTimeout(held);
				held = setTimeout(() => pv.classList.add("held"), 420);
				snd.play("tick");
			}
			on = true;
			light(i);
			run();
		};
		const hide = (keep) => {
			on = false;
			pinned = null;
			clearTimeout(held);
			pv.classList.remove("held");
			if (!keep) light(-1);
			run();
		};
		const anchor = (r) => show(rows.indexOf(r), $(".p-d", r).getBoundingClientRect().left + 40);
		rows.forEach((r, i) => {
			const lk = $(".p-links", r);
			r.addEventListener("pointerenter", (e) => {
				if (e.pointerType !== "mouse" || lk.contains(e.target)) return;
				pinned = null;
				show(i, e.clientX);
			});
			lk.addEventListener("pointerenter", () => on && !pinned && hide(true));
			lk.addEventListener("pointerleave", (e) => r.matches(":hover") && show(i, e.clientX));
			r.addEventListener("focusin", (e) => {
				if (!e.target.matches(":focus-visible")) return;
				pinned = r;
				anchor(r);
			});
		});
		list.addEventListener("pointermove", (e) => {
			if (on && !pinned) {
				aim(e.clientX);
				run();
			}
		});
		list.addEventListener("pointerleave", () => !pinned && hide());
		list.addEventListener("focusout", (e) => !list.contains(e.relatedTarget) && hide());
		addEventListener(
			"scroll",
			() => {
				if (pinned) anchor(pinned);
				else if (on && !list.matches(":hover")) hide();
				else if (on) (aim(), run());
			},
			{ passive: true },
		);
	} else if (!FINE) {
		const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("reg", e.isIntersecting)), {
			rootMargin: "-38% 0px -38% 0px",
		});
		rows.forEach((r) => io.observe(r));
	}
}

{
	const el = $("#clock");
	const f = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Madrid",
		hour: "2-digit",
		minute: "2-digit",
	});
	const tick = () => {
		const d = new Date();
		el.textContent = f.format(d);
		el.dateTime = d.toISOString();
	};
	tick();
	setInterval(tick, 20000);
}

{
	// easter egg: Konami, typing "force" or holding the logo loads crawl.js
	const run = () =>
		import("./crawl.js").then(
			(m) => m.crawl({ RM, snd }),
			() => {},
		);
	const K = "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a";
	let keys = [];
	addEventListener("keydown", (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
		if ($("dialog[open]")) return;
		keys = [...keys, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-10);
		if (keys.join(" ") === K || keys.slice(-5).join("") === "force") ((keys = []), run());
	});
	const logo = $(".logo");
	let hold = 0,
		held = false,
		x0 = 0,
		y0 = 0;
	const end = () => (clearTimeout(hold), logo.classList.remove("hold"));
	logo.addEventListener("pointerdown", (e) => {
		if (e.button) return;
		held = false;
		x0 = e.clientX;
		y0 = e.clientY;
		logo.classList.add("hold");
		hold = setTimeout(() => (end(), (held = true), run()), 1200);
	});
	logo.addEventListener("pointermove", (e) => Math.hypot(e.clientX - x0, e.clientY - y0) > 12 && end());
	for (const ev of ["pointerup", "pointercancel", "pointerleave"]) logo.addEventListener(ev, end);
	logo.addEventListener("contextmenu", (e) => e.preventDefault());
	logo.addEventListener("click", (e) => held && (e.preventDefault(), e.stopImmediatePropagation(), (held = false)));
}

root.classList.add("m");
if (!root.classList.contains("gl")) document.fonts.ready.then(() => setTimeout(snd.invite, 1800));
addEventListener("load", () => root.classList.add("ld"), { once: true });
