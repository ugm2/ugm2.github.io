/* ---------------------------------------------------------------------------
   Page behaviours: scroll reveals, the hero particle field, the sticky nav,
   and the pointer-driven card treatments.

   Previously this ran on jQuery plus the HTML5 UP browser/breakpoints/util
   helpers — about 113 KB of script for a load handler and a smooth scroll.
   Smooth scrolling is now `scroll-behavior: smooth` in CSS and the rest is
   plain DOM, so no library is needed.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* --- preload flag ------------------------------------------------------ */

  window.addEventListener("load", function () {
    document.body.classList.remove("is-preload");
  });

  /* --- scroll reveals --------------------------------------------------- */

  var reveals = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || reduceMotion.matches) {
    reveals.forEach(function (el) {
      el.classList.add("active");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("active");
          // One-shot: nothing re-hides, so stop watching.
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -40px 0px" },
    );
    reveals.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* --- hero particle field ---------------------------------------------- */

  // The original drew connecting lines from inside each particle's update(),
  // looping over every particle for every particle: 100x100 distance checks
  // and up to 10,000 individual stroke() calls per frame, every frame,
  // forever — including while the hero was scrolled off screen. This walks
  // unique pairs only, batches them into one path, and stops when the hero
  // is not visible.
  (function heroCanvas() {
    var canvas = document.getElementById("canvas-bg");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var hero = canvas.closest(".hero") || canvas.parentElement;
    var LINK_DIST = 108;
    var particles = [];
    var frame = null;
    var visible = true;

    function particleCount() {
      // Roughly one particle per 12,000 css px², clamped, so a phone does not
      // pay for a desktop's worth of geometry. Density and link distance are
      // tuned together: sparse points with long links draw big ugly polygons
      // rather than a fine constellation.
      var area = canvas.width * canvas.height;
      return Math.max(34, Math.min(130, Math.round(area / 12000)));
    }

    function seed() {
      particles = [];
      for (var i = 0; i < particleCount(); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.42,
          r: Math.random() * 1.6 + 0.3,
          a: Math.random() * 0.45 + 0.2,
        });
      }
    }

    function resize() {
      var rect = hero.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      seed();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // links: one path, one stroke per distance bucket is overkill, so use a
      // single mid-opacity path — visually indistinguishable, far cheaper.
      ctx.beginPath();
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx = p.x - q.x;
          var dy = p.y - q.y;
          if (
            dx > LINK_DIST ||
            dx < -LINK_DIST ||
            dy > LINK_DIST ||
            dy < -LINK_DIST
          )
            continue;
          if (dx * dx + dy * dy > LINK_DIST * LINK_DIST) continue;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.strokeStyle = "rgba(47, 179, 179, 0.11)";
      ctx.stroke();

      for (var k = 0; k < particles.length; k++) {
        var s = particles[k];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(47, 179, 179, " + s.a + ")";
        ctx.fill();
      }
    }

    function step() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx = -p.vx;
        if (p.y < 0 || p.y > canvas.height) p.vy = -p.vy;
      }
      draw();
      frame = requestAnimationFrame(step);
    }

    function start() {
      if (frame === null) frame = requestAnimationFrame(step);
    }

    function stop() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    }

    resize();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (!visible || reduceMotion.matches) draw();
      }, 150);
    });

    if (reduceMotion.matches) {
      // Static field: the texture without the motion.
      draw();
      return;
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      }).observe(hero);
    } else {
      start();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (visible) start();
    });
  })();

  /* --- sticky section nav ------------------------------------------------ */

  (function sectionNav() {
    var nav = document.getElementById("site-nav");
    var hero = document.querySelector(".hero");
    if (!nav || !hero) return;

    if ("IntersectionObserver" in window) {
      // Show the bar once the hero is mostly out of the way.
      new IntersectionObserver(
        function (entries) {
          nav.classList.toggle("is-visible", !entries[0].isIntersecting);
        },
        { rootMargin: "-72px 0px 0px 0px", threshold: 0 },
      ).observe(hero);
    } else {
      nav.classList.add("is-visible");
    }

    // Scroll spy: mark the section currently occupying the upper viewport.
    var links = Array.prototype.slice.call(
      nav.querySelectorAll(".site-nav__links a"),
    );
    var sections = links
      .map(function (a) {
        return document.querySelector(a.getAttribute("href"));
      })
      .filter(Boolean);

    if (!sections.length || !("IntersectionObserver" in window)) return;

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            a.toggleAttribute(
              "aria-current",
              a.getAttribute("href") === "#" + entry.target.id,
            );
            if (a.getAttribute("href") === "#" + entry.target.id)
              a.setAttribute("aria-current", "true");
          });
        });
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  })();

  /* --- pointer treatments ----------------------------------------------- */

  // All of this is cosmetic and depends on a real pointer, so it is skipped
  // entirely on touch and when reduced motion is requested.
  if (!finePointer.matches || reduceMotion.matches) return;

  (function customCursor() {
    var cursor = document.getElementById("custom-cursor");
    if (!cursor) return;

    var mx = 0,
      my = 0,
      cx = 0,
      cy = 0,
      seen = false;

    document.addEventListener(
      "mousemove",
      function (e) {
        mx = e.clientX;
        my = e.clientY;
        if (!seen) {
          cx = mx;
          cy = my;
          seen = true;
        }
      },
      { passive: true },
    );

    (function follow() {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      cursor.style.transform =
        "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)";
      requestAnimationFrame(follow);
    })();

    document
      .querySelectorAll("a, button, [role='button']")
      .forEach(function (el) {
        el.addEventListener("mouseenter", function () {
          cursor.classList.add("hover");
        });
        el.addEventListener("mouseleave", function () {
          cursor.classList.remove("hover");
        });
      });
  })();

  // Card tilt plus the --mx/--my spotlight that lights the gradient borders.
  // The tilt is normalised to each element's own size and capped, so a
  // full-width band leans as gently as a small tile.
  (function cardTilt() {
    var MAX_TILT = 2.2;
    document
      .querySelectorAll(".grid-item, .skill-category, .timeline-content")
      .forEach(function (el) {
        el.addEventListener(
          "mousemove",
          function (e) {
            var rect = el.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            el.style.setProperty("--mx", x + "px");
            el.style.setProperty("--my", y + "px");
            var nx = (x - rect.width / 2) / (rect.width / 2);
            var ny = (y - rect.height / 2) / (rect.height / 2);
            el.style.transform =
              "perspective(1200px) rotateX(" +
              (-ny * MAX_TILT).toFixed(2) +
              "deg) rotateY(" +
              (nx * MAX_TILT).toFixed(2) +
              "deg)";
          },
          { passive: true },
        );
        el.addEventListener("mouseleave", function () {
          el.style.transform = "";
        });
      });
  })();

  (function magneticIcons() {
    document.querySelectorAll("#footer .icons a").forEach(function (el) {
      el.addEventListener(
        "mousemove",
        function (e) {
          var rect = el.getBoundingClientRect();
          var x = e.clientX - rect.left - rect.width / 2;
          var y = e.clientY - rect.top - rect.height / 2;
          el.style.transform =
            "translate(" + x * 0.28 + "px," + y * 0.28 + "px)";
        },
        { passive: true },
      );
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  })();
})();
