/* soda-docs motion layer — scroll-reveal via IntersectionObserver.
 * Respects prefers-reduced-motion; re-initializes on Material's instant
 * navigation (document$). Reveal classes are removed after the transition
 * ends so component hover transitions return to their own (faster) timing. */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function reveal(el) {
    el.classList.add("in-view");
    el.addEventListener(
      "transitionend",
      function () {
        el.classList.remove("will-reveal", "in-view");
      },
      { once: true }
    );
  }

  function init() {
    if (reduced.matches || !("IntersectionObserver" in window)) return;
    var els = document.querySelectorAll(
      [
        ".md-typeset .grid.cards > ul > li",
        ".soda-stats > div",
        ".soda-group",
        ".soda-feature",
        ".soda-safety",
        ".md-typeset .admonition",
        ".md-typeset h2",
      ].join(", ")
    );
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    els.forEach(function (el) {
      el.classList.add("will-reveal");
      io.observe(el);
    });
  }

  if (window.document$ && window.document$.subscribe) {
    window.document$.subscribe(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
