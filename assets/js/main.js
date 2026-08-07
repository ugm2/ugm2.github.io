/*
	Photon by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function ($) {

	var $window = $(window),
		$body = $('body');

	// Breakpoints.
	breakpoints({
		xlarge: ['1141px', '1680px'],
		large: ['981px', '1140px'],
		medium: ['737px', '980px'],
		small: ['481px', '736px'],
		xsmall: ['321px', '480px'],
		xxsmall: [null, '320px']
	});

	// Play initial animations on page load.
	$window.on('load', function () {
		window.setTimeout(function () {
			$body.removeClass('is-preload');
		}, 100);
	});

	// Scrolly.
	$('.scrolly').scrolly();

	// Particle Background.
	const canvas = document.getElementById('canvas-bg');
	if (canvas) {
		const ctx = canvas.getContext('2d');
		let particles = [];
		const particleCount = 100;

		class Particle {
			constructor() {
				this.init();
			}

			init() {
				this.x = Math.random() * canvas.width;
				this.y = Math.random() * canvas.height;
				this.vx = (Math.random() - 0.5) * 0.5;
				this.vy = (Math.random() - 0.5) * 0.5;
				this.radius = Math.random() * 2;
				this.alpha = Math.random() * 0.5 + 0.2;
			}

			draw() {
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(47, 179, 179, ${this.alpha})`;
				ctx.fill();
			}

			update() {
				this.x += this.vx;
				this.y += this.vy;

				if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
				if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

				// Draw lines between nearby particles
				particles.forEach(p => {
					const dx = this.x - p.x;
					const dy = this.y - p.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < 100) {
						ctx.beginPath();
						ctx.moveTo(this.x, this.y);
						ctx.lineTo(p.x, p.y);
						ctx.strokeStyle = `rgba(47, 179, 179, ${0.2 * (1 - dist / 100)})`;
						ctx.stroke();
					}
				});
			}
		}

		function resizeCanvas() {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			particles = [];
			for (let i = 0; i < particleCount; i++) {
				particles.push(new Particle());
			}
		}

		function animate() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			particles.forEach(p => {
				p.update();
				p.draw();
			});
			requestAnimationFrame(animate);
		}

		window.addEventListener('resize', resizeCanvas);
		resizeCanvas();
		animate();
	}

	// Reveal Observer.
	const revealElements = document.querySelectorAll('.reveal');
	const observerOptions = {
		threshold: 0.15,
		rootMargin: '0px 0px -50px 0px'
	};

	const revealObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('active');
			}
		});
	}, observerOptions);

	revealElements.forEach(el => revealObserver.observe(el));

	// Custom Cursor & Micro-interactions
	const cursor = document.getElementById('custom-cursor');
	let mouseX = 0, mouseY = 0;
	let cursorX = 0, cursorY = 0;

	document.addEventListener('mousemove', (e) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
	});

	function animateCursor() {
		let dx = mouseX - cursorX;
		let dy = mouseY - cursorY;
		cursorX += dx * 0.15;
		cursorY += dy * 0.15;
		if (cursor) {
			cursor.style.left = cursorX + 'px';
			cursor.style.top = cursorY + 'px';
		}
		requestAnimationFrame(animateCursor);
	}
	animateCursor();

	// Cursor Hover States
	const hoverElements = document.querySelectorAll('a, button, .grid-item, .skill-category, .timeline-content');
	hoverElements.forEach(el => {
		el.addEventListener('mouseenter', () => { if (cursor) cursor.classList.add('hover'); });
		el.addEventListener('mouseleave', () => { if (cursor) cursor.classList.remove('hover'); });
	});

	// 3D Tilt Effect + cursor spotlight (--mx/--my drive the gradient borders).
	// The tilt is normalised to the element's own size and capped, so a
	// full-width skills band leans as gently as a small project tile; a fixed
	// divisor made wide elements swing several times further.
	const MAX_TILT = 3.5; // degrees at the very edge
	const tiltElements = document.querySelectorAll('.grid-item, .skill-category, .timeline-content');
	tiltElements.forEach(el => {
		el.addEventListener('mousemove', (e) => {
			const rect = el.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			el.style.setProperty('--mx', x + 'px');
			el.style.setProperty('--my', y + 'px');
			const nx = (x - rect.width / 2) / (rect.width / 2);
			const ny = (y - rect.height / 2) / (rect.height / 2);
			el.style.transform = `perspective(1200px) rotateX(${(-ny * MAX_TILT).toFixed(2)}deg) rotateY(${(nx * MAX_TILT).toFixed(2)}deg) scale(1.01)`;
			el.style.zIndex = "10";
		});
		el.addEventListener('mouseleave', () => {
			el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)';
			el.style.zIndex = "";
		});
	});

	// Skill Tag Marquee.
	// Each copy is padded out wider than the visible band, so the same tag is
	// never on screen twice; the track holds two copies, so translateX(-50%)
	// advances exactly one copy and loops seamlessly.
	const MARQUEE_SPEED = 22; // px per second - a drift, not a scroll
	const COPY_SLACK = 1.18;  // copy width relative to the band

	document.querySelectorAll('.skill-tags').forEach(band => {
		const tags = Array.from(band.children);
		if (!tags.length) return;

		const track = document.createElement('div');
		track.className = 'marquee-track';

		const copy = document.createElement('div');
		copy.className = 'marquee-copy';
		tags.forEach(tag => copy.appendChild(tag));
		track.appendChild(copy);
		band.appendChild(track);
		band.classList.add('is-marquee');

		const period = Math.max(copy.scrollWidth, Math.round(band.clientWidth * COPY_SLACK));
		copy.style.width = period + 'px';

		const trailing = copy.cloneNode(true);
		trailing.setAttribute('aria-hidden', 'true');
		track.appendChild(trailing);

		track.style.animationDuration = (period / MARQUEE_SPEED) + 's';
	});

	// Magnetic Buttons
	const magneticElements = document.querySelectorAll('#footer .icons a');
	magneticElements.forEach(el => {
		el.addEventListener('mousemove', (e) => {
			const rect = el.getBoundingClientRect();
			const x = e.clientX - rect.left - rect.width / 2;
			const y = e.clientY - rect.top - rect.height / 2;
			el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
		});
		el.addEventListener('mouseleave', () => {
			el.style.transform = '';
		});
	});

})(jQuery);