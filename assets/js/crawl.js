// the opening crawl: a riso-printed easter egg, built (DOM, CSS, sound) only when someone finds it
const CSS = `
.crawl{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;
background:oklch(.19 .04 168);color:var(--yellow);overscroll-behavior:contain;animation:cr-in .6s both;user-select:none}
.crawl.out{animation:cr-in .4s reverse both}
@keyframes cr-in{from{opacity:0}}
.cr-sky{position:absolute;left:-10%;top:-10%;width:125%;height:125%;animation:cr-sky 90s linear infinite alternate}
@keyframes cr-sky{to{transform:translate(-6%,-4%)}}
.cr-skip{position:absolute;z-index:3;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));min-height:44px;
padding:0 16px;border:1.5px dashed;border-radius:999px;background:none;color:inherit;font:600 .8125rem var(--hand);letter-spacing:.08em;cursor:pointer}
.cr-stage,.cr-intro,.cr-logo,.cr-crawl{position:absolute;inset:0;margin:0}
.cr-intro,.cr-logo{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;opacity:0}
.cr-intro{padding:0 max(24px,8vw);font:italic 500 clamp(1.15rem,.9rem + 1.6vw,2rem)/1.45 var(--serif);color:var(--pink);text-wrap:balance;
animation:cr-fade 4.6s .9s both}
.cr-intro span,.cr-ep{font:700 .75em/1.6 var(--hand);letter-spacing:.1em}
@keyframes cr-fade{18%,80%{opacity:1}}
.cr-logo,.cr-text h2{font:900 clamp(3.4rem,17vw,11rem)/.82 var(--serif-d);letter-spacing:.02em;text-shadow:.045em .035em 0 var(--pink)}
.cr-logo,.cr-crawl h2,.cr-end h2,.cr-n{font-variation-settings:"SOFT" 100,"WONK" 1}
.cr-logo{animation:cr-away 7s 5.8s cubic-bezier(.3,0,.85,.5) both}
@keyframes cr-away{0%{transform:scale(1.5)}4%,85%{opacity:1}100%{transform:scale(.03)}}
.cr-crawl{perspective:460px;perspective-origin:50% 22%;-webkit-mask:linear-gradient(#0000 18%,#000 52%);mask:linear-gradient(#0000 18%,#000 52%)}
.cr-plane{position:absolute;left:50%;bottom:0;width:min(86vw,42rem);margin-left:max(-43vw,-21rem);height:var(--dist);
transform-origin:50% 100%;transform:rotateX(32deg);overflow:hidden}
.cr-text{position:absolute;left:0;right:0;top:100%;font:600 clamp(1.1rem,.75rem + 1.9vw,2.5rem)/1.38 var(--serif);
font-variation-settings:"opsz" 18,"WONK" 0;text-align:justify;hyphens:auto;animation:cr-roll var(--dur) 9.4s linear both}
@keyframes cr-roll{to{transform:translateY(calc(-1 * var(--dist)))}}
.cr-text p{margin:0 0 1.1em}
.cr-text .cr-ep,.cr-text h2{margin:0;text-align:center}
.cr-text h2{margin:.1em 0 1em;font-size:1.45em;line-height:1.08}
.cr-end{position:absolute;z-index:2;left:50%;top:50%;width:min(88vw,34rem);translate:-50% -50%;padding:clamp(26px,4vw,44px) clamp(20px,3vw,36px);
border:2px solid var(--ink);border-radius:18px;background:var(--grain),var(--paper);color:var(--ink);text-align:center;
box-shadow:9px 8px 0 var(--pink);animation:cr-stamp .5s var(--spring) both;user-select:text;outline:0}
.cr-end[hidden]{display:none}
@keyframes cr-stamp{from{scale:1.3;rotate:-6deg;opacity:0}}
.cr-end h2{margin:0 0 24px;font:700 clamp(1.8rem,1.2rem + 2.6vw,3.2rem)/1.05 var(--serif-d);text-wrap:balance}
.cr-end h2 i{color:var(--pink)}
.cr-b{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.cr-stage{transition:opacity .7s,visibility 0s .7s}
.crawl.done .cr-stage{opacity:0;visibility:hidden}
.crawl.still{overflow-y:auto;animation:none}
.crawl.still .cr-sky{animation:none}
.crawl.still .cr-end{position:relative;top:0;translate:-50% 0;width:min(90vw,38rem);margin:max(64px,calc(env(safe-area-inset-top) + 58px)) 0 32px;animation:none}
.cr-still{margin:0 0 22px;text-align:left}
.cr-still>*{margin:0 0 10px;font:500 clamp(.98rem,.9rem + .3vw,1.12rem)/1.5 var(--serif)}
.cr-still .cr-il{color:var(--pink);font-style:italic}
.cr-still .cr-n{font:900 2.4rem/.9 var(--serif-d);text-shadow:.045em .035em 0 var(--pink)}
.cr-still .cr-ep{margin:18px 0 2px;font-size:.75rem}
.cr-still h3{font:800 1.25rem/1.1 var(--serif-d)}
.crawl-on{overflow:hidden}
`;

