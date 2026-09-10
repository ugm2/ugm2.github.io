/* ---------------------------------------------------------------------------
   Project dialogs and their carousels.

   Fixes carried over from the previous inline version:
   - the carousel was re-initialised on every open, so each visit added
     another autoplay interval, another pair of click listeners and another
     MutationObserver; reopening a project a few times made the slides race.
   - the dialog had no dialog semantics, did not take focus, did not trap it,
     and did not give it back on close, so keyboard and screen-reader users
     could tab straight into the page behind the overlay.
   - the tiles were <li onclick>, unreachable by keyboard entirely.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var FOCUSABLE =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // Shared name for the tile -> dialog view transition. Only ever set on one
  // element at a time: a duplicate name aborts the transition.
  var VT_NAME = "project-card";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var openDialog = null;
  var lastTrigger = null;

  function canTransition() {
    return (
      typeof document.startViewTransition === "function" &&
      !reduceMotion.matches
    );
  }

  /* --- carousel --------------------------------------------------------- */

  function initCarousel(root) {
    var slides = Array.prototype.slice.call(
      root.querySelectorAll(".carousel-slide"),
    );
    var status = root.querySelector(".carousel-status");
    var prev = root.querySelector(".prev");
    var next = root.querySelector(".next");
    if (slides.length < 2) {
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      if (status) status.hidden = true;
      return { start: function () {}, stop: function () {} };
    }

    var index = 0;
    var timer = null;

    function render() {
      slides.forEach(function (slide, i) {
        slide.classList.toggle("active", i === index);
      });
      if (status) status.textContent = index + 1 + " / " + slides.length;
    }

    function go(delta) {
      index = (index + delta + slides.length) % slides.length;
      render();
    }

    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (reduceMotion.matches) return;
      timer = setInterval(function () {
        go(1);
      }, 4500);
    }

    function manual(delta) {
      go(delta);
      start(); // reset the dwell time after a deliberate move
    }

    prev.addEventListener("click", function () {
      manual(-1);
    });
    next.addEventListener("click", function () {
      manual(1);
    });

    // Pause while the reader is looking at or interacting with it.
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    render();
    return { start: start, stop: stop };
  }

  var carousels = new Map();
  document.querySelectorAll(".project-modal").forEach(function (modal) {
    var el = modal.querySelector(".carousel");
    if (el) carousels.set(modal, initCarousel(el));
  });

  /* --- focus trap ------------------------------------------------------- */

  function trapFocus(e) {
    if (e.key !== "Tab" || !openDialog) return;
    var items = Array.prototype.slice
      .call(openDialog.querySelectorAll(FOCUSABLE))
      .filter(function (el) {
        return !el.hidden && el.offsetParent !== null;
      });
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (e.shiftKey && (active === first || !openDialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* --- open / close ----------------------------------------------------- */

  function show(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    openDialog = modal;
    var carousel = carousels.get(modal);
    if (carousel) carousel.start();
    var close = modal.querySelector(".close-modal");
    if (close) close.focus();
  }

  function hide(modal) {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    openDialog = null;
    var carousel = carousels.get(modal);
    if (carousel) carousel.stop();
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  function open(modal, trigger) {
    lastTrigger = trigger || null;
    var content = modal.querySelector(".modal-content");

    if (canTransition() && content && trigger) {
      trigger.style.viewTransitionName = VT_NAME;
      var t = document.startViewTransition(function () {
        trigger.style.viewTransitionName = "";
        content.style.viewTransitionName = VT_NAME;
        show(modal);
      });
      t.finished.finally(function () {
        content.style.viewTransitionName = "";
      });
    } else {
      show(modal);
    }
  }

  function close(modal) {
    var content = modal.querySelector(".modal-content");

    if (canTransition() && content) {
      content.style.viewTransitionName = VT_NAME;
      var back = lastTrigger;
      var t = document.startViewTransition(function () {
        content.style.viewTransitionName = "";
        if (back) back.style.viewTransitionName = VT_NAME;
        hide(modal);
      });
      t.finished.finally(function () {
        if (back) back.style.viewTransitionName = "";
      });
      return;
    }

    modal.classList.add("fade-out");
    setTimeout(function () {
      hide(modal);
      modal.classList.remove("fade-out");
    }, 250);
  }

  /* --- wiring ----------------------------------------------------------- */

  document.querySelectorAll("[data-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var modal = document.getElementById(trigger.getAttribute("data-modal"));
      if (modal) open(modal, trigger);
    });
  });

  document.querySelectorAll(".close-modal").forEach(function (button) {
    button.addEventListener("click", function () {
      var modal = button.closest(".project-modal");
      if (modal) close(modal);
    });
  });

  // Click on the backdrop, not the panel.
  document.querySelectorAll(".project-modal").forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close(modal);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!openDialog) return;
    if (e.key === "Escape") {
      close(openDialog);
      return;
    }
    trapFocus(e);
  });
})();