const INTRO = ["A long time ago, in a galaxy far, far away…", "(well, Alicante, 2018)"];
const EP = "EPISODE VI";
const TITLE = "THE RETURN OF THE EVALS";
const CRAWL = [
	"It is a period of production chaos. Demos have been winning battles, but losing the war against real users.",
	"From a quiet base in Alicante, one engineer has spent every year since 2018 shipping AI that holds: retrieval that actually retrieves, three US patent filings, and a road of five companies.",
	"Now, at Inulti, he builds an LLM retention platform where guardrails guard every message, humans stay in the loop, and evals gate every change…",
];

// a halftone night: each star a little cluster of dots on the plate's 3 px grid
function sky(cv) {
	const k = Math.min(2, devicePixelRatio || 1),
		w = innerWidth * 1.25,
		h = innerHeight * 1.25;
	cv.width = w * k;
	cv.height = h * k;
	const g = cv.getContext("2d");
	g.scale(k, k);
	let seed = 20180704;
	const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
	for (let i = (w * h) / 4200; i-- > 0; ) {
		const x = Math.round((rnd() * w) / 3) * 3,
			y = Math.round((rnd() * h) / 3) * 3,
			r = 0.5 + rnd() ** 4 * 5;
		g.fillStyle = rnd() < 0.07 ? "#ff48b0" : "#ffe800";
		g.globalAlpha = 0.45 + rnd() * 0.55;
		for (let dx = -3 * Math.floor(r / 1.5); dx <= 2 * r; dx += 3)
			for (let dy = -3 * Math.floor(r / 1.5); dy <= 2 * r; dy += 3) {
				const d = Math.hypot(dx, dy) / (2 * r);
				if (d < 1) (g.beginPath(), g.arc(x + dx, y + dy, Math.min(1.5, r * 0.8) * (1 - d) ** 1.4, 0, 7), g.fill());
			}
	}
}

// an original drone (filtered noise + a sub sine) that swells once under the title: no tune, no theme
function rumble({ ac, out, buf }) {
	const t = ac.currentTime,
		src = new AudioBufferSourceNode(ac, { buffer: buf, loop: true }),
		lp = new BiquadFilterNode(ac, { frequency: 70, Q: 0.9 }),
		o = new OscillatorNode(ac, { frequency: 34 }),
		g = new GainNode(ac, { gain: 0.0001 });
	for (const [p, v] of [
		[lp.frequency, 70],
		[o.frequency, 34],
		[g.gain, 0.0001],
	])
		p.setValueAtTime(v, t);
	lp.frequency.linearRampToValueAtTime(160, t + 5);
	lp.frequency.linearRampToValueAtTime(90, t + 12);
	o.frequency.linearRampToValueAtTime(46, t + 6);
	g.gain.linearRampToValueAtTime(0.9, t + 4);
	g.gain.exponentialRampToValueAtTime(0.28, t + 11);
	src.connect(lp).connect(g).connect(out);
	o.connect(new GainNode(ac, { gain: 0.35 })).connect(g);
	src.start();
	o.start();
	return () => {
		const n = ac.currentTime;
		g.gain.cancelScheduledValues(n);
		g.gain.setTargetAtTime(0.0001, n, 0.25);
		src.stop(n + 1.2);
		o.stop(n + 1.2);
	};
}

let open = false;

export function crawl({ RM, snd }) {
	if (open || !window.HTMLDialogElement) return;
	open = true;
	if (!document.getElementById("cr-css"))
		document.head.append(Object.assign(document.createElement("style"), { id: "cr-css", textContent: CSS }));
	const back = document.activeElement;
	const d = document.createElement("dialog");
	d.className = "crawl" + (RM ? " still" : "");
	d.setAttribute("aria-label", "Episode VI: The Return of the Evals");
	const para = CRAWL.map((p) => `<p>${p}</p>`).join("");
	const end = `<h2>May the evals be with <i>you</i>.</h2>
		<div class="cr-b"><a class="pill btn-k" href="#contact"><span>Say hi</span></a><button class="pill" type="button" data-x><span>Back to the site</span></button></div>`;
	d.innerHTML = RM
		? `<canvas class="cr-sky" aria-hidden="true"></canvas>
		<div class="cr-end"><div class="cr-still">
			<p class="cr-il">${INTRO.join(" ")}</p>
			<p class="cr-n">UNAI<br />GARAY</p>
			<p class="cr-ep">${EP}</p><h3>${TITLE}</h3>${para}
		</div>${end}</div>`
		: `<canvas class="cr-sky" aria-hidden="true"></canvas>
		<button class="cr-skip" type="button">Skip · Esc</button>
		<div class="cr-stage">
			<p class="cr-intro">${INTRO[0]} <span>${INTRO[1]}</span></p>
			<p class="cr-logo"><span>UNAI</span> <span>GARAY</span></p>
			<div class="cr-crawl"><div class="cr-plane"><div class="cr-text"><p class="cr-ep">${EP}</p><h2>${TITLE}</h2>${para}</div></div></div>
		</div>
		<div class="cr-end" hidden>${end}</div>`;
	document.body.append(d);
	document.documentElement.classList.add("crawl-on");
	sky(d.querySelector(".cr-sky"));
	const card = d.querySelector(".cr-end");
	const timers = [];
	let stop = null,
		done = RM;

	const finish = () => {
		if (done) return;
		done = true;
		timers.forEach(clearTimeout);
		stop?.();
		stop = null;
		d.classList.add("done");
		d.querySelector(".cr-skip").hidden = true;
		card.hidden = false;
		snd.play("paper");
		card.querySelector("a").focus();
	};
	const close = (restore = true) => {
		if (!open) return;
		open = false;
		timers.forEach(clearTimeout);
		stop?.();
		d.classList.add("out");
		document.documentElement.classList.remove("crawl-on");
		setTimeout(() => d.remove(), 400);
		d.close();
		if (restore && back?.isConnected) back.focus({ preventScroll: true });
	};
	d.addEventListener("cancel", (e) => (e.preventDefault(), close()));
	d.addEventListener("click", (e) => {
		if (e.target.closest("[data-x]")) close();
		else if (e.target.closest('a[href="#contact"]')) close(false);
		else if (e.target.closest(".cr-skip")) finish();
	});

	if (!RM) {
		// any tap, click, scroll or key skips straight to the end card
		d.addEventListener("pointerdown", (e) => !e.target.closest("button, a") && finish());
		for (const ev of ["wheel", "touchmove"])
			d.addEventListener(ev, (e) => (e.preventDefault(), finish()), { passive: false });
		d.addEventListener("keydown", (e) => {
			if (done || ["Tab", "Shift", "Escape", "Enter", " "].includes(e.key)) return;
			e.preventDefault();
			finish();
		});
		const text = d.querySelector(".cr-text");
		const dist = text.offsetHeight + innerHeight * 2.6;
		const dur = Math.min(34, Math.max(24, dist / 120));
		const cc = d.querySelector(".cr-crawl");
		cc.style.setProperty("--dist", `${Math.round(dist)}px`);
		cc.style.setProperty("--dur", `${dur.toFixed(1)}s`);
		// the end card comes up once the last paragraph has sailed into the distance
		const last = text.lastElementChild;
		const watch = () => {
			if (last.getBoundingClientRect().bottom < innerHeight * 0.3) finish();
			else timers.push(setTimeout(watch, 300));
		};
		timers.push(setTimeout(watch, 14000), setTimeout(finish, (9.4 + dur) * 1000));
		// soft paper ticks as each paragraph comes up the page
		[0, 1, 2, 3].forEach((i) => timers.push(setTimeout(() => snd.play("tick"), (9.6 + i * dur * 0.16) * 1000)));
		timers.push(
			setTimeout(
				() =>
					snd.audio()?.then((a) => {
						if (open && a && !done) stop = rumble(a);
					}),
				5600,
			),
		);
	}
	d.showModal();
	// the printed card starts at its top, not scrolled to its first button
	if (RM) (card.setAttribute("tabindex", "-1"), card.focus({ preventScroll: true }), (d.scrollTop = 0));
}
